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
     * Fallback policy for when the config does NOT positively declare any
     * usernameless Layer-1 method. This covers two states that must look
     * identical to the user:
     *   1. `config === null` — the login-config fetch failed.
     *   2. A "legacy"/password-first config (e.g. the `app.auth.config-driven-login`
     *      flag is OFF, so the API returns the current shape that carries no
     *      usernameless semantics).
     * In both cases `fallbackAll` decides whether today's passkey + approve
     * shortcuts still render. When the config DOES declare usernameless methods
     * (flag ON), they are rendered strictly per the config and this flag is
     * ignored — the screen is then 100% config-driven.
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

    // When the config positively declares any usernameless Layer-1 method, the
    // screen is rendered STRICTLY from it (flag-ON behaviour). Otherwise — null
    // config OR a legacy/password-first config that carries no usernameless
    // semantics (flag-OFF) — fall back to the caller's policy so today's
    // shortcuts are not silently dropped. This keeps the whole feature instantly
    // revertible by the API flag with no web redeploy.
    const configDeclaresUsernameless =
        config !== null && (hasUsernamelessPasskey(config) || hasUsernamelessApprove(config))

    const showPasskey = configDeclaresUsernameless
        ? hasUsernamelessPasskey(config!)
        : fallbackAll
    const showApprove = configDeclaresUsernameless
        ? hasUsernamelessApprove(config!)
        : fallbackAll

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
