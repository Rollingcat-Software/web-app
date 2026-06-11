/**
 * AxiosClient request-interceptor logic — focused on the X-Tenant-ID
 * active-tenant header attachment (SUPER_ADMIN / ROOT tenant scoping).
 *
 * We drive the real interceptor by installing a stub axios ADAPTER that
 * resolves immediately and captures the outgoing `config.headers`, so we can
 * assert exactly which headers the interceptor attached — without a network.
 *
 * Covered:
 *  - no active tenant set  → NO X-Tenant-ID header
 *  - active tenant set     → X-Tenant-ID === that tenant id
 *  - the header is cleared between requests when the override is cleared
 *  - the Bearer token is attached when a token exists
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { AxiosAdapter } from 'axios'
import { AxiosError } from 'axios'
import { AxiosClient } from '../AxiosClient'
import { ACTIVE_TENANT_HEADER, setActiveTenantHeader } from '../activeTenant'
import type { IConfig } from '@domain/interfaces/IConfig'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { ITokenService } from '@domain/interfaces/ITokenService'

const config: IConfig = {
    apiBaseUrl: 'http://localhost:8080/api/v1',
    apiTimeout: 30000,
    useMockAPI: false,
    environment: 'test',
    logLevel: 'error',
}

const logger: ILogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

// A token service that returns a non-expiring token (shouldRefresh=false) so the
// interceptor attaches Authorization but never tries to refresh.
function makeTokenService(token: string | null): ITokenService {
    return {
        storeTokens: vi.fn().mockResolvedValue(undefined),
        getAccessToken: vi.fn().mockResolvedValue(token),
        getRefreshToken: vi.fn().mockResolvedValue('refresh'),
        clearTokens: vi.fn().mockResolvedValue(undefined),
        isAuthenticated: vi.fn().mockResolvedValue(!!token),
        getExpirationTime: vi.fn().mockReturnValue(new Date(Date.now() + 3600_000)),
        isTokenExpired: vi.fn().mockReturnValue(false),
        shouldRefresh: vi.fn().mockReturnValue(false),
    } as unknown as ITokenService
}

/**
 * Build an AxiosClient whose underlying axios instance uses a capturing adapter.
 * Returns the client and a getter for the most-recent captured request config.
 */
function buildClient(token: string | null) {
    const client = new AxiosClient(config, logger, makeTokenService(token))
    let captured: { headers?: Record<string, unknown> } | null = null
    const adapter: AxiosAdapter = async (cfg) => {
        captured = cfg as unknown as { headers?: Record<string, unknown> }
        return {
            data: { ok: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: cfg,
        }
    }
    client.getAxiosInstance().defaults.adapter = adapter
    return { client, getCaptured: () => captured }
}

describe('AxiosClient request interceptor — X-Tenant-ID scoping', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setActiveTenantHeader(null)
    })
    afterEach(() => setActiveTenantHeader(null))

    it('does NOT attach X-Tenant-ID when no active tenant is set', async () => {
        const { client, getCaptured } = buildClient('tok')
        await client.get('/users')
        const headers = getCaptured()?.headers ?? {}
        expect(headers[ACTIVE_TENANT_HEADER]).toBeUndefined()
    })

    it('attaches X-Tenant-ID with the active tenant id when one is set', async () => {
        setActiveTenantHeader('tenant-xyz')
        const { client, getCaptured } = buildClient('tok')
        await client.get('/users')
        const headers = getCaptured()?.headers ?? {}
        expect(headers[ACTIVE_TENANT_HEADER]).toBe('tenant-xyz')
    })

    it('stops attaching X-Tenant-ID after the override is cleared', async () => {
        setActiveTenantHeader('tenant-xyz')
        const { client, getCaptured } = buildClient('tok')
        await client.get('/users')
        expect((getCaptured()?.headers ?? {})[ACTIVE_TENANT_HEADER]).toBe('tenant-xyz')

        setActiveTenantHeader(null)
        await client.get('/users')
        expect((getCaptured()?.headers ?? {})[ACTIVE_TENANT_HEADER]).toBeUndefined()
    })

    it('attaches the Bearer Authorization header when a token exists', async () => {
        const { client, getCaptured } = buildClient('my-access-token')
        await client.get('/users')
        const headers = getCaptured()?.headers ?? {}
        expect(headers['Authorization']).toBe('Bearer my-access-token')
    })

    it('omits Authorization when there is no token', async () => {
        const { client, getCaptured } = buildClient(null)
        await client.get('/public')
        const headers = getCaptured()?.headers ?? {}
        expect(headers['Authorization']).toBeUndefined()
    })

    it('attaches X-Tenant-ID on a POST as well (state-changing request)', async () => {
        setActiveTenantHeader('tenant-post')
        const { client, getCaptured } = buildClient('tok')
        await client.post('/users', { name: 'x' })
        const headers = getCaptured()?.headers ?? {}
        expect(headers[ACTIVE_TENANT_HEADER]).toBe('tenant-post')
    })
})

describe('AxiosClient response interceptor — 401 refresh+retry is bounded', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setActiveTenantHeader(null)
    })
    afterEach(() => setActiveTenantHeader(null))

    // Adapter that counts calls per URL. /auth/refresh succeeds (the access token is
    // actually valid and rotates cleanly); every OTHER url returns a persistent 401 — a
    // "logical" failure (e.g. a wrong 2FA code), modeling the Auth-Methods-Testing flood.
    function build401Client(token: string | null) {
        const client = new AxiosClient(config, logger, makeTokenService(token))
        const counts: Record<string, number> = {}
        const adapter: AxiosAdapter = async (cfg) => {
            const url = cfg.url ?? ''
            counts[url] = (counts[url] ?? 0) + 1
            if (url.includes('/auth/refresh')) {
                return {
                    data: { accessToken: 'new-acc', refreshToken: 'new-ref' },
                    status: 200, statusText: 'OK', headers: {}, config: cfg,
                }
            }
            throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', cfg, null, {
                data: { message: 'invalid code' },
                status: 401, statusText: 'Unauthorized', headers: {}, config: cfg,
            } as never)
        }
        client.getAxiosInstance().defaults.adapter = adapter
        return { client, counts }
    }

    it('refreshes + retries a generic 401 AT MOST ONCE (no unbounded loop)', async () => {
        const { client, counts } = build401Client('tok')
        await expect(client.get('/users')).rejects.toBeTruthy()
        // original + exactly one retry — NOT the ~190-call loop that tripped the limiter
        expect(counts['/users']).toBe(2)
        expect(counts['/auth/refresh']).toBe(1)
    })

    it('does NOT refresh/retry a 401 from /auth/2fa/verify-method (logical wrong-code)', async () => {
        const { client, counts } = build401Client('tok')
        await expect(
            client.post('/auth/2fa/verify-method', { method: 'TOTP', data: { code: '000000' } }),
        ).rejects.toBeTruthy()
        // exactly one call — no refresh, no retry → no audit-log spam, no 5-strike 429
        expect(counts['/auth/2fa/verify-method']).toBe(1)
        expect(counts['/auth/refresh'] ?? 0).toBe(0)
    })
})
