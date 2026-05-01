/**
 * Unit tests for formatApiError — the centralized HTTP error → i18n message
 * mapper. Regressions here have shipped wrong copy ("Beklenmeyen bir hata
 * oluştu" on wrong-password — see USER-BUG-6) so we lock in the contract:
 *
 *  - 401 from /auth/login              → auth-specific "invalid credentials"
 *  - 401 from any other path           → generic "session expired"
 *  - errorCode === 'INVALID_CREDENTIALS' (or carried in `error` field per
 *    Spring's ErrorResponse envelope) → invalid credentials irrespective of
 *    URL, so the same backend code is honoured from the widget + hosted
 *    flows alike
 *  - errorCode === 'NEEDS_ENROLLMENT'  → distinct, not "wrong creds"
 *  - errorCode === 'MFA_REQUIRED'      → distinct, not "wrong creds"
 *  - 5xx                                → server error
 *  - network / TypeError                → network error
 *  - safe backend `message`             → passed through
 *  - "Exception"/"status code" message  → stripped, fall to generic
 */

import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { formatApiError } from '../formatApiError'

// Identity translator — keeps the assertions checking i18n KEYS, not their
// localized strings, so the test never needs to mirror en/tr copy.
const tIdentity = ((key: string) => key) as unknown as TFunction

function axiosError(opts: {
    status: number
    url?: string
    body?: Record<string, unknown>
}) {
    return {
        response: { status: opts.status, data: opts.body ?? {} },
        config: { url: opts.url ?? '/some/path' },
    }
}

describe('formatApiError — login wrong-password (USER-BUG-6)', () => {
    it('returns auth.invalidCredentials for INVALID_CREDENTIALS errorCode (Spring `error` field)', () => {
        const err = axiosError({
            status: 401,
            url: '/auth/login',
            body: {
                error: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password',
            },
        })
        expect(formatApiError(err, tIdentity)).toBe('errors.invalidCredentials')
    })

    it('returns errors.invalidCredentials for INVALID_CREDENTIALS errorCode (legacy `errorCode` field)', () => {
        const err = axiosError({
            status: 401,
            url: '/auth/login',
            body: { errorCode: 'INVALID_CREDENTIALS', message: 'whatever' },
        })
        expect(formatApiError(err, tIdentity)).toBe('errors.invalidCredentials')
    })

    it('returns errors.invalidCredentials for a 401 on /auth/login even WITHOUT errorCode', () => {
        const err = axiosError({ status: 401, url: '/auth/login' })
        expect(formatApiError(err, tIdentity)).toBe('errors.invalidCredentials')
    })

    it('returns errors.unauthorized for a 401 on a non-login path (session expired)', () => {
        const err = axiosError({ status: 401, url: '/users/me' })
        expect(formatApiError(err, tIdentity)).toBe('errors.unauthorized')
    })
})

describe('formatApiError — distinct codes for adaptive MFA flow', () => {
    it('returns errors.needsEnrollment for NEEDS_ENROLLMENT', () => {
        const err = axiosError({
            status: 400,
            url: '/auth/login',
            body: { error: 'NEEDS_ENROLLMENT', message: 'Enroll fingerprint' },
        })
        expect(formatApiError(err, tIdentity)).toBe('errors.needsEnrollment')
    })

    it('returns errors.mfaRequired for MFA_REQUIRED', () => {
        const err = axiosError({
            status: 401,
            url: '/auth/login',
            body: { error: 'MFA_REQUIRED' },
        })
        expect(formatApiError(err, tIdentity)).toBe('errors.mfaRequired')
    })
})

describe('formatApiError — status fallbacks', () => {
    it('returns errors.serverError for 500', () => {
        const err = axiosError({ status: 500, url: '/anything' })
        expect(formatApiError(err, tIdentity)).toBe('errors.serverError')
    })

    it('returns errors.serverError for 503', () => {
        const err = axiosError({ status: 503, url: '/anything' })
        expect(formatApiError(err, tIdentity)).toBe('errors.serverError')
    })

    it('returns errors.tooManyRequests for 429', () => {
        const err = axiosError({ status: 429 })
        expect(formatApiError(err, tIdentity)).toBe('errors.tooManyRequests')
    })

    it('returns errors.badRequest for 400 without errorCode', () => {
        const err = axiosError({ status: 400, url: '/users' })
        expect(formatApiError(err, tIdentity)).toBe('errors.badRequest')
    })

    it('passes through a safe backend message', () => {
        const err = axiosError({
            status: 422,
            body: { message: 'E-posta zaten kullanılıyor' },
        })
        expect(formatApiError(err, tIdentity)).toBe('E-posta zaten kullanılıyor')
    })

    it('strips a leaky Exception message and falls back to generic', () => {
        const err = axiosError({
            status: 500,
            body: { message: 'java.lang.NullPointerException at FooService' },
        })
        expect(formatApiError(err, tIdentity)).toBe('errors.serverError')
    })

    it('strips a "status code" axios template message and falls back', () => {
        const err = axiosError({
            status: 401,
            url: '/users/me',
            body: { message: 'Request failed with status code 401' },
        })
        expect(formatApiError(err, tIdentity)).toBe('errors.unauthorized')
    })
})

describe('formatApiError — non-axios shapes', () => {
    it('returns errors.networkError for a TypeError', () => {
        expect(formatApiError(new TypeError('Failed to fetch'), tIdentity)).toBe('errors.networkError')
    })

    it('returns errors.networkError for an Error with "Network" in message', () => {
        expect(formatApiError(new Error('Network Error'), tIdentity)).toBe('errors.networkError')
    })

    it('returns errors.validation for a ZodError-shaped object', () => {
        const zod = { name: 'ZodError', issues: [{ path: ['email'], message: 'bad' }] }
        expect(formatApiError(zod, tIdentity)).toBe('errors.validation')
    })

    it('returns errors.unknown for an unrecognised error', () => {
        expect(formatApiError(new Error('something went wrong'), tIdentity)).toBe('errors.unknown')
    })

    it('returns errors.unknown for null/undefined', () => {
        expect(formatApiError(null, tIdentity)).toBe('errors.unknown')
        expect(formatApiError(undefined, tIdentity)).toBe('errors.unknown')
    })
})
