import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthMethodRepository } from '../AuthMethodRepository'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import { AuthMethodType, DEFAULT_AUTH_METHODS } from '@domain/models/AuthMethod'

const apiMethod = (type: string) => ({
    id: `${type.toLowerCase()}-id`,
    type,
    name: type,
    description: type,
    category: 'BASIC',
    platforms: ['web'],
    requiresEnrollment: false,
    isActive: true,
})

const ok = (data: unknown) => ({ data, status: 200, statusText: 'OK', headers: {} })

/**
 * The flow builder must list the EDITED tenant's catalog: the global
 * /auth-methods catalog hides PUZZLE unless it is on for every tenant, so a
 * canary tenant could never add a PUZZLE layer.
 */
describe('AuthMethodRepository.listMethods', () => {
    let httpClient: IHttpClient
    let logger: ILogger
    let repository: AuthMethodRepository

    beforeEach(() => {
        httpClient = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() }
        logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
        repository = new AuthMethodRepository(httpClient, logger)
    })

    it('reads the tenant catalog when a tenant is given (PUZZLE visible on a canary tenant)', async () => {
        vi.mocked(httpClient.get).mockResolvedValue(ok([apiMethod('PASSWORD'), apiMethod('PUZZLE')]))

        const methods = await repository.listMethods('tenant-1')

        expect(httpClient.get).toHaveBeenCalledWith('/tenants/tenant-1/auth-methods/catalog')
        expect(methods.map((m) => m.type)).toContain(AuthMethodType.PUZZLE)
    })

    it('falls back to the global catalog when the tenant catalog is unavailable', async () => {
        vi.mocked(httpClient.get)
            .mockRejectedValueOnce(new Error('404'))
            .mockResolvedValueOnce(ok([apiMethod('PASSWORD')]))

        const methods = await repository.listMethods('tenant-1')

        expect(httpClient.get).toHaveBeenLastCalledWith('/auth-methods')
        expect(methods.map((m) => m.type)).toEqual([AuthMethodType.PASSWORD])
    })

    it('uses the global catalog without a tenant, and the defaults if that fails', async () => {
        vi.mocked(httpClient.get).mockRejectedValue(new Error('down'))

        const methods = await repository.listMethods()

        expect(httpClient.get).toHaveBeenCalledTimes(1)
        expect(httpClient.get).toHaveBeenCalledWith('/auth-methods')
        expect(methods).toBe(DEFAULT_AUTH_METHODS)
    })
})
