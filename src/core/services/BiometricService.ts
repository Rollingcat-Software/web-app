import axios, { AxiosInstance } from 'axios'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import { config as envConfig } from '@config/env'

export interface EnrollmentResult {
    success: boolean
    userId: string
    confidence: number
    message: string
}

export interface VerificationResult {
    verified: boolean
    confidence: number
    /**
     * Cosine distance between the probe and the enrolled centroid (lower = more similar).
     * `null` when the backend did not surface it on this response — UI should render
     * "unavailable" rather than a hardcoded fallback. Wired in 2026-05-08 (P1, audit
     * 2026-05-07) once Team A landed `distance`/`threshold` on the proxy response.
     */
    distance: number | null
    /**
     * Decision threshold in cosine-distance space (verified iff `distance <= threshold`).
     * `null` when the backend did not surface it. Treat the same as `distance` above —
     * never substitute the historical 0.4 sentinel into the UI.
     */
    threshold: number | null
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
        /**
         * Human-readable owner name (firstName + lastName), resolved best-effort
         * from `GET /users/{userId}` after the 1:N search returns. Optional because
         * the biometric-processor search payload only carries `user_id`; the name
         * is hydrated client-side in `useFaceSearch` (mirrors `useVoiceSearch`).
         * The UI prefers name → email → raw id, so a soft-deleted / missing owner
         * (lookup 404 → these stay undefined) degrades to showing the raw id.
         */
        userName?: string
        userEmail?: string
        /**
         * True iff the `GET /users/{userId}` hydration lookup resolved a live
         * record (HTTP 200). False when the owner is soft-deleted / missing
         * (404) or the lookup failed — the UI then shows the raw id labelled
         * "unknown user". Undefined before hydration runs. Mirrors the backend's
         * lazy-proxy null-safe pattern: a missing owner never throws, it just
         * degrades the label.
         */
        userResolved?: boolean
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
        const baseURL = envConfig.apiBaseUrl

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
     * @param tenantId         Optional tenant scope (defense-in-depth — backend already
     *                         derives tenant from the authenticated principal, but for
     *                         admins linked to multiple tenants explicitly forwarding
     *                         `tenant_id` removes ambiguity at the biometric processor).
     * @param clientEmbeddings Optional per-image 512-dim landmark-geometry embeddings,
     *                         JSON-serialized and forwarded as `client_embeddings` for
     *                         D2 server-side telemetry.
     */
    async enrollFace(
        userId: string,
        imageBase64: string | string[],
        tenantId?: string,
        clientEmbeddings?: (number[] | null)[],
        optimize = false,
    ): Promise<EnrollmentResult> {
        const images = Array.isArray(imageBase64) ? imageBase64 : [imageBase64]

        try {
            if (images.length >= 2) {
                return await this.enrollFaceMulti(userId, images, tenantId, clientEmbeddings, optimize)
            }

            const blob = this.base64ToBlob(images[0])
            const formData = new FormData()
            // identity-core-api `enrollFace` expects field name `image`.
            formData.append('image', blob, 'face.jpg')
            // Defense-in-depth: forward tenant + client embeddings to the proxy
            // (BiometricServiceAdapter#addOptionalTenantAndEmbeddingParts).
            this.appendTenantAndEmbeddings(formData, tenantId, clientEmbeddings)
            // Re-enroll & optimize: when set, the proxy forwards optimize=true to
            // the biometric-processor, which FUSES this capture into the user's
            // existing template (centroid update) instead of a plain replace.
            if (optimize) {
                formData.append('optimize', 'true')
            }

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
     * Enroll a face by submitting ONLY its 512-d Facenet512 embedding (privacy-
     * preserving counterpart of {@link enrollFace}).
     *
     * The raw face image NEVER leaves the device: the browser computes the
     * authoritative Facenet512 vector locally (via `embedCapturedFace`) and posts
     * just the vector, exactly mirroring how the FACE *verify* path submits
     * `{ embedding }` instead of an image. This closes audit item H2 — FACE
     * enrollment previously always uploaded raw images even when client-side
     * embedding was enabled for verify.
     *
     * Wire contract (FROZEN, mirrors api `EnrollEmbeddingRequest`):
     *   POST /api/v1/biometric/enroll-embedding/{userId}
     *   Content-Type: application/json
     *   body: { embedding: number[512], tenant_id?: string }
     * `tenant_id` (snake_case) is added ONLY when `tenantId` is a non-blank
     * string (defense-in-depth — the backend already derives tenant from the
     * authenticated principal, but explicit forwarding disambiguates admins
     * linked to multiple tenants).
     *
     * The api gate is FAIL-CLOSED: it returns 403 when the tenant's
     * `app.auth.client-side-embedding` flag is off (so the caller must flip the
     * identity flag before the web flag), and 400 on a wrong-length vector. There
     * is intentionally no `optimize`/template-fusion field on this route — a
     * re-enroll replaces the stored template.
     *
     * @param userId    The user whose face template is being (re)enrolled.
     * @param embedding The L2-normalized 512-float Facenet512 vector.
     * @param tenantId  Optional tenant scope (forwarded as `tenant_id`).
     */
    async enrollFaceEmbedding(
        userId: string,
        embedding: number[],
        tenantId?: string,
    ): Promise<EnrollmentResult> {
        try {
            const body: { embedding: number[]; tenant_id?: string } = { embedding }
            // Mirror appendTenantAndEmbeddings' blank check — only forward a real tenant.
            if (tenantId && tenantId.trim().length > 0) {
                body.tenant_id = tenantId
            }

            const response = await this.client.post(
                `/biometric/enroll-embedding/${encodeURIComponent(userId)}`,
                body,
                { headers: { 'Content-Type': 'application/json' } },
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
    private async enrollFaceMulti(
        userId: string,
        images: string[],
        tenantId?: string,
        clientEmbeddings?: (number[] | null)[],
        optimize = false,
    ): Promise<EnrollmentResult> {
        const formData = new FormData()
        for (let i = 0; i < images.length; i++) {
            const blob = this.base64ToBlob(images[i])
            // identity-core-api `enrollFaceMulti` expects field name `files`.
            formData.append('files', blob, `face_${i}.jpg`)
        }
        this.appendTenantAndEmbeddings(formData, tenantId, clientEmbeddings)
        // Re-enroll & optimize — see enrollFace().
        if (optimize) {
            formData.append('optimize', 'true')
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
     * Normalize a biometric-enrollment error before re-throwing.
     *
     * We intentionally PRESERVE the original axios error (rather than collapsing
     * it into a plain `Error` with a hardcoded English message). Every call site
     * renders the thrown error through `formatApiError(err, t)` (i18n EN/TR), and
     * `formatApiError` now maps the FastAPI `error_code` (FACE_NOT_DETECTED /
     * MULTIPLE_FACES / POOR_IMAGE_QUALITY / FACE_ALREADY_ENROLLED) to localized
     * `errors.*` keys. Collapsing to English here would lose the code and force
     * the generic `errors.unknown` fallback.
     *
     * The only normalization we do is to synthesize a `FACE_ALREADY_ENROLLED`
     * code for a 409 that lacks one, so `formatApiError` can localize the
     * "already enrolled" case (the biometric proxy returns a bare 409).
     */
    private mapEnrollmentError(error: unknown): Error {
        if (axios.isAxiosError(error) && error.response) {
            const status = error.response.status
            const data = (error.response.data ?? {}) as { error_code?: string }
            if (status === 409 && !data.error_code) {
                // Tag the response so formatApiError maps it to
                // `errors.faceAlreadyEnrolled` instead of the generic conflict.
                data.error_code = 'FACE_ALREADY_ENROLLED'
                error.response.data = data
            }
            // axios errors are Error instances — re-throw as-is so the response
            // (status + error_code) survives to formatApiError for i18n.
            return error
        }
        return error instanceof Error ? error : new Error('Face enrollment failed.')
    }

    /**
     * Verify a face against an enrolled user (1:1).
     * `tenantId` is forwarded to the proxy as `tenant_id` for defense-in-depth
     * (backend principal-derived tenant is authoritative; explicit forwarding
     * disambiguates admins linked to multiple tenants).
     */
    async verifyFace(
        userId: string,
        imageBase64: string,
        tenantId?: string,
        clientEmbeddings?: (number[] | null)[],
    ): Promise<VerificationResult> {
        const blob = this.base64ToBlob(imageBase64)
        const formData = new FormData()
        // identity-core-api `verifyFace` expects field name `image`.
        formData.append('image', blob, 'face.jpg')
        this.appendTenantAndEmbeddings(formData, tenantId, clientEmbeddings)

        const response = await this.client.post(
            `/biometric/verify/${encodeURIComponent(userId)}`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } },
        )

        // Read distance/threshold defensively. Team A is shipping these on the
        // proxy response; until the backend rebuild lands they may be absent.
        // Use `?? null` (NOT a hardcoded `1`/`0.4`) so the UI can render
        // "unavailable" instead of a fabricated decision boundary.
        const distance = typeof response.data.distance === 'number' ? response.data.distance : null
        const threshold = typeof response.data.threshold === 'number' ? response.data.threshold : null
        return {
            verified: response.data.verified ?? false,
            confidence: response.data.confidence ?? 0,
            distance,
            threshold,
            message: response.data.message ?? (response.data.verified ? 'Face verified' : 'Face not recognized'),
        }
    }

    /**
     * Search for a face in the database (1:N identification).
     * Requires an authenticated session — backend mirror endpoint is gated on
     * `isAuthenticated()`. Pre-auth callers will receive 401.
     */
    async searchFace(imageBase64: string, tenantId?: string, maxResults = 5): Promise<SearchResult> {
        const blob = this.base64ToBlob(imageBase64)
        const formData = new FormData()
        // identity-core-api `searchFace` expects field name `file`.
        formData.append('file', blob, 'face.jpg')
        this.appendTenantAndEmbeddings(formData, tenantId)
        if (Number.isFinite(maxResults) && maxResults > 0) {
            formData.append('max_results', String(maxResults))
        }

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

    /**
     * Append the optional `tenant_id` + `client_embeddings` parts to a multipart
     * request. Mirrors the field names that
     * `BiometricServiceAdapter#addOptionalTenantAndEmbeddingParts` expects on the
     * Java proxy (snake_case) so the proxy can forward them unchanged to the
     * biometric processor.
     */
    private appendTenantAndEmbeddings(
        formData: FormData,
        tenantId?: string,
        clientEmbeddings?: (number[] | null)[],
    ): void {
        if (tenantId && tenantId.trim().length > 0) {
            formData.append('tenant_id', tenantId)
        }
        if (clientEmbeddings && clientEmbeddings.length > 0) {
            try {
                formData.append('client_embeddings', JSON.stringify(clientEmbeddings))
            } catch {
                // JSON.stringify can throw on circular refs — drop quietly,
                // server-side logging-only telemetry is not auth-critical.
            }
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
