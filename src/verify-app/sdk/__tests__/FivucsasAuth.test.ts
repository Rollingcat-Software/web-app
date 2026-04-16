/**
 * FivucsasAuth SDK tests
 *
 * Covers:
 *   B7  — OIDC §3.1.3.7 nonce validation in handleRedirectCallback()
 *   B7b — Redirect URI scheme allowlist (https / loopback http / custom schemes)
 *
 * These tests never hit the network. We stub global.fetch and sessionStorage
 * where needed, and exercise the exported pure helpers directly for
 * finer-grained coverage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    FivucsasAuth,
    assertSafeRedirectScheme,
    assertNonceMatches,
    decodeJwtPayload,
} from '../FivucsasAuth'

// ─── JWT test helpers ──────────────────────────────────────────────

function base64url(input: string): string {
    return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fakeJwt(payload: Record<string, unknown>): string {
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const body = base64url(JSON.stringify(payload))
    const sig = base64url('not-a-real-signature')
    return `${header}.${body}.${sig}`
}

// ─── assertSafeRedirectScheme ──────────────────────────────────────

describe('assertSafeRedirectScheme', () => {
    describe('accepts', () => {
        it.each([
            'https://app.example.com/callback',
            'https://example.com',
            'https://deep.sub.domain.example.com/path?x=1#y',
            'http://127.0.0.1/cb',
            'http://127.0.0.1:3000/cb',
            'http://[::1]:8080/cb',
            'http://localhost/cb',
            'http://localhost:54321/cb',
            'com.example://oauth/cb',
            'com.example.app://auth',
            'msauth.com.example://x',
        ])('accepts %s', (uri) => {
            expect(() => assertSafeRedirectScheme(uri)).not.toThrow()
        })
    })

    describe('rejects', () => {
        it('rejects empty string', () => {
            expect(() => assertSafeRedirectScheme('')).toThrow(/empty or not a string/)
        })

        it('rejects non-string input', () => {
            // @ts-expect-error — testing runtime guard
            expect(() => assertSafeRedirectScheme(null)).toThrow(/empty or not a string/)
        })

        it('rejects malformed URLs', () => {
            expect(() => assertSafeRedirectScheme('not a url')).toThrow(/not a valid URL/)
        })

        it('rejects http:// to a public host', () => {
            expect(() => assertSafeRedirectScheme('http://evil.com/cb')).toThrow(
                /only permitted for RFC 8252 loopback/
            )
        })

        it('rejects http:// to an arbitrary non-loopback IP', () => {
            expect(() => assertSafeRedirectScheme('http://8.8.8.8/cb')).toThrow(
                /only permitted for RFC 8252 loopback/
            )
        })

        it('rejects javascript: scheme', () => {
            expect(() => assertSafeRedirectScheme('javascript:alert(1)')).toThrow(
                /not allowed/
            )
        })

        it('rejects data: scheme', () => {
            expect(() => assertSafeRedirectScheme('data:text/html,<script>alert(1)</script>')).toThrow(
                /not allowed/
            )
        })

        it('rejects file: scheme', () => {
            expect(() => assertSafeRedirectScheme('file:///etc/passwd')).toThrow(
                /not allowed/
            )
        })

        it('rejects vbscript: scheme', () => {
            expect(() => assertSafeRedirectScheme('vbscript:msgbox(1)')).toThrow(
                /not allowed/
            )
        })
    })
})

// ─── decodeJwtPayload ──────────────────────────────────────────────

describe('decodeJwtPayload', () => {
    it('decodes a well-formed JWT payload', () => {
        const jwt = fakeJwt({ sub: 'alice', nonce: 'abc', iat: 1 })
        const payload = decodeJwtPayload(jwt)
        expect(payload).toMatchObject({ sub: 'alice', nonce: 'abc', iat: 1 })
    })

    it('throws for non-string input', () => {
        // @ts-expect-error — testing runtime guard
        expect(() => decodeJwtPayload(null)).toThrow(/not a string/)
    })

    it('throws when segment count is wrong', () => {
        expect(() => decodeJwtPayload('a.b')).toThrow(/not a valid JWT/)
    })

    it('throws for malformed base64', () => {
        expect(() => decodeJwtPayload('header.@@@bad@@@.sig')).toThrow(
            /could not be decoded/
        )
    })

    it('throws when payload is not an object', () => {
        const header = base64url(JSON.stringify({ alg: 'none' }))
        const body = base64url(JSON.stringify('just a string'))
        const sig = base64url('sig')
        expect(() => decodeJwtPayload(`${header}.${body}.${sig}`)).toThrow(
            /payload is not an object/
        )
    })
})

// ─── assertNonceMatches ────────────────────────────────────────────

describe('assertNonceMatches', () => {
    it('passes when nonces match', () => {
        const jwt = fakeJwt({ nonce: 'abc123' })
        expect(() => assertNonceMatches(jwt, 'abc123')).not.toThrow()
    })

    it('throws when nonces mismatch', () => {
        const jwt = fakeJwt({ nonce: 'abc123' })
        expect(() => assertNonceMatches(jwt, 'different')).toThrow(/nonce mismatch/)
    })

    it('throws when expected nonce is null (session lost)', () => {
        const jwt = fakeJwt({ nonce: 'abc123' })
        expect(() => assertNonceMatches(jwt, null)).toThrow(/missing stored nonce/)
    })

    it('throws when id_token has no nonce claim', () => {
        const jwt = fakeJwt({ sub: 'alice' })
        expect(() => assertNonceMatches(jwt, 'abc123')).toThrow(/nonce mismatch/)
    })

    it('throws when id_token is malformed', () => {
        expect(() => assertNonceMatches('not.a.jwt!', 'abc123')).toThrow(
            /could not be decoded/
        )
    })
})

// ─── FivucsasAuth.loginRedirect scheme validation ──────────────────

describe('FivucsasAuth.loginRedirect — scheme validation', () => {
    beforeEach(() => {
        sessionStorage.clear()
    })

    it('rejects http:// to a public host', async () => {
        const auth = new FivucsasAuth({ clientId: 'c1' })
        await expect(
            auth.loginRedirect({ redirectUri: 'http://evil.com/cb' })
        ).rejects.toThrow(/only permitted for RFC 8252 loopback/)
        // Nothing should have been stored
        expect(sessionStorage.getItem('fivucsas:state')).toBeNull()
        expect(sessionStorage.getItem('fivucsas:pkce')).toBeNull()
    })

    it('rejects javascript: scheme', async () => {
        const auth = new FivucsasAuth({ clientId: 'c1' })
        await expect(
            auth.loginRedirect({ redirectUri: 'javascript:alert(1)' })
        ).rejects.toThrow(/not allowed/)
    })
})

// ─── FivucsasAuth.handleRedirectCallback — nonce validation ────────

describe('FivucsasAuth.handleRedirectCallback — B7 nonce + scheme', () => {
    const originalLocation = Object.getOwnPropertyDescriptor(window, 'location')
    const originalFetch = global.fetch

    function setCallbackQuery(params: Record<string, string>) {
        const qs = new URLSearchParams(params).toString()
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                href: `https://app.example.com/cb?${qs}`,
                origin: 'https://app.example.com',
                pathname: '/cb',
                search: `?${qs}`,
                hash: '',
                host: 'app.example.com',
                hostname: 'app.example.com',
                port: '',
                protocol: 'https:',
                assign: vi.fn(),
                replace: vi.fn(),
                reload: vi.fn(),
            },
        })
    }

    function primeSession(overrides: Partial<{
        state: string
        nonce: string
        pkce: string
        redirectUri: string
    }> = {}) {
        sessionStorage.setItem('fivucsas:state', overrides.state ?? 'state-abc')
        sessionStorage.setItem('fivucsas:nonce', overrides.nonce ?? 'nonce-xyz')
        sessionStorage.setItem('fivucsas:pkce', overrides.pkce ?? 'verifier-zzz')
        sessionStorage.setItem(
            'fivucsas:redirect_uri',
            overrides.redirectUri ?? 'https://app.example.com/cb'
        )
    }

    beforeEach(() => {
        sessionStorage.clear()
    })

    afterEach(() => {
        if (originalLocation) {
            Object.defineProperty(window, 'location', originalLocation)
        }
        global.fetch = originalFetch
        sessionStorage.clear()
    })

    it('happy path: matching nonce → returns tokens', async () => {
        setCallbackQuery({ code: 'code-1', state: 'state-abc' })
        primeSession()

        const idToken = fakeJwt({ nonce: 'nonce-xyz', sub: 'u1' })
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                access_token: 'at',
                refresh_token: 'rt',
                id_token: idToken,
                token_type: 'Bearer',
                expires_in: 3600,
            }),
        }) as unknown as typeof fetch

        const auth = new FivucsasAuth({ clientId: 'c1' })
        const result = await auth.handleRedirectCallback()

        expect(result.accessToken).toBe('at')
        expect(result.idToken).toBe(idToken)
        // Single-use: nonce cleared
        expect(sessionStorage.getItem('fivucsas:nonce')).toBeNull()
    })

    it('throws on nonce mismatch', async () => {
        setCallbackQuery({ code: 'code-1', state: 'state-abc' })
        primeSession({ nonce: 'expected' })

        const idToken = fakeJwt({ nonce: 'attacker-injected' })
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ access_token: 'at', id_token: idToken }),
        }) as unknown as typeof fetch

        const auth = new FivucsasAuth({ clientId: 'c1' })
        await expect(auth.handleRedirectCallback()).rejects.toThrow(/nonce mismatch/)
        // Cleared even on failure
        expect(sessionStorage.getItem('fivucsas:nonce')).toBeNull()
        expect(sessionStorage.getItem('fivucsas:pkce')).toBeNull()
    })

    it('throws when sessionStorage has no nonce', async () => {
        setCallbackQuery({ code: 'code-1', state: 'state-abc' })
        primeSession()
        sessionStorage.removeItem('fivucsas:nonce')

        const idToken = fakeJwt({ nonce: 'anything' })
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ access_token: 'at', id_token: idToken }),
        }) as unknown as typeof fetch

        const auth = new FivucsasAuth({ clientId: 'c1' })
        await expect(auth.handleRedirectCallback()).rejects.toThrow(/missing stored nonce/)
    })

    it('throws when id_token is malformed', async () => {
        setCallbackQuery({ code: 'code-1', state: 'state-abc' })
        primeSession()

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ access_token: 'at', id_token: 'definitely-not-a-jwt' }),
        }) as unknown as typeof fetch

        const auth = new FivucsasAuth({ clientId: 'c1' })
        await expect(auth.handleRedirectCallback()).rejects.toThrow(
            /not a valid JWT|could not be decoded/
        )
    })

    it('rejects stored redirect URI with dangerous scheme', async () => {
        setCallbackQuery({ code: 'code-1', state: 'state-abc' })
        primeSession({ redirectUri: 'javascript:alert(1)' })

        global.fetch = vi.fn() as unknown as typeof fetch

        const auth = new FivucsasAuth({ clientId: 'c1' })
        await expect(auth.handleRedirectCallback()).rejects.toThrow(/not allowed/)
        // fetch must not fire for a rejected scheme
        expect(global.fetch).not.toHaveBeenCalled()
    })
})
