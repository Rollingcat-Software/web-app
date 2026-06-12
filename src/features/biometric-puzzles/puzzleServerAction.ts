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
 * ``biometric-processor/app/api/schemas/active_liveness.py``. A few local ids
 * have no usable 1:1 server counterpart — those return ``null`` here, which the
 * caller hook treats as "skip server validation":
 *   - HAND_TRACE_TEMPLATE — client-only DTW variant, no server action;
 *   - HAND_SHAPE_TRACE — free-form trace can't produce bio's `dtw_cost` metric,
 *     so it's deliberately unmapped (2026-06-12) and never offered.
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
    [ChallengeType.CLOSE_LEFT]: 'close_left_eye',
    [ChallengeType.CLOSE_RIGHT]: 'close_right_eye',
    [ChallengeType.LOOK_UP]: 'look_up',
    [ChallengeType.LOOK_DOWN]: 'look_down',
    [ChallengeType.RAISE_LEFT_BROW]: 'raise_left_brow',
    [ChallengeType.RAISE_RIGHT_BROW]: 'raise_right_brow',
    [ChallengeType.NOD]: 'nod',
    [ChallengeType.SHAKE_HEAD]: 'shake_head',
}

/** Hand BiometricPuzzleId → server ChallengeType action string. */
const HAND_PUZZLE_TO_SERVER: Partial<Record<BiometricPuzzleId, PuzzleServerAction>> = {
    [BiometricPuzzleId.HAND_FINGER_COUNT]: 'finger_count',
    [BiometricPuzzleId.HAND_WAVE]: 'wave',
    [BiometricPuzzleId.HAND_FLIP]: 'hand_flip',
    [BiometricPuzzleId.HAND_FINGER_TAP]: 'finger_tap',
    [BiometricPuzzleId.HAND_PINCH]: 'pinch',
    [BiometricPuzzleId.HAND_PEEK_A_BOO]: 'peek_a_boo',
    [BiometricPuzzleId.HAND_MATH]: 'math',
    // HAND_SHAPE_TRACE: DELIBERATELY UNMAPPED (2026-06-12). bio's `shape_trace`
    // canonical metric is `dtw_cost` (≤ 0.25) against the SPECIFIC server-issued
    // template, but the free-form `ShapeTraceDetector` (HAND_SHAPE_TRACE) gates on
    // arc-length + closure only — it computes NO `dtw_cost`. With no honest scalar
    // the metric-REQUIRED auth path fails closed, making the puzzle unsatisfiable.
    // Leaving it unmapped drops it from `RENDERABLE_PUZZLE_IDS` so the flow builder
    // never offers it (same treatment as the component-less `light`/`hold_position`).
    // BACKLOG: build template-DTW shape matching (consume the session's
    // `template_key` param, DTW the traced path à la `TemplateTraceDetector`, and
    // surface `dtw_cost`) — then re-map HAND_SHAPE_TRACE here to re-enable it.
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

// ---------------------------------------------------------------------------
// Reverse maps (CV-3, 2026-06-12) — server action → web challenge component id
// ---------------------------------------------------------------------------
//
// The server-issued puzzle session (CV-1/CV-2) drives EXACTLY the challenges bio
// randomly selected; the web must render the matching component for each issued
// ``action``. These maps are the inverse of the two forward maps above. Every
// face action resolves to a `BiometricPuzzleId.FACE_*` (the registry id whose
// component runs the gesture); every hand action to a `BiometricPuzzleId.HAND_*`.
// Built from the forward maps + `BIOMETRIC_PUZZLE_REGISTRY` so a future edit to
// the forward map propagates here automatically.

/** server action → the registry BiometricPuzzleId whose component runs it. */
const ACTION_TO_PUZZLE_ID: Partial<Record<PuzzleServerAction, BiometricPuzzleId>> =
    (() => {
        const map: Partial<Record<PuzzleServerAction, BiometricPuzzleId>> = {}
        // Face: invert FACE_CHALLENGE_TO_SERVER via the registry's challengeType.
        // The registry holds one FACE_* entry per ChallengeType, so map each
        // server action back through its ChallengeType to the registry id.
        const challengeTypeToId: Partial<Record<ChallengeType, BiometricPuzzleId>> = {
            [ChallengeType.BLINK]: BiometricPuzzleId.FACE_BLINK,
            [ChallengeType.CLOSE_LEFT]: BiometricPuzzleId.FACE_CLOSE_LEFT,
            [ChallengeType.CLOSE_RIGHT]: BiometricPuzzleId.FACE_CLOSE_RIGHT,
            [ChallengeType.SMILE]: BiometricPuzzleId.FACE_SMILE,
            [ChallengeType.OPEN_MOUTH]: BiometricPuzzleId.FACE_OPEN_MOUTH,
            [ChallengeType.TURN_LEFT]: BiometricPuzzleId.FACE_TURN_LEFT,
            [ChallengeType.TURN_RIGHT]: BiometricPuzzleId.FACE_TURN_RIGHT,
            [ChallengeType.LOOK_UP]: BiometricPuzzleId.FACE_LOOK_UP,
            [ChallengeType.LOOK_DOWN]: BiometricPuzzleId.FACE_LOOK_DOWN,
            [ChallengeType.RAISE_BOTH_BROWS]: BiometricPuzzleId.FACE_RAISE_BOTH_BROWS,
            [ChallengeType.RAISE_LEFT_BROW]: BiometricPuzzleId.FACE_RAISE_LEFT_BROW,
            [ChallengeType.RAISE_RIGHT_BROW]: BiometricPuzzleId.FACE_RAISE_RIGHT_BROW,
            [ChallengeType.NOD]: BiometricPuzzleId.FACE_NOD,
            [ChallengeType.SHAKE_HEAD]: BiometricPuzzleId.FACE_SHAKE_HEAD,
        }
        for (const [ct, action] of Object.entries(FACE_CHALLENGE_TO_SERVER)) {
            const id = challengeTypeToId[ct as ChallengeType]
            if (action && id) map[action] = id
        }
        // Hand: invert HAND_PUZZLE_TO_SERVER directly.
        for (const [id, action] of Object.entries(HAND_PUZZLE_TO_SERVER)) {
            if (action) map[action] = id as BiometricPuzzleId
        }
        return map
    })()

/**
 * Resolve a server-issued ``action`` to the web ``BiometricPuzzleId`` whose
 * registry component runs that gesture, or null if the web cannot render it.
 * A null result is a VOCABULARY GAP — the server issued an action the web has
 * no component for (the PUZZLE step must fail closed rather than skip it).
 */
export function serverActionToPuzzleId(
    action: string,
): BiometricPuzzleId | null {
    return ACTION_TO_PUZZLE_ID[action as PuzzleServerAction] ?? null
}

/**
 * The set of ``BiometricPuzzleId``s that a server-issued action can resolve to —
 * i.e. the puzzles the web can actually RENDER **and** satisfy. This is the image
 * of `serverActionToPuzzleId`: every FACE_* (all 14 mapped) + the 7 mapped HAND_*
 * puzzles. It EXCLUDES:
 *   - `HAND_TRACE_TEMPLATE` (client-only variant — no forward server-action map);
 *   - `HAND_SHAPE_TRACE` (free-form trace can't produce bio's `dtw_cost` metric —
 *     deliberately unmapped 2026-06-12 so it's never offered; see the backlog note
 *     on `HAND_PUZZLE_TO_SERVER`);
 *   - actions with no web component at all (`light`, `hold_position`), which have
 *     no `BiometricPuzzleId` so they never appear here.
 *
 * The flow builder uses this to offer ONLY renderable challenge types, so an
 * admin cannot configure a flow that issues a challenge the web can't render
 * (the PUZZLE step already fails closed at runtime; this prevents the misconfig).
 */
export const RENDERABLE_PUZZLE_IDS: ReadonlySet<BiometricPuzzleId> = new Set(
    Object.values(ACTION_TO_PUZZLE_ID).filter(
        (id): id is BiometricPuzzleId => id != null,
    ),
)

/** True if the web has a renderable component reachable for this puzzle id. */
export function isRenderablePuzzleId(id: BiometricPuzzleId): boolean {
    return RENDERABLE_PUZZLE_IDS.has(id)
}

// ---------------------------------------------------------------------------
// Canonical metric key per server action (CV-3) — must match bio
// ``app/application/services/challenge_metric_scorer.py`` ``ACTION_METRIC_KEY``.
// ---------------------------------------------------------------------------
//
// bio's SUBMIT path is metric-REQUIRED: the payload MUST carry the canonical key
// (non-null) for the action or bio fails the challenge with ``METRIC_REQUIRED``.
// The web puzzle components compute the underlying scalar locally; PuzzleStep
// submits it under exactly this key. Kept in lockstep with bio by the table
// documented in the CV-3 report.
//
// SIGN CONVENTION (cross-repo, agreed 2026-06-12 — Phase-1B):
//   yaw   < 0 = head turned to the USER's LEFT  (turn_left);  > 0 = RIGHT (turn_right)
//   pitch < 0 = looking UP / chin up            (look_up);    > 0 = looking DOWN (look_down)
// The web submits the RAW `headPose.pitch` / `headPose.yaw` under these keys
// (see `canonicalFaceMetric` in FacePuzzle.tsx + the `HeadPoseEstimator` class doc).
// bio's `challenge_metric_scorer.py` gates `look_up: pitch ≤ -10°`,
// `look_down: pitch ≥ +10°`, `turn_left: yaw ≤ -15°`, `turn_right: yaw ≥ +15°` —
// SAME sign on both sides, so the raw scalar is submitted unchanged (no flip).

/**
 * Server action → the single canonical metric key bio expects in
 * ``metrics`` on the SUBMIT path. Mirrors bio ``ACTION_METRIC_KEY`` 1:1.
 */
export const ACTION_METRIC_KEY: Record<PuzzleServerAction, string> = {
    blink: 'ear',
    close_left_eye: 'ear',
    close_right_eye: 'ear',
    smile: 'mar',
    open_mouth: 'mar',
    raise_eyebrows: 'brow_raise',
    raise_left_brow: 'brow_raise',
    raise_right_brow: 'brow_raise',
    turn_left: 'yaw',
    turn_right: 'yaw',
    look_up: 'pitch',
    look_down: 'pitch',
    nod: 'oscillation_count',
    shake_head: 'oscillation_count',
    light: 'brightness_delta',
    finger_count: 'finger_count',
    math: 'finger_count',
    wave: 'reversals',
    hand_flip: 'orientation_changes',
    finger_tap: 'tap_dist_scaled',
    pinch: 'pinch_dist_scaled',
    hold_position: 'wrist_variance',
    shape_trace: 'dtw_cost',
    peek_a_boo: 'covered_then_revealed',
}

/** Canonical metric key for a server action, or null if the action is unknown. */
export function metricKeyForAction(action: string): string | null {
    return ACTION_METRIC_KEY[action as PuzzleServerAction] ?? null
}
