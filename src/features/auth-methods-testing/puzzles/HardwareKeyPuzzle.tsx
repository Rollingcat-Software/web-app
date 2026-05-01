/**
 * HardwareKeyPuzzle — wraps the production `HardwareKeyStep` and runs the
 * cross-platform WebAuthn assertion against the REAL `/webauthn/authenticate`
 * endpoint.
 *
 * Same shape as `FingerprintPuzzle`: the only difference is which kind of
 * authenticator the OS picker prefers. Both call into
 * `useAuthMethodPuzzleApi.submitWebAuthnAssertion` so the cryptographic
 * verification on the server side is identical.
 *
 * USER-BUG-5 (this fix): no more 500 ms `setTimeout(onSuccess)`; success only
 * fires on a server-confirmed signature.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import HardwareKeyStep from '@features/auth/components/steps/HardwareKeyStep'
import type { AuthMethodProps } from '../authMethodRegistry'
import { useAuthMethodPuzzleApi } from './useAuthMethodPuzzleApi'

export default function HardwareKeyPuzzle({ onSuccess, onError }: AuthMethodProps) {
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
        <HardwareKeyStep
            onRequestChallenge={() => api.requestWebAuthnChallenge(t)}
            onSubmit={handleSubmit}
            loading={loading}
            error={stepError}
        />
    )
}
