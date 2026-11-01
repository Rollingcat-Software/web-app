/**
 * PuzzleStep — PUZZLE session contract v2 (server-side trace re-scoring).
 *
 * When CREATE advertises `trace_contract: 'v2'`, the step must:
 *   - tell the challenge component to record a landmark trace (`collectTrace`)
 *     and pass the server-issued params (`challengeParams`);
 *   - forward the component's `trace` on SUBMIT, and FAIL CLOSED (no submit)
 *     when the component produced none;
 *   - with identity-binding on, add `binding_frame` (trace-subset landmarks +
 *     the trace timestamp of the embedding's source frame) to the verdict.
 * Without the advertisement (v1) the payloads are byte-identical to before.
 *
 * (Fixture scaffolding below mirrors PuzzleStep.binding.test.tsx.)
 *
 * --- original header of the mirrored file follows ---
 * PuzzleStep identity-binding (SP-B Phase 5, 2026-06-12)
 *
 * Tasks 5.1 + 5.3 — when the tenant turned `alsoMatchFaceIdentity` ON for the
 * PUZZLE layer AND SP-A's `app.auth.client-side-embedding` flag is ON, PuzzleStep:
 *   - threads an `onBestFrame` callback into the live FacePuzzle,
 *   - reuses SP-A's `embedCapturedFace(image, landmarks)` to derive a 512-float
 *     vector from that SAME live-session frame,
 *   - submits `verifyStep(PUZZLE, { puzzle_session_id, embedding: number[512] })`
 *     on completion — the raw image is NEVER in the payload,
 *   - fails CLOSED (no submit) if binding is required but no embedding was produced.
 *
 * When binding is OFF (or the SP-A flag is OFF) the step is unchanged from CV-3:
 * it submits `{ puzzle_session_id }` only and threads NO `onBestFrame` (no capture).
 *
 * The double-gate is `alsoMatchFaceIdentity` (tenant config) AND
 * `isClientSideEmbeddingEnabled()` (SP-A build flag).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthMethodType } from '@features/auth/constants'
import type { PuzzleConfig } from '@domain/models/AuthMethod'
import type { BiometricPuzzleProps } from '@features/biometric-puzzles/biometricPuzzleRegistry'
import type { PuzzleServerVerdict } from '@features/biometric-puzzles/useBiometricPuzzleServer'
import type { NormalizedLandmark } from '@/lib/biometric-engine/types'

// ── Global inert mocks ───────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Trans: ({ children }: { children: ReactNode }) => children,
}))

// ── Puzzle registry mock: capture the props the step passes the component ──
let capturedOnSuccess: ((verdict?: PuzzleServerVerdict) => void) | null = null
let capturedOnBestFrame:
    | ((image: string, landmarks: NormalizedLandmark[], capturedAtMs?: number) => void)
    | undefined
let capturedProps: BiometricPuzzleProps | null = null

const MockChallengeComponent = (props: BiometricPuzzleProps) => {
    const { onSuccess, onBestFrame } = props
    capturedProps = props
    capturedOnSuccess = onSuccess
    capturedOnBestFrame = onBestFrame
    return <div data-testid="mock-challenge">mock-challenge</div>
}

vi.mock('@features/biometric-puzzles/biometricPuzzleRegistry', () => ({
    getBiometricPuzzle: (id: string) => {
        if (id === 'FACE_BLINK') {
            return {
                id,
                modality: 'face',
                i18nKey: 'biometricPuzzle.puzzles.face_blink',
                component: MockChallengeComponent,
                difficulty: 'beginner',
                platforms: ['web'],
                requiresEnrollment: false,
                capability: 'realCapable',
            }
        }
        return undefined
    },
}))

// ── Session client mock ───────────────────────────────────────────────────
const mockCreateSession = vi.fn()
const mockSubmitChallenge = vi.fn()
vi.mock('@features/biometric-puzzles/usePuzzleSessionClient', () => ({
    usePuzzleSessionClient: () => ({
        createSession: mockCreateSession,
        submitChallenge: mockSubmitChallenge,
    }),
}))

// ── DI + SP-A flag + embedder mocks (tunable per test) ────────────────────
vi.mock('@app/providers', () => ({
    useService: () => ({ post: vi.fn(), get: vi.fn() }),
}))
vi.mock('@core/di/types', () => ({ TYPES: { HttpClient: 'HttpClient' } }))

let clientEmbeddingFlagOn = true
vi.mock('@features/biometrics/embedding/clientEmbeddingFlag', () => ({
    isClientSideEmbeddingEnabled: () => clientEmbeddingFlagOn,
}))

/** A 512-float embedding the SP-A embedder resolves with (tunable to null). */
let embedResult: number[] | null = Array.from({ length: 512 }, (_, i) => (i % 7) / 7)
const mockEmbed = vi.fn(async () => embedResult)
vi.mock('@features/biometrics/embedding/embedCapturedFace', () => ({
    embedCapturedFace: (image: string, landmarks?: NormalizedLandmark[]) =>
        mockEmbed(image, landmarks),
}))

import PuzzleStep from '../PuzzleStep'

// ── Fixtures ──────────────────────────────────────────────────────────────
const LANDMARKS_478: NormalizedLandmark[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
}))
const BEST_FRAME_IMAGE = 'data:image/jpeg;base64,/9j/LIVE'

function bindingConfig(on: boolean): PuzzleConfig {
    return {
        allowedChallengeTypes: ['FACE_BLINK'],
        count: 1,
        difficulty: 'easy',
        alsoMatchFaceIdentity: on,
    }
}

function blinkVerdict(): PuzzleServerVerdict {
    return {
        action: 'blink',
        verified: true,
        metrics: { ear: 0.18 },
        startTimestampMs: 1000,
        endTimestampMs: 2000,
        confidence: 0.9,
    }
}

async function flushCreate() {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    capturedOnSuccess = null
    capturedOnBestFrame = undefined
    capturedProps = null
    clientEmbeddingFlagOn = true
    embedResult = Array.from({ length: 512 }, (_, i) => (i % 7) / 7)
    mockEmbed.mockImplementation(async () => embedResult)
    mockCreateSession.mockResolvedValue({
        session_id: 'psess-1',
        challenges: [{ action: 'blink', params: null }],
    })
    mockSubmitChallenge.mockResolvedValue({
        verified: true,
        action: 'blink',
        reason_code: null,
    })
})

const TRACE = {
    version: 2 as const,
    frame_width: 640,
    frame_height: 480,
    frames: [{ t: 1000, f: Array.from({ length: 96 }, (_, i) => 1000 + i) }],
}

function v2Create(params: Record<string, unknown> | null = null) {
    mockCreateSession.mockResolvedValue({
        session_id: 'psess-1',
        challenges: [{ action: 'blink', params }],
        trace_contract: 'v2',
        trace_face_indices: null,
    })
}

describe('PuzzleStep — contract v2 (landmark traces)', () => {
    it('v2: asks the component for a trace, forwards it on SUBMIT, passes server params', async () => {
        v2Create({ target: 3 })
        const verifyStep = vi.fn()
        render(
            <PuzzleStep mfaSessionToken="sess-abc" verifyStep={verifyStep} loading={false} puzzleConfig={bindingConfig(false)} />,
        )
        await flushCreate()
        expect(capturedProps?.collectTrace).toBe(true)
        expect(capturedProps?.challengeParams).toEqual({ target: 3 })

        await act(async () => {
            capturedOnSuccess?.({ ...blinkVerdict(), trace: TRACE })
            await Promise.resolve()
        })

        expect(mockSubmitChallenge).toHaveBeenCalledOnce()
        const submit = mockSubmitChallenge.mock.calls[0][2]
        expect(submit.trace).toEqual(TRACE)
        expect(verifyStep).toHaveBeenCalledWith(AuthMethodType.PUZZLE, { puzzle_session_id: 'psess-1' })
    })

    it('v2: a completion WITHOUT a trace fails closed (no SUBMIT, no verdict)', async () => {
        v2Create()
        const verifyStep = vi.fn()
        render(
            <PuzzleStep mfaSessionToken="sess-abc" verifyStep={verifyStep} loading={false} puzzleConfig={bindingConfig(false)} />,
        )
        await flushCreate()
        await act(async () => {
            capturedOnSuccess?.(blinkVerdict())
            await Promise.resolve()
        })
        expect(mockSubmitChallenge).not.toHaveBeenCalled()
        expect(verifyStep).not.toHaveBeenCalled()
    })

    it('v1 (no advertisement): no trace requested, SUBMIT carries no trace key', async () => {
        const verifyStep = vi.fn()
        render(
            <PuzzleStep mfaSessionToken="sess-abc" verifyStep={verifyStep} loading={false} puzzleConfig={bindingConfig(false)} />,
        )
        await flushCreate()
        expect(capturedProps?.collectTrace).toBe(false)
        await act(async () => {
            capturedOnSuccess?.({ ...blinkVerdict(), trace: TRACE })
            await Promise.resolve()
        })
        expect(mockSubmitChallenge.mock.calls[0][2]).not.toHaveProperty('trace')
    })

    it('v2 + identity-binding: verdict carries binding_frame for the embedding source frame', async () => {
        v2Create()
        const verifyStep = vi.fn()
        render(
            <PuzzleStep mfaSessionToken="sess-abc" verifyStep={verifyStep} loading={false} puzzleConfig={bindingConfig(true)} />,
        )
        await flushCreate()
        await act(async () => {
            capturedOnBestFrame?.(BEST_FRAME_IMAGE, LANDMARKS_478, 1000)
            await Promise.resolve()
        })
        await act(async () => {
            capturedOnSuccess?.({ ...blinkVerdict(), trace: TRACE })
            await Promise.resolve()
        })
        const payload = verifyStep.mock.calls[0][1]
        expect(payload.embedding).toHaveLength(512)
        expect(payload.binding_frame.t).toBe(1000)
        expect(payload.binding_frame.f).toHaveLength(96)
        expect(JSON.stringify(payload)).not.toContain(BEST_FRAME_IMAGE)
    })

    it('v1 + identity-binding: verdict has no binding_frame (unchanged)', async () => {
        const verifyStep = vi.fn()
        render(
            <PuzzleStep mfaSessionToken="sess-abc" verifyStep={verifyStep} loading={false} puzzleConfig={bindingConfig(true)} />,
        )
        await flushCreate()
        await act(async () => {
            capturedOnBestFrame?.(BEST_FRAME_IMAGE, LANDMARKS_478, 1000)
            await Promise.resolve()
        })
        await act(async () => {
            capturedOnSuccess?.(blinkVerdict())
            await Promise.resolve()
        })
        expect(verifyStep.mock.calls[0][1]).not.toHaveProperty('binding_frame')
    })
})
