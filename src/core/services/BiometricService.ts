import axios, { AxiosInstance } from 'axios'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { ITokenService } from '@domain/interfaces/ITokenService'

export interface EnrollmentResult {
    success: boolean
    userId: string
    confidence: number
    message: string
}

export interface VerificationResult {
    verified: boolean
    confidence: number
    distance: number
    threshold: number
    message: string
}

export interface SearchResult {
    found: boolean
    userId: string | null
    confidence: number
    distance: number
    results: Array<{
        userId: string
        distance: number
        confidence: number
    }>
}

export interface LivenessResult {
    isReal: boolean
    confidence: number
    spoofType?: string
}

/**
 * BiometricService — Wrapper for biometric operations.
 *
 * SECURITY (Sec-P0b, audit 2026-04-28):
 * All requests go through identity-core-api at `${VITE_API_BASE_URL}/biometric/*`.
 * The browser bundle MUST NOT carry the biometric-processor X-API-Key — that key
 * is held server-side and applied by `BiometricServiceAdapter` inside the Java
 * backend, which talks to bio.fivucsas.com over the internal docker network.
 *
 * The browser authenticates to identity-core-api with the user's Bearer JWT
 * (pulled from `ITokenService` via the IoC container), and identity-core-api
 * enforces RBAC + tenant scoping before delegating to the biometric processor.
 *
 * NOTE: face SEARCH (1:N identification) and continuous VERIFY require an
 * authenticated session. The legacy "log in by face" flow on `LoginPage` is
 * pre-auth, has no JWT, and is NOT supported by the proxy as currently
 * designed — that path will surface a 401 until a dedicated public face-login
 * endpoint is added on the backend (logged as a follow-up).
 */
export class BiometricService {
    private readonly client: AxiosInstance

    constructor() {
        const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1'

        this.client = axios.create({
            baseURL,
            timeout: 30000,
        })

        // Inject the user's Bearer JWT on every call. We resolve TokenService lazily
        // per-request so we don't have to thread DI through the singleton constructor.
        this.client.interceptors.request.use(async (config) => {
            try {
                const tokenService = container.get<ITokenService>(TYPES.TokenService)
                const token = await tokenService.getAccessToken()
                if (token) {
                    config.headers = config.headers ?? {}
                    config.headers.Authorization = `Bearer ${token}`
                }
            } catch {
                // No token available (pre-auth caller) — let the backend reject.
            }
            return config
        })
    }

    /**
     * Enroll a face for a user (1:1 registration).
     * When multiple images are provided, uses the /enroll/multi endpoint
     * for quality-weighted template fusion (30-40% better accuracy).
     *
     * @param imageBase64      Single or multiple base64 JPEG data-URLs (224x224 client crop).
     * @param tenantId         Optional tenant scope (currently unused by the proxy — backend
     *                         derives tenant from the authenticated user; recorded as a
     *                         follow-up if explicit override is ever needed).
     * @param clientEmbeddings Optional per-image 512-dim landmark-geometry embeddings.
     *                         Currently dropped at the proxy boundary (D2 telemetry will
     *                         need a backend pass-through enhancement to land server-side).
     */
    async enrollFace(
        userId: string,
        imageBase64: string | string[],
        // tenantId/clientEmbeddings retained on the API for caller compat;
        // backend proxy currently does not forward them (see follow-up note).
        _tenantId?: string,
        _clientEmbeddings?: (number[] | null)[],
    ): Promise<EnrollmentResult> {
        const images = Array.isArray(imageBase64) ? imageBase64 : [imageBase64]

        try {
            if (images.length >= 2) {
                return await this.enrollFaceMulti(userId, images)
            }

            const blob = this.base64ToBlob(images[0])
            const formData = new FormData()
            // identity-core-api `enrollFace` expects field name `image`.
            formData.append('image', blob, 'face.jpg')

            const response = await this.client.post(
                `/biometric/enroll/${encodeURIComponent(userId)}`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            )

            // Proxy returns BiometricVerificationResponse: {verified, confidence, message}.
            return {
                success: response.data.verified !== false,
                userId,
                confidence: typeof response.data.confidence === 'number' ? response.data.confidence : 1.0,
                message: response.data.message ?? 'Face enrolled successfully',
            }
        } catch (error) {
            throw this.mapEnrollmentError(error)
        }
    }

    /**
     * Enroll using multiple images with quality-weighted fusion.
     */
    private async enrollFaceMulti(userId: string, images: string[]): Promise<EnrollmentResult> {
        const formData = new FormData()
        for (let i = 0; i < images.length; i++) {
            const blob = this.base64ToBlob(images[i])
            // identity-core-api `enrollFaceMulti` expects field name `files`.
            formData.append('files', blob, `face_${i}.jpg`)
        }

        const response = await this.client.post(
            `/biometric/enroll/multi/${encodeURIComponent(userId)}`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } },
        )

        // Multi-enroll returns the raw biometric-processor payload — preserve the
        // legacy `fused_quality_score` mapping where available.
        const fusedQuality = response.data?.fused_quality_score
        return {
            success: true,
            userId,
            confidence: typeof fusedQuality === 'number' ? fusedQuality / 100 : 1.0,
            message: response.data?.message ?? 'Face enrolled successfully',
        }
    }

    /**
     * Map biometric API errors to user-friendly messages.
     */
    private mapEnrollmentError(error: unknown): Error {
        if (axios.isAxiosError(error) && error.response) {
            const status = error.response.status
            const data = error.response.data
            const errorCode = data?.error_code ?? ''
            const detail = data?.detail ?? data?.message ?? ''

            if (status === 400) {
                switch (errorCode) {
                    case 'FACE_NOT_DETECTED':
                        return new Error('No face detected in the captured image. Please try again with better lighting and ensure your face is clearly visible.')
                    case 'MULTIPLE_FACES':
                        return new Error('Multiple faces detected. Please ensure only your face is in the frame.')
                    case 'POOR_IMAGE_QUALITY':
                        return new Error('Image quality is too low. Please try again with better lighting and hold still during capture.')
                    default:
                        return new Error(detail || 'Face enrollment failed. Please try again.')
                }
            }
            if (status === 409) {
                return new Error('Face is already enrolled. Revoke the existing enrollment first to re-enroll.')
            }
            return new Error(detail || `Face enrollment failed (HTTP ${status}). Please try again.`)
        }
        return error instanceof Error ? error : new Error('Face enrollment failed. Please try again.')
    }

    /**
     * Verify a face against an enrolled user (1:1).
     * `tenantId` retained for caller compat; backend proxy uses the authenticated
     * user's tenant context.
     */
    async verifyFace(userId: string, imageBase64: string, _tenantId?: string): Promise<VerificationResult> {
        const blob = this.base64ToBlob(imageBase64)
        const formData = new FormData()
        // identity-core-api `verifyFace` expects field name `image`.
        formData.append('image', blob, 'face.jpg')

        const response = await this.client.post(
            `/biometric/verify/${encodeURIComponent(userId)}`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } },
        )

        return {
            verified: response.data.verified ?? false,
            confidence: response.data.confidence ?? 0,
            // Proxy's BiometricVerificationResponse does not currently surface
            // distance/threshold; default to safe sentinels.
            distance: response.data.distance ?? 1,
            threshold: response.data.threshold ?? 0.4,
            message: response.data.message ?? (response.data.verified ? 'Face verified' : 'Face not recognized'),
        }
    }

    /**
     * Search for a face in the database (1:N identification).
     * Requires an authenticated session — backend mirror endpoint is gated on
     * `isAuthenticated()`. Pre-auth callers will receive 401.
     */
    async searchFace(imageBase64: string, _tenantId?: string, _maxResults = 5): Promise<SearchResult> {
        const blob = this.base64ToBlob(imageBase64)
        const formData = new FormData()
        // identity-core-api `searchFace` expects field name `file`.
        formData.append('file', blob, 'face.jpg')

        const response = await this.client.post(
            '/biometric/search',
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } },
        )

        // Backend proxies the biometric-processor payload through unchanged.
        const matches = response.data.matches ?? response.data.results ?? []
        return {
            found: matches.length > 0 || response.data.found === true,
            userId: response.data.best_match?.user_id ?? matches[0]?.user_id ?? null,
            confidence: response.data.best_match?.confidence ?? matches[0]?.confidence ?? 0,
            distance: response.data.best_match?.distance ?? matches[0]?.distance ?? 1,
            results: matches.map((r: { user_id: string; distance: number; confidence: number }) => ({
                userId: r.user_id,
                distance: r.distance,
                confidence: r.confidence,
            })),
        }
    }

    /**
     * Liveness check — NOT exposed by identity-core-api as a dedicated mirror endpoint
     * (liveness is now bundled into /enroll and /verify on the biometric processor
     * via `LIVENESS_MODE=passive`). Retained for caller-API compatibility; throws
     * to make accidental usage visible.
     */
    async checkLiveness(_imageBase64: string): Promise<LivenessResult> {
        throw new Error('checkLiveness is no longer exposed as a standalone call — liveness is enforced server-side inside /enroll and /verify.')
    }

    /**
     * Check if the biometric API is reachable (via proxy).
     */
    async healthCheck(): Promise<boolean> {
        try {
            await this.client.get('/biometric/health')
            return true
        } catch {
            return false
        }
    }

    private base64ToBlob(base64: string): Blob {
        // Strip data URL prefix if present
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        return new Blob([new Uint8Array(byteNumbers)], { type: 'image/jpeg' })
    }
}

// Singleton instance
let biometricServiceInstance: BiometricService | null = null

export function getBiometricService(): BiometricService {
    if (!biometricServiceInstance) {
        biometricServiceInstance = new BiometricService()
    }
    return biometricServiceInstance
}
