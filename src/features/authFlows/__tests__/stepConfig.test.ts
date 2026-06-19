import { describe, it, expect } from 'vitest'
import { AuthMethodType, type AuthFlowStep, type PuzzleConfig } from '@domain/models/AuthMethod'
import { serializeStepConfig, parseStepConfig } from '../stepConfig'

const PUZZLE_CONFIG: PuzzleConfig = {
    allowedChallengeTypes: ['OBJECT_MATCH', 'COUNT'],
    count: 3,
    difficulty: 'medium',
    alsoMatchFaceIdentity: false,
}

function step(partial: Partial<AuthFlowStep>): AuthFlowStep {
    return {
        id: 's1',
        order: 1,
        methodId: 'm',
        methodType: AuthMethodType.PASSWORD,
        isRequired: true,
        timeout: 120,
        maxAttempts: 3,
        ...partial,
    }
}

describe('serializeStepConfig', () => {
    it('serializes a PUZZLE step puzzleConfig as the backend-shaped JSON blob', () => {
        const out = serializeStepConfig(step({ methodType: AuthMethodType.PUZZLE, puzzleConfig: PUZZLE_CONFIG }))
        // must match the round-trip-tested backend shape exactly
        expect(out).toBe(
            '{"allowedChallengeTypes":["OBJECT_MATCH","COUNT"],"count":3,"difficulty":"medium","alsoMatchFaceIdentity":false}',
        )
    })

    it('serializes PUZZLE when it is a CHOICE alternative, not just the primary method', () => {
        const out = serializeStepConfig(
            step({
                methodType: AuthMethodType.FACE,
                alternativeMethodTypes: [AuthMethodType.PUZZLE],
                puzzleConfig: PUZZLE_CONFIG,
            }),
        )
        expect(out).toContain('allowedChallengeTypes')
    })

    it('serializes a FACE step active-puzzle-liveness toggle', () => {
        const out = serializeStepConfig(
            step({ methodType: AuthMethodType.FACE, requireActivePuzzleLiveness: true }),
        )
        expect(out).toBe('{"requireActivePuzzleLiveness":true}')
    })

    it('returns undefined for an ordinary step (payload shape unchanged)', () => {
        expect(serializeStepConfig(step({ methodType: AuthMethodType.PASSWORD }))).toBeUndefined()
    })

    it('returns undefined for a PUZZLE step that has no puzzleConfig yet', () => {
        expect(serializeStepConfig(step({ methodType: AuthMethodType.PUZZLE }))).toBeUndefined()
    })
})

describe('parseStepConfig', () => {
    it('returns {} for undefined / empty / malformed config', () => {
        expect(parseStepConfig(undefined)).toEqual({})
        expect(parseStepConfig('{}')).toEqual({})
        expect(parseStepConfig('not json')).toEqual({})
    })

    it('parses a backend puzzle blob into puzzleConfig', () => {
        const parsed = parseStepConfig(
            '{"allowedChallengeTypes":["OBJECT_MATCH","COUNT"],"count":3,"difficulty":"medium","alsoMatchFaceIdentity":false}',
        )
        expect(parsed.puzzleConfig).toEqual(PUZZLE_CONFIG)
    })

    it('parses a FACE blob into requireActivePuzzleLiveness', () => {
        expect(parseStepConfig('{"requireActivePuzzleLiveness":true}')).toEqual({
            requireActivePuzzleLiveness: true,
        })
    })

    it('defaults alsoMatchFaceIdentity to true unless explicitly false', () => {
        const parsed = parseStepConfig('{"allowedChallengeTypes":["COUNT"],"count":2,"difficulty":"easy"}')
        expect(parsed.puzzleConfig?.alsoMatchFaceIdentity).toBe(true)
        expect(parsed.puzzleConfig?.difficulty).toBe('easy')
    })
})

describe('round-trip', () => {
    it('serialize → parse preserves a puzzleConfig', () => {
        const blob = serializeStepConfig(step({ methodType: AuthMethodType.PUZZLE, puzzleConfig: PUZZLE_CONFIG }))
        expect(parseStepConfig(blob).puzzleConfig).toEqual(PUZZLE_CONFIG)
    })
})
