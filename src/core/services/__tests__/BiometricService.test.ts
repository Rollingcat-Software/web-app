/**
 * Unit tests for BiometricService — locks the wire-contract for the optional
 * `tenant_id`, `client_embeddings`, and `max_results` multipart parts that
 * the identity-core-api proxy
 * (`BiometricServiceAdapter#addOptionalTenantAndEmbeddingParts`) forwards to
 * the biometric processor.
 *
 * Regression motivation (P1, audit 2026-05-07): the public method signatures
 * accepted `_tenantId` / `_clientEmbeddings` / `_maxResults` underscore-prefix
 * parameters that were silently dropped, so admins linked to multiple tenants
 * could not disambiguate the target tenant on enroll/verify/search and the
 * D2 client-side embeddings telemetry was never reaching the server.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Capture the axios instance used by BiometricService so we can drive its
// `.post` mock directly. We intercept `axios.create` to return our stub
// instead of a real axios instance.
const post = vi.fn()
const get = vi.fn()
const requestInterceptorUse = vi.fn()

const fakeAxiosInstance = {
    post,
    get,
    interceptors: {
        request: { use: requestInterceptorUse },
    },
}

vi.mock('axios', async () => {
    const actual = await vi.importActual<typeof import('axios')>('axios')
    return {
        ...actual,
        default: {
            ...actual.default,
            create: vi.fn(() => fakeAxiosInstance),
            isAxiosError: actual.default.isAxiosError,
        },
    }
})

// Mock the IoC container so the request interceptor doesn't blow up; the
// BiometricService constructor calls container.get lazily inside the
// interceptor, never at construction time, but be defensive anyway.
vi.mock('@core/di/container', () => ({
    container: {
        get: vi.fn(() => ({ getAccessToken: async () => null })),
    },
}))

// Import AFTER mocks so the module picks up the stubbed axios.
import { BiometricService } from '../BiometricService'

function lastFormData(): FormData {
    expect(post).toHaveBeenCalled()
    const call = post.mock.calls[post.mock.calls.length - 1]
    const fd = call[1]
    expect(fd).toBeInstanceOf(FormData)
    return fd as FormData
}

describe('BiometricService — multipart wire contract', () => {
    let service: BiometricService

    beforeEach(() => {
        post.mockReset()
        get.mockReset()
        requestInterceptorUse.mockReset()
        service = new BiometricService()
    })

    describe('enrollFace', () => {
        it('forwards tenant_id and client_embeddings on single-image enroll', async () => {
            post.mockResolvedValue({
                data: { verified: true, confidence: 0.95, message: 'ok' },
            })

            const tenantId = 'tenant-marmara-uuid'
            const embeddings = [[0.1, 0.2, 0.3]]
            await service.enrollFace('user-1', 'data:image/jpeg;base64,Zm9v', tenantId, embeddings)

            const fd = lastFormData()
            expect(fd.get('image')).toBeInstanceOf(Blob)
            expect(fd.get('tenant_id')).toBe(tenantId)
            expect(fd.get('client_embeddings')).toBe(JSON.stringify(embeddings))
        })

        it('forwards tenant_id and client_embeddings on multi-image enroll', async () => {
            post.mockResolvedValue({
                data: { fused_quality_score: 88, message: 'ok' },
            })

            const tenantId = 'tenant-acme-uuid'
            const embeddings = [[0.1], [0.2]]
            await service.enrollFace(
                'user-1',
                ['data:image/jpeg;base64,Zm9v', 'data:image/jpeg;base64,YmFy'],
                tenantId,
                embeddings,
            )

            const fd = lastFormData()
            expect(fd.getAll('files')).toHaveLength(2)
            expect(fd.get('tenant_id')).toBe(tenantId)
            expect(fd.get('client_embeddings')).toBe(JSON.stringify(embeddings))
        })

        it('omits tenant_id when blank/whitespace-only', async () => {
            post.mockResolvedValue({ data: { verified: true } })
            await service.enrollFace('user-1', 'data:image/jpeg;base64,Zm9v', '   ')

            const fd = lastFormData()
            expect(fd.has('tenant_id')).toBe(false)
        })

        it('omits client_embeddings when caller passes an empty array', async () => {
            post.mockResolvedValue({ data: { verified: true } })
            await service.enrollFace('user-1', 'data:image/jpeg;base64,Zm9v', 'tenant', [])

            const fd = lastFormData()
            expect(fd.has('client_embeddings')).toBe(false)
        })

        it('appends optimize=true on a re-enroll & optimize (single-image)', async () => {
            post.mockResolvedValue({ data: { verified: true } })
            await service.enrollFace('user-1', 'data:image/jpeg;base64,Zm9v', 'tenant', undefined, true)

            const fd = lastFormData()
            expect(fd.get('optimize')).toBe('true')
        })

        it('appends optimize=true on a re-enroll & optimize (multi-image)', async () => {
            post.mockResolvedValue({ data: { fused_quality_score: 90 } })
            await service.enrollFace(
                'user-1',
                ['data:image/jpeg;base64,Zm9v', 'data:image/jpeg;base64,YmFy'],
                'tenant',
                undefined,
                true,
            )

            const fd = lastFormData()
            expect(fd.get('optimize')).toBe('true')
        })

        it('does NOT append optimize on a normal enroll', async () => {
            post.mockResolvedValue({ data: { verified: true } })
            await service.enrollFace('user-1', 'data:image/jpeg;base64,Zm9v', 'tenant')

            const fd = lastFormData()
            expect(fd.has('optimize')).toBe(false)
        })
    })

    describe('verifyFace', () => {
        it('forwards tenant_id', async () => {
            post.mockResolvedValue({
                data: { verified: true, confidence: 0.9 },
            })
            await service.verifyFace('user-1', 'data:image/jpeg;base64,Zm9v', 'tenant-x')

            const fd = lastFormData()
            expect(fd.get('image')).toBeInstanceOf(Blob)
            expect(fd.get('tenant_id')).toBe('tenant-x')
        })

        it('returns null distance/threshold when backend omits them (not the legacy 1/0.4 sentinels)', async () => {
            post.mockResolvedValue({
                data: { verified: false, confidence: 0.32 },
            })
            const result = await service.verifyFace('user-1', 'data:image/jpeg;base64,Zm9v', 'tenant-x')

            expect(result.verified).toBe(false)
            expect(result.distance).toBeNull()
            expect(result.threshold).toBeNull()
        })

        it('passes through distance/threshold when backend surfaces them', async () => {
            post.mockResolvedValue({
                data: { verified: true, confidence: 0.91, distance: 0.27, threshold: 0.42 },
            })
            const result = await service.verifyFace('user-1', 'data:image/jpeg;base64,Zm9v', 'tenant-x')

            expect(result.distance).toBe(0.27)
            expect(result.threshold).toBe(0.42)
        })

        it('forwards client_embeddings on verify when provided', async () => {
            post.mockResolvedValue({
                data: { verified: true, confidence: 0.9 },
            })
            await service.verifyFace(
                'user-1',
                'data:image/jpeg;base64,Zm9v',
                'tenant-x',
                [[0.5, 0.6]],
            )

            const fd = lastFormData()
            expect(fd.get('client_embeddings')).toBe(JSON.stringify([[0.5, 0.6]]))
        })
    })

    describe('searchFace', () => {
        it('forwards tenant_id and max_results', async () => {
            post.mockResolvedValue({
                data: { matches: [], best_match: null },
            })
            await service.searchFace('data:image/jpeg;base64,Zm9v', 'tenant-y', 7)

            const fd = lastFormData()
            expect(fd.get('file')).toBeInstanceOf(Blob)
            expect(fd.get('tenant_id')).toBe('tenant-y')
            expect(fd.get('max_results')).toBe('7')
        })

        it('uses the default max_results when caller does not pass one', async () => {
            post.mockResolvedValue({ data: { matches: [] } })
            await service.searchFace('data:image/jpeg;base64,Zm9v', 'tenant-y')

            const fd = lastFormData()
            expect(fd.get('max_results')).toBe('5')
        })

        it('omits max_results when explicitly given 0 or a negative value', async () => {
            post.mockResolvedValue({ data: { matches: [] } })
            await service.searchFace('data:image/jpeg;base64,Zm9v', 'tenant-y', 0)

            const fd = lastFormData()
            expect(fd.has('max_results')).toBe(false)
        })
    })
})
