/**
 * ConfigUnavailableBanner — shared "couldn't load your sign-in options" notice.
 *
 * Both login surfaces resolve their Layer-1 surface from
 * `GET /auth/login-config`. When that fetch SETTLES with no usable config
 * (network / unreachable API / malformed) — as opposed to "null because the
 * config-driven engine is OFF" — the surface still renders the legacy
 * email+password fallback, but must EXPLAIN why it looks basic and offer a retry
 * (a silent degrade read as a stale / old-looking login page on filtered
 * networks that block `api.fivucsas.com`).
 *
 * The dashboard (`LoginPage`) shipped this banner first (2026-06-03); the hosted
 * surface (`HostedLoginApp`) lacked it. This component is that one banner so both
 * surfaces show the identical `role="status"` warning + Retry, with the same i18n
 * keys (`login.configUnavailable` / `configRetry` / `configRetrying`). Purely
 * additive — the fallback form is unchanged.
 */
import { Alert, Button } from '@mui/material'
import { useTranslation } from 'react-i18next'

export interface ConfigUnavailableBannerProps {
    /** Re-fetch the login-config. */
    onRetry: () => void
    /** True while a retry is in flight (disables the button + shows "Retrying…"). */
    retrying: boolean
    /** Optional sx override for the Alert (surface-specific spacing). */
    sx?: object
}

export default function ConfigUnavailableBanner({
    onRetry,
    retrying,
    sx,
}: ConfigUnavailableBannerProps) {
    const { t } = useTranslation()
    return (
        <Alert
            severity="warning"
            role="status"
            sx={sx ?? { mb: 3, borderRadius: '12px' }}
            action={
                <Button color="inherit" size="small" onClick={onRetry} disabled={retrying}>
                    {retrying ? t('login.configRetrying') : t('login.configRetry')}
                </Button>
            }
        >
            {t('login.configUnavailable')}
        </Alert>
    )
}
