/**
 * Login-identifier email format validation.
 *
 * The login identifier field is an email field on every tenant surface
 * (dashboard `app.fivucsas` + hosted `verify.fivucsas`). Both the browser
 * `type="email"` constraint AND Zod's `.email()` ACCEPT a one-character TLD
 * (e.g. `user@gmail.x`), so an obvious typo advanced past the identifier step to
 * the password step before failing — which read like the malformed address had
 * "passed identity verification". This validator additionally requires a TLD of
 * at least 2 characters, catching the common `.x` / `.c` / missing-TLD typos
 * WITHOUT rejecting any real address (the shortest live TLDs are 2 chars).
 *
 * It is deliberately a FORMAT check ONLY — it never asks the backend whether the
 * account exists, so the identifier step stays enumeration-resistant (any
 * well-formed email advances to the password step; existence is only ever
 * revealed by the generic credential failure at the password step).
 */

// local@domain.tld — a single `@`, a dotted domain, and a final TLD label of
// >= 2 non-whitespace, non-`@`, non-`.` characters. Intentionally permissive
// within those bounds so valid-but-unusual addresses (sub-domains, +tags, long
// or new TLDs) all pass; it only rejects the structurally-broken / 1-char-TLD
// cases.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/

/**
 * True when `value` is a structurally plausible email with a >= 2-char TLD.
 * Trims surrounding whitespace first (the callers already `.trim()`, but this
 * keeps the validator safe to use standalone, e.g. in a Zod `.refine`).
 */
export function isLikelyValidEmail(value: string): boolean {
    return EMAIL_REGEX.test(value.trim())
}
