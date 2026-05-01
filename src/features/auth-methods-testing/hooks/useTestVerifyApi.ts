/**
 * useTestVerifyApi — thin wrapper around the production HTTP client that
 * exposes the 2FA verification endpoints as plain async functions for the
 * Auth Methods Testing playground.
 *
 * Why this exists:
 *   The Auth Methods Testing page is a self-test surface for the currently
 *   logged-in admin. We do NOT mint a fresh MFA session token here (that
 *   would log the admin out). Instead we use the JWT-protected `/auth/2fa/*`
 *   endpoints which run the same verification logic against the caller's
 *   own user record (TOTP secret, phone, email, QR token store).
 *
 *   Endpoints used (all require an authenticated admin JWT):
 *   - POST /auth/2fa/send                — emails an OTP to the admin
 *   - POST /auth/2fa/send-sms            — texts an OTP to the admin
 *   - POST /auth/qr/generate/{userId}    — mints a QR token (qr:generate or self)
 *   - POST /auth/2fa/verify-method       — verifies any AuthMethodType
 *
 *   The verify endpoint returns `{ success: boolean, message: string }` —
 *   we return that boolean as-is so the puzzle can surface a real error.
 */
import { useCallback } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'

export interface VerifyMethodResult {
    success: boolean
    message?: string
}

export interface SendOtpResult {
    /** Server-masked email or phone identifier returned for display. */
    masked?: string
}

export interface QrTokenResult {
    token: string
    expiresInSeconds: number
}

export interface TestVerifyApi {
    /** POST /auth/2fa/send — emails an OTP to the logged-in admin. */
    sendEmailOtp: () => Promise<SendOtpResult>
    /** POST /auth/2fa/send-sms — sends an SMS OTP to the logged-in admin. */
    sendSmsOtp: () => Promise<SendOtpResult>
    /** POST /auth/qr/generate/{userId} — mints a QR token for the admin. */
    generateQrToken: (userId: string) => Promise<QrTokenResult>
    /** DELETE /api/v1/qr/{token} — best-effort token invalidation. */
    invalidateQrToken: (token: string) => Promise<void>
    /**
     * POST /auth/2fa/verify-method — verifies an arbitrary auth method
     * against the caller's own credentials. Always resolves; on a wrong
     * code the server returns 200 + `{ success: false }`.
     */
    verifyMethod: (
        method: string,
        data: Record<string, unknown>,
    ) => Promise<VerifyMethodResult>
}

/**
 * Hook that exposes the test-mode verification API. Resolves the production
 * HTTP client from the DI container so every request travels through the
 * same auth interceptors as the rest of the dashboard.
 */
export function useTestVerifyApi(): TestVerifyApi {
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)

    const sendEmailOtp = useCallback(async (): Promise<SendOtpResult> => {
        const res = await httpClient.post<{ message?: string; email?: string }>(
            '/auth/2fa/send',
        )
        return { masked: res.data?.email }
    }, [httpClient])

    const sendSmsOtp = useCallback(async (): Promise<SendOtpResult> => {
        const res = await httpClient.post<{ message?: string; phone?: string }>(
            '/auth/2fa/send-sms',
        )
        return { masked: res.data?.phone }
    }, [httpClient])

    const generateQrToken = useCallback(
        async (userId: string): Promise<QrTokenResult> => {
            const res = await httpClient.post<{
                token: string
                expiresInSeconds?: number
            }>(`/qr/generate/${userId}`)
            return {
                token: res.data.token,
                expiresInSeconds: res.data.expiresInSeconds ?? 300,
            }
        },
        [httpClient],
    )

    const invalidateQrToken = useCallback(
        async (token: string): Promise<void> => {
            try {
                await httpClient.delete(`/qr/${encodeURIComponent(token)}`)
            } catch {
                // Best-effort — server-side TTL will handle the rest.
            }
        },
        [httpClient],
    )

    const verifyMethod = useCallback(
        async (
            method: string,
            data: Record<string, unknown>,
        ): Promise<VerifyMethodResult> => {
            const res = await httpClient.post<{
                success?: boolean
                message?: string
            }>('/auth/2fa/verify-method', { method, data })
            return {
                success: res.data?.success === true,
                message: res.data?.message,
            }
        },
        [httpClient],
    )

    return {
        sendEmailOtp,
        sendSmsOtp,
        generateQrToken,
        invalidateQrToken,
        verifyMethod,
    }
}
