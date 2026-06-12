/**
 * PuzzleStep + MfaStepRenderer PUZZLE routing (Task 3.4 + fail-closed/server-
 * evidence hardening, 2026-06-12)
 *
 * 1. MfaStepRenderer routes PUZZLE → PuzzleStep (landmark string visible)
 * 2. PuzzleStep: no puzzleConfig → shows noChallenges key
 * 3. PuzzleStep: valid config → renders the challenge component from registry
 *    AND passes serverMode='auth' to it (fail-closed re-score)
 * 4. PuzzleStep: onSuccess(verdict) on last challenge → calls
 *    verifyStep(PUZZLE, { server_verdicts:[...] }) carrying the SERVER verdict,
 *    NOT a client {challengeId, completedAt}-only trace
 * 5. PuzzleStep: a multi-challenge flow accumulates one verdict per challenge
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthMethodType } from '@features/auth/constants'
import type { PuzzleConfig } from '@domain/models/AuthMethod'
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

vi.mock('@features/biometric-puzzles/biometricPuzzleRegistry', () => ({
    getBiometricPuzzle: (id: string) => {
        // Inline valid-id list — vi.mock factory is hoisted, so it cannot
        // close over module-level consts.
        const validIds = new Set<string>(['FACE_BLINK', 'FACE_SMILE'])
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

// ── useBiometricPuzzleServer mock ─────────────────────────────────────

/** Spy captures the mode argument passed from PuzzleStep. */
const mockVerifyChallenge = vi.fn()

vi.mock('@features/biometric-puzzles/useBiometricPuzzleServer', () => ({
    useBiometricPuzzleServer: () => ({
        verifyChallenge: mockVerifyChallenge,
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

const puzzleConfig: PuzzleConfig = {
    allowedChallengeTypes: [BiometricPuzzleId.FACE_BLINK],
    count: 1,
    difficulty: 'easy',
    alsoMatchFaceIdentity: false,
}

beforeEach(() => {
    vi.clearAllMocks()
    capturedOnSuccess = null
    capturedServerMode = undefined
})

/** A representative SERVER verdict the auth-mode re-score would return. */
function serverVerdict(action: PuzzleServerVerdict['action']): PuzzleServerVerdict {
    return { action, verified: true, durationSeconds: 1.2 }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('MfaStepRenderer — PUZZLE routing', () => {
    it('routes PUZZLE method to PuzzleStep (landmark title key visible)', () => {
        render(
            <MfaStepRenderer
                {...baseMfaProps}
                method={AuthMethodType.PUZZLE}
                verifyStep={vi.fn()}
                puzzleConfig={puzzleConfig}
            />,
        )
        // PuzzleStep renders the title key (t() returns keys in test).
        expect(screen.getByText('mfa.puzzle.title')).toBeInTheDocument()
    })
})

describe('PuzzleStep', () => {
    it('shows noChallenges key when puzzleConfig is undefined', () => {
        render(
            <PuzzleStep
                puzzleConfig={undefined}
                verifyStep={vi.fn()}
                loading={false}
            />,
        )
        expect(screen.getByText('mfa.puzzle.noChallenges')).toBeInTheDocument()
    })

    it('shows noChallenges key when allowedChallengeTypes is empty', () => {
        const emptyConfig: PuzzleConfig = {
            allowedChallengeTypes: [],
            count: 1,
            difficulty: 'easy',
            alsoMatchFaceIdentity: false,
        }
        render(
            <PuzzleStep
                puzzleConfig={emptyConfig}
                verifyStep={vi.fn()}
                loading={false}
            />,
        )
        expect(screen.getByText('mfa.puzzle.noChallenges')).toBeInTheDocument()
    })

    it('renders the MockChallengeComponent in auth mode (fail-closed re-score)', () => {
        render(
            <PuzzleStep
                puzzleConfig={puzzleConfig}
                verifyStep={vi.fn()}
                loading={false}
            />,
        )
        expect(screen.getByTestId('mock-challenge')).toBeInTheDocument()
        // The challenge runs its server re-score in AUTH mode — a missing/non-2xx
        // proxy must fail the challenge, never soft-pass.
        expect(capturedServerMode).toBe('auth')
    })

    it('submits server_verdicts (not a bare client trace) after onSuccess on the only challenge', async () => {
        const verifyStep = vi.fn()
        render(
            <PuzzleStep
                puzzleConfig={puzzleConfig}
                verifyStep={verifyStep}
                loading={false}
            />,
        )

        // The challenge resolves with the SERVER's re-score verdict.
        await act(async () => {
            capturedOnSuccess?.(serverVerdict('blink'))
        })

        expect(verifyStep).toHaveBeenCalledOnce()
        const [method, payload] = verifyStep.mock.calls[0]
        expect(method).toBe(AuthMethodType.PUZZLE)

        // Carries SERVER evidence …
        expect(payload).toHaveProperty('server_verdicts')
        expect(payload.server_verdicts).toEqual([
            expect.objectContaining({
                challengeId: BiometricPuzzleId.FACE_BLINK,
                completedAt: expect.any(Number),
                action: 'blink',
                verified: true,
                durationSeconds: 1.2,
            }),
        ])
        // … and does NOT fall back to the old client-trusting trace shape.
        expect(payload).not.toHaveProperty('puzzle_traces')
        // No server-issued session id is available yet (stateless proxy gap).
        expect(payload.puzzle_session_id).toBeUndefined()
    })

    it('accumulates one server verdict per challenge across a multi-challenge flow', async () => {
        const verifyStep = vi.fn()
        const twoStepConfig: PuzzleConfig = {
            allowedChallengeTypes: [
                BiometricPuzzleId.FACE_BLINK,
                BiometricPuzzleId.FACE_SMILE,
            ],
            count: 2,
            difficulty: 'easy',
            alsoMatchFaceIdentity: false,
        }
        render(
            <PuzzleStep
                puzzleConfig={twoStepConfig}
                verifyStep={verifyStep}
                loading={false}
            />,
        )

        // First challenge passes → advances, no submit yet.
        await act(async () => {
            capturedOnSuccess?.(serverVerdict('blink'))
        })
        expect(verifyStep).not.toHaveBeenCalled()

        // Second (final) challenge passes → submit both verdicts.
        await act(async () => {
            capturedOnSuccess?.(serverVerdict('smile'))
        })

        expect(verifyStep).toHaveBeenCalledOnce()
        const payload = verifyStep.mock.calls[0][1]
        expect(payload.server_verdicts).toHaveLength(2)
        expect(payload.server_verdicts.map((v: { action: string }) => v.action)).toEqual([
            'blink',
            'smile',
        ])
    })
})
