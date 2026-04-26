/**
 * authMethodRegistry
 *
 * Single source of truth for the Auth Methods Testing playground. Each entry
 * maps an AuthMethodType to a stub-capable wrapper around the existing step
 * component. The landing website will later consume the same registry via a
 * shared package.
 *
 * We deliberately DO NOT duplicate the step components — each auth-method
 * wrapper lives next to this file (see `./puzzles/*Puzzle.tsx`) and simply
 * bridges the step's `onSubmit`/`onAuthenticated` callbacks to the unified
 * `AuthMethodProps` contract (`onSuccess`, `onError`, `onClose`).
 *
 * NOTE: this registry is NOT the Biometric Puzzles registry. Biometric
 * Puzzles (the 23 face/hand micro-challenges that feed active liveness) live
 * under `src/features/biometric-puzzles/`. This one covers the platform's 9
 * pluggable authentication methods end-to-end.
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
 * Props every auth-method preview component receives.
 *
 * - `onSuccess` — the stubbed challenge was completed (fires ~500ms after
 *   the underlying step component hands back its answer).
 * - `onError`  — preview-level error (rare in stub mode; kept for parity).
 * - `onClose`  — the user dismissed the preview; parent should close the modal.
 */
export interface AuthMethodProps {
    onSuccess: () => void
    onError: (message: string) => void
    onClose: () => void
}

export type AuthMethodPlatform = 'web' | 'android' | 'ios' | 'desktop'
export type AuthMethodDifficulty = 'beginner' | 'intermediate' | 'advanced'

/**
 * Runtime capability — auth methods can either be `stubbedOnly` (mocked inside
 * the playground, e.g. NFC on desktop) or `realCapable` (end-to-end once wired
 * into a tenant flow). The AuthMethodRunnerModal always runs in stub mode
 * regardless, but admins can read this flag to set expectations.
 */
export type AuthMethodCapability = 'stubbedOnly' | 'realCapable'

export interface AuthMethodEntry {
    id: AuthMethodType
    /** i18n key root, e.g. `authMethodsTesting.methods.face` */
    i18nKey: string
    component: ComponentType<AuthMethodProps>
    difficulty: AuthMethodDifficulty
    platforms: AuthMethodPlatform[]
    icon: SvgIconComponent
    requiresEnrollment: boolean
    capability: AuthMethodCapability
}

/**
 * Every registered auth method — ordered so the page renders a pleasant
 * "easy to hard" reading path by default.
 *
 * Excluded by design (for now):
 * - PASSWORD — covered by the login form; not a discrete second factor.
 * - GESTURE_LIVENESS — not yet in AuthMethodType; lands with Phase 1 backend.
 */
export const AUTH_METHOD_REGISTRY: Partial<Record<AuthMethodType, AuthMethodEntry>> = {
    [AuthMethodType.EMAIL_OTP]: {
        id: AuthMethodType.EMAIL_OTP,
        i18nKey: 'authMethodsTesting.methods.email_otp',
        component: EmailOtpPuzzle,
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: Email,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [AuthMethodType.SMS_OTP]: {
        id: AuthMethodType.SMS_OTP,
        i18nKey: 'authMethodsTesting.methods.sms',
        component: SmsPuzzle,
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: Sms,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [AuthMethodType.TOTP]: {
        id: AuthMethodType.TOTP,
        i18nKey: 'authMethodsTesting.methods.totp',
        component: TotpPuzzle,
        difficulty: 'beginner',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: PhonelinkLock,
        requiresEnrollment: true,
        capability: 'realCapable',
    },
    [AuthMethodType.QR_CODE]: {
        id: AuthMethodType.QR_CODE,
        i18nKey: 'authMethodsTesting.methods.qr',
        component: QrCodePuzzle,
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: QrCode2,
        requiresEnrollment: false,
        capability: 'realCapable',
    },
    [AuthMethodType.FACE]: {
        id: AuthMethodType.FACE,
        i18nKey: 'authMethodsTesting.methods.face',
        component: FacePuzzle,
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: Face,
        requiresEnrollment: true,
        capability: 'realCapable',
    },
    [AuthMethodType.VOICE]: {
        id: AuthMethodType.VOICE,
        i18nKey: 'authMethodsTesting.methods.voice',
        component: VoicePuzzle,
        difficulty: 'intermediate',
        platforms: ['web', 'android', 'ios', 'desktop'],
        icon: RecordVoiceOver,
        requiresEnrollment: true,
        capability: 'realCapable',
    },
    [AuthMethodType.FINGERPRINT]: {
        id: AuthMethodType.FINGERPRINT,
        i18nKey: 'authMethodsTesting.methods.fingerprint',
        component: FingerprintPuzzle,
        difficulty: 'advanced',
        platforms: ['android', 'ios', 'desktop'],
        icon: Fingerprint,
        requiresEnrollment: true,
        capability: 'realCapable',
    },
    [AuthMethodType.NFC_DOCUMENT]: {
        id: AuthMethodType.NFC_DOCUMENT,
        i18nKey: 'authMethodsTesting.methods.nfc',
        component: NfcPuzzle,
        difficulty: 'advanced',
        platforms: ['web', 'android'],
        icon: Nfc,
        requiresEnrollment: false,
        capability: 'stubbedOnly',
    },
    [AuthMethodType.HARDWARE_KEY]: {
        id: AuthMethodType.HARDWARE_KEY,
        i18nKey: 'authMethodsTesting.methods.hardware_key',
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
export function listAuthMethods(): AuthMethodEntry[] {
    return Object.values(AUTH_METHOD_REGISTRY).filter(
        (entry): entry is AuthMethodEntry => entry !== undefined,
    )
}

export function getAuthMethod(id: AuthMethodType): AuthMethodEntry | undefined {
    return AUTH_METHOD_REGISTRY[id]
}
