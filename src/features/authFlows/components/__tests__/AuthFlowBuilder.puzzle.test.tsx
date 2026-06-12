import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuthFlowBuilder } from '../AuthFlowBuilder'
import { AuthMethodType, type AuthFlowStep, DEFAULT_AUTH_METHODS } from '@domain/models/AuthMethod'
import type { AuthMethod } from '@domain/models/AuthMethod'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            if (opts && typeof opts.count === 'number') return `${key}:${opts.count}`
            if (opts && typeof opts.number === 'number') return `${key}:${opts.number}`
            return key
        },
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Trans: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('framer-motion', () => {
    const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
    return {
        motion: new Proxy({}, { get: () => (p: { children?: React.ReactNode }) => <div>{p.children}</div> }),
        AnimatePresence: passthrough,
    }
})

/** Build an active PUZZLE method entry for passing to authMethods prop. */
const PUZZLE_METHOD: AuthMethod = {
    id: 'PUZZLE',
    name: 'Puzzle Liveness',
    type: AuthMethodType.PUZZLE,
    description: 'Active challenge-response liveness',
    icon: 'Puzzle',
    platforms: ['web', 'mobile', 'desktop'],
    isActive: true,
    category: 'PREMIUM',
    supportsUsernameless: false,
}

/** A set of available methods including PUZZLE. */
const METHODS_WITH_PUZZLE: AuthMethod[] = [...DEFAULT_AUTH_METHODS, PUZZLE_METHOD]

/** A set of available methods WITHOUT PUZZLE (gating flag off). */
const METHODS_WITHOUT_PUZZLE: AuthMethod[] = DEFAULT_AUTH_METHODS

/** A pre-built single-PUZZLE-method layer. */
const PUZZLE_LAYER: AuthFlowStep[] = [
    {
        id: 's1',
        order: 1,
        methodId: 'PUZZLE',
        methodType: AuthMethodType.PUZZLE,
        isRequired: true,
        timeout: 120,
        maxAttempts: 3,
        puzzleConfig: {
            allowedChallengeTypes: ['FACE_BLINK'],
            count: 1,
            difficulty: 'medium',
            alsoMatchFaceIdentity: true,
        },
    },
]

/** A pre-built single-FACE-method layer. */
const FACE_LAYER: AuthFlowStep[] = [
    {
        id: 's1',
        order: 1,
        methodId: 'FACE',
        methodType: AuthMethodType.FACE,
        isRequired: true,
        timeout: 120,
        maxAttempts: 3,
    },
]

describe('AuthFlowBuilder — PUZZLE layer wiring', () => {
    it('renders PuzzleLayerConfig when a layer contains PUZZLE', () => {
        render(
            <AuthFlowBuilder
                initialSteps={PUZZLE_LAYER}
                authMethods={METHODS_WITH_PUZZLE}
            />,
        )
        // PuzzleLayerConfig renders the layer label key
        expect(screen.getByText('biometricPuzzle.builder.layerLabel')).toBeTruthy()
    })

    it('does NOT render PuzzleLayerConfig when no PUZZLE in layer', () => {
        render(
            <AuthFlowBuilder
                initialSteps={FACE_LAYER}
                authMethods={METHODS_WITH_PUZZLE}
            />,
        )
        expect(screen.queryByText('biometricPuzzle.builder.layerLabel')).toBeNull()
    })

    it('renders requireActivePuzzleLiveness toggle when a FACE layer is present', () => {
        render(
            <AuthFlowBuilder
                initialSteps={FACE_LAYER}
                authMethods={METHODS_WITH_PUZZLE}
            />,
        )
        expect(screen.getByText('authFlowBuilder.requireActivePuzzleLiveness')).toBeTruthy()
    })

    it('does NOT render requireActivePuzzleLiveness toggle when no FACE layer', () => {
        const passwordLayer: AuthFlowStep[] = [
            {
                id: 's1', order: 1, methodId: 'PASSWORD', methodType: AuthMethodType.PASSWORD,
                isRequired: true, timeout: 120, maxAttempts: 3,
            },
        ]
        render(
            <AuthFlowBuilder
                initialSteps={passwordLayer}
                authMethods={METHODS_WITH_PUZZLE}
            />,
        )
        expect(screen.queryByText('authFlowBuilder.requireActivePuzzleLiveness')).toBeNull()
    })

    it('save round-trips puzzleConfig into the step', () => {
        const onSave = vi.fn()
        render(
            <AuthFlowBuilder
                initialSteps={PUZZLE_LAYER}
                authMethods={METHODS_WITH_PUZZLE}
                onSave={onSave}
            />,
        )
        fireEvent.click(screen.getByText('authFlowBuilder.saveFlow'))
        expect(onSave).toHaveBeenCalledTimes(1)
        const saved = onSave.mock.calls[0][0]
        expect(saved.steps[0].puzzleConfig).toEqual(PUZZLE_LAYER[0].puzzleConfig)
    })

    it('save round-trips requireActivePuzzleLiveness into the FACE step when toggled ON', () => {
        const onSave = vi.fn()
        render(
            <AuthFlowBuilder
                initialSteps={FACE_LAYER}
                authMethods={METHODS_WITH_PUZZLE}
                onSave={onSave}
            />,
        )
        // Toggle the requireActivePuzzleLiveness switch ON
        const toggleLabel = screen.getByText('authFlowBuilder.requireActivePuzzleLiveness')
        const switchEl = toggleLabel.closest('label')!.querySelector('input[type="checkbox"]')!
        fireEvent.click(switchEl)

        fireEvent.click(screen.getByText('authFlowBuilder.saveFlow'))
        expect(onSave).toHaveBeenCalledTimes(1)
        const saved = onSave.mock.calls[0][0]
        expect(saved.steps[0].requireActivePuzzleLiveness).toBe(true)
    })

    it('PUZZLE method is NOT offered when authMethods does not include PUZZLE (gating off)', () => {
        render(
            <AuthFlowBuilder
                initialSteps={[]}
                authMethods={METHODS_WITHOUT_PUZZLE}
            />,
        )
        fireEvent.click(screen.getByText('authFlowBuilder.addLayer'))
        // 'Puzzle Liveness' checkbox should not appear
        expect(screen.queryByLabelText('Puzzle Liveness')).toBeNull()
        expect(screen.queryByRole('checkbox', { name: 'Puzzle Liveness' })).toBeNull()
    })

    it('PUZZLE method IS offered when authMethods includes PUZZLE (gating on)', () => {
        render(
            <AuthFlowBuilder
                initialSteps={[]}
                authMethods={METHODS_WITH_PUZZLE}
            />,
        )
        fireEvent.click(screen.getByText('authFlowBuilder.addLayer'))
        expect(screen.getByRole('checkbox', { name: 'Puzzle Liveness' })).toBeTruthy()
    })
})
