import { AuthMethodType } from '@domain/models/AuthMethod'

/**
 * Quality and liveness scores are only produced by biometric *capture* methods
 * (FACE, VOICE). Every other auth method (PASSWORD, EMAIL_OTP, SMS_OTP, TOTP,
 * QR_CODE, FINGERPRINT, NFC_DOCUMENT, HARDWARE_KEY) never has these scores, so a
 * null value means "Not Applicable" rather than "not recorded yet".
 *
 * Used by the Enrollments list + the Enrollment details page to decide whether a
 * missing score should render as a muted "N/A" or the neutral "—" placeholder.
 */
const SCORE_BEARING_METHODS = new Set<string>([
    AuthMethodType.FACE,
    AuthMethodType.VOICE,
])

/**
 * Whether quality/liveness scores apply to the given auth method type.
 * Defaults to `false` (Not Applicable) for unknown / undefined methods.
 */
export function methodHasScores(authMethodType?: string): boolean {
    if (!authMethodType) return false
    return SCORE_BEARING_METHODS.has(authMethodType.toUpperCase())
}

/**
 * How a null score should be displayed for the given method:
 * - `'notApplicable'` — non-biometric method, scores never apply
 * - `'pending'` — biometric method, score just not recorded yet ("—")
 */
export function nullScoreDisplay(authMethodType?: string): 'notApplicable' | 'pending' {
    return methodHasScores(authMethodType) ? 'pending' : 'notApplicable'
}
