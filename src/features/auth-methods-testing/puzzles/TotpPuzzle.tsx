/**
 * TotpPuzzle — exercises the real TOTP path against the logged-in admin's
 * enrolled secret.
 *
 *   1. Admin opens their authenticator app and enters the current 6-digit
 *      code.
 *   2. POST /auth/2fa/verify-method with method `TOTP` and `{ code }`.
 *   3. Server resolves the user's stored TOTP secret and checks the code
 *      against the current 30-second window. A wrong code returns
 *      `success: false`; we render the server message.
 *
 * Note: if the admin has not enrolled TOTP, the server returns
 * `success: false` (no secret resolves) which we relay as a real error.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TotpStep from '@features/auth/components/steps/TotpStep'
import { formatApiError } from '@utils/formatApiError'
import { useTestVerifyApi } from '../hooks/useTestVerifyApi'
import type { AuthMethodProps } from '../authMethodRegistry'

export default function TotpPuzzle({ onSuccess }: AuthMethodProps) {
    const { t } = useTranslation()
    const api = useTestVerifyApi()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | undefined>()

    const handleSubmit = useCallback(
        async (code: string) => {
            setLoading(true)
            setError(undefined)
            try {
                const result = await api.verifyMethod('TOTP', { code })
                if (result.success) {
                    onSuccess()
                } else {
                    setError(result.message || t('mfa.verificationFailed'))
                }
            } catch (err) {
                setError(formatApiError(err, t))
            } finally {
                setLoading(false)
            }
        },
        [api, onSuccess, t],
    )

    return <TotpStep onSubmit={handleSubmit} loading={loading} error={error} />
}
