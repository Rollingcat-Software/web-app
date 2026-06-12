# CLAUDE.md - FIVUCSAS Web App

## Project Overview

React 18 / TypeScript 5 / Vite 8 admin dashboard for FIVUCSAS biometric identity platform.
Clean Architecture with InversifyJS dependency injection, Material-UI, Zod validation.

## Build & Run

```bash
npm install
npm run dev              # Dev server on port 3000
npm run fetch-models     # Pull ONNX models from Hostinger bucket (auto via prebuild)
npm run build            # Production build (prebuild → fetch-models, then tsc + vite)
npm run test             # Run tests (Vitest)
npm run lint             # ESLint
```

ONNX models live at `https://app.fivucsas.com/models/`. `scripts/fetch-models.mjs` downloads them with SHA256 verification (fatal on mismatch). See `public/models/README.md` and `manifest.json`.

Set `VITE_ENABLE_MOCK_API=true` in `.env.local` for offline development with mock data.

## Key Directories

- `src/features/auth/components/` - Auth step components (10 methods) + enrollment UIs
- `src/features/auth/components/enrollment/methods/` - Per-biometric-method
  enrollment subdirectories landed in PR #69 (P1-Q7) on 2026-05-04. The old
  monolithic `EnrollmentPage.tsx` (1350 LOC, 38 hooks) is decomposed by
  method: `face/`, `voice/`, `nfc/`, `sms/`, `totp/`, `webauthn/`. New
  enrollment methods follow the same pattern — each method owns its hook,
  step components, and DI wiring under its own subdirectory.
- **Face enrollment flow (`hooks/useFaceChallenge.ts`, 2026-06-03):** a **3-step**
  guided capture — **center/look → turn left → turn right** (counter X/3), one
  image per step. Head-turn gestures are **mandatory** (no silent auto-skip); a
  liveness miss re-prompts the current step (never resets to Step 1); step
  counter + percentage both derive from current/total. **No blink step** —
  client-side blink detection (EAR via the 478-pt FaceLandmarker `avgEAR`) was too
  unreliable across devices/FPS; server passive-liveness is authoritative. The
  shared `BlazeFace` detector runs at `numFaces:1` for auth (single subject →
  higher FPS). Don't re-add a hard-required client blink. See CHANGELOG 2026-06-03.
- `src/features/auth/constants.ts` - Centralized enums: AuthMethodType, MfaStepStatus, WEBAUTHN, AUTH_API
- `src/features/auth/webauthn-utils.ts` - Shared WebAuthn: resolveChallenge, mapWebAuthnError, base64 helpers
- `src/features/authFlows/` - Auth flow builder and management. The builder
  (`AuthFlowBuilder.tsx`, redesigned to a simpler **layer** model) renders a
  flow as an ordered list of LAYERS. Each layer is a **set of allowed methods**
  picked via uniform **checkboxes** + a **Required** switch; the user satisfies
  a layer by completing ANY ONE of its methods (1 method = mandatory single
  factor, 2+ = a "any one of" choice). There is no special primary method and
  no method-picker/CallSplit affordance. A **usernameless** switch appears on
  Layer 1 only when a selected method is `AuthMethod.supportsUsernameless`.
  The wire contract is unchanged: a layer's method set persists as
  `authMethodType` = set[0] + `alternativeMethodTypes` = set.slice(1) (mapped in
  `AuthFlowsPage.tsx`); single-method layers send no `alternativeMethodTypes`.
  Save is disabled when any layer has 0 methods or there are 0 layers, and a
  0-method layer is never sent.
- `src/features/auth/login-shared/` - UI shared between the dashboard login
  (`app.fivucsas`) and the hosted login (`verify.fivucsas`) so the two surfaces
  stay identical (2026-06-01). `MfaStepRenderer.tsx` is the SINGLE
  method→step-component router both `TwoFactorDispatcher` (dashboard) and
  `LoginMfaFlow` (hosted) render — adding/changing an MFA step here updates BOTH
  surfaces at once. `webauthnChallenge.ts` is the shared
  `makeRequestWebAuthnChallenge` helper. Each surface keeps its own SHELL
  (dashboard full-screen glass card vs hosted in-card OIDC flow) + flow state;
  only the per-step BODY is shared. See `LOGIN_PARITY_2026-06-01.md`.
  **2026-06-12 parity additions:** `steps/IdentifierStep.tsx` (the shared opening
  email-box + Continue identity-entry, used by BOTH surfaces — props inject the
  surface-specific chrome: gradient pill + ArrowForward + spinner on the dashboard
  vs theme button on hosted; `loading`=spinner, `disabled`=broader-busy-no-spinner)
  and `ConfigUnavailableBanner.tsx` (the shared config-failure `role="status"`
  banner + Retry, now on BOTH surfaces). **puzzleConfig threading:** the active
  PUZZLE step's tenant config is sourced from the login-config via
  `selectPuzzleConfig(loginConfig, method)` (`domain/models/LoginConfig.ts`, which
  now parses per-step `puzzleConfig` / `stepConfig.puzzleConfig`) and threaded
  through `MfaStepRenderer` → `PuzzleStep` on BOTH dispatchers — so SP-B Phase-5
  `alsoMatchFaceIdentity` binding actually engages when the client-embedding flag
  is on. The opening identifier endpoint still DIVERGES (dashboard `/auth/login/
  begin` opens a session; hosted lone-password `/auth/login/preflight` does not) —
  intentionally left for the owner (session/lockout-semantics decision).
- `src/core/repositories/` - API repository implementations
- `src/domain/models/` - Domain models
- `src/core/di/` - InversifyJS DI container and TYPES
- `src/pages/` - Page components (17 pages)
- `src/utils/formatApiError.ts` - Centralized HTTP error → i18n message mapping
- `src/verify-app/` - Auth surfaces (both widget iframe + hosted-first redirect page)

## Architectural direction (2026-04-16)

**Hosted-first auth.** Primary integration is redirective: tenants use `FivucsasAuth.loginRedirect({...})` which navigates the user to `verify.fivucsas.com/login` (top-level browsing context). After MFA, the browser redirects back to the tenant's `redirect_uri` with `?code=…&state=…`. The tenant exchanges the code at `/oauth2/token` for access + id tokens (OIDC). Widget iframe remains available but demoted to **inline step-up MFA** (sensitive-action re-auth, checkout confirmation).

**Why:** Industry pattern (Auth0, Okta, Microsoft, Google, Apple, Keycloak, AWS Cognito, Stripe, Turkish banks, e-Devlet all use hosted-first). Native platform features (Web NFC, WebAuthn, autofill, password managers) behave correctly in top-level context. Future-proof against Safari ITP + 3P cookie deprecation.

**Platform coverage:** hosted mode supports web, iOS (ASWebAuthenticationSession), Android (Chrome Custom Tabs), Electron (loopback), CLI (loopback). Redirect-URI allowlist accepts HTTPS, custom schemes (`com.acme://auth`), and loopback (`http://127.0.0.1:*`) per RFC 8252.

**Backend OAuth 2.0 + OIDC already production-grade:** `OAuth2Controller.authorize`, `.token`, PKCE S256, state/nonce, JWKS, OIDC discovery, exact-match redirect-URI allowlist. PR-1 only adds `display=page` content negotiation + `POST /oauth2/authorize/complete` to mint the code after MFA.

## Auth Methods (ALL 10 WORKING)

Step components in `src/features/auth/components/`:
PasswordStep, EmailOtpStep, SmsOtpStep, TotpStep, QrCodeStep,
FaceCaptureStep, FingerprintStep, VoiceStep, NfcStep, HardwareKeyStep

## Config-driven login (feature-flagged `app.auth.config-driven-login`, default OFF)

The login surface renders its **Layer 1 STRICTLY from the backend
`GET /auth/login-config?tenantId=<uuid>` response** (frozen contract — api
task #16 / PR #163) — never hardcode the password-first form.

- `features/auth/login-config.ts` → `fetchLoginConfig(httpClient, {tenantId?|clientId?})`
  fetches + normalizes via `domain/models/LoginConfig.ts` (tolerant of
  `type`/`methodType`, `usernameless`/`supportsUsernameless`,
  `order`/`stepOrder` deltas). Returns **`null` on ANY failure** (404 / network
  / malformed) so the UI degrades to the legacy email+password screen. Method
  `type` is the `AuthMethodType` enum name — incl. the usernameless
  login-config entry types **`PASSKEY`** (discoverable WebAuthn) and
  **`APPROVE_LOGIN`** (number-matching), plus `QR_CODE`.
- `LoginMfaFlow.tsx` shows the **password step only when `PASSWORD ∈
  layer1.methods`**; otherwise an **identifier-first** entry (when
  `identifierRequired`) or the usernameless shortcuts. The usernameless entry
  points (passkey / approve / qr) may return **MFA_PENDING** for multi-step
  tenant flows and then continue through `/auth/mfa/step` like a password login.
- `LoginPage.tsx` (dashboard) gates the password form the same way; the
  no-password path routes through `TwoFactorDispatcher`.
- `Layer1Shortcuts.tsx` renders the cross-device sign-in cluster on the initial
  identity-entry screen: the **passkey** button (config-driven — shown strictly per
  the config when it declares a usernameless Layer-1 method; `fallbackAll` keeps it
  on a null/flag-OFF config), plus **"Approve on another device"** and **"Sign in
  with your phone" (QR)** when the caller passes `onApproveClick` / `onQrClick` (both
  `LoginPage` and `HostedLoginApp` do). The approve + QR panels self-collect what they
  need (email / a scanned session), so they work as no-typing-first alternatives.
  (web-app #199, 2026-06-03 — approve had been removed from here and was re-homed;
  QR is new. See `qr-login.ts` + `QrLoginPanel.tsx` / `ApproveLoginPanel.tsx`. QR
  encodes the **sessionId** as `fivucsas://qr-login?session=<id>` — NOT the API's
  random `qrContent`, which is not a Redis lookup key. Multi-step tenants return
  `mfaRequired`; the step-up handoff via `mfaSessionToken` is a tracked follow-up.)
- **Reversibility**: the UI is 100% config-driven + always has the
  email+password fallback, so flipping the API flag OFF (which returns the
  current password-first shape) reverts the whole feature with **no web
  redeploy**. Don't bake the new behaviour into the components.
- **Config-unavailable banner (2026-06-03)**: when `fetchLoginConfig` settles
  with no usable config (network / unreachable API / malformed), `LoginPage`
  sets `configLoadFailed` and renders a `role="status"` warning banner +
  **Retry** (`login.configUnavailable` / `configRetry` / `configRetrying`)
  ABOVE the still-rendered legacy fallback. This stops a config-fetch failure
  from looking like a stale/old login page (it read that way on filtered
  networks that block `api.fivucsas.com`). The fallback form is unchanged — the
  banner is purely additive messaging. **Hosted parity DONE (2026-06-12)**: the
  banner is now the SHARED `login-shared/ConfigUnavailableBanner.tsx`, rendered on
  BOTH `LoginPage` (dashboard) and `verify-app/HostedLoginApp.tsx` (hosted) when
  the login-config fetch settles null-because-FAILED (distinct from null-because-
  engine-OFF, which returns a usable password-first config). Hosted gained its own
  `configLoadFailed`/`configRetrying` + `handleRetryLoginConfig`.

Contract is provisional (api task #16): the client normalizer absorbs
field/casing deltas and never hard-fails.

## Dashboard login step counter (2026-05-31)

The dashboard (`features/auth/components/LoginPage.tsx`) is cross-tenant and used
the platform login-config (`totalSteps=1`) + derived the total from live progress
(`completedMfaMethods.length + 1`), so the total always equalled the current →
password screen showed NO counter and MFA read "2/2" then "3/3". Fix: prefer the
**backend-authoritative** flow size. The email (identifier) step calls
`/auth/login/preflight`, which now returns the caller's resolved tenant
login-config (api 2026-05-31); its `totalSteps` is stored in `flowTotalSteps` and
each `/auth/mfa/step` response reaffirms it. `loginTotalSteps` prefers
`flowTotalSteps → loginConfig.totalSteps → live progress`, so the dashboard reads
the tenant's REAL flow (1/3, 2/3, 3/3) instead of the platform default. The
dashboard stays password-first (the `beginIdentifierLogin`→`/auth/login/begin`
no-password path is dead — no such endpoint); arbitrary first-factor is a future
feature (verify.fivucsas also falls back to password). `AuthResponse` gained
`currentStep/totalSteps`; `checkLoginEligibility()` now returns the resolved
`LoginConfig | null`.

## Client-side face embedding (feature-flagged `VITE_CLIENT_SIDE_EMBEDDING`, default OFF)

The browser computes the **authoritative** Facenet512 face embedding locally and
uploads **only the 512-float vector** — the raw face image never leaves the device.
This replaces the legacy "pre-filter only, upload a JPEG, server embeds" path (the
old D1/D2 lock) when the flag is ON; with the flag OFF the legacy image path is
unchanged and is the default + fallback. See `docs/plans/CLIENT_SIDE_ML_PLAN.md` v3.0
(in the `docs` submodule) for the full strategy.

- **Embedding module:** `src/features/biometrics/embedding/embedCapturedFace.ts` —
  in-browser eye **aligner** (similarity transform to canonical eye coords) →
  DeepFace-parity preprocessing (aligned crop → aspect-preserving resize → centre
  black-pad 160×160 → `(1,160,160,3)` float32, **BGR**, **[0,1]**, `normalization=base`,
  NOT prewhiten) → Facenet512 via onnxruntime-web → L2-normalize. **Do NOT add a
  BGR→RGB swap** (it collapses cosine self-consistency).
- **Model delivery:** the FP16 `facenet512-<sha256>.onnx` (~47 MB) is fetched from
  `app.fivucsas.com/models/` via the same `fetch-models` / `manifest.json` SHA256
  pattern as YOLO/Silero, then cached download-once (Service Worker CacheFirst +
  IndexedDB, re-verify-on-read). INT8 is rejected (onnxruntime-web WASM lacks the
  quant ops); FP16 is the ship format.
- **Upload:** when the flag is ON the FACE MFA step (`MfaStepRenderer.tsx` /
  `FaceCaptureStep.tsx`) submits `{embedding[512]}` instead of an image; the server
  routes it to bio `/verify-embedding` (verify) / `/enroll-embedding` (enroll).
- **Ordering caveat:** flip the Identity Core `app.auth.client-side-embedding` flag
  **before** `VITE_CLIENT_SIDE_EMBEDDING` — web-ON + identity-OFF breaks FACE login
  (no image sent → legacy server path fails). Best fix = drive the web flag from
  login-config.
- **Privacy framing (honest):** the raw image is not transmitted; the only biometric
  data sent is a derived, non-invertible 512-d embedding, over TLS, stored encrypted
  (Fernet) — data minimization, NOT "biometric data never leaves the device".

## Puzzle as a first-class auth-flow layer (feature-flagged `app.auth.puzzle-layer`, default OFF)

The Biometric Puzzle is composable in the `AuthFlowBuilder` as its own LAYER (allowed
challenge types via checkboxes + count + difficulty + an `alsoMatchFaceIdentity` toggle),
not a FACE sub-component. `PuzzleStep.tsx` (`src/features/auth/login-shared/steps/`)
drives a **server-issued, single-use, anti-replay session**: it CREATEs a session
(`/auth/mfa/puzzle/session`), runs the SERVER-issued challenges with in-browser MediaPipe
detection, SUBMITs each challenge's landmark/gesture **traces** (no frames), and on
completion calls `verifyStep(PUZZLE, { puzzle_session_id })` — it submits ONLY the opaque
`session_id` (never a client-attested "passed" verdict). When identity-binding is on AND
`VITE_CLIENT_SIDE_EMBEDDING` is ON, it grabs a best frontal frame from the same live
session, computes the Facenet512 vector, and submits `{ puzzle_session_id, embedding }`
(raw image not sent) so liveness AND identity come from one capture. Contract:
`docs/superpowers/plans/2026-06-12-puzzle-session-convergence.md`.

## Key Patterns

- **i18n**: ALL strings use `t()` with keys in en.json + tr.json. NEVER hardcode English.
- **Error handling**: Use `formatApiError(err, t)` — NEVER show raw `err.message` to users.
- **WebAuthn base64**: Frontend `btoa()` = standard base64. Backend `decodeBase64()` normalizes to URL-safe.
- **Breadcrumbs**: `BREADCRUMB_I18N_MAP` in DashboardLayout.tsx with `t()` calls.
- **CSP**: Defined in BOTH `vite.config.ts` AND `public/.htaccess` — keep in sync.
- **Admin gating**: Sidebar.tsx filters by `user.isAdmin()`. ProtectedRoute for admin pages.
- **Platform tier (2026-05-30)**: trust the backend `userType` from `/auth/me`, not a
  role string. `user.isRoot()` = `userType === 'ROOT'` (role fallback only when `userType`
  is absent). The top tier is `UserRole.ROOT` (the old `SUPER_ADMIN` value is dropped;
  `fromJSON` still maps legacy `'SUPER_ADMIN'` → `ROOT` for older tokens). UI labels it
  **"Root"** via `utils/roleLabel.ts`. See `identity-core-api/docs/IDENTITY_ROLE_UNIFICATION.md`.

## Identity & account-linking UI (Phases 2/3/5, 2026-05-30)

Profile + TopBar surfaces for the Model-A identity layer (backend:
`identity-core-api/docs/IDENTITY_ACCOUNT_LINKING_DESIGN.md`):

- **Linked Accounts** (Profile, Phase 2): list/link/unlink the person's memberships via
  `GET /identity/me` + `/identity/link/initiate|confirm` + `/unlink`.
- **Biometric Consent** toggle (Profile, Phase 3, Model A): per-tenant grant/revoke via
  `GET/POST /identity/biometric/consents`; default-DENY, raw template never shared.
- **Account / workspace switcher** (TopBar, Phase 5): shown when `/identity/me` has >1
  membership; calls `POST /auth/switch-membership`, swaps tokens, reloads as the target
  membership. **Keep this distinct from the ROOT `X-Tenant-ID` data-switcher** — the
  account switcher changes WHO you are; `X-Tenant-ID` only re-scopes which tenant's DATA
  a ROOT user reads.

## Cross-device login UI (2026-05-30, PR #137)

Two usernameless login surfaces on the hosted login + dashboard login pages (backend:
`identity-core-api/docs` + the api CLAUDE.md "Cross-device / authenticator login" note):

- **"Sign in with a passkey"** button on `verify-app/HostedLoginApp.tsx` +
  `features/auth/components/LoginPage.tsx`. Calls `navigator.credentials.get()` with an EMPTY
  `allowCredentials` (discoverable/usernameless) against `POST /webauthn/passkey/authenticate-options`,
  then `POST /webauthn/passkey/authenticate`. The browser/OS handles the cross-device hybrid QR
  ("use your phone") — no companion app needed. Reuses `webauthn-utils.ts` (resolveChallenge,
  base64 helpers, mapWebAuthnError).
- **Approve-login initiator** (number-matching, no Firebase): kicks off
  `POST /auth/approve-login/session`, displays the **`matchNumber` as a STRING** (it is
  zero-padded, e.g. "07" — do NOT coerce to a number or leading zeros drop), polls for the
  approver's decision, then completes login. The approver side lives in the client-apps shared
  KMP stack (#53); the web side is the initiator.

The config-driven login work (in-flight, feature-flagged `app.auth.config-driven-login` default
OFF) will fold these into a single config-rendered login screen — internals land with their PRs.
See `ROADMAP_AUTH_2026-05-30.md`.

## Production Deployment (Hostinger)

```bash
npm run build
rsync -avz --delete -e "ssh -p 65002" dist/ u349700627@46.202.158.52:~/domains/app.fivucsas.com/public_html/
```

- URL: https://app.fivucsas.com
- API: `VITE_API_BASE_URL=https://api.fivucsas.com/api/v1` (in `.env.production`)
- SPA routing: `public/.htaccess` with RewriteEngine
- `connect-src` must include `https://api.fivucsas.com`

## PWA service worker — network-first app shell (2026-06-01)

The app-shell (the HTML document / navigation requests) is served **NETWORK-FIRST**,
configured in `vite.config.ts` (VitePWA `workbox` block). This is the fix for a
stale-shell bug: `index.html` is precached, and the previous
`navigateFallback: '/index.html'` registered a cache-first `NavigationRoute` that
served that **precached** shell for every navigation — so a fresh deploy (new
index.html → new hashed JS/CSS) never reached users until they hard-cleared the
browser cache.

Current strategy:
- **Navigations → NetworkFirst** via a `runtimeCaching` route whose function
  `urlPattern` is `({request}) => request.mode === 'navigate'`, `cacheName:
  'app-shell'`, `networkTimeoutSeconds: 3`, and `precacheFallback.fallbackURL:
  '/index.html'`. Online users always get the freshest `index.html` (and thus the
  newest hashed chunks); on a slow/flaky network the 3s timeout falls back to the
  app-shell cache; fully offline falls back to the **precached** `index.html`.
- `navigateFallback` is set to **`null`** (not merely omitted): vite-plugin-pwa
  injects a DEFAULT `navigateFallback: 'index.html'`, so it MUST be explicitly
  nulled or the cache-first `NavigationRoute` is re-registered and shadows the
  network-first route (silently re-introducing the bug). Keep it `null`.
- **Hashed JS/CSS/font assets stay precached + cache-first** (`globPatterns`
  unchanged) — they're immutable and load fast/offline; only the shell is
  network-first. The `api.fivucsas.com` NetworkFirst rule and
  `cleanupOutdatedCaches: true` are preserved; `skipWaiting`/`clientsClaim` are
  set explicitly so the new SW activates promptly (also implied by
  `registerType: 'autoUpdate'`).
- **generateSW-valid**: workbox-build 7.4.0 accepts a function `urlPattern`
  (`RouteMatchCallback`) and emits `registerRoute(<fn>, NetworkFirst, 'GET')` into
  `dist/sw.js`. Verify after any change: `npm run build` then grep `dist/sw.js`
  for the `"navigate"===…mode` → `NetworkFirst({cacheName:"app-shell"…})` route and
  confirm NO `NavigationRoute` / `createHandlerBoundToURL` remains.
- **SW cache headers (2026-06-03)**: `public/.htaccess` must serve `sw.js` +
  `registerSW.js` (fixed-name, NOT build-hashed) as `no-cache, must-revalidate`,
  via `<Files>` overrides placed AFTER the blanket `\.(js|css)$ → immutable` rule.
  Without this the SW script gets pinned `immutable, 1yr` and a new deploy's SW
  can never take over → users stuck on a stale build (observed 2026-06-03). Only
  these two fixed-name files are exempted; hashed `/assets/*` stay immutable.
- **One-time clear caveat**: users whose browser already installed the OLD
  cache-first SW need ONE cache clear (or for the old SW to update itself) to pick
  up this new SW. After that, all future deploys are fresh with no manual clear.
- **Reversible**: to revert, restore `navigateFallback: '/index.html'` and drop the
  app-shell `runtimeCaching` entry — pure config, no code changes.

## Known Issue

- **Mobile multi-tap**: Chrome/Brave on Android need 2-7 taps for fingerprint scanner. Logging added.

See CHANGELOG.md for historical fix logs. See TODO.md for integration audit.
