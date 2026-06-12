/**
 * useBiometricPuzzleServer — auth-mode behaviour (Task 3.2, 2026-06-12)
 *
 * Verifies the fail-closed contract:
 *   - auth mode + 404  → kind=error  (NOT soft_pass — can't bypass liveness)
 *   - training mode + 404 → kind=soft_pass (unchanged rollout-window behaviour)
 *   - auth mode + 503  → kind=error
 *   - auth mode + verified:true → kind=success
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { useBiometricPuzzleServer } from '../useBiometricPuzzleServer'
import type { PuzzleVerifyRequestPayload } from '../useBiometricPuzzleServer'

// ── Dependency mocks ─────────────────────────────────────────────────

const mockPost = vi.fn()

vi.mock('@app/providers', () => ({
    useService: () => ({
        post: mockPost,
        get: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    }),
}))

vi.mock('@core/di/types', () => ({
    TYPES: { HttpClient: 'HttpClient' },
}))

vi.mock('@utils/formatApiError', () => ({
    formatApiError: (err: unknown) => {
        const e = err as { message?: string }
        return e?.message ?? 'http-error'
    },
}))

// ── Helpers ──────────────────────────────────────────────────────────

const t: TFunction = ((key: string) => key) as unknown as TFunction

const payload: PuzzleVerifyRequestPayload = {
    action: 'blink',
    startTimestampMs: 1000,
    endTimestampMs: 2000,
    confidence: 0.9,
}

function make404Error() {
    return Object.assign(new Error('Not Found'), {
        response: { status: 404 },
    })
}

function make503Error() {
    return Object.assign(new Error('Service Unavailable'), {
        response: { status: 503 },
    })
}

beforeEach(() => {
    vi.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────

describe('useBiometricPuzzleServer — auth mode vs training mode on 404', () => {
    it('auth mode + 404 → kind=error (fails closed, not soft_pass)', async () => {
        mockPost.mockRejectedValueOnce(make404Error())

        const { result } = renderHook(() => useBiometricPuzzleServer())
        const outcome = await result.current.verifyChallenge(payload, t, 'auth')

        expect(outcome.kind).toBe('error')
        // The 404 soft-pass regression would have returned kind=soft_pass here.
        expect(outcome.kind).not.toBe('soft_pass')
        if (outcome.kind === 'error') {
            // Uses the i18n key — deterministic because t() returns the key.
            expect(outcome.message).toBe('biometricPuzzle.serverError')
        }
    })

    it('training mode + 404 → kind=soft_pass (rollout-window behaviour unchanged)', async () => {
        mockPost.mockRejectedValueOnce(make404Error())

        const { result } = renderHook(() => useBiometricPuzzleServer())
        const outcome = await result.current.verifyChallenge(payload, t, 'training')

        expect(outcome.kind).toBe('soft_pass')
        if (outcome.kind === 'soft_pass') {
            expect(outcome.reason).toBe('endpoint_not_deployed')
        }
    })

    it('training mode (default, no third arg) + 404 → kind=soft_pass', async () => {
        mockPost.mockRejectedValueOnce(make404Error())

        const { result } = renderHook(() => useBiometricPuzzleServer())
        // Omit the mode parameter — should default to 'training' (soft-pass).
        const outcome = await result.current.verifyChallenge(payload, t)

        expect(outcome.kind).toBe('soft_pass')
    })

    it('auth mode + non-2xx (503) → kind=error', async () => {
        mockPost.mockRejectedValueOnce(make503Error())

        const { result } = renderHook(() => useBiometricPuzzleServer())
        const outcome = await result.current.verifyChallenge(payload, t, 'auth')

        expect(outcome.kind).toBe('error')
    })

    it('auth mode + verified:true → kind=success', async () => {
        mockPost.mockResolvedValueOnce({
            data: { verified: true, duration_seconds: 1.2 },
        })

        const { result } = renderHook(() => useBiometricPuzzleServer())
        const outcome = await result.current.verifyChallenge(payload, t, 'auth')

        expect(outcome.kind).toBe('success')
        if (outcome.kind === 'success') {
            expect(outcome.durationSeconds).toBe(1.2)
        }
    })
})
