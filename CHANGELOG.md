# Changelog - FIVUCSAS Web App

## [Unreleased]

### 2026-06-01 — Biometric-puzzle blink/wink fixed (close→re-open transition)

The browser biometric-puzzle BLINK challenge required squeezing the eyes shut
for a 0.6s global hold because every challenge shared one `HOLD_DURATION` and
BLINK was a stateless "eyes-closed-now" boolean — a natural ~120ms blink never
reached the hold, and re-opening *cancelled* progress. Adopted the canonical
transition model used by the production anti-spoof code (spoof-detector
`blink_analyzer.py` + biometric-processor `active_liveness_manager.py`).

- **Blink/wink as a close→re-open EDGE, not a hold.** New
  `BlinkTransitionTracker` (`lib/biometric-engine/core/challenges/blinkTransition.ts`)
  is the single source of truth: EAR drops below `BLINK_EAR_CLOSED` (0.18) for
  ≥ `BLINK_CONSECUTIVE_FRAMES` (2), then recovers ≥ `BLINK_EAR_REOPEN` (0.23) →
  fires once on the re-open. `BLINK_MIN_OPEN_BETWEEN` (12) debounce +
  `BLINK_WARMUP_FRAMES` guard. `BlinkDetector`, `CloseLeftDetector`,
  `CloseRightDetector` delegate to it and declare `isTransient = true`.
- **Per-challenge transient vs sustained semantics.** `IChallengeDetector` gains
  `isTransient` + optional `reset()`. `BiometricPuzzle.checkChallenge` completes
  transient challenges on the single re-open edge (50% progress while closing,
  100% on re-open) with NO hold, and resets the detector on `start()` /
  `advanceChallenge()`. Sustained challenges (turns, look up/down, smile, open
  mouth, brow raises) and motion-history NOD/SHAKE keep the 0.6s hold unchanged.
- **One blink implementation for enrollment too.** `useFaceChallenge` enrollment
  blink replaced its face-detection *confidence-dip* heuristic with the same
  `BlinkTransitionTracker`; `FaceDetectionState` now carries `avgEAR` (from the
  478-pt landmarks via the engine metrics calculator; `null` on the
  BlazeFace/FaceDetector fallback backends, where the existing stage soft-timeout
  applies).
- **FaceLandmarker reused per session, not per challenge.** `useBiometricEngine`
  no longer destroys the shared singleton on every unmount (opt-in
  `destroyOnUnmount`, default false), eliminating the per-challenge MediaPipe
  Graph create/destroy + WebGL-context churn in the puzzle runner.
  `FaceDetector.detect` now clamps `detectForVideo` timestamps to be strictly
  increasing (required for a reused VIDEO-mode landmarker).
- **Removed a third divergent gesture impl.** The auth-feature `useLivenessPuzzle`
  hook was dead (no consumer) and carried non-canonical detectors (2-pt EAR
  `<0.18`, smile `width/height>2.8`, open-mouth `>0.08`); stripped to just
  `detectHeadTurn` (its only live consumer, a head-pose geometry helper).
- **i18n** — blink/wink copy (`biometricPuzzle.puzzles.face_blink|face_close_*`)
  now reads "quick natural blink / completes when eyes re-open" (no hold
  connotation), EN + TR in sync.
- Tests: `blinkTransition.test.ts` (8) + `BiometricPuzzleBlink.test.ts` (4) pin
  the new behaviour (close→open passes; sustained-closed never passes; re-open
  completes; sustained challenge still holds).

Deferred: P2 SMILE-width (0.60) / single-brow (1.25) recalibration — left as-is
to avoid destabilising; flagged for a follow-up with on-device tuning.

### 2026-05-30 — Config-driven login UI + usernameless flow builder

Feature-flagged behind the API's `app.auth.config-driven-login` (default OFF);
the UI renders correctly in both flag states purely from the login-config
response, so the flag reverts the feature with no web redeploy.

- **Config-driven Layer 1** — `fetchLoginConfig` (`features/auth/login-config.ts`)
  calls `GET /auth/login-config?tenantId=<uuid>` (frozen contract, api PR #163)
  and normalizes the result through `domain/models/LoginConfig.ts` (tolerant of
  camelCase / `methodType` / `supportsUsernameless` / `stepOrder` deltas;
  returns `null` on any failure). Added the new usernameless method types
  `PASSKEY` + `APPROVE_LOGIN` to `AuthMethodType`. `LoginMfaFlow` and `LoginPage`
  render the **password field only when `PASSWORD ∈ layer1.methods`**; otherwise
  an identifier-first entry (when `identifierRequired`) or the usernameless
  shortcuts. Graceful fallback to email+password when the config fails to load.
- **Config-driven shortcuts** — replaced the standalone hardcoded passkey /
  "approve on another device" buttons with `Layer1Shortcuts`, gated by the
  per-method `usernameless` flags. When the config declares no usernameless
  method (null config OR the flag-OFF password-first shape) `fallbackAll`
  preserves today's shortcuts.
- **Flow builder** — `AuthFlowBuilder` no longer locks password as a mandatory
  first step (removed `PASSWORD_MANDATORY_OPS` here and in `useAuthFlowBuilder`):
  password is a normal removable + reorderable method. Added **CHOICE-step
  editing** (pick N one-of alternative methods per step → `alternativeMethodTypes`)
  and a **usernameless Layer-1 toggle** gated by the new
  `AuthMethod.supportsUsernameless`. i18n'd the builder's hardcoded English
  (`authFlowBuilder.*`, EN+TR).
- **Set-Default impact dialog** now surfaces `usernamelessOnly` +
  `noRecoveryMethod` advisories from the default-impact payload.

### 2026-05-30 — Biometric quality + liveness hardening (client)

- **Real head pose** — `FaceDetector` now requests the MediaPipe 4x4 facial
  transformation matrix (`outputFacialTransformationMatrixes: true`).
  `HeadPoseEstimator` decomposes true **yaw / pitch / roll** Euler angles from
  it (falling back to the old landmark-ratio approximation only when the matrix
  is absent), so the head-rotation puzzles (turn left/right, look up/down, nod,
  shake) finally track real rotation. Added **EWMA smoothing + release-debounce
  hysteresis** in `BiometricPuzzle` so directional gestures don't flicker.
- **Liveness as a real gate** — the client passive-liveness pre-filter in
  `useFaceChallenge` is now **fail-CLOSED**: a capture is only accepted when the
  detector is available AND the score clears the threshold (detector missing,
  bad ROI, or an exception all reject + reset). `FacePuzzle` now enforces
  `face.liveness` before resolving success, so a photo/replay performing the
  gesture is rejected.
- **Face-enroll quality gate** — `QualityAssessor` is wired into the enrollment
  capture flow: a blurry / dark / over-bright / too-small frame is **rejected +
  re-prompted** (with a specific hint) instead of being enrolled, including on
  the 6 s soft-timeout path.
- **Hand puzzles** — ported the Python 4-layer hand pipeline into
  `handChallenges.ts`: `GestureValidator` (3D finger ratios + per-finger
  hysteresis + EWMA + moving-median) with a `HandCalibrator`; a **frequency-gated**
  `WaveDetector` (1–4 Hz band); and **DTW** shape matching (resample +
  centroid-normalise + DTW cost). The two trace puzzles are now distinct:
  `HAND_SHAPE_TRACE` = free-form closed loop, `HAND_TRACE_TEMPLATE` = DTW match
  against a random target shape (circle / square / triangle / S-curve).
- **Capture quality** — camera raised to **1280×720** and the face crop to
  **320 px @ JPEG q0.92** (from 224 px @ q0.85) for a sharper server embedding.
- **Tests** — new vitest suites for matrix→Euler head pose (`HeadPoseEstimator`),
  the `QualityAssessor` gate, and the hand pipeline (validator + frequency gate +
  DTW); `handChallenges` grew 23→35 specs. All i18n strings via `t()` (en + tr).

### 2026-05-30 — Frontend edge-case test hardening (suite green)

- **PR #133/#134** — added **+80 edge-case specs** across the identity surfaces
  (account linking / per-tenant biometric consent / account-workspace switcher /
  `formatApiError`), plus `isRoot` mock + banner stub fixes to green the suite.
  Full Vitest suite now **914 passing, 0 failing**. Part of the 2026-05-30
  stabilize-&-harden backlog.

### 2026-05-30 — Identity & account-linking UI surfaces (Phases 2/3/5) + consent-path / mobile-switcher fixes

- **PR #128** `feat/profile-linked-accounts` — **Linked Accounts** section in
  Profile (Identity Phase 2). Lists the person's memberships (tenant + role) across
  accounts via `GET /identity/me`, and lets the user link another account by email
  (`/identity/link/initiate` → OTP → `/link/confirm` with caller step-up) or unlink
  a membership (`/unlink`). Linking is additive — login is still per-account.
- **PR #127** `feat/profile-biometric-consent` — **per-tenant Biometric Consent**
  toggle in Profile (Identity Phase 3, Model A). Surfaces
  `GET/POST /identity/biometric/consents` so a person can grant/revoke "use my
  enrolled biometric for tenant X" per tenant; default-DENY (off = behaves like
  not-enrolled). The raw template is never shared — consent only authorizes a
  verify against the person's canonical enrollment.
- **PR #129** `feat/topbar-account-switcher` — **Account / workspace switcher** in
  the TopBar (Identity Phase 5), shown when `/identity/me` returns >1 membership.
  Selecting a membership calls `POST /auth/switch-membership`, stores the new token
  pair, and reloads context as that membership (new role/tenant/permissions).
  **Distinct from the ROOT (formerly SUPER_ADMIN) `X-Tenant-ID` data-switcher**:
  the account switcher changes WHO you are (a different linked membership); the
  `X-Tenant-ID` switcher keeps you the same ROOT user and only re-scopes which
  tenant's DATA you read.
- **PR #130** `fix/2026-05-30-consent-path-and-mobile-switcher` — (1) biometric
  consent requests hit a **doubled path** (e.g. `/api/v1/api/v1/identity/...`) →
  normalized to the single API base. (2) The tenant switcher was hidden / unusable
  on **mobile** layouts → restored in the responsive TopBar.

### 2026-05-30 — Role/user_type unification: "SUPER_ADMIN" → "Root", trust backend `userType`

- **`feat/2026-05-30-role-unification-root`** — eliminate the "SUPER_ADMIN"
  label and make the platform tier authoritative from the backend `userType`
  (see `identity-core-api/docs/IDENTITY_ROLE_UNIFICATION.md`).
  - `domain/models/User.ts`: `UserRole` top member renamed `SUPER_ADMIN` → `ROOT`
    (value dropped). New `userType` field (`ROOT | TENANT_ADMIN | TENANT_MEMBER |
    GUEST`) parsed from `/auth/me`, tolerant of absence. `isSuperAdmin()` →
    `isRoot()` = `userType === 'ROOT'` (authoritative), role fallback only when
    `userType` is undefined (older tokens). `fromJSON` role map keeps both
    `'ROOT'` and legacy `'SUPER_ADMIN'` → `UserRole.ROOT`. `isAdmin()` stays true
    for ROOT or TENANT_ADMIN.
  - `ActiveTenantProvider`: `canSwitch = !!user?.isRoot()` (userType-driven →
    matches the backend cross-tenant gate).
  - `PermissionProvider`/`PermissionContext`: `isSuperAdmin` flag → `isRoot`,
    sourced from `user.isRoot()`; `ROLE_PERMISSIONS` key `SUPER_ADMIN` → `ROOT`.
  - UI now renders the top tier as **"Root"** everywhere (UsersListPage chips,
    UserDetailsPage, MyProfilePage, UserFormPage role select, TopBar context)
    via a new shared `utils/roleLabel.ts` (i18n-aware). `PLATFORM_OWNER_ROLES`/
    `ADMIN_ROLES`/`AUTHENTICATED_ROLES` + `types/index.ts` enum updated.
  - i18n: new `roles.labels.{root,admin,tenantAdmin,user}` (EN/TR); the
    "super-admin view" session/device notices now read "Root view" / "Root
    görünümü".
  - Tests: new `User.test.ts` (userType authority + back-compat cases);
    PermissionContext/PermissionGuard/UserService specs updated to ROOT/isRoot.

### 2026-05-29 — Admin pages wave: enrollment detail, guest invites, tenant email domains, flow-render fix (5 PRs)

- **PR #114** `fix/2026-05-29-enrollment-detail-and-default-guardrail` — Enrollments page.
  - New **Enrollment Details** page + `/enrollments/:id` route. The eye ("view")
    button used to have no matching route and fell through to the dashboard; it now
    opens a dedicated detail view.
  - Quality / liveness columns show **"N/A"** for non-biometric methods (those scores
    only exist for face/voice), instead of empty or misleading cells.
  - The set-default ("Make Default") dialog now shows a **lockout warning** if making
    the method default would lock the user out of every configured login path. It
    calls the backend default-impact endpoint and surfaces the impact before the admin
    confirms.
- **PR #115** `fix/2026-05-29-remove-redundant-sidebar-suite-bar` — removed the redundant
  hardcoded **"FIVUCSAS suite"** bar from the sidebar. The shared `<fivucsas-launcher>`
  FAB (hosted at `app.fivucsas.com/launcher.js`) already provides cross-site navigation,
  so the in-sidebar duplicate was dead weight.
- **PR #116** `feat/guest-accept-invite` — guest invitation acceptance.
  - New **public** `/accept-invite` page lets an invited guest accept their invitation
    by setting a name + password (no prior login required).
  - Added a **"Resend invitation"** action to the Guests page for pending invites.
- **PR #117** `feat/tenant-email-domain-admin-ui` — tenant edit page.
  - New **"Email Domains"** management section (add / remove / set-primary).
  - New **"Enforce domain matching"** toggle to require member emails to match an
    allowed domain.
- **PR #118** `fix/2026-05-29-verification-flows-render-crash` — the Verification Flows
  page no longer crashes. `listFlows` now maps the API response shape
  (`operationType` / `isActive` / `stepCount`) to the UI shape
  (`flowType` / `status` / `steps`); the mismatch was throwing on render.

### 2026-05-29 — MFA dark-mode "black box" fix + safer auth-flow editing

- **Fix: invisible MFA code inputs in dark mode (app.fivucsas dashboard login).**
  The MFA card in `TwoFactorDispatcher` is an intentionally fixed *light* surface
  (white card, forced `#1a1a2e` input text) even when the app is in dark mode. But
  the step `TextField`s fill their box from the theme token `background.paper`,
  which is near-black (`#1a1f33`) in dark mode → black text on a black box (SMS/Email
  OTP, TOTP, QR code inputs were unreadable). The card now forces the input box white
  (`&&`-doubled specificity so it beats the per-step `background.paper`), matching the
  always-light card. Light mode was unaffected; verify.fivucsas (`LoginMfaFlow`) is a
  theme-aware card and never had the bug.
- **Fix (data-loss): auth-flow editing could wipe the tenant's default flow.**
  `AuthFlowsPage` recreates a flow on edit (the backend update can't change steps). It
  used to `deleteFlow()` **then** `createFlow()`; a failed create left the tenant with
  the flow gone — and if it was the default, every login broke. Now it creates the
  replacement first (temp name, non-default) → deletes the old → renames + reapplies
  the default flag via `updateFlow` (which atomically dethrones any other default).
- **Fix: `AuthFlowBuilder` ignored the edited flow's default flag.** It hardcoded
  `isDefault=false`, so editing the default flow silently recreated it as non-default.
  Added an `initialIsDefault` prop wired from `editingFlow.isDefault`.

### 2026-05-04 — Quality + hygiene wave (4 PRs)

Squash-merged to `main`:

- **PR #67** `chore/frontend-p3-hygiene-batch` (`319b457`) — P3 hygiene batch:
  brand-neutral `<title>` (PageTitle still re-localizes per route), `setTimeout`
  cleanups across 9 components (WidgetDemoPage CodeBlock, GuestsPage,
  TotpEnrollment, WebAuthnEnrollment, NfcEnrollment, StepUpDeviceRegistration,
  FaceVerificationFlow, TwoFactorVerification, NfcStep), NotificationPanel
  polling pauses on `document.visibilityState === 'hidden'`, CSP cleanup
  (`tfhub.dev` + `kaggle.com` removed across vite.config + 3 .htaccess + verify-app).
- **PR #68** `chore/lint-ratchet` (`386b904`) — `--max-warnings` ratchet from
  90 to 2 (P1-Q10).
- **PR #69** `refactor/enrollment-page-decomposition` (`35c116c`) — `EnrollmentPage.tsx`
  (1350 LOC, 38 hooks) decomposed by biometric method. New layout:
  `src/features/auth/components/enrollment/methods/{face,voice,nfc,sms,totp,webauthn}/`.
  Each method owns its hook, step components, and DI wiring (P1-Q7).
- **PR #70** `chore/nfc-step-clear-timeout-copilot` (`9bcf16a`) — `NfcStep.tsx:96`
  30s scan timeout now cleared in both `reading` and `readingerror` handlers
  (Copilot post-merge nit on PR #67).

CI: 4-of-4 GREEN on every PR; auto-deployed to Hostinger after each merge.

### Fix — 2026-05-01 (USER-BUG-5: auth-methods-testing puzzles always succeeded)

Auth Methods Testing playground (`/auth-methods-testing`) previously routed every test card through `stubAuthRepository.verifyMfaStep`, which resolved with `status: 'AUTHENTICATED'` after a 500 ms artificial delay. Plus each puzzle wrapper (`FacePuzzle`, `VoicePuzzle`, `FingerprintPuzzle`, `NfcPuzzle`, `HardwareKeyPuzzle`) called `setTimeout(onSuccess, 500)` regardless of what the underlying step component returned. Net effect: clicking "Try this method" → completing the step UI always reported success, even when the camera saw nothing, NFC was unavailable, the fingerprint dialog was cancelled, or no WebAuthn credentials existed.

This fix wires the 5 biometric / WebAuthn puzzles owned by this PR to real production endpoints with the signed-in admin's JWT. The puzzles now share `useAuthMethodPuzzleApi` and only invoke `onSuccess` on a server-confirmed verdict; cancellations and rejections surface as real errors via `formatApiError(err, t)`.

**Per-method round-trips:**
- `FacePuzzle` — `POST /biometric/verify/{userId}` (auto `/biometric/enroll/{userId}` on first attempt). USER-BUG-1 detection-gate preserved (FaceCaptureStep blocks capture without `detected=true` + bbox).
- `VoicePuzzle` — `POST /biometric/voice/verify/{userId}` (auto `/biometric/voice/enroll/{userId}` on first attempt). Production `VoiceStep` emits 16 kHz WAV via `useVoiceRecorder`.
- `FingerprintPuzzle` — `POST /webauthn/authenticate-options` → `navigator.credentials.get` (platform authenticator) → `POST /webauthn/authenticate`. Server-side fingerprint biometric removed in PR #39.
- `NfcPuzzle` — `POST /nfc/verify` against the captured card serial. NDEFReader / framed-context errors continue to surface from `NfcStep` directly.
- `HardwareKeyPuzzle` — `POST /webauthn/authenticate-options` → `navigator.credentials.get` (cross-platform authenticator) → `POST /webauthn/authenticate`.

**Files**:
- New `src/features/auth-methods-testing/puzzles/useAuthMethodPuzzleApi.ts` — DI-resolved HttpClient + BiometricService + useAuth.
- 5 puzzle wrappers rewritten to delegate to the hook; the bogus `setTimeout(onSuccess, 500)` is gone in all of them.
- New regression test `__tests__/biometricPuzzleApi.test.tsx` asserts that server-rejected verifications and missing WebAuthn sessions surface as `kind: 'error'` (NOT silent success).
- `__tests__/AuthMethodRunnerModal.test.tsx` updated for the new async-resolution path (no fake timers).
- 7 new i18n keys added to `authMethodsTesting.errors.*` and `authMethodsTesting.info.*` in both en.json and tr.json.

`StubAuthRepository` is intentionally NOT deleted — the parallel non-biometric puzzles PR (Password / EmailOTP / SMS / TOTP / QR) may still reference it. Final removal lands when both PRs merge.

### Docs — 2026-04-26 (iOS / macOS scope dropped)

Forward-looking iOS AppAuth integration references removed from `TODO.md` (Phase G4 + Wave 2 PR-2 backlog). iOS / iPadOS / macOS permanently out of scope — no Apple hardware available for development, signing, or testing. Apple-platform users are served via the hosted login page in their system browser.

### Design system refresh — 2026-04-22b (Scope B: verify-app chrome)

Zero functional change. The hosted login (`verify.fivucsas.com/login`) and
the iframe widget (`verify.fivucsas.com/?session_id=…`) both pick up the
new theme tokens from Scope A plus targeted visual polish on three shell
files. Every handler, OAuth param parse, `/oauth2/authorize/complete`
call, postMessage event (`fivucsas:ready`, `fivucsas:step-change`,
`fivucsas:complete`, `fivucsas:cancel`, `fivucsas:error`, `fivucsas:config`),
frame-bust effect, `assertSafeRedirectScheme` guard, CSP meta,
`Permissions-Policy` delegation, all 11 step components
(10 auth methods + `MethodPickerStep`), and the SDK
(`fivucsas-auth.js` + `.esm.js`) are **untouched**. Integrators' SRI
hashes remain valid.

**`src/verify-app/HostedLoginApp.tsx`**
- `HostedFrame` layout rebuilt: ambient radial gradient canvas (light +
  dark aware), gradient brand-mark above the card, refined Paper border
  + elevation tuned for both modes, `verify.fivucsas.com` microcopy
  footer under the card.
- Tenant header now leads with a small "Secured by FIVUCSAS" pill
  (`hosted.securedBy` key unchanged) using `VerifiedUserOutlined` icon +
  mono-width overline, and a Poppins display title for
  `hosted.signingInTo`.
- Loading / error / meta-load-failed render branches keep identical
  logic and i18n keys; only spinner size, stack spacing, Alert copy
  weight tuned.
- All handlers (`handleLoginComplete`, `handleCancel`), all `useEffect`
  blocks (frame-bust, locale change, tenant meta fetch with
  AbortController + 10s timeout), and all param parsing (`parseHostedParams`,
  `resolveLocale`) preserved byte-for-byte.

**`src/verify-app/VerifyApp.tsx`**
- Iframe body wrapper (`Box` in login + session mode) keeps a
  transparent background so the parent page styling shows through the
  widget — only padding tokens + `boxSizing` comment refined.
- Every state (`config`, `themeMode`, `session`, `loading`, `error`),
  every `useEffect` (postMessage listener, locale setter, session fetch),
  every handler (`handleSessionComplete`, `handleLoginComplete`,
  `handleCancel`, `handleStepChangeTracking`), and every postMessage
  emission preserved.

**`src/verify-app/LoginMfaFlow.tsx`**
- Card chrome: `borderRadius` 24 → 20, shadow tuned to a mode-aware
  soft-ground elevation (removes the theme-default hover lift, because
  an MFA card should feel grounded, not interactive).
- Header: title now uses the display font family with tighter tracking;
  cancel button gains a compact close icon and better flex alignment so
  the gradient title can wrap cleanly on narrow widgets.
- `phase` state machine, every one of the 11 step components
  (`PasswordStep`, `MethodPickerStep`, `TotpStep`, `SmsOtpStep`,
  `EmailOtpMfaStep`, `FaceCaptureStep`, `VoiceStep`, `FingerprintStep`,
  `QrCodeStep`, `HardwareKeyStep`, `NfcStep`), every API call (login /
  verifyMfaStep / WebAuthn challenge / QR generate / SMS send), every
  callback (`handlePasswordSubmit`, `handleMfaResult`,
  `handleMethodSelected`, `handleBackToMethodSelection`,
  `handleBackToPassword`, `verifyStep`, `requestWebAuthnChallenge`), and
  all i18n keys unchanged.

### Deploy verification (2026-04-22b)
- `npm run build:verify` clean.
- `npm test --run src/verify-app` → 56 / 56 green (HostedLoginApp +
  postMessageBridge + FivucsasAuth).
- `npm test --run` (full suite) → 608 / 608 green.
- `./sync-assets.sh` staged the new bundle into `verify-widget/html/`
  without touching any SDK file.
- `docker compose -f docker-compose.prod.yml up -d --build verify-widget`
  rebuilt the nginx image; container is healthy.
- `sha384sum` on `/fivucsas-auth.js` (live) = local staged copy — SRI
  hash on `bys-demo/index.html` + `bys-demo/callback.html` is still valid.
- `verify.fivucsas.com/` and `verify.fivucsas.com/login` both 200.

### Design system refresh — 2026-04-22 (Scope A: theme + app shell)

Zero functional change. Every route, handler, test id, i18n key, `aria-*`
attribute, and component API is preserved. All 608 Vitest tests stay
green, lint 0 errors, `npm run build` clean.

**`src/theme.ts`** — full rewrite.
- Calibrated **ink scale** (light + dark) with surface / paper / border /
  divider tokens tuned for contrast and depth parity across modes.
- **Palette**: primary `#6366f1` → `#8b5cf6` gradient retained for brand
  continuity; secondary / success / warning / error / info hues refreshed
  with matched `lighter` ramps for dark + light.
- **Typography**: Poppins display hierarchy (h1–h6) with tighter letter
  spacing and optical-rhythm line-heights; Inter for body and UI; tabular
  numerics; `ss01 / ss02 / cv01 / cv09` feature settings enabled.
- **Shadow ramp**: 8-tier graduated system tuned for both modes
  (plateau above tier 8 per MUI's 24-slot requirement).
- **Component overrides** refined: `MuiButton` (gradient primary, focus-ring,
  micro-lift on hover), `MuiCard` (soft border + layered hover elevation),
  `MuiTextField` (focus ring at 3px alpha + border widen), `MuiTableCell`
  (compact uppercase heads), `MuiChip`, `MuiAlert` (tinted background +
  matched border), `MuiDialog` (18px radius + no elevation gradient),
  `MuiAppBar` (glass backdrop), `MuiMenu`/`MuiMenuItem`, `MuiListItemButton`,
  `MuiTabs`, `MuiLinearProgress`, `MuiCircularProgress`, `MuiSkeleton`.
- Global `*:focus-visible` ring and refined scrollbar styling on `body`.
- CSS variables (`--app-radius-*`) exposed at `:root` for consumers.

**`src/components/layout/Sidebar.tsx`** — visual refresh.
- Nav now **grouped** into Overview / Access / Security / Biometrics /
  Personal (all via existing `menuItems`; no route or label changes).
- Active item shows a gradient left-edge bar + tinted background + bold
  weight; `aria-current="page"` emitted for the active item.
- Admin-only items carry a small `nav.badgeAdmin` chip.
- Brand mark uses gradient block + "Identity · Verified" micro-caption.
- Footer tile: animated green status dot + `status.fivucsas.com` pointer
  (copy via new `sidebar.systemStatus` key).
- **Preserved**: `<Box component="nav">` (so `role="navigation"` resolves),
  MUI `ListItemButton` (so `role="button"` resolves with translated
  accessible name), full `menuItems` array (labelKey / icon / path /
  adminOnly), `user?.isAdmin()` filter. E2E `navigation.spec.ts`
  selectors unchanged.

**`src/components/layout/TopBar.tsx`** — visual refresh.
- Glass AppBar with blur-saturate backdrop, Poppins page title, tighter
  right cluster (language toggle / theme toggle / `NotificationPanel` /
  divider / user menu), gradient avatar with ring-on-hover.
- User menu redrawn with avatar + name + email + role chip.
- **Preserved**: `getPageTitle()` path→i18n-key mapping, every `onClick`
  handler (`toggleLanguage`, `toggleMode`, `handleLogout`, `handleSettings`),
  every tooltip + `aria-label` + `aria-haspopup` attribute, `NotificationPanel`
  untouched.

**`src/components/layout/DashboardLayout.tsx`** — visual refresh.
- Ambient gradient canvas (radial glows) behind content; refined
  breadcrumb styling; elevated footer typography.
- **Preserved**: `BREADCRUMB_I18N_MAP` (all keys, all routes),
  `#main-content` id + `tabIndex={-1}` (skip-link target), `Outlet`
  placement, footer `terms` / `privacy` route links, mobile drawer
  toggle wiring.

**`src/components/layout/PublicLayout.tsx`** — visual refresh.
- Glass AppBar with gradient logo mark + FIVUCSAS wordmark; CTA promoted
  to `variant="contained"` for unauthenticated users.
- **Preserved**: routing targets (`/`, `/login`, `/terms`, `/privacy`),
  i18n keys (`publicLayout.backToDashboard`, `publicLayout.signIn`,
  `footer.*`), `Outlet` container.

**`src/i18n/locales/en.json` + `tr.json`** — additive only.
- Added `nav.group.{overview,access,security,biometrics,personal}`,
  `nav.badgeAdmin`, `nav.primary`, `sidebar.systemStatus`.
- No existing keys renamed or removed; parity preserved across both
  locales.

### Out of scope
- No feature pages touched; every page inherits the new tokens via MUI
  theming.
- No changes to `verify-app/` (hosted login + widget) — planned separately.
- No SDK changes — `fivucsas-auth.js` SRI hash on integrators remains
  valid.

### Accessibility
- **FE-H4 a11y sweep (2026-04-20)** — every Zod-validated `TextField` in
  `UserFormPage`, `TenantFormPage`, `ForgotPasswordPage`, and
  `ResetPasswordPage` now declares an explicit `id` + matching
  `FormHelperTextProps.id` and passes `aria-describedby="${fieldId}-helper"`
  via `inputProps` (or `SelectProps` for `select` variants). Screen readers
  now announce validation / hint copy alongside each field label.
  `RoleFormPage`, `MyProfilePage`, `NfcEnrollmentPage` skipped: none use
  Zod + `helperText`, so no wiring invented.
- **Tests** — added 4 Testing Library specs
  (`UserFormPage.a11y.test.tsx`, `TenantFormPage.a11y.test.tsx`,
  `ForgotPasswordPage.a11y.test.tsx`, `ResetPasswordPage.a11y.test.tsx`)
  asserting each field declares `aria-describedby` with the expected helper
  id. Raises Vitest count 604 → 608; `npm run test` and `npm run lint`
  both green.
- Previously-landed skip-to-main link (`DashboardLayout`) and
  `role="status" aria-live="polite"` on `NotificationPanel` verified in
  place.

## [2026-04-19] Frontend audit remediation

Addresses FE-H1, FE-H2, FE-H3, FE-H4, FE-M3 from `/opt/projects/fivucsas/docs/audits/AUDIT_2026-04-19.md` Audit 3.

### Added
- **Page smoke tests (FE-H1)** — new `src/pages/__tests__/` with render-only
  smoke tests for LoginPage, DashboardPage, UsersListPage, TenantsListPage,
  MyProfilePage. Each mounts the page under `MemoryRouter` with the required
  hooks mocked and asserts the primary heading is in the document. Raises
  total Vitest count 599 → 604.
- **Skip-to-main link (FE-H4)** — `DashboardLayout.tsx` now renders a
  visually-hidden-until-focused skip link as the first focusable element,
  targeting the `<main id="main-content">` container. `common.skipToContent`
  key added to both en.json and tr.json (parity preserved: 1296/1296).
- **Notification live region (FE-H4)** — `NotificationPanel.tsx` list
  surface now carries `role="status"` + `aria-live="polite"` so screen
  readers announce new audit-log entries as they arrive.
- **ESLint rule (FE-H2 complement)** — `.eslintrc.cjs` adds a
  `no-restricted-syntax` override forbidding `err.message` member access in
  `src/**/*.{ts,tsx}` (ignores `src/utils/formatApiError.ts` + tests).
  Message: "Use formatApiError(err, t) instead of raw err.message — see
  CLAUDE.md." Starts as `warn`; `--max-warnings` bumped 45 → 90 to absorb
  the 41 existing offenders without blocking CI. Flip to `error` once the
  codemod sweep lands.

### Changed
- **Per-route CSP (FE-H3)** — `public/.htaccess` CSP rewritten:
  - Dashboard / admin routes (default): now `script-src 'self'` only —
    NO `'unsafe-eval'`, NO `'wasm-unsafe-eval'`.
  - `/verify*`, `/enroll*`, `/biometric*`: keep the relaxed CSP with
    `'unsafe-eval'` + `'wasm-unsafe-eval'` (onnxruntime-web + @tensorflow/tfjs
    require them).
  - `/login`: strict `script-src` AND `frame-ancestors 'none'` (clickjacking
    defense on the top-level OIDC sign-in page).
  Outer quoting stays double-quoted with bare `'self'` tokens inside (same
  style as the shipping B9 rule — avoids the Hostinger `\"` backslash leak).
  `vite.config.ts` gains a comment documenting that dev CSP is permissive by
  design and prod tightens per route via `.htaccess`.
- **Lazy chunks (FE-M3)** — `vite.config.ts` `manualChunks` extended:
  - `recharts-vendor` (splits Recharts + d3-*; 416 KB) — only loaded when
    a route that imports Recharts is navigated to (Analytics /
    VerificationDashboard are already `React.lazy`'d at the router level).
  - `onnx-vendor` (splits onnxruntime-web; 532 KB) — same idea for
    biometric routes.
  - `mui-x-vendor` reservation for future `@mui/x-*` additions.
  Build output confirms the new chunk names.
- **`UserFormPage.tsx` a11y (FE-H4)** — role-selection `Select` now carries
  `aria-describedby="roles-multi-select-helper"` pointing at the
  `<FormHelperText id="roles-multi-select-helper">`. Other RHF forms use
  MUI `<TextField helperText=…>`, which auto-wires `aria-describedby` — no
  manual fix needed.

### Not done / punted
- **Per-chart `React.lazy` inside AnalyticsPage / VerificationDashboardPage**
  would require extracting the chart regions into separate files; pragmatic
  benefit is small because those pages are already `React.lazy`'d at the
  router level, and the new `recharts-vendor` chunk now isolates the 416 KB
  cost. Listed as optional follow-up.
- **Migrating the 41 existing `err.message` call sites** is out of scope for
  this audit-remediation pass; the ESLint rule surfaces them as warnings for
  a subsequent codemod sweep.

### Verification
- `npm run lint` → 0 errors (73 warnings, under the new 90 cap).
- `npm run test` → 604/604 passing (was 599/599).
- `npm run build` → green; `recharts-vendor-*.js` and `onnx-vendor-*.js`
  appear as separate chunks in `dist/assets/`.
- i18n parity: `jq '[paths(scalars)] | length'` returns 1296 for both
  `en.json` and `tr.json`.

## [2026-04-19] — UX review fixes: MFA selector, face enrollment, copy, step counter

### Fixed
- **MFA selector layout overflow** — "Hazır/Kayıtlı değil" chip was rendering in
  the normal text flow and splitting descriptions mid-sentence (e.g.
  "E-postanıza gönderilen [Hazır] kodu girin"). `MethodPickerStep.tsx` now
  absolutely positions the chip and reserves `pr: 10` on the CardActionArea.
- **MFA selector English method names** — "Authenticator App", "Face Recognition",
  etc. appeared in English on a Turkish UI. Now resolved through i18n
  (reuses existing `enrollmentPage.methods.*` keys from the enrollment page).
- **Face enrollment modal** — 11 hardcoded English strings ("Face ID Enrollment",
  "Step 3 of 5", "Enrollment Complete!", "Retry", "Capture N", etc.) moved into
  `enrollment.face.*` i18n namespace. Dialog backdrop opacity raised to
  `rgba(0,0,0,0.7)` so the modal visibly dims the page behind.
- **Face enrollment progress math** — off-by-one: Step 5/5 plateaued at 80%
  before completion. `useFaceChallenge.ts` formula `(idx+1)/total` instead of
  `idx/total`; initial and reset states start at 1/5 (20%), last capture hits 100%.
- **Face login quality tags** — `useQualityAssessment.getQualityLabel` returned
  hardcoded `'Good' | 'Fair' | 'Poor'` which was interpolated into the quality
  chip during MFA. Now returns a suffix key resolved via `t('mfa.face.qualityLabel.*')`.
  Turkish: İyi / Orta / Zayıf.
- **Step counter jumping** — hosted login showed "1/2" then jumped to "3/3"
  because the frontend guessed `totalSteps=2` before the backend became
  authoritative. `LoginMfaFlow.tsx` now hides the counter until the real
  total is known and guards it with a monotonic `Math.max(prev, next)` so
  it can never shrink.
- **Copy / terminology** —
  - `auth.mfaInfo` TR: "kiracınızın" → "kuruluşunuzun" (end users don't know SaaS-tenant lingo). EN: "your tenant's" → "your organization's".
  - Page title "Biyometrik Kayıt" → "Kimlik Doğrulama Yöntemleri"
    (page also hosts non-biometric methods). EN: "Authentication Methods".
  - TDK grammar: `kayıt edildi` → `kaydedildi` across 6 enrollment strings.
  - Counter: "8 yöntem kayıtlı · Bu cihazda kullanılamayan: 0".

### Tests
- Vitest: **599 / 599** passing.
- Lint: 0 errors, 31 pre-existing warnings (unchanged).
- Build: succeeds.

### Commits
- `e47089f` — MFA selector overflow + face enrollment i18n + copy cleanup
- `a572c9f` — Stop step counter jumping between totals
- `920f641` — Translate face login step labels + chips

## [2026-04-18d] — Prod bug fixes: BlazeFace re-init, console noise, i18n debug

### Fixed
- **BlazeFace initialised four times** (React StrictMode + `useEffect` dep re-runs).
  `src/lib/ml/useBlazeFace.ts` no longer constructs a new `BlazeFaceDetector`
  per effect; it awaits a module-level singleton (`src/lib/ml/blazeFaceSingleton.ts`)
  that loads the model exactly once per tab and survives every remount /
  StrictMode double-invoke. The per-component dispose that was tearing down
  the shared model has been removed.
- **Console noise in production.** `vite.config.ts` + `vite.verify.config.ts`
  now configure `build.rollupOptions.output.minify.compress.dropConsole = true`
  for `mode === 'production'` so oxc's minifier strips every `console.log /
  .info / .debug` call from emitted code. `console.warn` and `console.error`
  are retained. Removed stray `console.log` / `.info` / `.debug` statements
  from `BlazeFaceDetector.ts`, `useFaceDetection.ts`, and `FingerprintStep.tsx`
  (hot-path offenders).
- **i18next debug banner.** `src/i18n/index.ts` pins `debug: false` explicitly.

### Tests
- Vitest: **599 / 599** passing.
- Lint: 0 errors.

### Verified
- `https://verify.fivucsas.com/assets/ort.min-CSPs-wzd.js` → HTTP 200 after
  widget container rebuild + new `sync-assets.sh` pre-stage script.
- `grep -c "console\.log\|console\.info\|console\.debug"` returns 0 across
  every bundle produced from our source (third-party `ort.min.js` ships
  pre-minified and still contains its own `console.log`; out of scope).
- CORS preflight `OPTIONS https://api.fivucsas.com/api/v1/auth/mfa/step`
  with `Origin: https://verify.fivucsas.com` → 200 + correct
  `Access-Control-Allow-*` headers. No backend change needed.

## [2026-04-18c] — Hosted-login UX recovery: callback data, stepper, locale, face retry, copy audit

### Fixed
- **Callback fields populated (Fix 3)** — `sdk/FivucsasAuth.ts` `handleRedirectCallback()`
  now decodes the id_token (`sub` → `userId`, `email`, `name` → `displayName`, `amr`
  → `completedMethods`) and falls back to `GET /oauth2/userinfo` with the bearer
  access token when any field is missing. Synthesized `sessionId` now derives
  from the auth code prefix instead of returning `''`. Tenants' callback pages
  (e.g. `bys-demo/callback.html`) no longer render `—` for Kullanıcı ID,
  E-posta, Doğrulama Yöntemleri.
- **Hosted login locale honoured (Fix 5)** — `sdk/FivucsasAuth.ts#loginRedirect`
  appends OIDC `ui_locales` on the authorize URL. `HostedLoginApp.tsx` resolves
  locale from `ui_locales` → legacy `locale` → `navigator.language` → `'en'`,
  sets `document.documentElement.lang`, and switches i18next before render.
- **Face failure UX (Fix 1)** — `FaceCaptureStep.tsx` swaps the captured-image
  alt text to `mfa.face.lastAttemptAlt` and applies a subtle grayscale filter
  when the server rejects a capture. Error alerts gain three retry tips
  (lighting, framing, glasses) instead of the bare "Verification failed." copy.
  No biometric threshold or model change.

### Added
- **`<StepProgress>` component (Fix 4)** — `verify-app/StepProgress.tsx`. Compact
  top-of-flow counter + determinate progress bar, ARIA-labeled, hidden when
  `total <= 1`. Mounted above the header in `LoginMfaFlow.tsx`; the redundant
  bottom "Step N of M" caption has been removed so every method (Face, TOTP,
  Email OTP, NFC, picker) renders a consistent indicator instead of the
  NFC-only inline text.
- **Copy audit (Fix 6)** — `widget.*` and `mfa.face.*` keys in `en.json` +
  `tr.json` rewritten to the "what happened + what to do" pattern:
  `loginFailed`, `verificationFailed`, `unexpectedError`, `missingParams`,
  `skipFailed`, `mfaRequired`, `cameraError`, plus three new
  `mfa.face.retryTip*` strings and `capturedAlt` / `lastAttemptAlt`.

### Tests
- **Vitest** — 599 / 599 passing (was 597). Two new SDK tests:
  id_token claim extraction, userinfo fallback.

### Deployed
- SDK rebuilt (`dist-sdk/fivucsas-auth.js` — SRI
  `sha384-LLegFtvECu4lDPINAMXGPM3C5lo3SCnj9jaqBAi1LDvxGILTG8Bm86Db5TIkP1G6`)
  and copied to `verify-widget/html/` alongside the new verify-app bundle;
  Docker widget recreated; web-app dist rsync'd to Hostinger.

## [2026-04-18] — CI on ubuntu-latest, Dependabot sweep, lint green, MobileFaceNet removed

### Changed
- **CI workflow** — both `build-and-test` and `code-quality` jobs moved from
  the self-hosted `hetzner-cx43` runner to `ubuntu-latest`. The runner group
  had `allows_public_repositories: false`, silently refusing to dispatch
  jobs for this public repo for several days. GitHub-hosted runners are the
  industry standard for public OSS projects.
- **`.npmrc`** added with `legacy-peer-deps=true` — `vite-plugin-pwa@1.2.0`
  declares a peer range that caps at Vite 7, while the project already uses
  Vite 8. The flag unblocks `npm ci` on ubuntu-latest without downgrading.
- **Face embedding** — stripped MobileFaceNet entirely (was blocked on an
  authenticated download). `EmbeddingComputer.ts` is now landmark-geometry
  only (`geometry-512`, 512-D vector from MediaPipe FaceLandmarker). The
  server remains authoritative via log-only client embedding observations
  (Alembic 0004), so the pre-filter → geometry fallback has no auth impact.
  `public/models/manifest.json` no longer lists the missing ONNX entry.

### Fixed
- **Lint green on public-repo CI** — 23 errors + 63 warnings → 0 errors / 33
  warnings (below the `--max-warnings 45` gate). The self-hosted runner had
  been skipping these PRs for ~5 days, hiding pre-existing debt.
  - 17 × `react-hooks/rules-of-hooks`: `HostedLoginApp.tsx` moved hooks above
    the early `return null` frame-bust; `TwoFactorDispatcher.tsx` promoted
    two `useCallback`s above the EMAIL_OTP early return. No behavior change
    (effects still gated on `isFramed` / method presence).
  - 1 × `no-useless-escape` in `sdk/FivucsasAuth.ts:105` regex.
  - 1 × stale `eslint-disable-next-line no-console` in `postMessageBridge.ts:74`.
  - 4 × unused test imports (`act` / `afterEach` / `waitFor` / `userEvent`).
  - 30 × `react-hooks/exhaustive-deps` — mostly adding the stable
    `useTranslation` `t` dep; `TenantFormPage`/`UserFormPage` got `onSubmit`
    wrapped in `useCallback` to stabilize `handleKeyDown`.

### Security
- **Dependabot merges** — 0 remaining vulnerabilities after:
  - `protobufjs` 7.5.4 → 7.5.5 (CRITICAL, PR #23)
  - `follow-redirects` 1.15.11 → 1.16.0 (MODERATE, PR #21)

### Deployed
- Production bundle rebuilt and rsync'd to Hostinger
  (`app.fivucsas.com/public_html/`) after the Dependabot merges.

## [2026-04-16] — PR-1 Hosted-first V1 + PR-1 review blockers

### Added
- **Hosted login page** — `HostedLoginApp.tsx` (357 LOC) at `/login`; top-level shell, tenant branding fetch, POST to `/oauth2/authorize/complete`, `window.location.replace` on success (verify-app/HostedLoginApp.tsx)
- **SDK loginRedirect** — `FivucsasAuth.loginRedirect({redirectUri, scope?, state?, nonce?})` with PKCE S256 via WebCrypto SubtleCrypto, 32-byte crypto-random state, sessionStorage, `window.location.assign` (sdk/FivucsasAuth.ts)
- **SDK handleRedirectCallback** — parses `?code=&state=`, validates state AND nonce against id_token claim (OIDC §3.1.3.7), POSTs `/oauth2/token` (B7) (sdk/FivucsasAuth.ts)
- **Web Components** — `<fivucsas-verify>` and `<fivucsas-button>` custom elements shipped (elements/)
- **Silero VAD gating** — `audioToWav16k.ts` util converts WebM → 16kHz 16-bit mono PCM WAV so Silero VAD `parseWav16kMono` actually parses the blob; VoiceEnrollmentFlow + useVoiceRecorder delegate to helper; `[VoiceVAD] decision` debug log in TwoFactorDispatcher (audioToWav16k.ts, __tests__ 5 tests)
- **Test coverage** — HostedLoginApp.test.tsx (407 LOC: missing-params, invalid-client, expired session, happy-path, redirect URL shape) + FivucsasAuth.test.ts (333 LOC) (B8)
- **CardDetector** — YOLOv8n ONNX client-side card detection (biometric-engine/core/CardDetector.ts, 434 LOC)
- **PerfOverlay** — dev-mode `?debug=perf` performance overlay with usePerformanceMetrics hook
- **HOSTED_LOGIN_INTEGRATION.md** — tenant integration recipe, PKCE walkthrough, redirect-URI registration, state/nonce, troubleshooting (docs/plans/)
- **AUDIT_REPORT_2026-04-16.md** — 5-agent audit (hygiene B+ / security A- / compliance B-)
- **Part D i18n** — +112 keys per locale across AuditLogsPage, RolesListPage, TenantsListPage, RoleFormPage, useLivenessPuzzle (9 action keys)

### Fixed
- **B7 nonce validation** — previously stored in sessionStorage and never checked; now validated against `id_token.nonce` claim; redirect URI scheme allowlist (http/https/custom) before `window.location.replace` (sdk/FivucsasAuth.ts)
- **B9 CSP frame-ancestors** — per-route split; `/login` = `'none'` (click-jacking protection for password field); widget routes keep allowlist; runtime frame-bust in HostedLoginApp.tsx (public/.htaccess, vite.config.ts, HostedLoginApp.tsx)
- **Dashboard dates** — localized via `i18n.language` in AnalyticsPage, VerificationDashboardPage, DashboardPage; Turkish users now see Turkish date formatting
- **Swallowed catches** — EnrollmentPage.tsx:354 + MultiStepAuthFlow.tsx:97-99 now log errors instead of silent `catch {}`
- **LoginPage demo credentials** — gated behind `import.meta.env.DEV` so they never ship to production

### Changed
- **Voice capture pipeline** — useVoiceRecorder now always emits 16kHz WAV; enrollment + login paths share `encodeToWav16kMono` helper
- **NfcStep** — framed-mode fallback card with i18n keys `mfa.nfc.framedTitle/Body/Cta/Secondary`
- **Face pipeline** — FaceCaptureStep + useFaceChallenge + useFaceDetection integrated with useLivenessPuzzle

### Commits
- `fa18586` CSP per-route + frame-bust (B9)
- `14d601f` nonce validation + URI scheme allowlist (B7)
- `7e581f4` hosted-login end-to-end tests (B8)
- `d1a5c6f` Part D i18n sweep + date locales + swallowed-catch logs
- `519b035` voice wav16k so Silero VAD gates
- Merged to main in `048de42` (fast-forward)

## [2026-04-15] — demo.fivucsas MFA hardening

### Fixed
- **Fingerprint**: `decodeChallengeToBytes()` now uses `base64urlToBytes()` — backend encodes with `Base64.getUrlEncoder()` so bare `atob()` was throwing `InvalidCharacterError` in a loop on every mount (webauthn-utils.ts)
- **Fingerprint**: added `transports: ['internal']` to allowCredentials — biases Windows Hello / Touch ID over security keys & phone hand-off (FingerprintStep.tsx)
- **QR**: ref-guarded initial mount + 429 detection with `Retry-After` header parsing — stops infinite `POST /mfa/qr-generate` loops (QrCodeStep.tsx)
- **SMS**: resend button → `variant="outlined"` with explicit contrast-safe colors — was invisible on Brave mobile (SmsOtpStep.tsx)
- **SDK iframe**: `"camera 'src'"` was invalid Permissions Policy syntax; replaced with bare feature names for src delegation (sdk/FivucsasAuth.ts)
- **Success payload**: `sendComplete()` now emits `completedMethods` + `timestamp`; `LoginMfaFlow` threads `usedMethods` through `onComplete` (postMessageBridge.ts, LoginMfaFlow.tsx, VerifyApp.tsx)

### Changed
- **i18n**: renamed fingerprint → "Device Authentication" / "Cihaz Kimlik Doğrulaması" (en.json, tr.json) — OS may show fingerprint, face, or PIN; old label was misleading. Matches Google/Microsoft/1Password convention.

## [Unreleased] - 2026-03-07

### Added
- CLAUDE.md with project context, known issues, and auth method UI status
- ROADMAP.md with phased auth enrollment and integration plan
- Auth method enrollment gap analysis in TODO.md (9 new items: AE-1 through AE-9)

### Documented
- Auth method UI status matrix: all 10 have step components, only 2 have enrollment UIs
- Missing enrollment UIs: Hardware Key, Fingerprint, Voice, NFC Document
- TotpEnrollment and QrCodeStep disconnected from backend endpoints
- Voice auth disabled (isActive: false), NFC is web placeholder only
- Model/enum mismatches with backend (5 critical issues)
- 16 backend features with no frontend UI

### Previous
- Cross-module integration audit (March 2026): 38 issues identified
- Previous audit (Feb 2026): 47/48 items completed

## [2026-04-15b] — demo.fivucsas test round 2

### Fixed
- **Face step crash**: `usePerf must be used inside <PerfProvider>` — widget iframe has no PerfProvider; changed `usePerf()` to return a no-op value instead of throwing (PerfContext.tsx)

### Known follow-ups
- SMS message content ("Dogrulama kodunuz: … TWVerify ile gonderildi. B043") is controlled by the Twilio Verify service template, not our backend. Update friendly name + Turkish locale + diacritic support in the Twilio console.
- Same-method reuse across MFA steps currently returns a raw 400; needs an i18n-friendly message.
