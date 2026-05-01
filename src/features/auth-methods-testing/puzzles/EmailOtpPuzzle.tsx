/**
 * EmailOtpPuzzle — exercises the real Email OTP path against the logged-in
 * admin's own account.
 *
 *   1. When the user clicks "Send code" inside EmailOtpStep we POST
 *      /auth/2fa/send → server emails a 6-digit code. (Nothing is sent
 *      automatically on mount; that lets the admin re-render the puzzle
 *      without spamming themselves.)
 *   2. User enters the code; we POST /auth/2fa/verify-method with method
 *      `EMAIL_OTP` and `{ code }`.
 *   3. On `success: true` we resolve `onSuccess()`; on `success: false`
 *      we surface the server message (or an i18n-mapped fallback) via
 *      the step's `error` prop. No silent successes.
 */
import { useCallback, useState } from 'react'
import EmailOtpStep from '@features/auth/components/steps/EmailOtpStep'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import { useTestVerifyApi } from '../hooks/useTestVerifyApi'
import type { AuthMethodProps } from '../authMethodRegistry'

export default function EmailOtpPuzzle({ onSuccess }: AuthMethodProps) {
    const { t } = useTranslation()
    const api = useTestVerifyApi()

    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | undefined>()

    const handleSendOtp = useCallback(async () => {
        setSending(true)
        setError(undefined)
        try {
            await api.sendEmailOtp()
        } catch (err) {
            setError(formatApiError(err, t))
        } finally {
            setSending(false)
        }
    }, [api, t])

    const handleSubmit = useCallback(
        async (code: string) => {
            setLoading(true)
            setError(undefined)
            try {
                const result = await api.verifyMethod('EMAIL_OTP', { code })
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

    return (
        <EmailOtpStep
            onSubmit={handleSubmit}
            onSendOtp={handleSendOtp}
            loading={loading || sending}
            error={error}
        />
    )
}
