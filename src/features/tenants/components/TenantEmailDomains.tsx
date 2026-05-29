import { useCallback, useEffect, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import {
    Add,
    CheckCircle,
    ContentCopy,
    DeleteOutline,
    GppMaybe,
    Language,
    StarOutline,
    Star,
    VerifiedUser,
} from '@mui/icons-material'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type {
    DomainVerificationChallenge,
    ITenantRepository,
    TenantEmailDomain,
} from '@domain/interfaces/ITenantRepository'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import { OperationContextBanner } from '@components/OperationContextBanner'

interface TenantEmailDomainsProps {
    tenantId: string
    /** Current enforcement flag (from the loaded tenant). */
    enforceDomainMatching: boolean
    /** Persist the enforcement flag toggle (delegates to the tenant update). */
    onEnforceChange: (enforce: boolean) => Promise<void>
    /** Name of the tenant these domains belong to (for the context banner). */
    tenantName?: string
}

// Basic FQDN shape — mirrors the backend regex (lowercase, no '@', valid TLD).
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

export default function TenantEmailDomains({
    tenantId,
    enforceDomainMatching,
    onEnforceChange,
    tenantName,
}: TenantEmailDomainsProps) {
    const repo = useService<ITenantRepository>(TYPES.TenantRepository)
    const { t } = useTranslation()

    const [domains, setDomains] = useState<TenantEmailDomain[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [newDomain, setNewDomain] = useState('')
    const [adding, setAdding] = useState(false)
    const [busyDomain, setBusyDomain] = useState<string | null>(null)
    const [enforceBusy, setEnforceBusy] = useState(false)
    const [enforce, setEnforce] = useState(enforceDomainMatching)
    const [pendingRemove, setPendingRemove] = useState<string | null>(null)

    // Domain DNS-verification dialog state.
    const [verifyDomainName, setVerifyDomainName] = useState<string | null>(null)
    const [challenge, setChallenge] = useState<DomainVerificationChallenge | null>(null)
    const [challengeLoading, setChallengeLoading] = useState(false)
    const [verifyBusy, setVerifyBusy] = useState(false)
    const [verifyError, setVerifyError] = useState<string | null>(null)
    const [verifyReason, setVerifyReason] = useState<string | null>(null)
    const [verifySucceeded, setVerifySucceeded] = useState(false)
    const [copiedField, setCopiedField] = useState<string | null>(null)

    useEffect(() => {
        setEnforce(enforceDomainMatching)
    }, [enforceDomainMatching])

    const fetchDomains = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            setDomains(await repo.listDomains(tenantId))
        } catch (err: unknown) {
            setError(formatApiError(err, t))
        } finally {
            setLoading(false)
        }
    }, [repo, tenantId, t])

    useEffect(() => {
        fetchDomains()
    }, [fetchDomains])

    const trimmed = newDomain.trim().toLowerCase()
    const newDomainInvalid = trimmed.length > 0 && !DOMAIN_RE.test(trimmed)

    const handleAdd = async () => {
        if (!trimmed || newDomainInvalid) return
        setAdding(true)
        setError(null)
        try {
            await repo.addDomain(tenantId, trimmed, domains.length === 0)
            setNewDomain('')
            await fetchDomains()
        } catch (err: unknown) {
            setError(formatApiError(err, t))
        } finally {
            setAdding(false)
        }
    }

    const handleRemoveConfirmed = async () => {
        const domain = pendingRemove
        setPendingRemove(null)
        if (!domain) return
        setBusyDomain(domain)
        setError(null)
        try {
            await repo.removeDomain(tenantId, domain)
            await fetchDomains()
        } catch (err: unknown) {
            setError(formatApiError(err, t))
        } finally {
            setBusyDomain(null)
        }
    }

    const handleSetPrimary = async (domain: string) => {
        setBusyDomain(domain)
        setError(null)
        try {
            await repo.setPrimaryDomain(tenantId, domain)
            await fetchDomains()
        } catch (err: unknown) {
            setError(formatApiError(err, t))
        } finally {
            setBusyDomain(null)
        }
    }

    const handleEnforceToggle = async (next: boolean) => {
        setEnforce(next) // optimistic
        setEnforceBusy(true)
        setError(null)
        try {
            await onEnforceChange(next)
        } catch (err: unknown) {
            setEnforce(!next) // revert on failure
            setError(formatApiError(err, t))
        } finally {
            setEnforceBusy(false)
        }
    }

    const openVerifyDialog = async (domain: string) => {
        setVerifyDomainName(domain)
        setChallenge(null)
        setVerifyError(null)
        setVerifyReason(null)
        setVerifySucceeded(false)
        setChallengeLoading(true)
        try {
            const result = await repo.getDomainVerificationChallenge(tenantId, domain)
            setChallenge(result)
            if (result.verified) setVerifySucceeded(true)
        } catch (err: unknown) {
            setVerifyError(formatApiError(err, t))
        } finally {
            setChallengeLoading(false)
        }
    }

    const closeVerifyDialog = () => {
        setVerifyDomainName(null)
        setChallenge(null)
        setCopiedField(null)
    }

    const handleVerify = async () => {
        if (!verifyDomainName) return
        setVerifyBusy(true)
        setVerifyError(null)
        setVerifyReason(null)
        try {
            const result = await repo.verifyDomain(tenantId, verifyDomainName)
            if (result.verified) {
                setVerifySucceeded(true)
                await fetchDomains() // chip flips to Verified
            } else {
                setVerifyReason(
                    result.reason
                        ? t(`tenants.emailDomains.verifyReasons.${result.reason}`, {
                              defaultValue: result.reason,
                          })
                        : t('tenants.emailDomains.verifyFailedGeneric')
                )
            }
        } catch (err: unknown) {
            setVerifyError(formatApiError(err, t))
        } finally {
            setVerifyBusy(false)
        }
    }

    const handleCopy = async (field: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value)
            setCopiedField(field)
            setTimeout(() => setCopiedField((curr) => (curr === field ? null : curr)), 1500)
        } catch {
            // Clipboard unavailable (insecure context) — silently ignore.
        }
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Language color="primary" />
                <Typography variant="h6" fontWeight={600}>
                    {t('tenants.emailDomains.title')}
                </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('tenants.emailDomains.description')}
            </Typography>

            {tenantName && (
                <OperationContextBanner i18nKey="operationContext.addEmailDomain" tenantName={tenantName} />
            )}

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={28} />
                </Box>
            ) : (
                <>
                    {domains.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t('tenants.emailDomains.empty')}
                        </Typography>
                    ) : (
                        <Box sx={{ mb: 2 }}>
                            {domains.map((d, index) => {
                                const busy = busyDomain === d.domain
                                return (
                                    <Box key={d.domain}>
                                        {index > 0 && <Divider />}
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                py: 1.25,
                                                px: 1,
                                                gap: 1,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <Typography variant="body1" fontWeight={500}>
                                                    {d.domain}
                                                </Typography>
                                                {d.isPrimary && (
                                                    <Chip
                                                        size="small"
                                                        color="primary"
                                                        icon={<Star sx={{ fontSize: 16 }} />}
                                                        label={t('tenants.emailDomains.primary')}
                                                    />
                                                )}
                                                <Chip
                                                    size="small"
                                                    color={d.verified ? 'success' : 'default'}
                                                    variant={d.verified ? 'filled' : 'outlined'}
                                                    icon={
                                                        d.verified ? (
                                                            <CheckCircle sx={{ fontSize: 16 }} />
                                                        ) : (
                                                            <GppMaybe sx={{ fontSize: 16 }} />
                                                        )
                                                    }
                                                    label={
                                                        d.verified
                                                            ? t('tenants.emailDomains.verified')
                                                            : t('tenants.emailDomains.unverified')
                                                    }
                                                />
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(d.createdAt).toLocaleDateString()}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                {busy ? (
                                                    <CircularProgress size={20} sx={{ mx: 1.25 }} />
                                                ) : (
                                                    <>
                                                        {!d.verified && (
                                                            <Tooltip
                                                                title={t('tenants.emailDomains.verifyDomain')}
                                                            >
                                                                <IconButton
                                                                    size="small"
                                                                    color="primary"
                                                                    aria-label={t(
                                                                        'tenants.emailDomains.verifyDomain'
                                                                    )}
                                                                    onClick={() => openVerifyDialog(d.domain)}
                                                                >
                                                                    <VerifiedUser fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                        {!d.isPrimary && (
                                                            <Tooltip
                                                                title={t('tenants.emailDomains.setPrimary')}
                                                            >
                                                                <IconButton
                                                                    size="small"
                                                                    aria-label={t(
                                                                        'tenants.emailDomains.setPrimary'
                                                                    )}
                                                                    onClick={() =>
                                                                        handleSetPrimary(d.domain)
                                                                    }
                                                                >
                                                                    <StarOutline fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                        <Tooltip title={t('common.remove')}>
                                                            <IconButton
                                                                size="small"
                                                                color="error"
                                                                aria-label={t('common.remove')}
                                                                onClick={() =>
                                                                    setPendingRemove(d.domain)
                                                                }
                                                            >
                                                                <DeleteOutline fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </>
                                                )}
                                            </Box>
                                        </Box>
                                    </Box>
                                )
                            })}
                        </Box>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 3 }}>
                        <TextField
                            size="small"
                            fullWidth
                            label={t('tenants.emailDomains.addLabel')}
                            placeholder="marmara.edu.tr"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAdd()
                                }
                            }}
                            error={newDomainInvalid}
                            helperText={
                                newDomainInvalid
                                    ? t('tenants.emailDomains.invalidFormat')
                                    : t('tenants.emailDomains.addHelper')
                            }
                        />
                        <Button
                            variant="contained"
                            startIcon={adding ? <CircularProgress size={18} /> : <Add />}
                            onClick={handleAdd}
                            disabled={adding || !trimmed || newDomainInvalid}
                            sx={{ mt: 0.25, whiteSpace: 'nowrap' }}
                        >
                            {t('common.add')}
                        </Button>
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    <FormControlLabel
                        control={
                            enforceBusy ? (
                                <CircularProgress size={20} sx={{ mx: 1.25 }} />
                            ) : (
                                <Switch
                                    checked={enforce}
                                    onChange={(e) => handleEnforceToggle(e.target.checked)}
                                    color="primary"
                                />
                            )
                        }
                        label={t('tenants.emailDomains.enforceLabel')}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: 0.5 }}>
                        {t('tenants.emailDomains.enforceHelper')}
                    </Typography>
                </>
            )}

            <Dialog open={pendingRemove !== null} onClose={() => setPendingRemove(null)}>
                <DialogTitle>{t('tenants.emailDomains.removeTitle')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('tenants.emailDomains.removeConfirm', { domain: pendingRemove ?? '' })}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPendingRemove(null)}>{t('common.cancel')}</Button>
                    <Button color="error" onClick={handleRemoveConfirmed}>
                        {t('common.remove')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* DNS-verification dialog */}
            <Dialog
                open={verifyDomainName !== null}
                onClose={closeVerifyDialog}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {t('tenants.emailDomains.verifyTitle', { domain: verifyDomainName ?? '' })}
                </DialogTitle>
                <DialogContent>
                    {challengeLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : verifySucceeded ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                            <CheckCircle color="success" />
                            <Typography>{t('tenants.emailDomains.verifySuccess')}</Typography>
                        </Box>
                    ) : (
                        <>
                            <DialogContentText sx={{ mb: 2 }}>
                                {challenge?.instructions ?? t('tenants.emailDomains.verifyInstructions')}
                            </DialogContentText>

                            {verifyError && (
                                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setVerifyError(null)}>
                                    {verifyError}
                                </Alert>
                            )}
                            {verifyReason && (
                                <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setVerifyReason(null)}>
                                    {verifyReason}
                                </Alert>
                            )}

                            {challenge && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                    <TextField
                                        label={t('tenants.emailDomains.recordType')}
                                        value={challenge.recordType}
                                        size="small"
                                        fullWidth
                                        InputProps={{ readOnly: true }}
                                    />
                                    <TextField
                                        label={t('tenants.emailDomains.recordName')}
                                        value={challenge.recordName}
                                        size="small"
                                        fullWidth
                                        InputProps={{
                                            readOnly: true,
                                            endAdornment: (
                                                <Tooltip
                                                    title={
                                                        copiedField === 'name'
                                                            ? t('common.copied')
                                                            : t('common.copy')
                                                    }
                                                >
                                                    <IconButton
                                                        size="small"
                                                        aria-label={t('common.copy')}
                                                        onClick={() =>
                                                            handleCopy('name', challenge.recordName)
                                                        }
                                                    >
                                                        <ContentCopy fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            ),
                                        }}
                                    />
                                    <TextField
                                        label={t('tenants.emailDomains.recordValue')}
                                        value={challenge.recordValue}
                                        size="small"
                                        fullWidth
                                        InputProps={{
                                            readOnly: true,
                                            endAdornment: (
                                                <Tooltip
                                                    title={
                                                        copiedField === 'value'
                                                            ? t('common.copied')
                                                            : t('common.copy')
                                                    }
                                                >
                                                    <IconButton
                                                        size="small"
                                                        aria-label={t('common.copy')}
                                                        onClick={() =>
                                                            handleCopy('value', challenge.recordValue)
                                                        }
                                                    >
                                                        <ContentCopy fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            ),
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeVerifyDialog}>
                        {verifySucceeded ? t('common.close') : t('common.cancel')}
                    </Button>
                    {!verifySucceeded && (
                        <Button
                            variant="contained"
                            onClick={handleVerify}
                            disabled={verifyBusy || challengeLoading || !challenge}
                            startIcon={
                                verifyBusy ? <CircularProgress size={18} /> : <VerifiedUser />
                            }
                        >
                            {t('tenants.emailDomains.verifyConfirm')}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    )
}
