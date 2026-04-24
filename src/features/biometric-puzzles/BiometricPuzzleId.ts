/**
 * BiometricPuzzleId — the catalog of real biometric micro-challenges.
 *
 * A *biometric puzzle* is NOT an auth method. EMAIL_OTP / SMS / TOTP / QR_CODE /
 * HARDWARE_KEY are auth methods, not biometric puzzles — entering a one-time
 * code is not a biometric signal.
 *
 * A biometric puzzle is a small, active-liveness challenge performed with the
 * user's face or hands in front of the camera:
 *
 *   - Face challenges (14): blink, smile, open mouth, turn head left/right,
 *     look up/down, raise brows, nod, shake — the set already implemented in
 *     `src/lib/biometric-engine/core/BiometricPuzzle.ts` + ported from
 *     `practice-and-test/demo_local_fast.py`.
 *
 *   - Hand/gesture challenges (9): finger count, shape trace, wave,
 *     hand flip, finger tap, pinch, peek-a-boo, quick math (finger digits),
 *     trace template — ported from
 *     `practice-and-test/GestureAnalysis/*.py`.
 *
 * Voice liveness, fingerprint tap, and NFC card-read are modalities in their
 * own right — they are covered by the normal auth-step flow and do NOT appear
 * on the Biometric Puzzles playground.
 */
export enum BiometricPuzzleId {
    // ─── Face micro-challenges (14) ──────────────────────────────────
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

    // ─── Hand / gesture challenges (9) ───────────────────────────────
    HAND_FINGER_COUNT = 'HAND_FINGER_COUNT',
    HAND_SHAPE_TRACE = 'HAND_SHAPE_TRACE',
    HAND_WAVE = 'HAND_WAVE',
    HAND_FLIP = 'HAND_FLIP',
    HAND_FINGER_TAP = 'HAND_FINGER_TAP',
    HAND_PINCH = 'HAND_PINCH',
    HAND_PEEK_A_BOO = 'HAND_PEEK_A_BOO',
    HAND_MATH = 'HAND_MATH',
    HAND_TRACE_TEMPLATE = 'HAND_TRACE_TEMPLATE',
}

export type PuzzleModality = 'face' | 'hand'
