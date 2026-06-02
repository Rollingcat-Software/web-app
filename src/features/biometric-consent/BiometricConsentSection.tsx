import { useState } from 'react'
import {
    Alert,
    Box,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    FormControlLabel,
    Switch,
    Typography,
} from '@mui/material'
import { VerifiedUser } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import { useBiometricConsents } from './useBiometricConsents'

interface BiometricConsentSectionProps {
    /** The user's currently active tenant id (the "current tenant" toggle target). */
    currentTenantId?: string
    /** Human-readable name of the current tenant, for the toggle label. */
    currentTenantName?: string
}

/**
 * Per-tenant biometric CONSENT toggles (Model A, Phase 3).
 *
 * <p>Lets a person who has enrolled their biometric once (their canonical
 * template) opt-in to letting another tenant VERIFY against it — "Use my
 * existing FIVUCSAS biometrics for {tenant}" — without re-enrolling. The tenant
 * never receives the raw template; only a verify decision, and only while
 * consent is granted.</p>
 *
 * <p>Self-contained component (own hook + state) so it can be mounted in Profile
 * with a single line — keeping merge surface with the concurrent Phase 2
 * "Linked accounts" work minimal.</p>
 */
export default function BiometricConsentSection({
    currentTenantId,
    currentTenantName,
}: BiometricConsentSectionProps) {
    const { t } = useTranslation()
    const { consents, loading, saving, setConsent } = useBiometricConsents()
    const [toggleError, setToggleError] = useState<string | null>(null)

    // The all-methods (method=null) consent row for the current tenant, if any.
    const currentTenantConsent = currentTenantId
        ? consents.find((c) => c.tenantId === currentTenantId && c.method === null)
        : undefined
    const currentTenantGranted = currentTenantConsent?.granted ?? false

    const handleToggle = async (tenantId: string, granted: boolean) => {
        setToggleError(null)
        try {
            await setConsent(tenantId, granted, null)
        } catch (e) {
            setToggleError(formatApiError(e, t))
        }
    }

    return (
        <Card>
            <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <VerifiedUser color="primary" />
                    <Typography variant="h6" fontWeight={700}>
                        {t('biometricConsent.title')}
                    </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('biometricConsent.description')}
                </Typography>

                {toggleError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setToggleError(null)}>
                        {toggleError}
                    </Alert>
                )}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : (
                    <>
                        {currentTenantId && (
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={currentTenantGranted}
                                        disabled={saving}
                                        onChange={(e) =>
                                            handleToggle(currentTenantId, e.target.checked)
                                        }
                                    />
                                }
                                label={t('biometricConsent.useForTenant', {
                                    tenant: currentTenantName ?? t('biometricConsent.thisTenant'),
                                })}
                            />
                        )}

                        {consents.some((c) => c.tenantId !== currentTenantId) && (
                            <>
                                <Divider sx={{ my: 2 }} />
                                <Typography
                                    variant="subtitle2"
                                    color="text.secondary"
                                    sx={{ mb: 1 }}
                                >
                                    {t('biometricConsent.grantedTenants')}
                                </Typography>
                                {/* current tenant already shown by the toggle above; list only OTHER orgs */}
                                {consents.filter((c) => c.tenantId !== currentTenantId).map((c) => (
                                    <FormControlLabel
                                        key={c.id}
                                        sx={{ display: 'flex' }}
                                        control={
                                            <Switch
                                                checked={c.granted}
                                                disabled={saving}
                                                onChange={(e) =>
                                                    handleToggle(c.tenantId, e.target.checked)
                                                }
                                            />
                                        }
                                        label={
                                            <Typography variant="body2">
                                                {c.tenantName ?? c.tenantId}
                                                {c.method ? ` · ${c.method}` : ''}
                                            </Typography>
                                        }
                                    />
                                ))}
                            </>
                        )}

                        {consents.length === 0 && !currentTenantId && (
                            <Typography variant="body2" color="text.secondary">
                                {t('biometricConsent.none')}
                            </Typography>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}
