# Changelog - FIVUCSAS Web App

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
