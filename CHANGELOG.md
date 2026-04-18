# Changelog - FIVUCSAS Web App

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
