import { Alert, Typography } from '@mui/material'
import { Business } from '@mui/icons-material'
import { Trans, useTranslation } from 'react-i18next'
import { useActiveTenant } from '@features/tenants/context/ActiveTenantContext'
import { useAuth } from '@features/auth/hooks/useAuth'

interface OperationContextBannerProps {
    /**
     * i18n key for the operation message. Receives a `tenantName` interpolation
     * value and should bold it via a `<strong>` placeholder, e.g.
     *   "Adding a user to <1>{{tenantName}}</1>"
     */
    i18nKey: string
    /**
     * Optionally override the tenant name (e.g. when a form has its own tenant
     * selector). Falls back to the active tenant, then the user's home tenant.
     */
    tenantName?: string | null
    sx?: object
}

/**
 * Shows which tenant an admin create/edit operation targets, e.g.
 * "Adding a user to **Marmara University**". Reads the active tenant
 * (SUPER_ADMIN switcher) and falls back to the operator's own tenant.
 */
export function OperationContextBanner({ i18nKey, tenantName, sx }: OperationContextBannerProps) {
    const { t } = useTranslation()
    const { activeTenantName } = useActiveTenant()
    const { user } = useAuth()

    const resolvedName = tenantName ?? activeTenantName ?? user?.tenantName ?? null
    if (!resolvedName) return null

    return (
        <Alert
            severity="info"
            icon={<Business fontSize="small" />}
            sx={{ mb: 3, ...sx }}
        >
            <Typography variant="body2">
                <Trans
                    i18nKey={i18nKey}
                    values={{ tenantName: resolvedName }}
                    t={t}
                    components={{ b: <strong /> }}
                />
            </Typography>
        </Alert>
    )
}
