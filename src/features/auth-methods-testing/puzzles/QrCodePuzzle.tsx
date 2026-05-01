/**
 * QrCodePuzzle — exercises the real QR code path against the logged-in
 * admin's own user record.
 *
 *   1. POST /api/v1/qr/generate/{adminId} mints a token (5-minute TTL).
 *      The token is also written to the OTP store under the key
 *      `2fa-qr:<adminId>` so /auth/2fa/verify-method can validate it.
 *   2. The QR widget displays the token; in this playground the admin
 *      can also paste it manually to confirm the round-trip works.
 *   3. POST /auth/2fa/verify-method with method `QR_CODE` and `{ token }`.
 *   4. A wrong token returns `success: false`; we render the server
 *      message via the step's `error` prop.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import QrCodeStep from '@features/auth/components/steps/QrCodeStep'
import { formatApiError } from '@utils/formatApiError'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useTestVerifyApi } from '../hooks/useTestVerifyApi'
import type { AuthMethodProps } from '../authMethodRegistry'

export default function QrCodePuzzle({ onSuccess, onError }: AuthMethodProps) {
    const { t } = useTranslation()
    const { user } = useAuth()
    const api = useTestVerifyApi()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | undefined>()

    const handleGenerateToken = useCallback(
        async (userId: string) => {
            return api.generateQrToken(userId)
        },
        [api],
    )

    const handleInvalidateToken = useCallback(
        async (token: string) => {
            await api.invalidateQrToken(token)
        },
        [api],
    )

    const handleSubmit = useCallback(
        async (token: string) => {
            setLoading(true)
            setError(undefined)
            try {
                const result = await api.verifyMethod('QR_CODE', { token })
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

    // The QR step requires a user id to mint the token — guard explicitly
    // so we don't show a half-broken UI to a session that somehow lost its
    // identity.
    if (!user?.id) {
        onError(t('mfa.qrCode.autoUnavailable'))
        return null
    }

    return (
        <QrCodeStep
            userId={user.id}
            onGenerateToken={handleGenerateToken}
            onInvalidateToken={handleInvalidateToken}
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
        />
    )
}
