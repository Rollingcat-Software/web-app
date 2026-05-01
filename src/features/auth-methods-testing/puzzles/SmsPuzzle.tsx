/**
 * SmsPuzzle — exercises the real SMS OTP path against the logged-in admin's
 * own phone number.
 *
 *   1. User clicks "Send code" → POST /auth/2fa/send-sms (Twilio Verify in
 *      prod, falls back to in-house OTP store when the SMS gateway is
 *      disabled).
 *   2. User enters the 6-digit code → POST /auth/2fa/verify-method with
 *      method `SMS_OTP`.
 *   3. On `success: false` we surface the server message; on a 400 (no
 *      phone on file) we surface the standard formatApiError mapping.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SmsOtpStep from '@features/auth/components/steps/SmsOtpStep'
import { formatApiError } from '@utils/formatApiError'
import { useTestVerifyApi } from '../hooks/useTestVerifyApi'
import type { AuthMethodProps } from '../authMethodRegistry'

export default function SmsPuzzle({ onSuccess }: AuthMethodProps) {
    const { t } = useTranslation()
    const api = useTestVerifyApi()

    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | undefined>()

    const handleSendOtp = useCallback(async () => {
        setSending(true)
        setError(undefined)
        try {
            await api.sendSmsOtp()
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
                const result = await api.verifyMethod('SMS_OTP', { code })
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
        <SmsOtpStep
            onSubmit={handleSubmit}
            onSendOtp={handleSendOtp}
            loading={loading || sending}
            error={error}
        />
    )
}
