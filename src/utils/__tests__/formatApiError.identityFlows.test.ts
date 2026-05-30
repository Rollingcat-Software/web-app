/**
 * formatApiError — supplemental coverage for the codes the NEW identity flows
 * (account linking, biometric consent, account/tenant switch) produce, plus the
 * "no response" (network) shape. Complements formatApiError.test.ts; these are
 * the exact statuses those features surface on failure.
 *
 * Invariants asserted across the board:
 *  - a sensible i18n KEY is returned (we use the identity translator so the
 *    assertions check keys, not localized copy)
 *  - the raw axios template ("...status code 4xx") is NEVER returned
 *  - it never throws on a missing/partial error shape.
 */
import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { formatApiError } from '../formatApiError'

const t = ((key: string) => key) as unknown as TFunction

function axiosError(status: number, body: Record<string, unknown> = {}, url = '/identity/me') {
    return { response: { status, data: body }, config: { url } }
}

describe('formatApiError — identity-flow status codes', () => {
    it('403 forbidden (consent / cross-tenant) → errors.forbidden', () => {
        expect(formatApiError(axiosError(403), t)).toBe('errors.forbidden')
    })

    it('403 with no membership body still maps to errors.forbidden (no raw message)', () => {
        const out = formatApiError(axiosError(403, { errorCode: 'FORBIDDEN' }), t)
        expect(out).toBe('errors.forbidden')
        expect(out).not.toMatch(/status code/i)
    })

    it('409 conflict (account already exists) → errors.conflict', () => {
        expect(formatApiError(axiosError(409, {}, '/identity/link/initiate'), t)).toBe('errors.conflict')
    })

    it('422 validation / domain conflict (same-tenant link) → errors.validation', () => {
        expect(formatApiError(axiosError(422, {}, '/identity/link/confirm'), t)).toBe('errors.validation')
    })

    it('422 with an unmapped SCREAMING_SNAKE code still falls back to errors.validation', () => {
        // Code not in the i18n map → must not render the raw code, must use the
        // per-status fallback.
        const out = formatApiError(axiosError(422, { errorCode: 'SAME_TENANT_LINK_FORBIDDEN' }), t)
        expect(out).toBe('errors.validation')
        expect(out).not.toMatch(/SAME_TENANT/)
    })

    it('401 on a non-login identity path → errors.unauthorized (step-up failure)', () => {
        expect(formatApiError(axiosError(401, {}, '/identity/link/confirm'), t)).toBe('errors.unauthorized')
    })

    it('500 on a switch → errors.serverError', () => {
        expect(formatApiError(axiosError(500, {}, '/auth/switch-membership'), t)).toBe('errors.serverError')
    })

    it('NO response (true network error / CORS) → errors.networkError', () => {
        // axios network errors are TypeErrors / "Network Error" Errors with no
        // `.response`. The switcher + consent toggles can hit this offline.
        expect(formatApiError(new TypeError('Failed to fetch'), t)).toBe('errors.networkError')
        expect(formatApiError(new Error('Network Error'), t)).toBe('errors.networkError')
    })

    it('an object with an empty response (no status) → errors.unknown, no throw', () => {
        expect(formatApiError({ response: {} }, t)).toBe('errors.unknown')
    })

    it('a completely empty object → errors.unknown, never raw err.message', () => {
        expect(formatApiError({}, t)).toBe('errors.unknown')
    })

    it('never returns the leaky axios template even when body.message carries it', () => {
        const out = formatApiError(
            axiosError(403, { message: 'Request failed with status code 403' }),
            t,
        )
        expect(out).toBe('errors.forbidden')
    })
})
