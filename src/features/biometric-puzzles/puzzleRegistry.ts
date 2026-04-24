/**
 * puzzleRegistry
 *
 * Single source of truth for the Biometric Puzzle playground. Each entry maps
 * an AuthMethodType to a stub-capable wrapper around the existing step
 * component. The landing website will later consume the same registry via a
 * shared package.
 *
 * We deliberately DO NOT duplicate the step components — each puzzle wrapper
 * lives next to this file (see `./puzzles/*Puzzle.tsx`) and simply bridges
 * the step's `onSubmit`/`onAuthenticated` callbacks to the unified
 * `PuzzleProps` contract (`onSuccess`, `onError`, `onClose`).
 */
import type { ComponentType } from 'react'
import type { SvgIconComponent } from '@mui/icons-material'
import {
    Email,
    Face,
    Fingerprint,
    Key,
    Nfc,
    PhonelinkLock,
    QrCode2,
    RecordVoiceOver,
    Sms,
} from '@mui/icons-material'
import { AuthMethodType } from '@domain/models/AuthMethod'
import FacePuzzle from './puzzles/FacePuzzle'
import VoicePuzzle from './puzzles/VoicePuzzle'
import FingerprintPuzzle from './puzzles/FingerprintPuzzle'
import NfcPuzzle from './puzzles/NfcPuzzle'
import TotpPuzzle from './puzzles/TotpPuzzle'
import SmsPuzzle from './puzzles/SmsPuzzle'
import EmailOtpPuzzle from './puzzles/EmailOtpPuzzle'
import QrCodePuzzle from './puzzles/QrCodePuzzle'
import HardwareKeyPuzzle from './puzzles/HardwareKeyPuzzle'

/**
 * Props every puzzle component receives.
 *
 * - `onSuccess` — the stubbed challenge was completed (fires ~500ms after
 *   the underlying step component hands back its answer).
 * - `onError`  — puzzle-level error (rare in stub mode; kept for parity).
 * - `onClose`  — the user dismissed the puzzle; parent should close the modal.
 */
export interface PuzzleProps {
    onSuccess: () => void
    onError: (message: string) => void
    onClose: () => void
}

export type PuzzlePlatform = 'web' | 'android' | 'ios' | 'desktop'
export type PuzzleDifficulty = 'beginner' | 'intermediate' | 'advanced'

/**
 * Runtime capability — puzzles can either be `stubbedOnly` (mocked inside the
 * playground, e.g. NFC on desktop) or `realCapable` (end-to-end once wired
 * into a tenant flow). The PuzzleRunnerModal always runs in stub mode
 * regardless, but admins can read this flag to set expectations.
 */
export type PuzzleCapability = 'stubbedOnly' | 'realCapable'

export interface Puzzle {
    id: AuthMethodType
    /** i18n key root, e.g. `biometricPuzzle.puzzles.face` */
    i18nKey: string
    component: ComponentType<PuzzleProps>
    difficulty: PuzzleDifficulty
    platforms: PuzzlePlatform[]
    icon: SvgIconComponent
    requiresEnrollment: boolean
    capability: PuzzleCapability
}

/**
 * Every registered puzzle — ordered so the page renders a pleasant
 * "easy to hard" reading path by default.
 *
 * Excluded by design (for now):
 * - PASSWORD — not a biometric challenge; covered elsewhere.
 * - GESTURE_LIVENESS — not yet in AuthMethodType; lands with Phase 1 backend.
 */
export const PUZZLE_REGISTRY: Partial<Record<AuthMethodType, Puzzle>> = {
    [AuthMethodType.EMAIL_OTP]: {
        id: AuthMethodType.EMAIL_OTP,
        i18nKey: 'biometricPuzzle.puzzles.email_otp',
        component: EmailOtpPuzzle,
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: Email,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [AuthMethodType.SMS_OTP]: {
        id: AuthMethodType.SMS_OTP,
        i18nKey: 'biometricPuzzle.puzzles.sms',
        component: SmsPuzzle,
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: Sms,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [AuthMethodType.TOTP]: {
        id: AuthMethodType.TOTP,
        i18nKey: 'biometricPuzzle.puzzles.totp',
        component: TotpPuzzle,
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: PhonelinkLock,
        requiresEnrollment: true,
        capability: 'realCapable',
    },
    [AuthMethodType.QR_CODE]: {
        id: AuthMethodType.QR_CODE,
        i18nKey: 'biometricPuzzle.puzzles.qr',
        component: QrCodePuzzle,
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: QrCode2,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [AuthMethodType.FACE]: {
        id: AuthMethodType.FACE,
        i18nKey: 'biometricPuzzle.puzzles.face',
        component: FacePuzzle,
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: Face,
        requiresEnrollment: true,
        capability: 'realCapable',
    },
    [AuthMethodType.VOICE]: {
        id: AuthMethodType.VOICE,
        i18nKey: 'biometricPuzzle.puzzles.voice',
        component: VoicePuzzle,
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: RecordVoiceOver,
        requiresEnrollment: true,
        capability: 'realCapable',
    },
    [AuthMethodType.FINGERPRINT]: {
        id: AuthMethodType.FINGERPRINT,
        i18nKey: 'biometricPuzzle.puzzles.fingerprint',
        component: FingerprintPuzzle,
        difficulty: 'advanced',
        platforms: ['android', 'ios', 'desktop'],
        icon: Fingerprint,
        requiresEnrollment: true,
        capability: 'realCapable',
    },
    [AuthMethodType.NFC_DOCUMENT]: {
        id: AuthMethodType.NFC_DOCUMENT,
        i18nKey: 'biometricPuzzle.puzzles.nfc',
        component: NfcPuzzle,
        difficulty: 'advanced',
        platforms: ['web', 'android'],
        icon: Nfc,
        requiresEnrollment: false,
        capability: 'stubbedOnly',
    },
    [AuthMethodType.HARDWARE_KEY]: {
        id: AuthMethodType.HARDWARE_KEY,
        i18nKey: 'biometricPuzzle.puzzles.hardware_key',
        component: HardwareKeyPuzzle,
        difficulty: 'advanced',
        platforms: ['web', 'desktop'],
        icon: Key,
        requiresEnrollment: true,
        capability: 'realCapable',
    },
}

/**
 * Iteration helper — returns registry entries in insertion order.
 */
export function listPuzzles(): Puzzle[] {
    return Object.values(PUZZLE_REGISTRY).filter(
        (p): p is Puzzle => p !== undefined,
    )
}

export function getPuzzle(id: AuthMethodType): Puzzle | undefined {
    return PUZZLE_REGISTRY[id]
}
