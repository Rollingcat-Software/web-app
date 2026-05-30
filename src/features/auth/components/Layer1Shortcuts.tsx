/**
 * Layer1Shortcuts — config-driven usernameless sign-in shortcuts.
 *
 * Replaces the previously-hardcoded passkey + "approve on another device"
 * buttons on the hosted login page and the dashboard login. Each shortcut is
 * shown ONLY when the tenant's {@link LoginConfig} marks a corresponding
 * Layer-1 method as `usernameless`:
 *   - passkey  → a usernameless HARDWARE_KEY / FINGERPRINT method
 *   - approve  → a usernameless cross-device method (QR/push hybrid)
 *
 * When no login-config is available (fetch failed), `config` is null and the
 * caller decides the fallback: pass `fallbackAll` to show every shortcut as
 * before. This keeps the legacy surface intact on a config outage.
 */

import { Button, Divider, Typography } from '@mui/material'
import { PhonelinkLock } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import PasskeyLoginButton from './PasskeyLoginButton'
import {
    hasUsernamelessApprove,
    hasUsernamelessPasskey,
    type LoginConfig,
} from '@domain/models/LoginConfig'

interface Layer1ShortcutsProps<T> {
    /** Tenant login config; null while loading or after a fetch failure. */
    config: LoginConfig | null
    /**
     * When `config` is null (fetch failed), show all shortcuts as the legacy
     * surface did. When `config` is present, shortcuts are gated strictly by it
     * and this flag is ignored.
     */
    fallbackAll?: boolean
    onPasskeySuccess: (login: T) => void
    onPasskeyError: (message: string) => void
    onApproveClick: () => void
    disabled?: boolean
    /** Hide the "or" divider (e.g. when there is no primary form above). */
    hideDivider?: boolean
    passkeySx?: React.ComponentProps<typeof PasskeyLoginButton>['sx']
}

export default function Layer1Shortcuts<T = unknown>({
    config,
    fallbackAll = false,
    onPasskeySuccess,
    onPasskeyError,
    onApproveClick,
    disabled,
    hideDivider = false,
    passkeySx,
}: Layer1ShortcutsProps<T>) {
    const { t } = useTranslation()

    // Gate each shortcut. With a config we obey it strictly; without one we use
    // the caller's fallback policy.
    const showPasskey = config ? hasUsernamelessPasskey(config) : fallbackAll
    const showApprove = config ? hasUsernamelessApprove(config) : fallbackAll

    if (!showPasskey && !showApprove) return null

    return (
        <>
            {!hideDivider && (
                <Divider sx={{ my: 2, '&::before, &::after': { borderColor: 'divider' } }}>
                    <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
                        {t('passkeyLogin.or')}
                    </Typography>
                </Divider>
            )}

            {showPasskey && (
                <PasskeyLoginButton<T>
                    onSuccess={onPasskeySuccess}
                    onError={onPasskeyError}
                    disabled={disabled}
                    sx={passkeySx}
                />
            )}

            {showApprove && (
                <Button
                    fullWidth
                    variant="text"
                    size="large"
                    startIcon={<PhonelinkLock />}
                    onClick={onApproveClick}
                    disabled={disabled}
                    sx={{
                        mt: showPasskey ? 1 : 0,
                        py: 1.25,
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontWeight: 600,
                    }}
                >
                    {t('approveLogin.button')}
                </Button>
            )}
        </>
    )
}
