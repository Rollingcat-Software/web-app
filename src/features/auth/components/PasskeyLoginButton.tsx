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
import type { AvailableMfaMethod } from '@domain/interfaces/IAuthRepository'
import type { Layer1Continuation } from '../login-shared/layer1Continuation'
import { mapWebAuthnError } from '../webauthn-utils'
import {
    fetchPasskeyOptions,
    getPasskeyAssertion,
    isPasskeySupported,
    submitPasskeyAssertion,
} from '../passkey-login'

export interface PasskeyLoginButtonProps<T = unknown> {
    /**
     * Called with the raw server login response after a successful assertion
     * that COMPLETES the login (final tokens present). When the passkey only
     * satisfied Layer 1 and the tenant flow needs more steps, `onMfaRequired`
     * is called instead (when wired).
     */
    onSuccess: (loginResponse: T) => void
    /**
     * Called when the passkey satisfied Layer 1 but the tenant flow needs MORE
     * steps: the server returned an `mfaSessionToken` (no final accessToken).
     * The host threads it into the existing MethodPicker / MfaStepRenderer
     * continuation. When omitted, a multi-step response falls through to
     * `onSuccess` (prior behaviour).
     */
    onMfaRequired?: (continuation: Layer1Continuation) => void
    /** Surfaced when the ceremony or server call fails (already localized). */
    onError?: (message: string) => void
    /** Disable while a parent flow is busy (e.g. password submit in flight). */
    disabled?: boolean
    /** Optional style overrides for the button (e.g. dark-on-light card). */
    sx?: Parameters<typeof Button>[0]['sx']
}

/**
 * Shape of the fields a passkey-success response may carry when the tenant flow
 * needs further steps. The server uses the standard login-success envelope
 * (`twoFactorRequired` / `mfaSessionToken` / `availableMethods`), which the
 * generic `T` does not expose — so we read them defensively off the raw object.
 */
interface PasskeyMultiStepFields {
    accessToken?: string | null
    twoFactorRequired?: boolean
    mfaSessionToken?: string | null
    availableMethods?: AvailableMfaMethod[]
    completedMethods?: string[]
    currentStep?: number
    totalSteps?: number
}

export default function PasskeyLoginButton<T = unknown>({
    onSuccess,
    onMfaRequired,
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
            // Multi-step: the passkey satisfied Layer 1 but the tenant flow needs
            // more steps. The server returns an mfaSessionToken WITHOUT a final
            // accessToken. Route into the host's MFA continuation instead of
            // handing a tokenless response to onSuccess (which would dead-end as
            // "missing access token"). When no handoff handler is wired, fall
            // through to onSuccess (prior behaviour).
            const multi = loginResponse as PasskeyMultiStepFields
            if (
                onMfaRequired &&
                !multi.accessToken &&
                multi.mfaSessionToken &&
                (multi.twoFactorRequired || multi.availableMethods?.length)
            ) {
                onMfaRequired({
                    mfaSessionToken: multi.mfaSessionToken,
                    availableMethods: multi.availableMethods,
                    completedMethods: multi.completedMethods,
                    currentStep: multi.currentStep,
                    totalSteps: multi.totalSteps,
                })
                return
            }
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
    }, [busy, supported, httpClient, onSuccess, onMfaRequired, onError, t])

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
