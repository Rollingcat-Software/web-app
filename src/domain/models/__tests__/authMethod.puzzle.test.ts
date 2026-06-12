import { describe, it, expect } from 'vitest'
import {
    AuthMethodType,
    isLoginMethodType,
    type AuthFlowStep,
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
