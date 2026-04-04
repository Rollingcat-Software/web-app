import axios, { AxiosInstance } from 'axios'

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
 * BiometricService — Wrapper for Biometric Processor API
 *
 * Communicates with the biometric-processor FastAPI service
 * for face enrollment, verification, search, and liveness checks.
 *
 * IL2: This service calls biometric-processor directly (via VITE_BIOMETRIC_API_URL)
 * rather than proxying through identity-core-api. This is intentional because:
 *   - Biometric operations involve large image payloads (multipart/form-data)
 *     that would add unnecessary latency if proxied through the Java backend.
 *   - identity-core-api does have a BiometricServicePort adapter for server-side
 *     biometric calls (e.g., during auth flow step-up), but the web dashboard
 *     bypasses it for direct user-initiated operations like enrollment and search.
 *   - Authentication for biometric-processor is handled via X-API-Key header.
 */
export class BiometricService {
    private readonly client: AxiosInstance

    constructor() {
        const baseURL = import.meta.env.VITE_BIOMETRIC_API_URL || 'https://bpa-fivucsas.rollingcatsoftware.com/api/v1'
        const apiKey = import.meta.env.VITE_BIOMETRIC_API_KEY || ''

        this.client = axios.create({
            baseURL,
            timeout: 30000,
            headers: {
                ...(apiKey ? { 'X-API-Key': apiKey } : {}),
            },
        })
    }

    /**
     * Enroll a face for a user (1:1 registration).
     * When multiple images are provided, uses the /enroll/multi endpoint
     * for quality-weighted template fusion (30-40% better accuracy).
     */
    async enrollFace(userId: string, imageBase64: string | string[], tenantId?: string): Promise<EnrollmentResult> {
        const images = Array.isArray(imageBase64) ? imageBase64 : [imageBase64]

        try {
            if (images.length >= 2) {
                return await this.enrollFaceMulti(userId, images, tenantId)
            }

            const blob = this.base64ToBlob(images[0])
            const formData = new FormData()
            formData.append('file', blob, 'face.jpg')
            formData.append('user_id', userId)
            if (tenantId) formData.append('tenant_id', tenantId)

            const response = await this.client.post('/enroll', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })

            return {
                success: true,
                userId,
                confidence: response.data.quality_score != null ? response.data.quality_score / 100 : 1.0,
                message: response.data.message ?? 'Face enrolled successfully',
            }
        } catch (error) {
            throw this.mapEnrollmentError(error)
        }
    }

    /**
     * Enroll using multiple images with quality-weighted fusion.
     */
    private async enrollFaceMulti(userId: string, images: string[], tenantId?: string): Promise<EnrollmentResult> {
        const formData = new FormData()
        formData.append('user_id', userId)
        if (tenantId) formData.append('tenant_id', tenantId)

        for (let i = 0; i < images.length; i++) {
            const blob = this.base64ToBlob(images[i])
            formData.append('files', blob, `face_${i}.jpg`)
        }

        const response = await this.client.post('/enroll/multi', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })

        return {
            success: true,
            userId,
            confidence: response.data.fused_quality_score != null ? response.data.fused_quality_score / 100 : 1.0,
            message: response.data.message ?? 'Face enrolled successfully',
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
     * Verify a face against an enrolled user (1:1)
     */
    async verifyFace(userId: string, imageBase64: string, tenantId?: string): Promise<VerificationResult> {
        const blob = this.base64ToBlob(imageBase64)
        const formData = new FormData()
        formData.append('file', blob, 'face.jpg')
        formData.append('user_id', userId)
        if (tenantId) formData.append('tenant_id', tenantId)

        const response = await this.client.post('/verify', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })

        return {
            verified: response.data.verified ?? false,
            confidence: response.data.confidence ?? 0,
            distance: response.data.distance ?? 1,
            threshold: response.data.threshold ?? 0.4,
            message: response.data.verified ? 'Face verified' : 'Face not recognized',
        }
    }

    /**
     * Search for a face in the database (1:N identification)
     */
    async searchFace(imageBase64: string, tenantId?: string, maxResults = 5): Promise<SearchResult> {
        const blob = this.base64ToBlob(imageBase64)
        const formData = new FormData()
        formData.append('file', blob, 'face.jpg')
        formData.append('max_results', String(maxResults))
        if (tenantId) formData.append('tenant_id', tenantId)

        const response = await this.client.post('/search', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })

        // Backend returns "matches" (not "results")
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
     * Check liveness / anti-spoofing
     */
    async checkLiveness(imageBase64: string): Promise<LivenessResult> {
        const blob = this.base64ToBlob(imageBase64)
        const formData = new FormData()
        formData.append('file', blob, 'face.jpg')

        const response = await this.client.post('/liveness', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })

        return {
            isReal: response.data.is_real ?? response.data.isReal ?? false,
            confidence: response.data.confidence ?? 0,
            spoofType: response.data.spoof_type,
        }
    }

    /**
     * Check if the biometric API is reachable
     */
    async healthCheck(): Promise<boolean> {
        try {
            await this.client.get('/health')
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
