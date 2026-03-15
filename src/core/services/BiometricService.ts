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
     * Enroll a face for a user (1:1 registration)
     */
    async enrollFace(userId: string, imageBase64: string, tenantId?: string): Promise<EnrollmentResult> {
        const blob = this.base64ToBlob(imageBase64)
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

        const results = response.data.results ?? []
        return {
            found: results.length > 0,
            userId: results[0]?.user_id ?? null,
            confidence: results[0]?.confidence ?? 0,
            distance: results[0]?.distance ?? 1,
            results: results.map((r: { user_id: string; distance: number; confidence: number }) => ({
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
