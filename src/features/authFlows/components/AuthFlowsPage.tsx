import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Chip,
    IconButton,
    Tooltip,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material'
import { Add, Delete, Edit, Star, StarBorder } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { PageTransition } from '@components/animations'
import { OperationContextBanner } from '@components/OperationContextBanner'
import { AuthFlowBuilder } from './AuthFlowBuilder'
import { TYPES } from '@core/di/types'
import { useService } from '@app/providers'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useActiveTenant } from '@features/tenants/context/ActiveTenantContext'
import { useAuthMethods } from '@features/authFlows/hooks/useAuthMethods'
import {
    OPERATION_TYPE_OPTIONS,
    getOperationTypeLabel,
    type OperationType,
    type AuthFlowStep,
} from '@domain/models/AuthMethod'
import type { AuthFlowRepository, AuthFlowResponse, CreateAuthFlowCommand, AuthFlowDefaultImpact } from '@core/repositories/AuthFlowRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import { formatApiError } from '@utils/formatApiError'
import { useTranslation } from 'react-i18next'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

/** i18n translation keys for each auth method (for the default-impact warning). */
const METHOD_LABEL_KEYS: Record<string, string> = {
    FACE: 'methods.face',
    FINGERPRINT: 'methods.fingerprint',
    VOICE: 'methods.voice',
    TOTP: 'methods.totp',
    EMAIL_OTP: 'methods.emailOtp',
    SMS_OTP: 'methods.smsOtp',
    QR_CODE: 'methods.qrCode',
    HARDWARE_KEY: 'methods.hardwareKey',
    NFC_DOCUMENT: 'methods.nfcDocument',
}

export default function AuthFlowsPage() {
    const authFlowRepo = useService<AuthFlowRepository>(TYPES.AuthFlowRepository)
    const logger = useService<ILogger>(TYPES.Logger)
    const { user } = useAuth()
    const { activeTenantId } = useActiveTenant()
    const { authMethods, warning: authMethodWarning } = useAuthMethods()
    const { t } = useTranslation()

    const [flows, setFlows] = useState<AuthFlowResponse[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showBuilder, setShowBuilder] = useState(false)
    const [filterType, setFilterType] = useState<string>('')

    // Edit state
    const [editingFlow, setEditingFlow] = useState<AuthFlowResponse | null>(null)

    // Delete confirmation state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingFlowId, setDeletingFlowId] = useState<string | null>(null)
    const [deletingFlowName, setDeletingFlowName] = useState<string>('')

    // Set-default confirmation state
    const [setDefaultDialogOpen, setSetDefaultDialogOpen] = useState(false)
    const [setDefaultTarget, setSetDefaultTarget] = useState<AuthFlowResponse | null>(null)
    const [setDefaultInFlight, setSetDefaultInFlight] = useState(false)
    const [success, setSuccess] = useState<string | null>(null)

    // Advisory lock-out impact for the flow being promoted to default.
    const [defaultImpact, setDefaultImpact] = useState<AuthFlowDefaultImpact | null>(null)
    const [defaultImpactLoading, setDefaultImpactLoading] = useState(false)

    // Copilot post-merge round 5: keep a ref to the auto-clear timer so
    // unmount / replacement cancels it, preventing setState-on-unmounted
    // warnings.
    const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => {
        return () => {
            if (successTimerRef.current !== null) {
                clearTimeout(successTimerRef.current)
                successTimerRef.current = null
            }
        }
    }, [])

    // Use the ACTIVE (switched) tenant for the path so it matches the X-Tenant-ID
    // header the AxiosClient sends. Otherwise a SUPER_ADMIN who switched tenants
    // would request /tenants/{home}/auth-flows while the Hibernate tenantFilter
    // (driven by X-Tenant-ID = active) scopes to the active tenant → empty list.
    // Also fixes the latent bug where this page ignored the tenant switcher.
    const tenantId = activeTenantId ?? user?.tenantId ?? ''

    const loadFlows = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await authFlowRepo.listFlows(tenantId, filterType || undefined)
            setFlows(data)
        } catch (err) {
            logger.error('Failed to load auth flows', err)
            // P1-FE-5: surface backend reason (e.g. 403, 502) over generic copy.
            setError(formatApiError(err, t) || t('authFlows.failedToLoad'))
        } finally {
            setLoading(false)
        }
    }, [authFlowRepo, logger, tenantId, filterType, t])

    useEffect(() => {
        loadFlows()
    }, [loadFlows])


    const handleSave = async (data: {
        name: string
        description: string
        operationType: OperationType
        isDefault: boolean
        steps: AuthFlowStep[]
    }) => {
        try {
            const command: CreateAuthFlowCommand = {
                name: data.name,
                description: data.description,
                operationType: data.operationType,
                isDefault: data.isDefault,
                steps: data.steps.map((s) => ({
                    authMethodType: s.methodType.toUpperCase(),
                    stepOrder: s.order,
                    isRequired: s.isRequired,
                    timeoutSeconds: s.timeout,
                    maxAttempts: s.maxAttempts,
                    allowsDelegation: false,
                    // CHOICE + usernameless (E): persist only when set so legacy
                    // single-method strict steps keep the same payload shape.
                    ...(s.alternativeMethodTypes && s.alternativeMethodTypes.length > 0
                        ? { alternativeMethodTypes: s.alternativeMethodTypes.map((m) => m.toUpperCase()) }
                        : {}),
                    ...(s.usernameless ? { usernameless: true } : {}),
                })),
            }

            if (editingFlow) {
                // Step edits require recreation: the backend UpdateAuthFlowCommand only
                // supports name/description/isDefault/isActive — not step changes.
                //
                // SAFETY (was a data-loss bug): the old order deleted the flow FIRST, then
                // created the replacement. A failed create then left the tenant with the
                // flow gone — and if it was the default, EVERY login broke ("No default auth
                // flow"). We now create the replacement FIRST, then delete the old one.
                //
                // Two coexistence hazards while both rows exist: (a) a duplicate-name 409,
                // and (b) two rows is_default=true at once (createFlow does NOT dethrone the
                // existing default). So we create under a temporary name as non-default,
                // delete the old flow, then rename back and (re)apply the default flag via
                // updateFlow — which atomically dethrones any other default.
                const wantDefault = command.isDefault === true
                // Temp name avoids a duplicate-name 409 while BOTH rows briefly coexist.
                const replacement = await authFlowRepo.createFlow(tenantId, {
                    ...command,
                    name: `${command.name} (updating…)`,
                    isDefault: false,
                })
                // If deleting the old flow fails, roll back the just-created replacement so
                // we never strand a "(updating…)"-named orphan (and never leave it default).
                try {
                    await authFlowRepo.deleteFlow(tenantId, editingFlow.id)
                } catch (delErr) {
                    await authFlowRepo.deleteFlow(tenantId, replacement.id).catch(() => {})
                    throw delErr
                }
                // The old row is gone, so the real name is free. Rename FIRST (low risk), then
                // claim default SEPARATELY: a failed default-claim (uq_auth_flow_default) must
                // not leave the temporary name persisted — that was the stuck "(updating…)" bug.
                await authFlowRepo.updateFlow(tenantId, replacement.id, {
                    name: command.name,
                    isActive: true,
                })
                if (wantDefault) {
                    await authFlowRepo.updateFlow(tenantId, replacement.id, {
                        isDefault: true,
                    })
                }
                setEditingFlow(null)
            } else {
                await authFlowRepo.createFlow(tenantId, command)
            }

            setShowBuilder(false)
            await loadFlows()
        } catch (err) {
            logger.error('Failed to save auth flow', err)
            // P1-FE-5: surface 409 ("flow with same name exists") and 400
            // ("invalid step config") instead of generic "Failed to save".
            setError(formatApiError(err, t) || t('authFlows.failedToSave'))
        }
    }

    const handleEditClick = (flow: AuthFlowResponse) => {
        setEditingFlow(flow)
        setShowBuilder(true)
    }

    const handleBuilderClose = () => {
        setShowBuilder(false)
        setEditingFlow(null)
    }

    const handleDeleteClick = (flowId: string, flowName: string) => {
        setDeletingFlowId(flowId)
        setDeletingFlowName(flowName)
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!deletingFlowId) return
        try {
            await authFlowRepo.deleteFlow(tenantId, deletingFlowId)
            await loadFlows()
        } catch (err) {
            logger.error('Failed to delete auth flow', err)
            // P1-FE-5: surface 409 ("flow in use by N users") instead of generic.
            setError(formatApiError(err, t) || t('authFlows.failedToDelete'))
        }
        setDeleteDialogOpen(false)
        setDeletingFlowId(null)
        setDeletingFlowName('')
    }

    const handleDeleteCancel = () => {
        setDeleteDialogOpen(false)
        setDeletingFlowId(null)
        setDeletingFlowName('')
    }

    const handleSetDefaultClick = async (flow: AuthFlowResponse) => {
        if (flow.isDefault) return
        setSetDefaultTarget(flow)
        setDefaultImpact(null)
        setSetDefaultDialogOpen(true)

        // Advisory only: fetch the lock-out impact to warn the admin. On any
        // failure we degrade gracefully and show the plain confirm dialog.
        setDefaultImpactLoading(true)
        try {
            const impact = await authFlowRepo.getDefaultImpact(tenantId, flow.id)
            setDefaultImpact(impact)
        } catch (err) {
            logger.warn('Failed to load default-impact (advisory)', err)
            setDefaultImpact(null)
        } finally {
            setDefaultImpactLoading(false)
        }
    }

    const handleSetDefaultConfirm = async () => {
        if (!setDefaultTarget) return
        setSetDefaultInFlight(true)
        try {
            await authFlowRepo.updateFlow(tenantId, setDefaultTarget.id, { isDefault: true })
            setSuccess(t('authFlows.setDefaultSuccess'))
            // Clear any in-flight auto-clear before scheduling a new one.
            if (successTimerRef.current !== null) {
                clearTimeout(successTimerRef.current)
            }
            successTimerRef.current = setTimeout(() => {
                setSuccess(null)
                successTimerRef.current = null
            }, 4000)
            setSetDefaultDialogOpen(false)
            setSetDefaultTarget(null)
            setDefaultImpact(null)
            await loadFlows()
        } catch (err) {
            logger.error('Failed to set default auth flow', err)
            // P1-FE-5: surface backend reason on set-default failure.
            setError(formatApiError(err, t) || t('authFlows.failedToSetDefault'))
        } finally {
            setSetDefaultInFlight(false)
        }
    }

    const handleSetDefaultCancel = () => {
        setSetDefaultDialogOpen(false)
        setSetDefaultTarget(null)
        setDefaultImpact(null)
    }

    // Convert AuthFlowResponse steps to AuthFlowStep[] for the builder
    const getBuilderInitialSteps = (): AuthFlowStep[] => {
        if (!editingFlow?.steps) return []
        return editingFlow.steps.map((s, i) => ({
            id: `step-${i}-${Date.now()}`,
            order: s.stepOrder,
            methodId: s.authMethodType,
            methodType: s.authMethodType as unknown as AuthFlowStep['methodType'],
            isRequired: s.isRequired,
            timeout: s.timeoutSeconds ?? 120,
            maxAttempts: s.maxAttempts ?? 3,
            // Hydrate CHOICE alternatives + usernameless flag (E) when present.
            alternativeMethodTypes: (s.alternativeMethodTypes ?? []) as unknown as AuthFlowStep['alternativeMethodTypes'],
            usernameless: s.usernameless ?? false,
        }))
    }

    return (
        <PageTransition>
            <Box>
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: easeOut }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Box>
                            <Typography variant="h4" fontWeight={700}>
                                {t('authFlows.title')}
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                {t('authFlows.subtitle')}
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={() => { setEditingFlow(null); setShowBuilder(true) }}
                            sx={{
                                py: 1.2,
                                px: 3,
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            }}
                        >
                            {t('authFlows.createFlow')}
                        </Button>
                    </Box>
                </motion.div>

                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}
                {authMethodWarning && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        {authMethodWarning}
                    </Alert>
                )}

                {/* Filter */}
                <Box sx={{ mb: 3 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>{t('authFlows.filterByOperation')}</InputLabel>
                        <Select
                            value={filterType}
                            label={t('authFlows.filterByOperation')}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <MenuItem value="">{t('authFlows.allOperations')}</MenuItem>
                            {OPERATION_TYPE_OPTIONS.map((operationType) => (
                                <MenuItem key={operationType.value} value={operationType.value}>
                                    {operationType.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {/* Flows Table */}
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : flows.length === 0 ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 6 }}>
                            <Typography variant="h6" color="text.secondary">
                                {t('authFlows.noFlows')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {t('authFlows.noFlowsHint')}
                            </Typography>
                            <Button variant="outlined" startIcon={<Add />} onClick={() => setShowBuilder(true)}>
                                {t('authFlows.createFlow')}
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('common.name')}</TableCell>
                                    <TableCell>{t('authFlows.operationType')}</TableCell>
                                    <TableCell>{t('authFlows.stepsHeader')}</TableCell>
                                    <TableCell>{t('common.status')}</TableCell>
                                    <TableCell>{t('common.default')}</TableCell>
                                    <TableCell align="right">{t('common.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {flows.map((flow) => (
                                    <TableRow key={flow.id} hover>
                                        <TableCell>
                                            <Typography variant="subtitle2" fontWeight={600}>{flow.name}</Typography>
                                            {flow.description && (
                                                <Typography variant="caption" color="text.secondary">
                                                    {flow.description}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={getOperationTypeLabel(flow.operationType)} size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={`${flow.steps?.length ?? 0} ${t('common.steps')}`} size="small" />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={flow.isActive ? t('common.active') : t('common.inactive')}
                                                size="small"
                                                color={flow.isActive ? 'success' : 'default'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {flow.isDefault && <Chip label={t('common.default')} size="small" color="primary" />}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title={flow.isDefault ? t('authFlows.alreadyDefault') : t('authFlows.setAsDefault')}>
                                                {/* span keeps Tooltip alive even when the IconButton is disabled */}
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleSetDefaultClick(flow)}
                                                        disabled={flow.isDefault}
                                                        sx={{ color: flow.isDefault ? 'warning.main' : 'text.secondary', mr: 0.5 }}
                                                        aria-label={
                                                            flow.isDefault
                                                                ? t('authFlows.alreadyDefault')
                                                                : t('authFlows.setAsDefault')
                                                        }
                                                    >
                                                        {flow.isDefault ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title={t('authFlows.editFlowAction')}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleEditClick(flow)}
                                                    sx={{ color: 'primary.main', mr: 0.5 }}
                                                    aria-label={t('authFlows.editFlowAction')}
                                                >
                                                    <Edit fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={t('authFlows.deleteFlowAction')}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDeleteClick(flow.id, flow.name)}
                                                    sx={{ color: 'error.main' }}
                                                    aria-label={t('authFlows.deleteFlowAction')}
                                                >
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* Builder Dialog (Create or Edit) */}
                <Dialog
                    open={showBuilder}
                    onClose={handleBuilderClose}
                    maxWidth="lg"
                    fullWidth
                    aria-labelledby="auth-flow-builder-dialog-title"
                >
                    <DialogTitle id="auth-flow-builder-dialog-title">
                        {editingFlow ? t('authFlows.editFlow') : t('authFlows.createFlowTitle')}
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ pt: 1 }}>
                            {!editingFlow && (
                                <OperationContextBanner i18nKey="operationContext.createAuthFlow" />
                            )}
                            <AuthFlowBuilder
                                key={editingFlow?.id ?? 'new'}
                                onSave={handleSave}
                                authMethods={authMethods}
                                initialSteps={editingFlow ? getBuilderInitialSteps() : undefined}
                                initialName={editingFlow?.name}
                                initialDescription={editingFlow?.description}
                                initialOperationType={editingFlow?.operationType}
                                initialIsDefault={editingFlow?.isDefault}
                            />
                        </Box>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <Dialog
                    open={deleteDialogOpen}
                    onClose={handleDeleteCancel}
                    aria-labelledby="delete-flow-dialog-title"
                >
                    <DialogTitle id="delete-flow-dialog-title">{t('authFlows.deleteFlow')}</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            {t('authFlows.deleteConfirm', { name: deletingFlowName })}
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleDeleteCancel}>{t('common.cancel')}</Button>
                        <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                            {t('common.delete')}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Set Default Confirmation Dialog */}
                <Dialog
                    open={setDefaultDialogOpen}
                    onClose={() => {
                        // Copilot post-merge round 5: ignore backdrop / Escape
                        // close while the request is in flight, so a stray
                        // dismiss can't leave a setDefault call orphaned with
                        // no UI to surface its result. Cancel button stays
                        // disabled separately.
                        if (setDefaultInFlight) return
                        handleSetDefaultCancel()
                    }}
                    aria-labelledby="set-default-flow-dialog-title"
                >
                    <DialogTitle id="set-default-flow-dialog-title">{t('authFlows.setDefaultTitle')}</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            {t('authFlows.setDefaultConfirm', { name: setDefaultTarget?.name ?? '' })}
                        </DialogContentText>
                        {defaultImpactLoading && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                                <CircularProgress size={16} />
                                <Typography variant="body2" color="text.secondary">
                                    {t('authFlows.defaultImpactChecking')}
                                </Typography>
                            </Box>
                        )}
                        {!defaultImpactLoading && defaultImpact && defaultImpact.usersAtRisk > 0 && (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                {t('authFlows.defaultImpactWarning', {
                                    atRisk: defaultImpact.usersAtRisk,
                                    total: defaultImpact.activeUsers,
                                    missing: defaultImpact.methods
                                        .filter((m) => m.missingUsers > 0)
                                        .map((m) => {
                                            const key = METHOD_LABEL_KEYS[m.method]
                                            return key ? t(key) : m.method
                                        })
                                        .join(', '),
                                })}
                            </Alert>
                        )}
                        {/* F-web: usernameless-only + no-recovery advisories. */}
                        {!defaultImpactLoading && defaultImpact?.usernamelessOnly && (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                {t('authFlows.defaultImpactUsernamelessOnly')}
                            </Alert>
                        )}
                        {!defaultImpactLoading && defaultImpact?.noRecoveryMethod && (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                {t('authFlows.defaultImpactNoRecovery')}
                            </Alert>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleSetDefaultCancel} disabled={setDefaultInFlight}>{t('common.cancel')}</Button>
                        <Button
                            onClick={handleSetDefaultConfirm}
                            color="primary"
                            variant="contained"
                            disabled={setDefaultInFlight}
                            startIcon={setDefaultInFlight ? <CircularProgress size={14} /> : <Star fontSize="small" />}
                        >
                            {t('authFlows.setAsDefault')}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </PageTransition>
    )
}
