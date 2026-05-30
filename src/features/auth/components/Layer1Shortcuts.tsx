/**
 * Layer1Shortcuts — the NO-EMAIL ("usernameless") sign-in cluster.
 *
 * Shows the cross-device methods that need NO identifier typed first — the
 * factor itself resolves the user. Today that is the discoverable **passkey**
 * ("use your phone" via the OS). A QR scan-to-login is a planned addition.
 *
 * NOTE: "Approve on another device" (number-matching) is deliberately NOT here.
 * It requires the user's email up front (the server must know whose device to
 * ping), so it is identifier-first and is rendered by the caller AFTER the email
 * field — not as a no-email peer of passkey. Listing it here made the login page
 * promise "no email needed" and then demand an email.
 *
 * When no login-config is available (fetch failed) `config` is null and the
 * caller's `fallbackAll` keeps the passkey shortcut visible (legacy surface).
 */

import { Divider, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import PasskeyLoginButton from './PasskeyLoginButton'
import {
    hasUsernamelessPasskey,
    type LoginConfig,
} from '@domain/models/LoginConfig'

interface Layer1ShortcutsProps<T> {
    /** Tenant login config; null while loading or after a fetch failure. */
    config: LoginConfig | null
    /**
     * Fallback policy for when the config does NOT positively declare a
     * usernameless Layer-1 method. This covers two states that must look
     * identical to the user:
     *   1. `config === null` — the login-config fetch failed.
     *   2. A "legacy"/password-first config (the `app.auth.config-driven-login`
     *      flag is OFF, so the API returns the current shape with no usernameless
     *      semantics).
     * In both cases `fallbackAll` decides whether the passkey shortcut still
     * renders. When the config DOES declare a usernameless passkey (flag ON) it
     * is rendered strictly per the config and this flag is ignored.
     */
    fallbackAll?: boolean
    onPasskeySuccess: (login: T) => void
    onPasskeyError: (message: string) => void
    /**
     * @deprecated Approve-on-another-device is identifier-first (needs email), so
     * it is no longer a no-email shortcut here. Accepted but IGNORED for caller
     * compatibility; the approve affordance is being re-homed AFTER the email
     * step. Remove once callers stop passing it.
     */
    onApproveClick?: () => void
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
    disabled,
    hideDivider = false,
    passkeySx,
}: Layer1ShortcutsProps<T>) {
    const { t } = useTranslation()

    // When the config-driven engine is ON for this tenant, render the passkey
    // shortcut STRICTLY from the config (shown only if a usernameless passkey is a
    // Layer-1 method). When OFF — legacy/null config — fall back to the caller's
    // policy so the passkey shortcut is not silently dropped. Keeps the feature
    // instantly revertible by the API engine flag with no web redeploy.
    const configDriven = config?.engineActive === true
    const showPasskey = configDriven ? hasUsernamelessPasskey(config!) : fallbackAll

    if (!showPasskey) return null

    return (
        <>
            {!hideDivider && (
                <Divider sx={{ my: 2, '&::before, &::after': { borderColor: 'divider' } }}>
                    <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
                        {t('passkeyLogin.or')}
                    </Typography>
                </Divider>
            )}

            <PasskeyLoginButton<T>
                onSuccess={onPasskeySuccess}
                onError={onPasskeyError}
                disabled={disabled}
                sx={passkeySx}
            />
        </>
    )
}
