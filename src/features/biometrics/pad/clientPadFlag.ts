/**
 * clientPadFlag — client gate for the advisory client-side PAD (Presentation
 * Attack Detection) / passive-liveness score on the FACE login capture (SP-D,
 * defense-in-depth).
 *
 * When ON, the browser runs the in-repo passive PAD analyzer
 * (`PassiveLivenessDetector` — texture / colour / skin-tone / moiré / local-
 * variance, the same passive-analyzer family the amispoof tester ships) on the
 * captured face frame, DISPLAYS the resulting live-confidence to the user, and
 * sends it to the server as an ADVISORY field (`client_pad_score`) alongside the
 * existing capture payload.
 *
 * UNTRUSTED-CLIENT CAVEAT: the score is advisory ONLY. The client NEVER blocks or
 * allows a login based on it — it is purely informational for the user and a
 * defense-in-depth signal the server MAY log/bound. The auth decision stays
 * server-side (D2). Flag OFF is byte-identical to the legacy capture path (no
 * score computed, displayed, or sent).
 *
 * This is a build-time env flag ONLY (`VITE_CLIENT_PAD_ADVISORY`), baked at build
 * time; it is not driven from login-config (a future per-tenant item, not
 * implemented). Mirrors `clientEmbeddingFlag.ts`.
 *
 * Read via a function (not a module-load constant) so the value is injectable /
 * mockable in tests and evaluated at call time rather than frozen at import.
 */

/**
 * True when the advisory client-side PAD score is enabled for this build.
 * Controlled by `VITE_CLIENT_PAD_ADVISORY` (string `'true'` to enable).
 */
export function isClientPadAdvisoryEnabled(): boolean {
    return import.meta.env.VITE_CLIENT_PAD_ADVISORY === 'true'
}
