/**
 * FingerprintPuzzle — wraps the production `FingerprintStep` and runs the
 * full WebAuthn platform-authenticator round-trip against the REAL
 * `/webauthn/authenticate-options` + `/webauthn/authenticate` endpoints.
 *
 * Server-side fingerprint biometric was removed in PR #39 — the legacy
 * `/biometric/fingerprint/*` paths are gone. The platform authenticator is the
 * only fingerprint path and that is what this puzzle exercises.
 *
 * USER-BUG-5 (this fix): the previous wrapper resolved success after a
 * `setTimeout(onSuccess, 500)` regardless of WebAuthn outcome. We now only
 * succeed when the server cryptographically validates the assertion;
 * cancellation, missing credentials and signature failures all surface as a
 * real error.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FingerprintStep from '@features/auth/components/steps/FingerprintStep'
import type { AuthMethodProps } from '../authMethodRegistry'
import { useAuthMethodPuzzleApi } from './useAuthMethodPuzzleApi'

export default function FingerprintPuzzle({ onSuccess, onError }: AuthMethodProps) {
    const { t } = useTranslation()
    const api = useAuthMethodPuzzleApi()
    const [loading, setLoading] = useState(false)
    const [stepError, setStepError] = useState<string | undefined>(undefined)

    const handleSubmit = useCallback(
        async (data: string) => {
            setLoading(true)
            setStepError(undefined)
            const result = await api.submitWebAuthnAssertion(data, t)
            setLoading(false)
            if (result.kind === 'success') {
                onSuccess()
            } else {
                setStepError(result.message)
                onError(result.message)
            }
        },
        [api, t, onSuccess, onError],
    )

    return (
        <FingerprintStep
            onRequestChallenge={() => api.requestWebAuthnChallenge(t)}
            onSubmit={handleSubmit}
            loading={loading}
            error={stepError}
        />
    )
}
