/**
 * PuzzleStep + MfaStepRenderer PUZZLE routing (CV-3 — server-issued session,
 * 2026-06-12)
 *
 * Covers the converged, server-authoritative model:
 * 1. MfaStepRenderer routes PUZZLE → PuzzleStep (title key visible)
 * 2. PuzzleStep CREATEs a session on mount (mocked proxy → session_id + 2
 *    challenges), then renders the component mapped from the FIRST issued action
 * 3. Each completion SUBMITs the canonical metric (correct key + action) to the
 *    session, advancing only on `{verified:true}`
 * 4. On the LAST challenge it calls verifyStep(PUZZLE, { puzzle_session_id })
 *    — NOT server_verdicts, NOT puzzle_traces, NOT metrics
 * 5. A SUBMIT failure (verified:false) is fail-closed — no advance, no verdict
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthMethodType } from '@features/auth/constants'
import { BiometricPuzzleId } from '@features/biometric-puzzles/BiometricPuzzleId'
import type { BiometricPuzzleProps } from '@features/biometric-puzzles/biometricPuzzleRegistry'
import type { PuzzleServerVerdict } from '@features/biometric-puzzles/useBiometricPuzzleServer'

// ── Global mocks ─────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Trans: ({ children }: { children: ReactNode }) => children,
}))

// Inert framer-motion.
vi.mock('framer-motion', () => ({
    motion: new Proxy(
        {},
        {
            get: () => {
                return ({ children, ...rest }: Record<string, unknown>) => {
                    const { initial: _i, animate: _a, variants: _v, transition: _tr, ...domProps } =
                        rest
                    return (
                        <div {...(domProps as React.HTMLAttributes<HTMLDivElement>)}>{children as ReactNode}</div>
                    )
                }
            },
        },
    ),
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
}))

// Inert biometric-engine (for MfaStepRenderer / GestureLivenessStep import paths).
vi.mock('@/lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: {
        getInstance: () => ({ initialize: () => Promise.resolve(), voiceVAD: null }),
    },
}))

// ── Puzzle registry mock ─────────────────────────────────────────────

/** Captures onSuccess + the serverMode the step rendered the challenge with. */
let capturedOnSuccess: ((verdict?: PuzzleServerVerdict) => void) | null = null
let capturedServerMode: 'auth' | 'training' | undefined

const MockChallengeComponent = ({ onSuccess, serverMode }: BiometricPuzzleProps) => {
    capturedOnSuccess = onSuccess
    capturedServerMode = serverMode
    return <div data-testid="mock-challenge">mock-challenge</div>
}

// FACE/HAND ids that resolve to a renderable component; anything else does not.
// Includes the hand + nod/shake ids so the SP-B metric-surfacing flow can be
// driven (finger_count → HAND_FINGER_COUNT, nod → FACE_NOD, etc.).
vi.mock('@features/biometric-puzzles/biometricPuzzleRegistry', () => ({
    getBiometricPuzzle: (id: string) => {
        const validIds = new Set<string>([
            'FACE_BLINK',
            'FACE_SMILE',
            'FACE_NOD',
            'FACE_SHAKE_HEAD',
            'HAND_FINGER_COUNT',
            'HAND_PINCH',
        ])
        if (validIds.has(id)) {
            return {
                id,
                modality: 'face',
                i18nKey: `biometricPuzzle.puzzles.${id.toLowerCase()}`,
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

// ── usePuzzleSessionClient mock ──────────────────────────────────────

const mockCreateSession = vi.fn()
const mockSubmitChallenge = vi.fn()

vi.mock('@features/biometric-puzzles/usePuzzleSessionClient', () => ({
    usePuzzleSessionClient: () => ({
        createSession: mockCreateSession,
        submitChallenge: mockSubmitChallenge,
    }),
}))

// ── DI + other mocks ──────────────────────────────────────────────────

vi.mock('@app/providers', () => ({
    useService: () => ({
        post: vi.fn(),
        get: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    }),
}))

vi.mock('@core/di/types', () => ({
    TYPES: { HttpClient: 'HttpClient' },
}))

vi.mock('@features/biometrics/embedding/clientEmbeddingFlag', () => ({
    isClientSideEmbeddingEnabled: () => false,
}))

vi.mock('@features/biometrics/embedding/embedCapturedFace', () => ({
    embedCapturedFace: vi.fn(),
}))

// ── Helpers ───────────────────────────────────────────────────────────

import MfaStepRenderer from '../../MfaStepRenderer'
import PuzzleStep from '../PuzzleStep'

const httpStub = {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
} as unknown as Parameters<typeof MfaStepRenderer>[0]['httpClient']

const baseMfaProps = {
    mfaSessionToken: 'sess-abc',
    requestWebAuthnChallenge: vi.fn().mockResolvedValue(null),
    httpClient: httpStub,
    onAuthenticated: vi.fn(),
    onBack: vi.fn(),
    loading: false,
    onError: vi.fn(),
}

/** A representative challenge-component verdict carrying its canonical metric. */
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
function smileVerdict(): PuzzleServerVerdict {
    return {
        action: 'smile',
        verified: true,
        metrics: { mar: 0.55 },
        startTimestampMs: 3000,
        endTimestampMs: 4000,
        confidence: 0.9,
    }
}

/** Flush the mount-time CREATE microtasks so the running phase renders. */
async function flushCreate() {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    capturedOnSuccess = null
    capturedServerMode = undefined
    // Default: a single-blink session.
    mockCreateSession.mockResolvedValue({
        session_id: 'psess-1',
        challenges: [{ action: 'blink', params: null }],
    })
    mockSubmitChallenge.mockResolvedValue({ verified: true, action: 'blink', reason_code: null })
})

// ── Tests ─────────────────────────────────────────────────────────────

describe('MfaStepRenderer — PUZZLE routing', () => {
    it('routes PUZZLE method to PuzzleStep (title key visible)', () => {
        render(
            <MfaStepRenderer
                {...baseMfaProps}
                method={AuthMethodType.PUZZLE}
                verifyStep={vi.fn()}
            />,
        )
        expect(screen.getByText('mfa.puzzle.title')).toBeInTheDocument()
    })
})

describe('PuzzleStep — server-issued session', () => {
    it('CREATEs a session on mount and renders the mapped component in auth mode', async () => {
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={vi.fn()}
                loading={false}
            />,
        )
        await flushCreate()

        expect(mockCreateSession).toHaveBeenCalledOnce()
        expect(mockCreateSession).toHaveBeenCalledWith('sess-abc')
        expect(screen.getByTestId('mock-challenge')).toBeInTheDocument()
        // Per-challenge UX runs in AUTH (fail-closed) mode.
        expect(capturedServerMode).toBe('auth')
    })

    it('shows an error when the session CREATE fails (fail-closed)', async () => {
        mockCreateSession.mockRejectedValueOnce(new Error('boom'))
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={vi.fn()}
                loading={false}
            />,
        )
        await flushCreate()
        expect(screen.getByText('mfa.puzzle.sessionError')).toBeInTheDocument()
        expect(screen.queryByTestId('mock-challenge')).not.toBeInTheDocument()
    })

    it('SUBMITs the canonical metric key + action for the issued challenge', async () => {
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={vi.fn()}
                loading={false}
            />,
        )
        await flushCreate()

        await act(async () => {
            capturedOnSuccess?.(blinkVerdict())
        })

        expect(mockSubmitChallenge).toHaveBeenCalledOnce()
        const [token, sessionId, submit] = mockSubmitChallenge.mock.calls[0]
        expect(token).toBe('sess-abc')
        expect(sessionId).toBe('psess-1')
        expect(submit.action).toBe('blink')
        // Canonical key for blink is `ear` — and ONLY that key is sent.
        expect(submit.metrics).toEqual({ ear: 0.18 })
        expect(submit.startTimestampMs).toBe(1000)
        expect(submit.endTimestampMs).toBe(2000)
        expect(submit.confidence).toBe(0.9)
    })

    it('on completion calls verifyStep(PUZZLE, { puzzle_session_id }) only', async () => {
        const verifyStep = vi.fn()
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={verifyStep}
                loading={false}
            />,
        )
        await flushCreate()

        await act(async () => {
            capturedOnSuccess?.(blinkVerdict())
        })

        expect(verifyStep).toHaveBeenCalledOnce()
        const [method, payload] = verifyStep.mock.calls[0]
        expect(method).toBe(AuthMethodType.PUZZLE)
        // The ONLY field submitted as the step verdict.
        expect(payload).toEqual({ puzzle_session_id: 'psess-1' })
        // The interim client-attested model is GONE.
        expect(payload).not.toHaveProperty('server_verdicts')
        expect(payload).not.toHaveProperty('puzzle_traces')
        expect(payload).not.toHaveProperty('metrics')
    })

    it('drives BOTH issued challenges in order, one SUBMIT each, then one verdict', async () => {
        mockCreateSession.mockResolvedValueOnce({
            session_id: 'psess-2',
            challenges: [
                { action: 'blink', params: null },
                { action: 'smile', params: null },
            ],
        })
        mockSubmitChallenge
            .mockResolvedValueOnce({ verified: true, action: 'blink', reason_code: null })
            .mockResolvedValueOnce({ verified: true, action: 'smile', reason_code: null })

        const verifyStep = vi.fn()
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={verifyStep}
                loading={false}
            />,
        )
        await flushCreate()

        // First challenge (blink) → SUBMIT, advance, no verdict yet.
        await act(async () => {
            capturedOnSuccess?.(blinkVerdict())
        })
        expect(verifyStep).not.toHaveBeenCalled()
        expect(mockSubmitChallenge).toHaveBeenCalledTimes(1)
        expect(mockSubmitChallenge.mock.calls[0][2].metrics).toEqual({ ear: 0.18 })

        // Second (final) challenge (smile) → SUBMIT, then verdict.
        await act(async () => {
            capturedOnSuccess?.(smileVerdict())
        })
        expect(mockSubmitChallenge).toHaveBeenCalledTimes(2)
        expect(mockSubmitChallenge.mock.calls[1][2].action).toBe('smile')
        expect(mockSubmitChallenge.mock.calls[1][2].metrics).toEqual({ mar: 0.55 })

        expect(verifyStep).toHaveBeenCalledOnce()
        expect(verifyStep.mock.calls[0][1]).toEqual({ puzzle_session_id: 'psess-2' })
    })

    it('fails closed when the per-challenge SUBMIT returns verified:false', async () => {
        mockSubmitChallenge.mockResolvedValueOnce({
            verified: false,
            action: 'blink',
            reason_code: 'EYE_NOT_CLOSED',
        })
        const verifyStep = vi.fn()
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={verifyStep}
                loading={false}
            />,
        )
        await flushCreate()

        await act(async () => {
            capturedOnSuccess?.(blinkVerdict())
        })

        // No advance, no soft-pass, no verdict.
        expect(verifyStep).not.toHaveBeenCalled()
        expect(screen.getByText('mfa.puzzle.challengeFailed')).toBeInTheDocument()
    })

    it('fails closed when the component cannot produce the canonical metric', async () => {
        const verifyStep = vi.fn()
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={verifyStep}
                loading={false}
            />,
        )
        await flushCreate()

        // Verdict with NO metrics (the metric/vocabulary gap case).
        await act(async () => {
            capturedOnSuccess?.({ action: 'blink', verified: true })
        })

        // It must NOT submit an empty metric bio would reject — it fails closed.
        expect(mockSubmitChallenge).not.toHaveBeenCalled()
        expect(verifyStep).not.toHaveBeenCalled()
        expect(screen.getByText('mfa.puzzle.challengeFailed')).toBeInTheDocument()
    })

    it('SUBMITs the canonical HAND metric (finger_count) for a hand action', async () => {
        mockCreateSession.mockResolvedValueOnce({
            session_id: 'psess-hand',
            challenges: [{ action: 'finger_count', params: { target: 3 } }],
        })
        mockSubmitChallenge.mockResolvedValueOnce({
            verified: true,
            action: 'finger_count',
            reason_code: null,
        })
        const verifyStep = vi.fn()
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={verifyStep}
                loading={false}
            />,
        )
        await flushCreate()

        // The hand component surfaces the canonical scalar under bio's key.
        await act(async () => {
            capturedOnSuccess?.({
                action: 'finger_count',
                verified: true,
                metrics: { finger_count: 3 },
                startTimestampMs: 10,
                endTimestampMs: 20,
                confidence: 0.9,
            })
        })

        expect(mockSubmitChallenge).toHaveBeenCalledOnce()
        const submit = mockSubmitChallenge.mock.calls[0][2]
        expect(submit.action).toBe('finger_count')
        // Canonical key for finger_count is `finger_count` — and ONLY that key.
        expect(submit.metrics).toEqual({ finger_count: 3 })
        expect(verifyStep).toHaveBeenCalledOnce()
        expect(verifyStep.mock.calls[0][1]).toEqual({
            puzzle_session_id: 'psess-hand',
        })
    })

    it('SUBMITs the canonical NOD metric (oscillation_count)', async () => {
        mockCreateSession.mockResolvedValueOnce({
            session_id: 'psess-nod',
            challenges: [{ action: 'nod', params: null }],
        })
        mockSubmitChallenge.mockResolvedValueOnce({
            verified: true,
            action: 'nod',
            reason_code: null,
        })
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={vi.fn()}
                loading={false}
            />,
        )
        await flushCreate()

        await act(async () => {
            capturedOnSuccess?.({
                action: 'nod',
                verified: true,
                metrics: { oscillation_count: 3 },
                startTimestampMs: 100,
                endTimestampMs: 900,
                confidence: 0.9,
            })
        })

        expect(mockSubmitChallenge).toHaveBeenCalledOnce()
        const submit = mockSubmitChallenge.mock.calls[0][2]
        expect(submit.action).toBe('nod')
        expect(submit.metrics).toEqual({ oscillation_count: 3 })
    })

    it('SUBMITs the canonical SHAKE_HEAD metric (oscillation_count)', async () => {
        mockCreateSession.mockResolvedValueOnce({
            session_id: 'psess-shake',
            challenges: [{ action: 'shake_head', params: null }],
        })
        mockSubmitChallenge.mockResolvedValueOnce({
            verified: true,
            action: 'shake_head',
            reason_code: null,
        })
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={vi.fn()}
                loading={false}
            />,
        )
        await flushCreate()

        await act(async () => {
            capturedOnSuccess?.({
                action: 'shake_head',
                verified: true,
                metrics: { oscillation_count: 4 },
                startTimestampMs: 100,
                endTimestampMs: 900,
                confidence: 0.9,
            })
        })

        const submit = mockSubmitChallenge.mock.calls[0][2]
        expect(submit.action).toBe('shake_head')
        expect(submit.metrics).toEqual({ oscillation_count: 4 })
    })

    it('shows an unsupported-challenge error when an issued action has no component', async () => {
        mockCreateSession.mockResolvedValueOnce({
            session_id: 'psess-3',
            // `light` maps to no renderable web component in this mocked registry.
            challenges: [{ action: 'light', params: null }],
        })
        render(
            <PuzzleStep
                mfaSessionToken="sess-abc"
                verifyStep={vi.fn()}
                loading={false}
            />,
        )
        await flushCreate()
        expect(screen.getByText('mfa.puzzle.unsupportedChallenge')).toBeInTheDocument()
    })
})

// Reference an enum value so the import is load-bearing for the reverse-map intent.
void BiometricPuzzleId.FACE_BLINK
