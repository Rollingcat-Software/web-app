/**
 * puzzleRegistry — catalog of biometric micro-challenges.
 *
 * A biometric puzzle is a small active-liveness challenge performed with the
 * camera: "blink", "smile", "turn head left", "wave", "show 3 fingers", etc.
 * NOT auth methods like EMAIL_OTP / SMS / TOTP / QR / HARDWARE_KEY (those are
 * code-based factors, not biometric signals).
 *
 * The catalog mirrors the two ported libraries:
 *   - 14 face challenges from `src/lib/biometric-engine/core/BiometricPuzzle.ts`
 *     (itself a port of `practice-and-test/demo_local_fast.py`).
 *   - 9 hand/gesture challenges from `practice-and-test/GestureAnalysis/`.
 *
 * Each registry entry maps a `BiometricPuzzleId` to:
 *   - a component that runs the challenge in the playground,
 *   - an icon + i18n key root for the card,
 *   - difficulty + platform-support metadata.
 *
 * Components today:
 *   - Face puzzles → `FacePuzzle` (wraps `FaceCaptureStep`; challenge-specific
 *     targeting lands with the next pass).
 *   - Hand puzzles → `HandGesturePlaceholderPuzzle` — a visual stub that
 *     simulates detection until the `@mediapipe/tasks-vision` integration from
 *     PR #31 (`feat/gesture-phase2-web`) lands.
 */
import type { ComponentType } from 'react'
import type { SvgIconComponent } from '@mui/icons-material'
import {
    EmojiEmotions,
    Face,
    HighlightOff,
    MenuBook,
    MoodBad,
    PanTool,
    PinchOutlined,
    RotateLeft,
    RotateRight,
    SentimentSatisfiedAlt,
    TouchApp,
    Visibility,
    VisibilityOff,
    WavingHand,
    WbSunny,
} from '@mui/icons-material'
// `FrontHand` only exists in newer @mui/icons-material versions — alias
// PanTool as a visual stand-in for hand challenges to keep the build on the
// pinned icons version.
const FrontHand = PanTool
import FacePuzzle from './puzzles/FacePuzzle'
import { makeHandGesturePlaceholder } from './puzzles/HandGesturePlaceholderPuzzle'
import { BiometricPuzzleId, type PuzzleModality } from './BiometricPuzzleId'

export interface PuzzleProps {
    onSuccess: () => void
    onError: (message: string) => void
    onClose: () => void
}

export type PuzzlePlatform = 'web' | 'android' | 'ios' | 'desktop'
export type PuzzleDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type PuzzleCapability = 'stubbedOnly' | 'realCapable'

export interface Puzzle {
    id: BiometricPuzzleId
    modality: PuzzleModality
    i18nKey: string
    component: ComponentType<PuzzleProps>
    difficulty: PuzzleDifficulty
    platforms: PuzzlePlatform[]
    icon: SvgIconComponent
    requiresEnrollment: boolean
    capability: PuzzleCapability
}

// Shared FacePuzzle component — kept identical across all 14 face challenges
// until per-challenge targeting lands. Rendering is the same; only the card
// and instructional copy differ (driven by i18nKey).
const PUZZLES: Record<BiometricPuzzleId, Puzzle> = {
    // ─── Face (14) ───────────────────────────────────────────────────
    [BiometricPuzzleId.FACE_BLINK]: {
        id: BiometricPuzzleId.FACE_BLINK,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_blink',
        component: FacePuzzle,
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: VisibilityOff,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [BiometricPuzzleId.FACE_CLOSE_LEFT]: {
        id: BiometricPuzzleId.FACE_CLOSE_LEFT,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_close_left',
        component: FacePuzzle,
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: Visibility,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [BiometricPuzzleId.FACE_CLOSE_RIGHT]: {
        id: BiometricPuzzleId.FACE_CLOSE_RIGHT,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_close_right',
        component: FacePuzzle,
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: Visibility,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [BiometricPuzzleId.FACE_SMILE]: {
        id: BiometricPuzzleId.FACE_SMILE,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_smile',
        component: FacePuzzle,
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: SentimentSatisfiedAlt,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [BiometricPuzzleId.FACE_OPEN_MOUTH]: {
        id: BiometricPuzzleId.FACE_OPEN_MOUTH,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_open_mouth',
        component: FacePuzzle,
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: MoodBad,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [BiometricPuzzleId.FACE_TURN_LEFT]: {
        id: BiometricPuzzleId.FACE_TURN_LEFT,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_turn_left',
        component: FacePuzzle,
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: RotateLeft,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [BiometricPuzzleId.FACE_TURN_RIGHT]: {
        id: BiometricPuzzleId.FACE_TURN_RIGHT,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_turn_right',
        component: FacePuzzle,
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: RotateRight,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [BiometricPuzzleId.FACE_LOOK_UP]: {
        id: BiometricPuzzleId.FACE_LOOK_UP,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_look_up',
        component: FacePuzzle,
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: WbSunny,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [BiometricPuzzleId.FACE_LOOK_DOWN]: {
        id: BiometricPuzzleId.FACE_LOOK_DOWN,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_look_down',
        component: FacePuzzle,
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: MenuBook,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [BiometricPuzzleId.FACE_RAISE_BOTH_BROWS]: {
        id: BiometricPuzzleId.FACE_RAISE_BOTH_BROWS,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_raise_both_brows',
        component: FacePuzzle,
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: EmojiEmotions,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [BiometricPuzzleId.FACE_RAISE_LEFT_BROW]: {
        id: BiometricPuzzleId.FACE_RAISE_LEFT_BROW,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_raise_left_brow',
        component: FacePuzzle,
        difficulty: 'advanced',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: EmojiEmotions,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [BiometricPuzzleId.FACE_RAISE_RIGHT_BROW]: {
        id: BiometricPuzzleId.FACE_RAISE_RIGHT_BROW,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_raise_right_brow',
        component: FacePuzzle,
        difficulty: 'advanced',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: EmojiEmotions,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [BiometricPuzzleId.FACE_NOD]: {
        id: BiometricPuzzleId.FACE_NOD,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_nod',
        component: FacePuzzle,
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: Face,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [BiometricPuzzleId.FACE_SHAKE_HEAD]: {
        id: BiometricPuzzleId.FACE_SHAKE_HEAD,
        modality: 'face',
        i18nKey: 'biometricPuzzle.puzzles.face_shake_head',
        component: FacePuzzle,
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: HighlightOff,
        requiresEnrollment: false,
        capability: 'realCapable',
    },

    // ─── Hand / gesture (9) ──────────────────────────────────────────
    // All use the placeholder until PR #31 (gesture Phase 2 web) merges.
    // The placeholder reads i18nKey from registry to render the right copy.
    [BiometricPuzzleId.HAND_FINGER_COUNT]: {
        id: BiometricPuzzleId.HAND_FINGER_COUNT,
        modality: 'hand',
        i18nKey: 'biometricPuzzle.puzzles.hand_finger_count',
        component: makeHandGesturePlaceholder('biometricPuzzle.puzzles.hand_finger_count'),
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: FrontHand,
        requiresEnrollment: false,
        capability: 'stubbedOnly',
    },
    [BiometricPuzzleId.HAND_WAVE]: {
        id: BiometricPuzzleId.HAND_WAVE,
        modality: 'hand',
        i18nKey: 'biometricPuzzle.puzzles.hand_wave',
        component: makeHandGesturePlaceholder('biometricPuzzle.puzzles.hand_wave'),
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: WavingHand,
        requiresEnrollment: false,
        capability: 'stubbedOnly',
    },
    [BiometricPuzzleId.HAND_FLIP]: {
        id: BiometricPuzzleId.HAND_FLIP,
        modality: 'hand',
        i18nKey: 'biometricPuzzle.puzzles.hand_flip',
        component: makeHandGesturePlaceholder('biometricPuzzle.puzzles.hand_flip'),
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: PanTool,
        requiresEnrollment: false,
        capability: 'stubbedOnly',
    },
    [BiometricPuzzleId.HAND_FINGER_TAP]: {
        id: BiometricPuzzleId.HAND_FINGER_TAP,
        modality: 'hand',
        i18nKey: 'biometricPuzzle.puzzles.hand_finger_tap',
        component: makeHandGesturePlaceholder('biometricPuzzle.puzzles.hand_finger_tap'),
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: TouchApp,
        requiresEnrollment: false,
        capability: 'stubbedOnly',
    },
    [BiometricPuzzleId.HAND_PINCH]: {
        id: BiometricPuzzleId.HAND_PINCH,
        modality: 'hand',
        i18nKey: 'biometricPuzzle.puzzles.hand_pinch',
        component: makeHandGesturePlaceholder('biometricPuzzle.puzzles.hand_pinch'),
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: PinchOutlined,
        requiresEnrollment: false,
        capability: 'stubbedOnly',
    },
    [BiometricPuzzleId.HAND_PEEK_A_BOO]: {
        id: BiometricPuzzleId.HAND_PEEK_A_BOO,
        modality: 'hand',
        i18nKey: 'biometricPuzzle.puzzles.hand_peek_a_boo',
        component: makeHandGesturePlaceholder('biometricPuzzle.puzzles.hand_peek_a_boo'),
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: Visibility,
        requiresEnrollment: false,
        capability: 'stubbedOnly',
    },
    [BiometricPuzzleId.HAND_SHAPE_TRACE]: {
        id: BiometricPuzzleId.HAND_SHAPE_TRACE,
        modality: 'hand',
        i18nKey: 'biometricPuzzle.puzzles.hand_shape_trace',
        component: makeHandGesturePlaceholder('biometricPuzzle.puzzles.hand_shape_trace'),
        difficulty: 'advanced',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: FrontHand,
        requiresEnrollment: false,
        capability: 'stubbedOnly',
    },
    [BiometricPuzzleId.HAND_TRACE_TEMPLATE]: {
        id: BiometricPuzzleId.HAND_TRACE_TEMPLATE,
        modality: 'hand',
        i18nKey: 'biometricPuzzle.puzzles.hand_trace_template',
        component: makeHandGesturePlaceholder('biometricPuzzle.puzzles.hand_trace_template'),
        difficulty: 'advanced',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: FrontHand,
        requiresEnrollment: false,
        capability: 'stubbedOnly',
    },
    [BiometricPuzzleId.HAND_MATH]: {
        id: BiometricPuzzleId.HAND_MATH,
        modality: 'hand',
        i18nKey: 'biometricPuzzle.puzzles.hand_math',
        component: makeHandGesturePlaceholder('biometricPuzzle.puzzles.hand_math'),
        difficulty: 'advanced',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: FrontHand,
        requiresEnrollment: false,
        capability: 'stubbedOnly',
    },
}

export const PUZZLE_REGISTRY: Readonly<Record<BiometricPuzzleId, Puzzle>> = PUZZLES

export function listPuzzles(): Puzzle[] {
    return Object.values(PUZZLES)
}

export function getPuzzle(id: BiometricPuzzleId): Puzzle | undefined {
    return PUZZLES[id]
}

export { BiometricPuzzleId } from './BiometricPuzzleId'
export type { PuzzleModality } from './BiometricPuzzleId'
