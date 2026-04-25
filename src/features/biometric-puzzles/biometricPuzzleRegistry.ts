/**
 * biometricPuzzleRegistry
 *
 * Registry for the 23 active-liveness micro-challenges (14 face + 9 hand).
 * The Biometric Puzzles page renders a card per entry and launches the
 * associated component inside a runner modal.
 *
 * NOTE: this registry is intentionally separate from `authMethodRegistry`
 * (the 9 pluggable auth methods). The two trees serve different purposes —
 * auth methods pick HOW a user authenticates; biometric puzzles pick WHICH
 * gesture the active-liveness detector should prompt for during a FACE
 * authentication (or later, a GESTURE_LIVENESS authentication).
 *
 * IMPORTANT: the face puzzles use the REAL biometric engine via the
 * top-level `DependencyProvider` — they do NOT go through a stub
 * repository. Only HTTP verification calls are mocked (by the puzzle
 * component itself). This keeps BlazeFace + MediaPipe detection fully
 * functional during preview.
 */
import type { ComponentType } from 'react'
import type { SvgIconComponent } from '@mui/icons-material'
import {
    BackHand,
    Calculate,
    ChildCare,
    EmojiEmotions,
    Face,
    Gesture,
    PanTool,
    Pinch,
    RemoveRedEye,
    SentimentSatisfiedAlt,
    SwapHoriz,
    Timeline,
    TouchApp,
    Vibration,
    Visibility,
    WavingHand,
} from '@mui/icons-material'

import { BiometricPuzzleId, type BiometricPuzzleModality } from './BiometricPuzzleId'
import { ChallengeType } from '@/lib/biometric-engine/types'
import { makeFacePuzzle } from './puzzles/FacePuzzle'
import { makeHandPuzzle } from './puzzles/HandGesturePuzzle'

/**
 * Props every puzzle component receives. Mirrors the auth-methods-testing
 * contract so the two runner modals can stay aligned.
 */
export interface BiometricPuzzleProps {
    onSuccess: () => void
    onError: (message: string) => void
    onClose: () => void
}

export type BiometricPuzzlePlatform = 'web' | 'android' | 'ios' | 'desktop'
export type BiometricPuzzleDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type BiometricPuzzleCapability = 'stubbedOnly' | 'realCapable'

export interface BiometricPuzzleEntry {
    id: BiometricPuzzleId
    modality: BiometricPuzzleModality
    /** i18n key root, e.g. `biometricPuzzle.puzzles.face_blink` */
    i18nKey: string
    component: ComponentType<BiometricPuzzleProps>
    difficulty: BiometricPuzzleDifficulty
    platforms: BiometricPuzzlePlatform[]
    icon: SvgIconComponent
    /** Active-liveness puzzles never require prior enrollment. */
    requiresEnrollment: false
    capability: BiometricPuzzleCapability
    /**
     * The engine `ChallengeType` this puzzle exercises — only set for face
     * puzzles (hand puzzles have no engine counterpart yet).
     */
    challengeType?: ChallengeType
}

const FACE_PLATFORMS: BiometricPuzzlePlatform[] = ['web', 'android', 'ios', 'desktop']
const HAND_PLATFORMS: BiometricPuzzlePlatform[] = ['web', 'android', 'ios', 'desktop']

/** Helper to build a face-challenge entry in a single place. */
function faceEntry(
    id: BiometricPuzzleId,
    challengeType: ChallengeType,
    icon: SvgIconComponent,
    difficulty: BiometricPuzzleDifficulty,
): BiometricPuzzleEntry {
    // The i18n key uses the enum name lower-cased: FACE_BLINK -> face_blink.
    const i18nLeaf = id.toLowerCase()
    const i18nKey = `biometricPuzzle.puzzles.${i18nLeaf}`
    return {
        id,
        modality: 'face',
        i18nKey,
        // Pre-bind the challenge type + i18n key so the runner modal can stay
        // generic. Each face card drives the real `BiometricPuzzle` engine
        // pinned to its specific gesture (blink, smile, ...).
        component: makeFacePuzzle(challengeType, i18nKey),
        difficulty,
        platforms: FACE_PLATFORMS,
        icon,
        requiresEnrollment: false,
        capability: 'realCapable',
        challengeType,
    }
}

/** Helper to build a hand-gesture entry in a single place. */
function handEntry(
    id: BiometricPuzzleId,
    icon: SvgIconComponent,
    difficulty: BiometricPuzzleDifficulty,
): BiometricPuzzleEntry {
    const i18nLeaf = id.toLowerCase()
    const i18nKey = `biometricPuzzle.puzzles.${i18nLeaf}`
    return {
        id,
        modality: 'hand',
        i18nKey,
        // Pre-bind puzzle id + i18n key. Each hand card now drives the real
        // MediaPipe HandLandmarker via `HandGesturePuzzle` and the per-puzzle
        // detectors in `handChallenges.ts`.
        component: makeHandPuzzle(id, i18nKey),
        difficulty,
        platforms: HAND_PLATFORMS,
        icon,
        requiresEnrollment: false,
        capability: 'realCapable',
    }
}

export const BIOMETRIC_PUZZLE_REGISTRY: Record<BiometricPuzzleId, BiometricPuzzleEntry> = {
    // Face — 14 entries.
    [BiometricPuzzleId.FACE_BLINK]: faceEntry(
        BiometricPuzzleId.FACE_BLINK,
        ChallengeType.BLINK,
        RemoveRedEye,
        'beginner',
    ),
    [BiometricPuzzleId.FACE_CLOSE_LEFT]: faceEntry(
        BiometricPuzzleId.FACE_CLOSE_LEFT,
        ChallengeType.CLOSE_LEFT,
        Visibility,
        'intermediate',
    ),
    [BiometricPuzzleId.FACE_CLOSE_RIGHT]: faceEntry(
        BiometricPuzzleId.FACE_CLOSE_RIGHT,
        ChallengeType.CLOSE_RIGHT,
        Visibility,
        'intermediate',
    ),
    [BiometricPuzzleId.FACE_SMILE]: faceEntry(
        BiometricPuzzleId.FACE_SMILE,
        ChallengeType.SMILE,
        SentimentSatisfiedAlt,
        'beginner',
    ),
    [BiometricPuzzleId.FACE_OPEN_MOUTH]: faceEntry(
        BiometricPuzzleId.FACE_OPEN_MOUTH,
        ChallengeType.OPEN_MOUTH,
        EmojiEmotions,
        'beginner',
    ),
    [BiometricPuzzleId.FACE_TURN_LEFT]: faceEntry(
        BiometricPuzzleId.FACE_TURN_LEFT,
        ChallengeType.TURN_LEFT,
        SwapHoriz,
        'intermediate',
    ),
    [BiometricPuzzleId.FACE_TURN_RIGHT]: faceEntry(
        BiometricPuzzleId.FACE_TURN_RIGHT,
        ChallengeType.TURN_RIGHT,
        SwapHoriz,
        'intermediate',
    ),
    [BiometricPuzzleId.FACE_LOOK_UP]: faceEntry(
        BiometricPuzzleId.FACE_LOOK_UP,
        ChallengeType.LOOK_UP,
        Face,
        'intermediate',
    ),
    [BiometricPuzzleId.FACE_LOOK_DOWN]: faceEntry(
        BiometricPuzzleId.FACE_LOOK_DOWN,
        ChallengeType.LOOK_DOWN,
        Face,
        'intermediate',
    ),
    [BiometricPuzzleId.FACE_RAISE_BOTH_BROWS]: faceEntry(
        BiometricPuzzleId.FACE_RAISE_BOTH_BROWS,
        ChallengeType.RAISE_BOTH_BROWS,
        Face,
        'intermediate',
    ),
    [BiometricPuzzleId.FACE_RAISE_LEFT_BROW]: faceEntry(
        BiometricPuzzleId.FACE_RAISE_LEFT_BROW,
        ChallengeType.RAISE_LEFT_BROW,
        Face,
        'advanced',
    ),
    [BiometricPuzzleId.FACE_RAISE_RIGHT_BROW]: faceEntry(
        BiometricPuzzleId.FACE_RAISE_RIGHT_BROW,
        ChallengeType.RAISE_RIGHT_BROW,
        Face,
        'advanced',
    ),
    [BiometricPuzzleId.FACE_NOD]: faceEntry(
        BiometricPuzzleId.FACE_NOD,
        ChallengeType.NOD,
        Vibration,
        'intermediate',
    ),
    [BiometricPuzzleId.FACE_SHAKE_HEAD]: faceEntry(
        BiometricPuzzleId.FACE_SHAKE_HEAD,
        ChallengeType.SHAKE_HEAD,
        Vibration,
        'intermediate',
    ),

    // Hand — 9 entries.
    [BiometricPuzzleId.HAND_FINGER_COUNT]: handEntry(
        BiometricPuzzleId.HAND_FINGER_COUNT,
        BackHand,
        'beginner',
    ),
    [BiometricPuzzleId.HAND_WAVE]: handEntry(
        BiometricPuzzleId.HAND_WAVE,
        WavingHand,
        'beginner',
    ),
    [BiometricPuzzleId.HAND_FLIP]: handEntry(
        BiometricPuzzleId.HAND_FLIP,
        PanTool,
        'intermediate',
    ),
    [BiometricPuzzleId.HAND_FINGER_TAP]: handEntry(
        BiometricPuzzleId.HAND_FINGER_TAP,
        TouchApp,
        'intermediate',
    ),
    [BiometricPuzzleId.HAND_PINCH]: handEntry(
        BiometricPuzzleId.HAND_PINCH,
        Pinch,
        'intermediate',
    ),
    [BiometricPuzzleId.HAND_PEEK_A_BOO]: handEntry(
        BiometricPuzzleId.HAND_PEEK_A_BOO,
        ChildCare,
        'advanced',
    ),
    [BiometricPuzzleId.HAND_SHAPE_TRACE]: handEntry(
        BiometricPuzzleId.HAND_SHAPE_TRACE,
        Gesture,
        'advanced',
    ),
    [BiometricPuzzleId.HAND_TRACE_TEMPLATE]: handEntry(
        BiometricPuzzleId.HAND_TRACE_TEMPLATE,
        Timeline,
        'advanced',
    ),
    [BiometricPuzzleId.HAND_MATH]: handEntry(
        BiometricPuzzleId.HAND_MATH,
        Calculate,
        'advanced',
    ),
}

export function listBiometricPuzzles(): BiometricPuzzleEntry[] {
    return Object.values(BIOMETRIC_PUZZLE_REGISTRY)
}

export function listBiometricPuzzlesByModality(
    modality: BiometricPuzzleModality,
): BiometricPuzzleEntry[] {
    return listBiometricPuzzles().filter((p) => p.modality === modality)
}

export function getBiometricPuzzle(id: BiometricPuzzleId): BiometricPuzzleEntry {
    return BIOMETRIC_PUZZLE_REGISTRY[id]
}
