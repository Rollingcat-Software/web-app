/**
 * Layer1Shortcuts — the cross-device sign-in cluster shown on the initial
 * identity-entry screen, beside the email/password form.
 *
 * Two usernameless alternatives to typing a password here:
 *   • Passkey — discoverable WebAuthn, fully usernameless (no email typed).
 *   • Sign in with your phone — cross-device QR scan-to-login. The QrLoginPanel
 *     it opens needs no identifier (the scanning phone resolves the user).
 *
 * Approve-login is deliberately NOT here: it REQUIRES the user's email, so it is
 * an auth FACTOR (a mid-flow step), not a usernameless identifier-layer login.
 * `onApproveClick` is accepted-but-ignored for caller compatibility (the approve
 * button no longer renders). See the APPROVE_LOGIN MFA step instead.
 *
 * QR renders only when the caller wires `onQrClick`; the caller gates it to the
 * initial identity-entry phase. When no login-config is available (fetch failed)
 * `config` is null and `fallbackAll` keeps the passkey shortcut visible.
 */

import { Button, Divider, Stack, Typography } from '@mui/material'
import { QrCode2 } from '@mui/icons-material'
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
     * @deprecated Accepted for caller compatibility but IGNORED — approve-login
     * requires the user's email, so it is a mid-flow auth FACTOR, not a
     * usernameless identifier-layer login. The button no longer renders here.
     */
    onApproveClick?: () => void
    /**
     * Open the cross-device "Sign in with your phone" (QR scan-to-login) panel.
     * When provided, a QR button renders here.
     */
    onQrClick?: () => void
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
    onQrClick,
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
    const showQr = Boolean(onQrClick)

    if (!showPasskey && !showQr) return null

    return (
        <>
            {!hideDivider && (
                <Divider sx={{ my: 2, '&::before, &::after': { borderColor: 'divider' } }}>
                    <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
                        {t('passkeyLogin.or')}
                    </Typography>
                </Divider>
            )}

            <Stack spacing={1.5}>
                {showPasskey && (
                    <PasskeyLoginButton<T>
                        onSuccess={onPasskeySuccess}
                        onError={onPasskeyError}
                        disabled={disabled}
                        sx={passkeySx}
                    />
                )}

                {showQr && (
                    <Button
                        fullWidth
                        variant="outlined"
                        size="large"
                        onClick={onQrClick}
                        disabled={disabled}
                        startIcon={<QrCode2 />}
                        sx={{
                            py: 1.5,
                            borderRadius: '12px',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            textTransform: 'none',
                            ...passkeySx,
                        }}
                    >
                        {t('qrLogin.button')}
                    </Button>
                )}
            </Stack>
        </>
    )
}
