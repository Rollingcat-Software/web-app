/**
 * Mapping from the web client's local enums to the biometric-processor
 * ``ChallengeType`` string-values accepted by ``/liveness/verify-challenge``.
 *
 * The web side uses two distinct enums:
 *   - ``ChallengeType`` in ``biometric-engine/types`` for FACE puzzles
 *     (UPPERCASE, e.g. ``BLINK``, ``TURN_LEFT``).
 *   - ``BiometricPuzzleId`` for the public training registry (FACE_* and
 *     HAND_* prefixed identifiers).
 *
 * The server enum is a flat lower_snake_case set in
 * ``biometric-processor/app/api/schemas/active_liveness.py``. Some local
 * variants (CLOSE_LEFT, CLOSE_RIGHT, LOOK_UP, LOOK_DOWN, RAISE_LEFT_BROW,
 * RAISE_RIGHT_BROW, NOD, SHAKE_HEAD, HAND_TRACE_TEMPLATE) don't have a
 * 1:1 server counterpart — those rows return ``null`` here, which the
 * caller hook treats as "skip server validation".
 */
import { ChallengeType } from '@/lib/biometric-engine/types'
import { BiometricPuzzleId } from './BiometricPuzzleId'
import type { PuzzleServerAction } from './useBiometricPuzzleServer'

/** Face ChallengeType → server ChallengeType action string. */
const FACE_CHALLENGE_TO_SERVER: Partial<Record<ChallengeType, PuzzleServerAction>> = {
    [ChallengeType.BLINK]: 'blink',
    [ChallengeType.SMILE]: 'smile',
    [ChallengeType.TURN_LEFT]: 'turn_left',
    [ChallengeType.TURN_RIGHT]: 'turn_right',
    [ChallengeType.OPEN_MOUTH]: 'open_mouth',
    [ChallengeType.RAISE_BOTH_BROWS]: 'raise_eyebrows',
    // CLOSE_LEFT, CLOSE_RIGHT, LOOK_UP, LOOK_DOWN, RAISE_LEFT_BROW,
    // RAISE_RIGHT_BROW, NOD, SHAKE_HEAD: no 1:1 server enum — skip.
}

/** Hand BiometricPuzzleId → server ChallengeType action string. */
const HAND_PUZZLE_TO_SERVER: Partial<Record<BiometricPuzzleId, PuzzleServerAction>> = {
    [BiometricPuzzleId.HAND_FINGER_COUNT]: 'finger_count',
    [BiometricPuzzleId.HAND_WAVE]: 'wave',
    [BiometricPuzzleId.HAND_FLIP]: 'hand_flip',
    [BiometricPuzzleId.HAND_FINGER_TAP]: 'finger_tap',
    [BiometricPuzzleId.HAND_PINCH]: 'pinch',
    [BiometricPuzzleId.HAND_PEEK_A_BOO]: 'peek_a_boo',
    [BiometricPuzzleId.HAND_SHAPE_TRACE]: 'shape_trace',
    [BiometricPuzzleId.HAND_MATH]: 'math',
    // HAND_TRACE_TEMPLATE: client-only variant of SHAPE_TRACE — skip.
}

/** Resolve a face ChallengeType to its server action, or null if unmapped. */
export function faceChallengeToServerAction(
    ct: ChallengeType,
): PuzzleServerAction | null {
    return FACE_CHALLENGE_TO_SERVER[ct] ?? null
}

/** Resolve a hand BiometricPuzzleId to its server action, or null if unmapped. */
export function handPuzzleToServerAction(
    id: BiometricPuzzleId,
): PuzzleServerAction | null {
    return HAND_PUZZLE_TO_SERVER[id] ?? null
}
