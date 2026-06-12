/**
 * puzzleConfig threading (Phase-5 identity binding, 2026-06-12)
 *
 * The PUZZLE step's `alsoMatchFaceIdentity` identity-binding is inert unless the
 * tenant's `puzzleConfig` reaches `PuzzleStep`. BOTH login dispatchers must
 * source the active PUZZLE step's config from the resolved login-config and
 * thread it through the SHARED `MfaStepRenderer`:
 *   - dashboard:  `TwoFactorDispatcher`  (passes `puzzleConfig` from LoginPage)
 *   - hosted:     `LoginMfaFlow`         (selects it via `selectPuzzleConfig`)
 *
 * `MfaStepRenderer` is mocked here so we can capture EXACTLY what each dispatcher
 * passes for a PUZZLE step — the renderer→PuzzleStep wiring itself is covered by
 * MfaStepRenderer's own suite + PuzzleStep.binding.test.tsx.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '../../../../i18n'
import { AuthMethodType } from '@features/auth/constants'
import { normalizeLoginConfig } from '@domain/models/LoginConfig'
import type { PuzzleConfig } from '@domain/models/AuthMethod'

// Capture the props every MfaStepRenderer render receives.
const rendererProps: Array<Record<string, unknown>> = []
vi.mock('@features/auth/login-shared/MfaStepRenderer', () => ({
    default: (props: Record<string, unknown>) => {
        rendererProps.push(props)
        return <div data-testid="mfa-step-renderer">method:{String(props.method)}</div>
    },
}))

// Inert biometric-engine warm-up (jsdom).
vi.mock('@/lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: { getInstance: () => ({ initialize: () => Promise.resolve() }) },
}))

// ── DI stubs shared by both dispatchers ───────────────────────────────────
const mockBegin = vi.fn()
const mockVerifyMfaStep = vi.fn()
const authRepoStub = {
    login: vi.fn(),
    beginIdentifierLogin: mockBegin,
    verifyMfaStep: mockVerifyMfaStep,
    checkLoginEligibility: vi.fn().mockResolvedValue(undefined),
}
const httpStub = { post: vi.fn(), get: vi.fn() }
vi.mock('@app/providers', () => ({
    useService: (type: symbol) =>
        String(type).includes('AuthRepository') ? authRepoStub : httpStub,
}))

import TwoFactorDispatcher from '@features/auth/components/TwoFactorDispatcher'
import LoginMfaFlow from '@/verify-app/LoginMfaFlow'

const PUZZLE_CONFIG: PuzzleConfig = {
    allowedChallengeTypes: ['FACE_BLINK'],
    count: 1,
    difficulty: 'medium',
    alsoMatchFaceIdentity: true,
}

beforeEach(() => {
    rendererProps.length = 0
    mockBegin.mockReset()
    mockVerifyMfaStep.mockReset()
})

describe('puzzleConfig threading → MfaStepRenderer', () => {
    it('dashboard TwoFactorDispatcher passes puzzleConfig for a PUZZLE step', () => {
        render(
            <TwoFactorDispatcher
                method={AuthMethodType.PUZZLE}
                mfaSessionToken="sess-1"
                onAuthenticated={vi.fn()}
                onBackToMethodSelection={vi.fn()}
                onCancel={vi.fn()}
                puzzleConfig={PUZZLE_CONFIG}
            />,
        )
        const last = rendererProps.at(-1)!
        expect(last.method).toBe(AuthMethodType.PUZZLE)
        expect(last.puzzleConfig).toEqual(PUZZLE_CONFIG)
    })

    it('hosted LoginMfaFlow selects + passes puzzleConfig for a PUZZLE step', async () => {
        // A config whose Layer-1 is a lone PUZZLE method carrying a puzzleConfig.
        const config = normalizeLoginConfig({
            engineActive: false,
            layer1: {
                identifierRequired: true,
                methods: [{ type: 'PUZZLE', puzzleConfig: PUZZLE_CONFIG }],
            },
        })!
        // beginIdentifierLogin resolves to a single enrolled PUZZLE method so the
        // flow auto-advances straight to the PUZZLE MFA step.
        mockBegin.mockResolvedValue({
            mfaSessionToken: 'sess-2',
            twoFactorRequired: true,
            availableMethods: [
                {
                    methodType: 'PUZZLE',
                    name: 'Puzzle',
                    category: 'BIOMETRIC',
                    enrolled: true,
                    preferred: true,
                    requiresEnrollment: false,
                },
            ],
        })

        render(
            <LoginMfaFlow
                clientId="c1"
                onComplete={vi.fn()}
                onCancel={vi.fn()}
                loginConfig={config}
            />,
        )

        // Identifier-first (PUZZLE Layer-1 needs an email) → submit it.
        fireEvent.change(screen.getByLabelText('Email Address'), {
            target: { value: 'user@example.com' },
        })
        fireEvent.click(screen.getByRole('button', { name: /continue/i }))

        // The flow advances to the PUZZLE step and renders MfaStepRenderer with
        // the tenant's puzzleConfig threaded in.
        await waitFor(() => {
            const puzzleRender = rendererProps.find((p) => p.method === AuthMethodType.PUZZLE)
            expect(puzzleRender).toBeDefined()
            expect(puzzleRender!.puzzleConfig).toEqual(PUZZLE_CONFIG)
        })
    })
})
