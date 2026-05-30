import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HttpResponse, IHttpClient } from '@domain/interfaces/IHttpClient'
import {
    APPROVE_LOGIN_API,
    APPROVE_LOGIN_POLL_INTERVAL_MS,
    pollApproveLoginSession,
    startApproveLoginSession,
    type ApproveLoginPoll,
    type ApproveLoginSession,
} from '../approve-login'

function ok<T>(data: T): HttpResponse<T> {
    return { data, status: 200, statusText: 'OK', headers: {} }
}

/** Build an axios-like error carrying an HTTP status. */
function httpError(status: number): Error & { response: { status: number } } {
    const err = new Error(`HTTP ${status}`) as Error & { response: { status: number } }
    err.response = { status }
    return err
}

function makeHttpClient(): IHttpClient {
    return {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn(),
    }
}

describe('approve-login', () => {
    let http: IHttpClient

    beforeEach(() => {
        http = makeHttpClient()
    })

    it('exposes a 2s poll interval', () => {
        expect(APPROVE_LOGIN_POLL_INTERVAL_MS).toBe(2000)
    })

    describe('startApproveLoginSession', () => {
        it('POSTs the email and returns the session + match number', async () => {
            const session: ApproveLoginSession = {
                sessionId: 'sess-abc',
                matchNumber: 42,
                status: 'PENDING',
                expiresAtEpochSeconds: 1_900_000_000,
            }
            ;(http.post as ReturnType<typeof vi.fn>).mockResolvedValue(ok(session))

            const result = await startApproveLoginSession(http, 'user@example.com')

            expect(http.post).toHaveBeenCalledWith(APPROVE_LOGIN_API.SESSION, {
                email: 'user@example.com',
            })
            expect(result).toEqual(session)
        })
    })

    describe('pollApproveLoginSession', () => {
        it('GETs the by-id endpoint with an encoded session id', async () => {
            const poll: ApproveLoginPoll = { status: 'PENDING' }
            ;(http.get as ReturnType<typeof vi.fn>).mockResolvedValue(ok(poll))

            const result = await pollApproveLoginSession(http, 'a/b c')

            expect(http.get).toHaveBeenCalledWith(APPROVE_LOGIN_API.SESSION_BY_ID('a/b c'))
            // encodeURIComponent must have been applied in the URL builder.
            expect((http.get as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('a%2Fb%20c')
            expect(result).toEqual(poll)
        })

        it('returns APPROVED with tokens when the other device approves', async () => {
            const poll: ApproveLoginPoll = {
                status: 'APPROVED',
                accessToken: 'at',
                refreshToken: 'rt',
                expiresIn: 900,
                role: 'TENANT_ADMIN',
            }
            ;(http.get as ReturnType<typeof vi.fn>).mockResolvedValue(ok(poll))

            const result = await pollApproveLoginSession(http, 'sess-1')
            expect(result.status).toBe('APPROVED')
            expect(result.accessToken).toBe('at')
            expect(result.role).toBe('TENANT_ADMIN')
        })

        it('normalizes a 404 (session gone) to EXPIRED', async () => {
            (http.get as ReturnType<typeof vi.fn>).mockRejectedValue(httpError(404))
            const result = await pollApproveLoginSession(http, 'sess-gone')
            expect(result).toEqual({ status: 'EXPIRED' })
        })

        it('normalizes a 410 (session gone) to EXPIRED', async () => {
            (http.get as ReturnType<typeof vi.fn>).mockRejectedValue(httpError(410))
            const result = await pollApproveLoginSession(http, 'sess-gone')
            expect(result).toEqual({ status: 'EXPIRED' })
        })

        it('rethrows transient errors (e.g. 500) so the caller can keep polling', async () => {
            (http.get as ReturnType<typeof vi.fn>).mockRejectedValue(httpError(500))
            await expect(pollApproveLoginSession(http, 'sess-1')).rejects.toMatchObject({
                response: { status: 500 },
            })
        })

        it('rethrows a network error with no response', async () => {
            (http.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network down'))
            await expect(pollApproveLoginSession(http, 'sess-1')).rejects.toThrow('Network down')
        })
    })
})
