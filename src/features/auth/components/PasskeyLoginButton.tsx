/**
 * PasskeyLoginButton — "Sign in with a passkey" (Phase 1, discoverable login)
 *
 * Additive entry point shown beside the email/password form on both the hosted
 * login page and the dashboard login. Runs the discoverable WebAuthn ceremony
 * (no email typed) and hands the raw server login response back to the caller
 * via `onSuccess`, so each surface can route it into its own completion path
 * (dashboard token-store vs. hosted OIDC code exchange).
 *
 * Graceful degradation: when WebAuthn is unavailable the button renders
 * disabled with an explanatory tooltip rather than vanishing, so the option is
 * still discoverable and the absence is explained.
 */

import { useCallback, useState } from 'react'
import { Box, Button, CircularProgress, Tooltip } from '@mui/material'
import { VpnKeyOutlined } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { mapWebAuthnError } from '../webauthn-utils'
import {
    fetchPasskeyOptions,
    getPasskeyAssertion,
    isPasskeySupported,
    submitPasskeyAssertion,
} from '../passkey-login'

export interface PasskeyLoginButtonProps<T = unknown> {
    /** Called with the raw server login response after a successful assertion. */
    onSuccess: (loginResponse: T) => void
    /** Surfaced when the ceremony or server call fails (already localized). */
    onError?: (message: string) => void
    /** Disable while a parent flow is busy (e.g. password submit in flight). */
    disabled?: boolean
    /** Optional style overrides for the button (e.g. dark-on-light card). */
    sx?: Parameters<typeof Button>[0]['sx']
}

export default function PasskeyLoginButton<T = unknown>({
    onSuccess,
    onError,
    disabled,
    sx,
}: PasskeyLoginButtonProps<T>) {
    const { t } = useTranslation()
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const [busy, setBusy] = useState(false)
    const supported = isPasskeySupported()

    const handleClick = useCallback(async () => {
        if (busy) return
        if (!supported) {
            onError?.(t('passkeyLogin.notSupported'))
            return
        }
        setBusy(true)
        try {
            const options = await fetchPasskeyOptions(httpClient)
            const assertion = await getPasskeyAssertion(options)
            if (!assertion) {
                onError?.(t('passkeyLogin.noCredential'))
                return
            }
            const loginResponse = await submitPasskeyAssertion<T>(
                httpClient,
                options.sessionId,
                assertion,
            )
            onSuccess(loginResponse)
        } catch (err) {
            // mapWebAuthnError handles both DOMExceptions (cancel/timeout) and
            // falls back to formatApiError for server failures. Returns
            // undefined for benign cancellations we shouldn't surface as errors.
            const mapped = mapWebAuthnError(err, t)
            if (mapped) onError?.(mapped)
        } finally {
            setBusy(false)
        }
    }, [busy, supported, httpClient, onSuccess, onError, t])

    const button = (
        <Button
            fullWidth
            variant="outlined"
            size="large"
            onClick={() => { void handleClick() }}
            disabled={disabled || busy || !supported}
            startIcon={
                busy ? (
                    <CircularProgress size={18} color="inherit" />
                ) : (
                    <VpnKeyOutlined />
                )
            }
            sx={{
                py: 1.5,
                borderRadius: '12px',
                fontSize: '0.95rem',
                fontWeight: 600,
                textTransform: 'none',
                ...sx,
            }}
        >
            {busy ? t('passkeyLogin.prompting') : t('passkeyLogin.button')}
        </Button>
    )

    if (!supported) {
        // Wrap a disabled button in a span so the tooltip still fires (MUI
        // disabled buttons don't emit pointer events).
        return (
            <Tooltip title={t('passkeyLogin.notSupported')}>
                <Box component="span" sx={{ display: 'block' }}>
                    {button}
                </Box>
            </Tooltip>
        )
    }

    return button
}
