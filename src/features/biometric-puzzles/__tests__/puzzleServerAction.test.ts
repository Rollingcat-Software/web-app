/**
 * Tests for the face/hand → server-action mappers (Bug 4, 2026-05-12).
 *
 * The mapper translates web-side enums (ChallengeType, BiometricPuzzleId)
 * into the lower_snake_case strings expected by the biometric-processor
 * /liveness/verify-challenge endpoint. Mismatches mean the server rejects
 * 100% of the challenge type, so we pin the mapping for both happy paths
 * and the deliberate "no server counterpart" returns.
 */
import { describe, expect, it } from 'vitest'

import { ChallengeType } from '@/lib/biometric-engine/types'
import { BiometricPuzzleId } from '../BiometricPuzzleId'
import {
    faceChallengeToServerAction,
    handPuzzleToServerAction,
    metricKeyForAction,
    isRenderablePuzzleId,
    RENDERABLE_PUZZLE_IDS,
} from '../puzzleServerAction'

describe('faceChallengeToServerAction', () => {
    it.each([
        [ChallengeType.BLINK, 'blink'],
        [ChallengeType.SMILE, 'smile'],
        [ChallengeType.TURN_LEFT, 'turn_left'],
        [ChallengeType.TURN_RIGHT, 'turn_right'],
        [ChallengeType.OPEN_MOUTH, 'open_mouth'],
        [ChallengeType.RAISE_BOTH_BROWS, 'raise_eyebrows'],
    ])('maps %s → %s', (input, expected) => {
        expect(faceChallengeToServerAction(input)).toBe(expected)
    })

    it.each([
        [ChallengeType.CLOSE_LEFT, 'close_left_eye'],
        [ChallengeType.CLOSE_RIGHT, 'close_right_eye'],
        [ChallengeType.LOOK_UP, 'look_up'],
        [ChallengeType.LOOK_DOWN, 'look_down'],
        [ChallengeType.RAISE_LEFT_BROW, 'raise_left_brow'],
        [ChallengeType.RAISE_RIGHT_BROW, 'raise_right_brow'],
        [ChallengeType.NOD, 'nod'],
        [ChallengeType.SHAKE_HEAD, 'shake_head'],
    ])('maps previously-unmapped variant %s → %s', (input, expected) => {
        expect(faceChallengeToServerAction(input)).toBe(expected)
    })
})

describe('handPuzzleToServerAction', () => {
    it.each([
        [BiometricPuzzleId.HAND_FINGER_COUNT, 'finger_count'],
        [BiometricPuzzleId.HAND_WAVE, 'wave'],
        [BiometricPuzzleId.HAND_FLIP, 'hand_flip'],
        [BiometricPuzzleId.HAND_FINGER_TAP, 'finger_tap'],
        [BiometricPuzzleId.HAND_PINCH, 'pinch'],
        [BiometricPuzzleId.HAND_PEEK_A_BOO, 'peek_a_boo'],
        [BiometricPuzzleId.HAND_MATH, 'math'],
    ])('maps %s → %s', (input, expected) => {
        expect(handPuzzleToServerAction(input)).toBe(expected)
    })

    it('returns null for HAND_TRACE_TEMPLATE (client-only variant)', () => {
        expect(
            handPuzzleToServerAction(BiometricPuzzleId.HAND_TRACE_TEMPLATE),
        ).toBeNull()
    })

    it('returns null for HAND_SHAPE_TRACE (free-form trace has no dtw_cost — unmapped 2026-06-12)', () => {
        // Deliberately unmapped: the free-form ShapeTraceDetector gates on
        // arc-length + closure only and produces no `dtw_cost`, so bio's
        // metric-REQUIRED auth path is unsatisfiable. It must not round-trip.
        expect(
            handPuzzleToServerAction(BiometricPuzzleId.HAND_SHAPE_TRACE),
        ).toBeNull()
    })

    it('returns null for face puzzles passed by accident', () => {
        // Caller bug guard: a face-modality id must not silently round-trip
        // a hand action — the mapper is one-modality-per-function.
        expect(
            handPuzzleToServerAction(BiometricPuzzleId.FACE_BLINK as unknown as BiometricPuzzleId),
        ).toBeNull()
    })
})

describe('metricKeyForAction — canonical bio keys for surfaced actions', () => {
    it.each([
        // HAND scalars surfaced by SP-B.
        ['finger_count', 'finger_count'],
        ['math', 'finger_count'],
        ['wave', 'reversals'],
        ['hand_flip', 'orientation_changes'],
        ['finger_tap', 'tap_dist_scaled'],
        ['pinch', 'pinch_dist_scaled'],
        ['shape_trace', 'dtw_cost'],
        ['peek_a_boo', 'covered_then_revealed'],
        // FACE motion scalars.
        ['nod', 'oscillation_count'],
        ['shake_head', 'oscillation_count'],
    ])('maps action %s → canonical key %s', (action, key) => {
        expect(metricKeyForAction(action)).toBe(key)
    })
})

describe('renderable puzzle set (builder offering filter)', () => {
    it('includes every FACE_* id (all 14 face actions are mapped)', () => {
        const faceIds = Object.values(BiometricPuzzleId).filter((id) =>
            id.startsWith('FACE_'),
        )
        for (const id of faceIds) {
            expect(isRenderablePuzzleId(id as BiometricPuzzleId)).toBe(true)
        }
    })

    it('includes the 7 mapped HAND_* ids but EXCLUDES HAND_TRACE_TEMPLATE + HAND_SHAPE_TRACE', () => {
        for (const id of [
            BiometricPuzzleId.HAND_FINGER_COUNT,
            BiometricPuzzleId.HAND_WAVE,
            BiometricPuzzleId.HAND_FLIP,
            BiometricPuzzleId.HAND_FINGER_TAP,
            BiometricPuzzleId.HAND_PINCH,
            BiometricPuzzleId.HAND_PEEK_A_BOO,
            BiometricPuzzleId.HAND_MATH,
        ]) {
            expect(isRenderablePuzzleId(id)).toBe(true)
        }
        expect(isRenderablePuzzleId(BiometricPuzzleId.HAND_TRACE_TEMPLATE)).toBe(false)
        // HAND_SHAPE_TRACE is unsatisfiable (no dtw_cost) → not offered (2026-06-12).
        expect(isRenderablePuzzleId(BiometricPuzzleId.HAND_SHAPE_TRACE)).toBe(false)
    })

    it('renderable set is exactly 21 (14 face + 7 hand)', () => {
        expect(RENDERABLE_PUZZLE_IDS.size).toBe(21)
    })
})
