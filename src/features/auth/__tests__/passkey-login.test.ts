import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IHttpClient, HttpResponse } from '@domain/interfaces/IHttpClient'
import {
    PASSKEY_API,
    fetchPasskeyOptions,
    getPasskeyAssertion,
    isPasskeySupported,
    submitPasskeyAssertion,
    type PasskeyAuthenticateOptions,
} from '../passkey-login'

/** Wrap a body in the IHttpClient envelope. */
function ok<T>(data: T): HttpResponse<T> {
    return { data, status: 200, statusText: 'OK', headers: {} }
}

/** Minimal IHttpClient mock — only the methods these helpers call. */
function makeHttpClient(): IHttpClient {
    return {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn(),
    }
}

describe('passkey-login', () => {
    let http: IHttpClient

    beforeEach(() => {
        http = makeHttpClient()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('isPasskeySupported', () => {
        it('returns true when PublicKeyCredential + credentials.get exist', () => {
            // jsdom may not define these; stub them for the positive case.
            const origPKC = (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential
            ;(window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential = function () {}
            Object.defineProperty(navigator, 'credentials', {
                value: { get: vi.fn() },
                configurable: true,
            })

            expect(isPasskeySupported()).toBe(true)
            ;(window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential = origPKC
        })

        it('returns false when PublicKeyCredential is undefined', () => {
            const orig = (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential
            // @ts-expect-error — intentionally clearing for the test
            delete (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential
            expect(isPasskeySupported()).toBe(false)
            ;(window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential = orig
        })
    })

    describe('fetchPasskeyOptions', () => {
        it('POSTs an empty body to the options endpoint (no email)', async () => {
            const options: PasskeyAuthenticateOptions = {
                sessionId: 'sess-1',
                challenge: 'Y2hhbGxlbmdl',
                rpId: 'fivucsas.com',
                userVerification: 'required',
                allowCredentials: [],
            }
            ;(http.post as ReturnType<typeof vi.fn>).mockResolvedValue(ok(options))

            const result = await fetchPasskeyOptions(http)

            expect(http.post).toHaveBeenCalledWith(PASSKEY_API.AUTHENTICATE_OPTIONS, {})
            expect(result).toEqual(options)
        })
    })

    describe('submitPasskeyAssertion', () => {
        it('POSTs the assertion fields and returns the server login body', async () => {
            const loginBody = {
                accessToken: 'at',
                refreshToken: 'rt',
                expiresIn: 900,
                user: { id: 7, email: 'a@b.com' },
            }
            ;(http.post as ReturnType<typeof vi.fn>).mockResolvedValue(ok(loginBody))

            const assertion = {
                credentialId: 'cred-id',
                authenticatorData: 'authData==',
                clientDataJSON: 'clientData==',
                signature: 'sig==',
                userHandle: 'handle',
            }

            const result = await submitPasskeyAssertion<typeof loginBody>(http, 'sess-9', assertion)

            expect(http.post).toHaveBeenCalledWith(PASSKEY_API.AUTHENTICATE, {
                sessionId: 'sess-9',
                credentialId: 'cred-id',
                authenticatorData: 'authData==',
                clientDataJSON: 'clientData==',
                signature: 'sig==',
                userHandle: 'handle',
            })
            expect(result).toEqual(loginBody)
        })
    })

    describe('getPasskeyAssertion', () => {
        const baseOptions: PasskeyAuthenticateOptions = {
            sessionId: 'sess-2',
            challenge: 'Y2hhbGxlbmdl', // "challenge"
            rpId: 'fivucsas.com',
            userVerification: 'required',
            allowCredentials: [],
        }

        it('calls navigator.credentials.get with an EMPTY allowCredentials list (discoverable)', async () => {
            const getMock = vi.fn().mockResolvedValue({
                id: 'cred-discoverable',
                response: {
                    authenticatorData: new Uint8Array([1, 2, 3]).buffer,
                    clientDataJSON: new Uint8Array([4, 5, 6]).buffer,
                    signature: new Uint8Array([7, 8, 9]).buffer,
                    userHandle: new Uint8Array([10, 11]).buffer,
                },
            })
            Object.defineProperty(navigator, 'credentials', {
                value: { get: getMock },
                configurable: true,
            })

            const result = await getPasskeyAssertion(baseOptions)

            expect(getMock).toHaveBeenCalledTimes(1)
            const publicKey = getMock.mock.calls[0][0].publicKey
            expect(publicKey.allowCredentials).toEqual([])
            expect(publicKey.rpId).toBe('fivucsas.com')
            expect(publicKey.userVerification).toBe('required')

            expect(result).not.toBeNull()
            expect(result?.credentialId).toBe('cred-discoverable')
            // userHandle is base64url (no padding) for the resident key.
            expect(typeof result?.userHandle).toBe('string')
            // standard base64 byte fields are non-empty.
            expect(result?.authenticatorData.length).toBeGreaterThan(0)
        })

        it('returns null when the browser yields no credential without throwing', async () => {
            const getMock = vi.fn().mockResolvedValue(null)
            Object.defineProperty(navigator, 'credentials', {
                value: { get: getMock },
                configurable: true,
            })

            const result = await getPasskeyAssertion(baseOptions)
            expect(result).toBeNull()
        })

        it('maps a missing userHandle to null', async () => {
            const getMock = vi.fn().mockResolvedValue({
                id: 'cred-no-handle',
                response: {
                    authenticatorData: new Uint8Array([1]).buffer,
                    clientDataJSON: new Uint8Array([2]).buffer,
                    signature: new Uint8Array([3]).buffer,
                    userHandle: null,
                },
            })
            Object.defineProperty(navigator, 'credentials', {
                value: { get: getMock },
                configurable: true,
            })

            const result = await getPasskeyAssertion(baseOptions)
            expect(result?.userHandle).toBeNull()
        })

        it('propagates a DOMException (cancel/timeout) so the caller can map it', async () => {
            const getMock = vi.fn().mockRejectedValue(new DOMException('cancelled', 'NotAllowedError'))
            Object.defineProperty(navigator, 'credentials', {
                value: { get: getMock },
                configurable: true,
            })

            await expect(getPasskeyAssertion(baseOptions)).rejects.toBeInstanceOf(DOMException)
        })
    })
})
