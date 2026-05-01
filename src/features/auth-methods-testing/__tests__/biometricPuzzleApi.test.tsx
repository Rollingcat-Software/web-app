/**
 * biometricPuzzleApi — covers USER-BUG-5
 *
 * The previous puzzle wrappers always called `setTimeout(onSuccess, 500)` after
 * the underlying step submitted, regardless of what the backend said. These
 * tests guard against re-introducing that pattern by asserting that:
 *
 *   - When the server rejects the verification, the puzzle calls `onError`
 *     (NOT `onSuccess`).
 *   - When WebAuthn is cancelled (no sessionId in the puzzle hook), the
 *     fingerprint puzzle surfaces the "no credentials" error rather than
 *     resolving silently as success.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import * as React from 'react'
import type { TFunction } from 'i18next'
import { useAuthMethodPuzzleApi } from '../puzzles/useAuthMethodPuzzleApi'

// ── Mocks ───────────────────────────────────────────────────────────

const mockHttpPost = vi.fn()
const mockVerifyFace = vi.fn()
const mockEnrollFace = vi.fn()

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Trans: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@app/providers', () => ({
    useService: () => ({
        post: mockHttpPost,
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn(),
    }),
}))

vi.mock('@features/auth/hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'admin-1', email: 'admin@fivucsas.local' },
        loading: false,
        error: null,
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
    }),
}))

vi.mock('@core/services/BiometricService', () => ({
    getBiometricService: () => ({
        verifyFace: mockVerifyFace,
        enrollFace: mockEnrollFace,
    }),
}))

vi.mock('@utils/formatApiError', () => ({
    formatApiError: (err: unknown) => {
        const e = err as { message?: string }
        return e?.message || 'http-error'
    },
}))

// i18n test stub — return key-as-translation, deterministic.
const t: TFunction = ((key: string) => key) as unknown as TFunction

const wrapper = ({ children }: { children: ReactNode }) => <>{children}</>

beforeEach(() => {
    vi.clearAllMocks()
})

// ── Tests ───────────────────────────────────────────────────────────

describe('useAuthMethodPuzzleApi', () => {
    describe('submitFace — server rejection surfaces as error (not silent success)', () => {
        it('returns kind=error when the server says verified=false', async () => {
            mockVerifyFace.mockResolvedValueOnce({
                verified: false,
                confidence: 0.1,
                distance: 0.9,
                threshold: 0.4,
                message: 'Face not recognized',
            })

            const { result } = renderHook(() => useAuthMethodPuzzleApi(), { wrapper })
            let outcome = await result.current.submitFace('data:image/jpeg;base64,xyz', t)

            expect(outcome.kind).toBe('error')
            // The 500 ms `setTimeout(onSuccess)` regression would have made this success.
            if (outcome.kind === 'error') {
                expect(outcome.message).toBe('Face not recognized')
            }
            // Ensure we never auto-marked it success.
            expect(mockVerifyFace).toHaveBeenCalledOnce()

            // Sanity-check the happy path stays green.
            mockVerifyFace.mockResolvedValueOnce({
                verified: true,
                confidence: 0.95,
                distance: 0.05,
                threshold: 0.4,
                message: 'ok',
            })
            outcome = await result.current.submitFace('data:image/jpeg;base64,xyz', t)
            expect(outcome.kind).toBe('success')
        })

        it('auto-enrolls and returns kind=info when no template exists yet', async () => {
            mockVerifyFace.mockRejectedValueOnce({
                response: { status: 404, data: { error_code: 'FACE_NOT_ENROLLED' } },
            })
            mockEnrollFace.mockResolvedValueOnce({
                success: true,
                userId: 'admin-1',
                confidence: 1,
                message: 'enrolled',
            })

            const { result } = renderHook(() => useAuthMethodPuzzleApi(), { wrapper })
            const outcome = await result.current.submitFace(
                'data:image/jpeg;base64,xyz',
                t,
            )
            expect(outcome.kind).toBe('info')
            expect(mockEnrollFace).toHaveBeenCalledOnce()
        })
    })

    describe('submitWebAuthnAssertion — cancellation does NOT silently succeed', () => {
        it('returns kind=error with the "no credentials" message when no challenge was requested', async () => {
            const { result } = renderHook(() => useAuthMethodPuzzleApi(), { wrapper })

            // Skip requestWebAuthnChallenge — simulate the user cancelling
            // immediately. submitWebAuthnAssertion would previously have been
            // shoved through a 500 ms setTimeout to onSuccess; it must now
            // refuse without a sessionId.
            const fakeAssertion = btoa(
                JSON.stringify({
                    credentialId: 'ignored',
                    authenticatorData: 'ignored',
                    clientDataJSON: 'ignored',
                    signature: 'ignored',
                }),
            )

            const outcome = await result.current.submitWebAuthnAssertion(
                fakeAssertion,
                t,
            )

            expect(outcome.kind).toBe('error')
            expect(mockHttpPost).not.toHaveBeenCalled()
            if (outcome.kind === 'error') {
                expect(outcome.message).toBe(
                    'authMethodsTesting.errors.webauthnNoCredentials',
                )
            }
        })

        it('returns kind=error when the server rejects the assertion', async () => {
            mockHttpPost
                // requestWebAuthnChallenge call
                .mockResolvedValueOnce({
                    data: {
                        sessionId: 'session-1',
                        challenge: 'AAAA',
                        rpId: 'app.fivucsas.com',
                        allowCredentials: [{ id: 'cred-1', type: 'public-key' }],
                    },
                })
                // submitWebAuthnAssertion call
                .mockResolvedValueOnce({
                    data: { success: false, message: 'Authentication failed' },
                })

            const { result } = renderHook(() => useAuthMethodPuzzleApi(), { wrapper })
            await act(async () => {
                await result.current.requestWebAuthnChallenge(t)
            })

            const fakeAssertion = btoa(
                JSON.stringify({
                    credentialId: 'cred-1',
                    authenticatorData: 'AA',
                    clientDataJSON: 'BB',
                    signature: 'CC',
                }),
            )

            const outcome = await result.current.submitWebAuthnAssertion(
                fakeAssertion,
                t,
            )
            expect(outcome.kind).toBe('error')
            if (outcome.kind === 'error') {
                expect(outcome.message).toBe('Authentication failed')
            }
        })
    })

    describe('submitNfc — server says no match → error, not success', () => {
        it('does not return success when /nfc/verify reports verified=false', async () => {
            mockHttpPost.mockResolvedValueOnce({
                data: { verified: false, message: 'Card not enrolled' },
            })

            const { result } = renderHook(() => useAuthMethodPuzzleApi(), { wrapper })
            const outcome = await result.current.submitNfc('04:1A:BB:CC:DD:EE:11', t)
            expect(outcome.kind).toBe('error')
            if (outcome.kind === 'error') {
                expect(outcome.message).toBe('Card not enrolled')
            }
        })
    })
})
