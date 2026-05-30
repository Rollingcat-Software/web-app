import { describe, it, expect, vi } from 'vitest'
import { fetchLoginConfig, LOGIN_CONFIG_ENDPOINT } from '../login-config'
import { AuthMethodType } from '@domain/models/AuthMethod'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'

function makeHttp(get: ReturnType<typeof vi.fn>): IHttpClient {
    return { get } as unknown as IHttpClient
}

describe('fetchLoginConfig', () => {
    it('passes tenantId as a query param and normalizes the body', async () => {
        const get = vi.fn().mockResolvedValue({
            data: {
                tenantId: 't1',
                layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
            },
        })
        const cfg = await fetchLoginConfig(makeHttp(get), { tenantId: 't1' })

        expect(get).toHaveBeenCalledWith(
            LOGIN_CONFIG_ENDPOINT,
            expect.objectContaining({ params: { tenantId: 't1' } }),
        )
        expect(cfg?.layer1.methods[0].type).toBe(AuthMethodType.PASSWORD)
    })

    it('forwards clientId as the fallback query param (hosted surface)', async () => {
        const get = vi.fn().mockResolvedValue({
            data: { layer1: { methods: [{ type: 'PASSWORD' }] } },
        })
        await fetchLoginConfig(makeHttp(get), { clientId: 'client-123' })
        expect(get).toHaveBeenCalledWith(
            LOGIN_CONFIG_ENDPOINT,
            expect.objectContaining({ params: { clientId: 'client-123' } }),
        )
    })

    it('sends no identifier params when none is given (platform tenant)', async () => {
        const get = vi.fn().mockResolvedValue({
            data: { layer1: { methods: [{ type: 'EMAIL_OTP' }] } },
        })
        await fetchLoginConfig(makeHttp(get))
        expect(get).toHaveBeenCalledWith(
            LOGIN_CONFIG_ENDPOINT,
            expect.objectContaining({ params: {} }),
        )
    })

    it('returns null on any error (graceful fallback)', async () => {
        const get = vi.fn().mockRejectedValue({ response: { status: 404 } })
        expect(await fetchLoginConfig(makeHttp(get), { tenantId: 't1' })).toBeNull()
    })

    it('returns null on a malformed body', async () => {
        const get = vi.fn().mockResolvedValue({ data: { garbage: true } })
        expect(await fetchLoginConfig(makeHttp(get))).toBeNull()
    })

    it('keeps PASSKEY / APPROVE_LOGIN usernameless methods through normalization', async () => {
        const get = vi.fn().mockResolvedValue({
            data: {
                layer1: {
                    identifierRequired: false,
                    methods: [
                        { type: 'PASSKEY', usernameless: true, requiresEnrollment: true },
                        { type: 'APPROVE_LOGIN', usernameless: true, requiresEnrollment: false },
                    ],
                },
                totalSteps: 1,
                laterSteps: [],
            },
        })
        const cfg = await fetchLoginConfig(makeHttp(get), { tenantId: 't1' })
        expect(cfg?.layer1.methods.map((m) => m.type)).toEqual([
            AuthMethodType.PASSKEY,
            AuthMethodType.APPROVE_LOGIN,
        ])
        expect(cfg?.layer1.identifierRequired).toBe(false)
    })
})
