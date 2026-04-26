import { useState, useEffect, useCallback } from 'react'
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
import { Add, Delete, Edit } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { PageTransition } from '@components/animations'
import { AuthFlowBuilder } from './AuthFlowBuilder'
import { TYPES } from '@core/di/types'
import { useService } from '@app/providers'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useAuthMethods } from '@features/authFlows/hooks/useAuthMethods'
import {
    OPERATION_TYPE_OPTIONS,
    getOperationTypeLabel,
    type OperationType,
    type AuthFlowStep,
} from '@domain/models/AuthMethod'
import type { AuthFlowRepository, AuthFlowResponse, CreateAuthFlowCommand } from '@core/repositories/AuthFlowRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import { useTranslation } from 'react-i18next'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

export default function AuthFlowsPage() {
    const authFlowRepo = useService<AuthFlowRepository>(TYPES.AuthFlowRepository)
    const logger = useService<ILogger>(TYPES.Logger)
    const { user } = useAuth()
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

    const tenantId = user?.tenantId ?? ''

    const loadFlows = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await authFlowRepo.listFlows(tenantId, filterType || undefined)
            setFlows(data)
        } catch (err) {
            logger.error('Failed to load auth flows', err)
            setError(t('authFlows.failedToLoad'))
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
                })),
            }

            if (editingFlow) {
                // For edit: delete the old flow and create a new one with updated data
                // (The backend UpdateAuthFlowCommand only supports name/description/isDefault/isActive,
                // not step changes. So we recreate the flow to apply step changes.)
                await authFlowRepo.deleteFlow(tenantId, editingFlow.id)
                await authFlowRepo.createFlow(tenantId, command)
                setEditingFlow(null)
            } else {
                await authFlowRepo.createFlow(tenantId, command)
            }

            setShowBuilder(false)
            await loadFlows()
        } catch (err) {
            logger.error('Failed to save auth flow', err)
            setError(t('authFlows.failedToSave'))
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
            setError(t('authFlows.failedToDelete'))
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
                                            <Tooltip title="Edit flow">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleEditClick(flow)}
                                                    sx={{ color: 'primary.main', mr: 0.5 }}
                                                    aria-label="Edit flow"
                                                >
                                                    <Edit fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete flow">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDeleteClick(flow.id, flow.name)}
                                                    sx={{ color: 'error.main' }}
                                                    aria-label="Delete flow"
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
                            <AuthFlowBuilder
                                key={editingFlow?.id ?? 'new'}
                                onSave={handleSave}
                                authMethods={authMethods}
                                initialSteps={editingFlow ? getBuilderInitialSteps() : undefined}
                                initialName={editingFlow?.name}
                                initialDescription={editingFlow?.description}
                                initialOperationType={editingFlow?.operationType}
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
            </Box>
        </PageTransition>
    )
}
