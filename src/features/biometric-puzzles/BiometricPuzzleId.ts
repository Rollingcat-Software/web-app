/**
 * BiometricPuzzleId
 *
 * Canonical enum for the 23 active-liveness micro-challenges the platform
 * supports. 14 face challenges are a direct mirror of
 * `biometric-engine/types/ChallengeType` and are detected client-side by
 * `BiometricPuzzle` (port of `practice-and-test/demo_local_fast.py`). 9 hand
 * gesture challenges originate from `practice-and-test/GestureAnalysis/*.py`
 * and are currently simulated until the MediaPipe HandLandmarker integration
 * lands on the gesture-phase2 branch.
 *
 * NOTE: this enum is *not* `AuthMethodType`. AuthMethodType identifies the 9
 * pluggable authentication methods (EMAIL_OTP, FACE, etc.). BiometricPuzzleId
 * identifies the fine-grained micro-challenges that power active liveness
 * *within* the FACE auth method (and, later, within a GESTURE_LIVENESS
 * auth method once it lands server-side).
 */
export enum BiometricPuzzleId {
    // 14 face challenges — mirrors biometric-engine ChallengeType.
    FACE_BLINK = 'FACE_BLINK',
    FACE_CLOSE_LEFT = 'FACE_CLOSE_LEFT',
    FACE_CLOSE_RIGHT = 'FACE_CLOSE_RIGHT',
    FACE_SMILE = 'FACE_SMILE',
    FACE_OPEN_MOUTH = 'FACE_OPEN_MOUTH',
    FACE_TURN_LEFT = 'FACE_TURN_LEFT',
    FACE_TURN_RIGHT = 'FACE_TURN_RIGHT',
    FACE_LOOK_UP = 'FACE_LOOK_UP',
    FACE_LOOK_DOWN = 'FACE_LOOK_DOWN',
    FACE_RAISE_BOTH_BROWS = 'FACE_RAISE_BOTH_BROWS',
    FACE_RAISE_LEFT_BROW = 'FACE_RAISE_LEFT_BROW',
    FACE_RAISE_RIGHT_BROW = 'FACE_RAISE_RIGHT_BROW',
    FACE_NOD = 'FACE_NOD',
    FACE_SHAKE_HEAD = 'FACE_SHAKE_HEAD',

    // 9 hand-gesture challenges — from practice-and-test/GestureAnalysis/*.py.
    HAND_FINGER_COUNT = 'HAND_FINGER_COUNT',
    HAND_WAVE = 'HAND_WAVE',
    HAND_FLIP = 'HAND_FLIP',
    HAND_FINGER_TAP = 'HAND_FINGER_TAP',
    HAND_PINCH = 'HAND_PINCH',
    HAND_PEEK_A_BOO = 'HAND_PEEK_A_BOO',
    HAND_SHAPE_TRACE = 'HAND_SHAPE_TRACE',
    HAND_TRACE_TEMPLATE = 'HAND_TRACE_TEMPLATE',
    HAND_MATH = 'HAND_MATH',
}

export type BiometricPuzzleModality = 'face' | 'hand'
