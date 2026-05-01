/**
 * Client-side E.164 phone number normalization + validation.
 *
 * Server enforces `^\+[1-9]\d{7,14}$` (api PR #48: CreateUserRequest +
 * UpdateUserRequest @Pattern; V54 backfill + CHECK constraint). Without
 * this client work, a user typing `5551234567` instead of `+905551234567`
 * sees a 422 error after submit and has to retype manually. We:
 *
 *   1. Strip non-digits except a leading `+`.
 *   2. Auto-prepend `+90` (configurable default country code) when the
 *      input starts with a digit and is non-empty, so the prefix appears
 *      live as the user types.
 *   3. Preserve any other valid `+CC` prefix the user typed (e.g. a
 *      visiting US number `+12025550100` is left untouched).
 *
 * The wire payload should always come from this normalizer (not the raw
 * input value) so a paste + immediate submit cannot escape the rule.
 */

/**
 * Normalize a free-form phone-input value into E.164 form (or empty
 * string if the input has no usable digits).
 *
 * Rules:
 *   - `""`            → `""`   (caller may treat empty as "field cleared")
 *   - `"5551234567"`  → `"+905551234567"`
 *   - `"+90 555 123 45 67"` → `"+905551234567"`
 *   - `"+12025550100"`→ `"+12025550100"` (foreign prefix preserved)
 *   - `"abc"`         → `""`   (no digits at all)
 *   - `"+"`           → `""`   (no digits at all)
 *   - `"+0123"`       → `"+0123"` (we keep the value as-typed if it has a
 *                        leading `+` but starts with `0` — `isValidE164`
 *                        will reject it, which is the right UX: surface
 *                        the helperText, don't silently mangle).
 *
 * The default country code is `+90` (Turkey — primary FIVUCSAS market).
 */
export function normalizePhoneInputE164(
    input: string,
    defaultCountryCode: string = '+90'
): string {
    if (!input) return ''

    const trimmed = input.trim()
    if (!trimmed) return ''

    const startsWithPlus = trimmed.startsWith('+')

    // Strip everything that isn't a digit — we'll re-add the leading `+`
    // separately based on whether the user typed one.
    const digitsOnly = trimmed.replace(/\D/g, '')

    if (digitsOnly.length === 0) {
        // Pure junk like "abc" or a bare "+" — return empty so the caller
        // doesn't end up with a stray `+` in state.
        return ''
    }

    if (startsWithPlus) {
        // User typed an explicit country code — preserve their choice.
        return `+${digitsOnly}`
    }

    // No `+` typed: auto-prepend the default CC. We strip the leading
    // `+` from the default before re-adding so callers can pass `+90`,
    // `90`, or even `+90 ` — all behave the same.
    const ccDigits = defaultCountryCode.replace(/\D/g, '')

    // Defensive: if the user already typed the country-code digits at
    // the start (e.g. typed `905551234567` without `+`), don't double
    // them up. We only treat it as a duplicate when there's room for a
    // realistic subscriber number after the CC (>= 7 trailing digits)
    // so legitimate Turkish mobile numbers starting with 9 (none today,
    // but future-proofing) aren't mangled.
    if (
        ccDigits.length > 0 &&
        digitsOnly.startsWith(ccDigits) &&
        digitsOnly.length - ccDigits.length >= 7
    ) {
        return `+${digitsOnly}`
    }

    return `+${ccDigits}${digitsOnly}`
}

/**
 * E.164 validation — must match the backend `@Pattern` exactly so a
 * value that passes here is guaranteed to pass server validation.
 *
 *   ^\+[1-9]\d{7,14}$
 *
 *   - Leading `+`
 *   - First country-code digit must be 1-9 (no leading zero)
 *   - 8 to 15 digits total after the `+`
 */
export function isValidE164(value: string): boolean {
    if (!value) return false
    return /^\+[1-9]\d{7,14}$/.test(value)
}
