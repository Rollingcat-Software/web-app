import { describe, it, expect } from 'vitest'
import {
    AuthMethodType,
    isLoginMethodType,
    mapAuthMethodResponseToModel,
    DEFAULT_AUTH_METHODS,
    type AuthFlowStep,
    type AuthMethodApiResponse,
} from '../AuthMethod'
import type { PuzzleConfig } from '../AuthMethod'

describe('PUZZLE auth method type', () => {
    it('PUZZLE enum value is the string "PUZZLE"', () => {
        expect(AuthMethodType.PUZZLE).toBe('PUZZLE')
    })

    it('isLoginMethodType(PUZZLE) is true', () => {
        expect(isLoginMethodType(AuthMethodType.PUZZLE)).toBe(true)
    })

    it('isLoginMethodType(GESTURE_LIVENESS) is still false', () => {
        expect(isLoginMethodType(AuthMethodType.GESTURE_LIVENESS)).toBe(false)
    })

    it('PuzzleConfig type compiles with all 4 required fields', () => {
        const cfg: PuzzleConfig = {
            allowedChallengeTypes: ['FACE_BLINK', 'HAND_WAVE'],
            count: 2,
            difficulty: 'medium',
            alsoMatchFaceIdentity: true,
        }
        expect(cfg.allowedChallengeTypes).toHaveLength(2)
        expect(cfg.count).toBe(2)
        expect(cfg.difficulty).toBe('medium')
        expect(cfg.alsoMatchFaceIdentity).toBe(true)
    })

    it('AuthFlowStep accepts puzzleConfig and requireActivePuzzleLiveness', () => {
        const step: AuthFlowStep = {
            id: 'step-1',
            order: 1,
            methodId: 'PUZZLE',
            methodType: AuthMethodType.PUZZLE,
            isRequired: true,
            timeout: 120,
            maxAttempts: 3,
            puzzleConfig: {
                allowedChallengeTypes: ['FACE_SMILE'],
                count: 1,
                difficulty: 'easy',
                alsoMatchFaceIdentity: false,
            },
        }
        expect(step.puzzleConfig?.difficulty).toBe('easy')
        expect(step.puzzleConfig?.alsoMatchFaceIdentity).toBe(false)

        const faceStep: AuthFlowStep = {
            id: 'step-2',
            order: 1,
            methodId: 'FACE',
            methodType: AuthMethodType.FACE,
            isRequired: true,
            timeout: 120,
            maxAttempts: 3,
            requireActivePuzzleLiveness: true,
        }
        expect(faceStep.requireActivePuzzleLiveness).toBe(true)
    })
})

describe('mapAuthMethodResponseToModel — backend-gated PUZZLE', () => {
    const basePuzzleResponse: AuthMethodApiResponse = {
        id: 'PUZZLE',
        type: 'PUZZLE',
        name: '',
        description: '',
        category: 'PREMIUM',
        platforms: ['web', 'mobile', 'desktop'],
        requiresEnrollment: false,
        isActive: true,
    }

    it('maps a backend PUZZLE method instead of dropping it', () => {
        // Regression: PUZZLE is intentionally absent from DEFAULT_AUTH_METHODS,
        // so the old DEFAULT_METHOD_BY_TYPE lookup returned undefined and the
        // mapper dropped it → it never reached the flow builder even with the
        // flag ON. Same bug class that hit PASSKEY/APPROVE_LOGIN.
        const model = mapAuthMethodResponseToModel(basePuzzleResponse)
        expect(model).not.toBeNull()
        expect(model?.type).toBe(AuthMethodType.PUZZLE)
        expect(model?.isActive).toBe(true)
    })

    it('gives a backend PUZZLE without a name a non-empty humanized fallback', () => {
        const model = mapAuthMethodResponseToModel({ ...basePuzzleResponse, name: '' })
        expect(model?.name?.trim().length).toBeGreaterThan(0)
        expect(model?.name).toBe('Puzzle')
    })

    it('keeps a backend-supplied PUZZLE name when present', () => {
        const model = mapAuthMethodResponseToModel({ ...basePuzzleResponse, name: 'Puzzle Liveness' })
        expect(model?.name).toBe('Puzzle Liveness')
    })

    it('PUZZLE is NOT in the static DEFAULT_AUTH_METHODS catalog (gating intact)', () => {
        // PUZZLE must stay backend-seeded only — adding it to the static defaults
        // would surface it in the offline/flag-OFF fallback catalog where it
        // should never appear.
        const types = DEFAULT_AUTH_METHODS.map((m) => m.type)
        expect(types).not.toContain(AuthMethodType.PUZZLE)
    })

    it('still returns null for a genuinely-unknown (non-enum) method type', () => {
        const model = mapAuthMethodResponseToModel({ ...basePuzzleResponse, type: 'TOTALLY_UNKNOWN' })
        expect(model).toBeNull()
    })

    it('still returns null for GESTURE_LIVENESS (enum but not a login factor)', () => {
        const model = mapAuthMethodResponseToModel({
            ...basePuzzleResponse,
            type: AuthMethodType.GESTURE_LIVENESS,
        })
        expect(model).toBeNull()
    })
})
