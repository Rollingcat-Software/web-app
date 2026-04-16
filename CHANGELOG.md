# Changelog - FIVUCSAS Web App

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
