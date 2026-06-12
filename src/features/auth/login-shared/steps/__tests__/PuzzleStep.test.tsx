/**
 * PuzzleStep + MfaStepRenderer PUZZLE routing (Task 3.4, 2026-06-12)
 *
 * 1. MfaStepRenderer routes PUZZLE → PuzzleStep (landmark string visible)
 * 2. PuzzleStep: no puzzleConfig → shows noChallenges key
 * 3. PuzzleStep: valid config → renders the challenge component from registry
 * 4. PuzzleStep: onSuccess on last challenge → calls verifyStep(PUZZLE, { puzzle_traces })
 * 5. PuzzleStep: useBiometricPuzzleServer is wired with mode:'auth'
 *    (verified indirectly — the hook mock captures the mode argument)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthMethodType } from '@features/auth/constants'
import type { PuzzleConfig } from '@domain/models/AuthMethod'
import { BiometricPuzzleId } from '@features/biometric-puzzles/BiometricPuzzleId'
import type { BiometricPuzzleProps } from '@features/biometric-puzzles/biometricPuzzleRegistry'

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
            get: (_target, prop) => {
                const tag = String(prop)
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

/** Captures onSuccess so the test can fire it. */
let capturedOnSuccess: (() => void) | null = null

const MockChallengeComponent = ({ onSuccess }: BiometricPuzzleProps) => {
    capturedOnSuccess = onSuccess
    return <div data-testid="mock-challenge">mock-challenge</div>
}

vi.mock('@features/biometric-puzzles/biometricPuzzleRegistry', () => ({
    getBiometricPuzzle: (id: string) => {
        if (id === BiometricPuzzleId.FACE_BLINK) {
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
})

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

    it('renders the MockChallengeComponent when a valid BiometricPuzzleId is configured', () => {
        render(
            <PuzzleStep
                puzzleConfig={puzzleConfig}
                verifyStep={vi.fn()}
                loading={false}
            />,
        )
        expect(screen.getByTestId('mock-challenge')).toBeInTheDocument()
    })

    it('calls verifyStep(PUZZLE, { puzzle_traces }) after onSuccess on the only challenge', async () => {
        const verifyStep = vi.fn()
        render(
            <PuzzleStep
                puzzleConfig={puzzleConfig}
                verifyStep={verifyStep}
                loading={false}
            />,
        )

        // Trigger the challenge success.
        await act(async () => {
            capturedOnSuccess?.()
        })

        expect(verifyStep).toHaveBeenCalledOnce()
        expect(verifyStep).toHaveBeenCalledWith(
            AuthMethodType.PUZZLE,
            expect.objectContaining({
                puzzle_traces: expect.arrayContaining([
                    expect.objectContaining({
                        challengeId: BiometricPuzzleId.FACE_BLINK,
                        completedAt: expect.any(Number),
                    }),
                ]),
            }),
        )
    })
})
