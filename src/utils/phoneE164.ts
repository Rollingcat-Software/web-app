/**
 * E.164 phone-number normalization & validation (USER-BUG-4 follow-up).
 *
 * Twilio Verify matches `to` + `code` byte-for-byte. If the user types
 * `5551234567` at enrollment, send goes to `+905551234567` but verify
 * looks up the raw stored string — silent send-OK / verify-FAIL.
 *
 * The server now enforces a strict E.164 @Pattern + DB CHECK constraint
 * (V53). This util is the matching client-side defense-in-depth: it
 * auto-prefixes the configured default country code, strips non-digit
 * noise (spaces, dashes, parens), and offers a boolean validator the
 * form can call before submit.
 */

/**
 * Strict E.164: leading `+`, country-code first digit 1-9, total 10-15
 * digits. Mirrors:
 *   - server PhoneNumber.java: `^\+[1-9]\d{9,14}$`
 *   - server CreateUserRequest / UpdateUserRequest @Pattern
 *   - server V53 users_phone_e164 CHECK
 */
const E164 = /^\+[1-9]\d{9,14}$/

/**
 * Default country code to auto-prefix when the user types a bare digit
 * sequence. Defaults to Turkey (`+90`) since FIVUCSAS's primary
 * deployment is at Marmara University.
 */
const DEFAULT_COUNTRY = '+90'

/**
 * `true` iff the input is a syntactically valid E.164 string.
 */
export function isValidE164(input: string | null | undefined): boolean {
    if (!input) return false
    return E164.test(input.trim())
}

/**
 * Normalize a user-typed phone string to E.164.
 *
 * Strategy (in order):
 *   1. Trim, strip spaces / dashes / parens (formatting users paste in).
 *   2. If the result starts with `+`, keep it (preserve user-supplied
 *      country code) and drop everything else that isn't a digit.
 *   3. If the result is digits-only, decide a country prefix:
 *      a. 11 digits starting with `0` (Turkish 0-prefix mobile) → drop
 *         the leading 0 and prefix the default country code.
 *      b. 10 digits starting with `5` (Turkish bare mobile) → prefix
 *         the default country code.
 *      c. otherwise → prefix the default country code as a best-guess.
 *   4. Return the candidate. Caller is responsible for calling
 *      {@link isValidE164} on the result if it intends to gate submit.
 *
 * Returns `null` for null / empty / whitespace-only input.
 */
export function normalizeToE164(
    input: string | null | undefined,
    defaultCountry: string = DEFAULT_COUNTRY
): string | null {
    if (!input) return null
    const trimmed = input.trim()
    if (!trimmed) return null

    if (trimmed.startsWith('+')) {
        // Preserve user-supplied country code, drop noise.
        const digits = trimmed.slice(1).replace(/\D/g, '')
        if (!digits) return null
        return '+' + digits
    }

    const digits = trimmed.replace(/\D/g, '')
    if (!digits) return null

    // 0-prefix Turkish-shaped (e.g. 0 5XX XXX XX XX = 11 digits).
    if (digits.length === 11 && digits.startsWith('0')) {
        return defaultCountry + digits.slice(1)
    }

    return defaultCountry + digits
}

/**
 * Convenience: normalize, then validate. Returns the E.164 string when
 * valid, `null` when not. Use at submit time to decide whether to send
 * the request or surface an inline error.
 */
export function toE164OrNull(
    input: string | null | undefined,
    defaultCountry: string = DEFAULT_COUNTRY
): string | null {
    const candidate = normalizeToE164(input, defaultCountry)
    return candidate && isValidE164(candidate) ? candidate : null
}
