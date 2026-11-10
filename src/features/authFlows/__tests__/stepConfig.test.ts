import { describe, it, expect } from 'vitest'
import { AuthMethodType, PUZZLE_CONFIG_DEFAULTS, type AuthFlowStep, type PuzzleConfig } from '@domain/models/AuthMethod'
import { serializeStepConfig, parseStepConfig } from '../stepConfig'

const PUZZLE_CONFIG: PuzzleConfig = {
    allowedChallengeTypes: ['blink', 'wave'],
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
    it('serializes a PUZZLE step under the "puzzleConfig" key the api reads', () => {
        const out = serializeStepConfig(step({ methodType: AuthMethodType.PUZZLE, puzzleConfig: PUZZLE_CONFIG }))
        // identity-core-api PuzzleStepConfig accepts ONLY this wrapped shape and
        // rejects the bare object on save (it used to fail closed at login).
        expect(out).toBe(
            '{"puzzleConfig":{"allowedChallengeTypes":["blink","wave"],"count":3,"difficulty":"medium","alsoMatchFaceIdentity":false}}',
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

    it('parses the api puzzle blob ({"puzzleConfig":{...}}) into puzzleConfig', () => {
        const parsed = parseStepConfig(
            '{"puzzleConfig":{"allowedChallengeTypes":["blink","wave"],"count":3,"difficulty":"medium","alsoMatchFaceIdentity":false}}',
        )
        expect(parsed.puzzleConfig).toEqual(PUZZLE_CONFIG)
    })

    it('still reads a flow saved by the old builder (bare object), so it can be re-saved', () => {
        const parsed = parseStepConfig(
            '{"allowedChallengeTypes":["FACE_BLINK","HAND_WAVE"],"count":3,"difficulty":"medium","alsoMatchFaceIdentity":false}',
        )
        expect(parsed.puzzleConfig).toEqual(PUZZLE_CONFIG)
        expect(serializeStepConfig(step({ methodType: AuthMethodType.PUZZLE, ...parsed }))).toContain(
            '"puzzleConfig":',
        )
    })

    it('parses a FACE blob into requireActivePuzzleLiveness', () => {
        expect(parseStepConfig('{"requireActivePuzzleLiveness":true}')).toEqual({
            requireActivePuzzleLiveness: true,
        })
    })

    it('defaults alsoMatchFaceIdentity to true unless explicitly false', () => {
        const parsed = parseStepConfig('{"allowedChallengeTypes":["blink"],"count":2,"difficulty":"easy"}')
        expect(parsed.puzzleConfig?.alsoMatchFaceIdentity).toBe(true)
        expect(parsed.puzzleConfig?.difficulty).toBe('easy')
    })
})

describe('defaults', () => {
    it('fills omitted fields from PUZZLE_CONFIG_DEFAULTS (binding ON, count 2), like the api', () => {
        const parsed = parseStepConfig('{"puzzleConfig":{"allowedChallengeTypes":["blink"],"count":0}}')
        expect(parsed.puzzleConfig).toEqual({ allowedChallengeTypes: ['blink'], ...PUZZLE_CONFIG_DEFAULTS })
        expect(PUZZLE_CONFIG_DEFAULTS.alsoMatchFaceIdentity).toBe(true)
        expect(PUZZLE_CONFIG_DEFAULTS.count).toBe(2)
    })

    it('drops non-string allow-list entries, like the api', () => {
        const parsed = parseStepConfig('{"puzzleConfig":{"allowedChallengeTypes":[7,"blink",null," "]}}')
        expect(parsed.puzzleConfig?.allowedChallengeTypes).toEqual(['blink'])
    })
})

describe('challenge ids are server actions (B5)', () => {
    it('reads registry ids saved by the old builder as server actions, so re-saving migrates them', () => {
        const parsed = parseStepConfig(
            '{"puzzleConfig":{"allowedChallengeTypes":["FACE_BLINK","FACE_RAISE_BOTH_BROWS","HAND_FINGER_COUNT"]}}',
        )
        expect(parsed.puzzleConfig?.allowedChallengeTypes).toEqual(['blink', 'raise_eyebrows', 'finger_count'])
        expect(serializeStepConfig(step({ methodType: AuthMethodType.PUZZLE, ...parsed }))).toContain(
            '"allowedChallengeTypes":["blink","raise_eyebrows","finger_count"]',
        )
    })

    it('keeps server actions (case-insensitive) and collapses a registry id onto the same action once', () => {
        const parsed = parseStepConfig('{"puzzleConfig":{"allowedChallengeTypes":["Blink","FACE_BLINK","wave"]}}')
        expect(parsed.puzzleConfig?.allowedChallengeTypes).toEqual(['blink', 'wave'])
    })

    it('drops unknown and unrenderable entries no checkbox could clear', () => {
        const parsed = parseStepConfig(
            '{"puzzleConfig":{"allowedChallengeTypes":["OBJECT_MATCH","light","hold_position","HAND_SHAPE_TRACE","shape_trace","nod"]}}',
        )
        expect(parsed.puzzleConfig?.allowedChallengeTypes).toEqual(['nod'])
    })
})

describe('round-trip', () => {
    it('serialize → parse preserves a puzzleConfig', () => {
        const blob = serializeStepConfig(step({ methodType: AuthMethodType.PUZZLE, puzzleConfig: PUZZLE_CONFIG }))
        expect(parseStepConfig(blob).puzzleConfig).toEqual(PUZZLE_CONFIG)
    })
})
