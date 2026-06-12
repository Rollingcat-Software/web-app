# Login parity — app.fivucsas (dashboard) ⇄ verify.fivucsas (hosted)

Product-owner directive: *"Keep verify.fivucsas and app.fivucsas identical — use
a common UI library or pages."*

This is an **"identical login UX, not merged apps"** effort. Each surface keeps
its legitimately-different shell; the parts that must be pixel/behaviour-identical
are extracted into `src/features/auth/login-shared/`.

## Divergence audit (as of 2026-06-01)

| Concern | Dashboard (`LoginPage` + `TwoFactorDispatcher`) | Hosted (`HostedLoginApp` + `LoginMfaFlow`) | Status |
|---|---|---|---|
| **MFA step → component routing** | own `renderStep()` switch (had voice VAD gate + `GESTURE_LIVENESS`) | own `renderMfaStep()` switch (NO VAD gate, NO gesture) | **UNIFIED** → `login-shared/MfaStepRenderer.tsx` (both surfaces now identical; verify gains the VAD gate + gesture/unknown handling) |
| **WebAuthn challenge helper** | inline `requestWebAuthnChallenge` | duplicate inline copy | **UNIFIED** → `login-shared/webauthnChallenge.ts` |
| **Method picker** | `MethodPickerStep` (shared), `usedMethods=completedMfaMethods`, all 3 states (#166) | `MethodPickerStep` (shared), `usedMethods` | already shared — unchanged |
| **Step / layer counter** | `StepProgress` (shared); total from `flowTotalSteps`→config→live (#158) | `StepProgress` (shared); total from backend `currentStep`/`totalSteps` | already shared — unchanged |
| **Password step + email-lock** | `PasswordStep` (shared); password@layer-2+ → MFA step, no email-change (#167) | `PasswordStep` (shared); same | already shared — unchanged |
| **Usernameless shortcuts** | `Layer1Shortcuts` (shared); hidden after the email step (#164) | `Layer1Shortcuts` (shared) | already shared — unchanged |
| **Login config** | `fetchLoginConfig` + `LoginConfig` model (shared) | same | already shared — unchanged |
| **Card / page shell** | full-screen animated gradient **glass card** | in-card hosted **OIDC frame** (tenant branding, "Signing in to …") | **INTENTIONALLY DIFFERENT** (dashboard chrome vs hosted OIDC presentation) |
| **Completion** | store tokens → `navigate('/')` | mint OIDC code via `/oauth2/authorize/complete` → redirect to tenant `redirect_uri` | **INTENTIONALLY DIFFERENT** (OIDC redirect is hosted-only) |
| **Identifier-first entry markup** | inline in `LoginPage` | inline in `LoginMfaFlow` (FlowPhase.Identifier) | **UNIFIED (2026-06-12)** → `login-shared/steps/IdentifierStep.tsx` (props inject the surface chrome) |
| **Config-unavailable banner** | inline banner + Retry in `LoginPage` | **was missing** (silent fallback) | **UNIFIED (2026-06-12)** → `login-shared/ConfigUnavailableBanner.tsx` on BOTH; hosted gained `configLoadFailed`/retry |
| **Anti-flash on opening screen** | revealed `pageReady` on a 2s timer (could flash password-first then swap) | skeleton-until-config-settles (`showLayer1Skeleton`/`metaLoading`) | **UNIFIED (2026-06-12)** → dashboard `pageReady` now gates on the fetch settle (safety fallback 2s→10s, matching `fetchLoginConfig`'s own timeout) so it never reveals before the config lands |
| **PUZZLE step config (Phase-5 binding)** | not threaded (binding inert) | not threaded (binding inert) | **UNIFIED (2026-06-12)** → `selectPuzzleConfig(loginConfig, method)` threaded through `MfaStepRenderer` → `PuzzleStep` on BOTH; `LoginConfig` model now parses per-step `puzzleConfig` |
| **Identifier-step endpoint** | `/auth/login/begin` (opens an MFA session at the identifier step) | lone-password engine-ON: `/auth/login/preflight` (NO session, NO lockout touch); non-password: `/auth/login/begin` | **STILL DIVERGENT** — owner decision (session/lockout semantics). Recommendation: canonicalize on `/auth/login/preflight` at the identifier step (session created at the first real factor submit). |

## What shipped here

- `login-shared/MfaStepRenderer.tsx` — the one MFA step→component router for both surfaces.
- `login-shared/webauthnChallenge.ts` — shared `makeRequestWebAuthnChallenge`.
- `login-shared/__tests__/MfaStepRenderer.test.tsx` — routing + helper tests.
- `TwoFactorDispatcher` and `LoginMfaFlow` rewired to the shared renderer; their
  shells, flow state, and the just-shipped #158/#164/#166/#167 behaviour are untouched.

## Deliberately NOT forced

- The OIDC redirect/completion flow and the hosted tenant-branding frame stay
  hosted-only — unifying them would break the redirect contract for no UX gain.
- The two identifier-first entry blocks (email box + Continue) are still authored
  per-surface. They already render the same fields/behaviour; folding them into a
  shared `<IdentifierStep>` is a safe follow-up but was left out of this pass to
  keep the just-merged login work (#160–#168) low-risk.
