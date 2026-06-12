/**
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
    | ((image: string, landmarks: NormalizedLandmark[]) => void)
    | undefined

const MockChallengeComponent = ({ onSuccess, onBestFrame }: BiometricPuzzleProps) => {
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

describe('PuzzleStep — identity-binding (Phase 5)', () => {
    it('binding ON + flag ON: submits { puzzle_session_id, embedding:number[512] }, NO image', async () => {
        const verifyStep = vi.fn()
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={verifyStep}
                loading={false}
                puzzleConfig={bindingConfig(true)}
            />,
        )
        await flushCreate()

        // The step threaded an onBestFrame into the live FacePuzzle.
        expect(capturedOnBestFrame).toBeTypeOf('function')

        // Live frame arrives from the running puzzle session, then the gesture
        // completes — order mirrors the real component (capture at completion).
        await act(async () => {
            capturedOnBestFrame?.(BEST_FRAME_IMAGE, LANDMARKS_478)
            await Promise.resolve()
        })
        await act(async () => {
            capturedOnSuccess?.(blinkVerdict())
            await Promise.resolve()
        })

        // SP-A's embedder ran on the live crop + its landmarks.
        expect(mockEmbed).toHaveBeenCalledOnce()
        expect(mockEmbed).toHaveBeenCalledWith(BEST_FRAME_IMAGE, LANDMARKS_478)

        expect(verifyStep).toHaveBeenCalledOnce()
        const [method, payload] = verifyStep.mock.calls[0]
        expect(method).toBe(AuthMethodType.PUZZLE)
        expect(payload.puzzle_session_id).toBe('psess-1')
        expect(Array.isArray(payload.embedding)).toBe(true)
        expect(payload.embedding).toHaveLength(512)
        // The raw image is NEVER in the payload — only the vector.
        expect(payload).not.toHaveProperty('image')
        expect(JSON.stringify(payload)).not.toContain(BEST_FRAME_IMAGE)
    })

    it('binding OFF: submits { puzzle_session_id } only, threads NO onBestFrame', async () => {
        const verifyStep = vi.fn()
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={verifyStep}
                loading={false}
                puzzleConfig={bindingConfig(false)}
            />,
        )
        await flushCreate()

        // No capture wiring when binding is off.
        expect(capturedOnBestFrame).toBeUndefined()

        await act(async () => {
            capturedOnSuccess?.(blinkVerdict())
            await Promise.resolve()
        })

        expect(mockEmbed).not.toHaveBeenCalled()
        expect(verifyStep).toHaveBeenCalledOnce()
        expect(verifyStep.mock.calls[0][1]).toEqual({ puzzle_session_id: 'psess-1' })
    })

    it('binding ON but SP-A flag OFF: liveness-only — { puzzle_session_id }, no capture', async () => {
        clientEmbeddingFlagOn = false
        const verifyStep = vi.fn()
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={verifyStep}
                loading={false}
                puzzleConfig={bindingConfig(true)}
            />,
        )
        await flushCreate()

        expect(capturedOnBestFrame).toBeUndefined()
        await act(async () => {
            capturedOnSuccess?.(blinkVerdict())
            await Promise.resolve()
        })

        expect(mockEmbed).not.toHaveBeenCalled()
        expect(verifyStep).toHaveBeenCalledOnce()
        expect(verifyStep.mock.calls[0][1]).toEqual({ puzzle_session_id: 'psess-1' })
    })

    it('binding ON but NO best frame captured: fails closed (no verdict submit)', async () => {
        const verifyStep = vi.fn()
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={verifyStep}
                loading={false}
                puzzleConfig={bindingConfig(true)}
            />,
        )
        await flushCreate()

        // Gesture completes but NO onBestFrame ever fired (e.g. never frontal).
        await act(async () => {
            capturedOnSuccess?.(blinkVerdict())
            await Promise.resolve()
        })

        // No embedding could be produced → binding-required step is NOT submitted.
        expect(mockEmbed).not.toHaveBeenCalled()
        expect(verifyStep).not.toHaveBeenCalled()
    })

    it('binding ON but embedder returns null: fails closed (no verdict submit)', async () => {
        embedResult = null
        const verifyStep = vi.fn()
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={verifyStep}
                loading={false}
                puzzleConfig={bindingConfig(true)}
            />,
        )
        await flushCreate()

        await act(async () => {
            capturedOnBestFrame?.(BEST_FRAME_IMAGE, LANDMARKS_478)
            await Promise.resolve()
        })
        await act(async () => {
            capturedOnSuccess?.(blinkVerdict())
            await Promise.resolve()
        })

        expect(mockEmbed).toHaveBeenCalledOnce()
        // Embedding null → fail closed (the server would also fail-close).
        expect(verifyStep).not.toHaveBeenCalled()
    })

    it('Task 5.3: the embedding comes from the live session onBestFrame, not an external image (PuzzleStep takes no image prop)', () => {
        // PuzzleStepProps has no image/embedding input — the ONLY way an embedding
        // enters is via the live FacePuzzle onBestFrame of the running session.
        // This is the single-capture (identity + liveness) guarantee of spec §3.1.
        type Props = Parameters<typeof PuzzleStep>[0]
        const probe = {} as Props
        // @ts-expect-error — no externally-supplied image is accepted.
        void probe.image
        // @ts-expect-error — no externally-supplied embedding is accepted.
        void probe.embedding
        expect(true).toBe(true)
    })
})
