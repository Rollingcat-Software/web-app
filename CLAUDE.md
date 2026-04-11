# CLAUDE.md - FIVUCSAS Web App

## Project Overview

React 18 / TypeScript 5 / Vite 8 admin dashboard for FIVUCSAS biometric identity platform.
Clean Architecture with InversifyJS dependency injection, Material-UI, Zod validation.

## Build & Run

```bash
npm install
npm run dev        # Dev server on port 3000
npm run build      # Production build
npm run test       # Run tests (Vitest)
npm run lint       # ESLint
```

Set `VITE_ENABLE_MOCK_API=true` in `.env.local` for offline development with mock data.

## Key Directories

- `src/features/auth/components/` - Auth step components (PasswordStep, FaceCaptureStep, etc.)
- `src/features/auth/hooks/` - Auth hooks
- `src/features/authFlows/` - Auth flow builder and management
- `src/core/repositories/` - API repository implementations
- `src/domain/models/` - Domain models (AuthMethod.ts, User.ts, etc.)
- `src/domain/interfaces/` - Service/repository interfaces
- `src/core/di/` - InversifyJS DI container and TYPES
- `src/pages/` - Page components

## Auth Method UI Components

All 10 auth methods have step components in `src/features/auth/components/`:
- PasswordStep, EmailOtpStep, SmsOtpStep, TotpStep, QrCodeStep
- FaceCaptureStep, FingerprintStep, VoiceStep, NfcStep, HardwareKeyStep

Enrollment UIs:
- FaceEnrollmentFlow.tsx - Multi-stage face enrollment with liveness
- TotpEnrollment.tsx - TOTP setup/verify/disable connected to backend TotpController

## Known Issues (March 2026)

### Auth method status (2026-03-28):
1. **Password** — WORKING
2. **Email OTP** — WORKING
3. **SMS OTP** — WORKING (NoOpSmsService, needs Twilio config)
4. **TOTP** — WORKING (enrollment + verification)
5. **Face** — WORKING (MediaPipe + DeepFace)
6. **QR Code** — WORKING (generate, display, polling, invalidate)
7. **Hardware Key** — WORKING (server challenge + WebAuthn assertion)
8. **Fingerprint** — WORKING (WebAuthn platform authenticator)
9. **Voice** — WORKING (Resemblyzer 256-dim in biometric-processor)
10. **NFC** — STUB (mobile-only, backend works, frontend placeholder)

### Enrollment page fixes (2026-04-04):
- ✅ **Enrollment status fix**: Backend `startEnrollment()` now auto-completes for non-biometric methods. Frontend creates enrollment records for TOTP and WebAuthn on success. "0 enrolled" counter now works correctly.
- ✅ **Face enrollment mobile UX**: Head turn threshold relaxed (0.12→0.08), blink detection relaxed, 12s stage timeout with auto-advance, larger instruction chip
- ✅ **WebAuthn credential delete**: New `/by-id/{uuid}` endpoint avoids base64url URL encoding issues
- ✅ **Floating notifications**: Replaced top-of-page Alerts with bottom-center Snackbar (auto-dismiss 4s)
- ✅ **Human-readable messages**: METHOD_LABELS map for all 9 method types, no more raw enum names
- ✅ **Better WebAuthn errors**: DOMException switch/case with mobile-friendly guidance
- ✅ **NFC unsupported toast**: Snackbar instead of invisible top Alert

### Fixed (2026-03-28):
- Fingerprint auth: WebAuthn assertion (was: credentials.create, now: credentials.get)
- HardwareKey auth: server-side challenge via onRequestChallenge callback (was: random local challenge)
- AuthSessionRepository.completeStep(): data wrapping fix — was sending flat data, now sends { data } (fixed ALL secondary auth methods)
- ESLint warnings: 42→38 (under max 40 cap)

### New pages and components (2026-03-28):
- **WidgetDemoPage** (`/widget-demo`) — live preview of embeddable auth widget
- **DeveloperPortalPage** (`/developer-portal`) — SDK documentation and integration guide
- **verify-app/** — standalone extracted auth widget components (`src/features/auth/components/verify-app/`)
- **sdk/** — @fivucsas/auth-js SDK module (`src/features/auth/components/sdk/`)
- **react/** — @fivucsas/auth-react components (`src/features/auth/components/react/`)

### Code Quality Refactoring (2026-04-08):
- **`src/features/auth/constants.ts`** — Centralized enums: `AuthMethodType`, `MfaStepStatus`, `MfaStepAction`, `StepStatus`, `WebAuthnErrorName`, `WEBAUTHN` constants, `AUTH_API` endpoints, `EASE_OUT` animation curve
- **`src/features/auth/webauthn-utils.ts`** — Shared WebAuthn utilities: `resolveChallenge()`, `mapWebAuthnError()`, `arrayBufferToBase64()`, `base64urlToBytes()`, `bytesToBase64url()`, `ChallengeResponse` type
- **FingerprintStep + HardwareKeyStep**: Refactored to use shared `resolveChallenge()`, `WEBAUTHN.*` constants, `EASE_OUT`/`ANIMATION` timing
- **TwoFactorDispatcher + LoginMfaFlow**: `AuthMethodType.*` enum in switch cases, `MfaStepStatus.*` for status checks, `AUTH_API.*` for endpoints, extracted `requestWebAuthnChallenge` helper (eliminates code duplication)
- **WebAuthnEnrollment**: 30+ hardcoded English strings → `t()` i18n (EN+TR), `WEBAUTHN.*` constants for algorithms/timeouts/transports, `AUTH_API.*` for endpoints, `mapWebAuthnError()` for consistent error handling
- **MethodPickerStep**: `hideNonEnrolled` prop, `flexShrink: 0` on cards/avatars/chips, `maxHeight: 60vh` scroll container
- **PasswordStep**: Zod validation messages use `t()` i18n
- **StepProgress**: Step labels visible on mobile (smaller font, truncated instead of hidden)
- **i18n**: Added `webauthn.*` (32 keys), `auth.validation.*` (3 keys), `mfa.sendOtpFailed` — all in EN+TR

### Widget UX Fixes (2026-04-08):
- **Scroll fix**: `overflowY: auto` + `py` padding on method picker parents, `maxHeight: 60vh` on method list
- **Non-enrolled methods hidden in widget** via `hideNonEnrolled` prop
- **Back to login button** in widget method picker phase
- **TwoFactorDispatcher** card widened 400→480px
- **SecondaryAuthFlow** verify container overflow `hidden`→`auto`
- **WebAuthn rpId fix**: FingerprintStep + HardwareKeyStep now get `rpId` from server challenge (`fivucsas.com`) instead of `window.location.hostname` — credentials work cross-subdomain
- **Backend WebAuthn MFA verification**: `/auth/mfa/step` FINGERPRINT/HARDWARE_KEY now does full cryptographic verification (was stub: `assertion != null`)
- **Backend challenge generation**: `action: "challenge"` in MFA step returns `{ status: "CHALLENGE", data: { challenge, rpId, timeout, allowCredentials } }`
- **Widget sends email** in completion payload (was N/A in BYS demo callback)
- **BYS demo callback**: Redirect timer 3s→10s

### WebAuthn / Auth Method Fixes (2026-04-11):
- **CRITICAL: Base64 encoding mismatch fixed** — Frontend `btoa()` produces standard base64 (`+/`), but `WebAuthnService.java` used `Base64.getUrlDecoder()` which rejects `/` (0x2F). Added `decodeBase64()` helper that normalizes standard→URL-safe. This was THE root cause of ALL WebAuthn verification failures since April.
- **MFA challenge now includes `allowCredentials`** — `AuthController.verifyMfaStep()` challenge response now returns user's credential IDs filtered by transport type (platform for FINGERPRINT, cross-platform for HARDWARE_KEY). Android Chrome needs explicit `allowCredentials` for non-discoverable credentials.
- **LoginMfaFlow.tsx `allowCredentials` extraction** — Widget login flow now reads `allowCredentials` from challenge response (was missing, unlike TwoFactorDispatcher which already had it).
- **FingerprintStep.tsx `waiting` state reset** — Added `setWaiting(false)` before `onSubmit()` on success path. Previously button stayed disabled after scan.
- **MultiStepAuthFlow.tsx field name fix** — Changed `{ fingerprintData: data }` → `{ assertion: data }` to match backend `data.get("assertion")`.
- **HardwareKeyStep.tsx base64 JSON encoding** — Now returns `btoa(JSON.stringify({...}))` string instead of plain object. All 4 callers updated to wrap as `{ assertion: data }`.
- **Enhanced WebAuthn error logging** — AuthController logs `data.keySet()` when assertion field is null/blank.

### Auth Method Audit (2026-04-11):
- **MFA path (TwoFactorDispatcher/LoginMfaFlow → POST /auth/mfa/step)**: ALL 10 methods field names MATCH ✅
- **Session path (MultiStepAuthFlow → POST /auth/sessions/{id}/steps/{order})**: 6 mismatches found:
  - EMAIL_OTP/SMS_OTP send: frontend `send_otp` vs handler `send`
  - FACE: FaceAuthHandler doesn't strip `data:image/jpeg;base64,` prefix
  - FINGERPRINT: `assertion` vs handler `fingerprintData`
  - HARDWARE_KEY: base64 blob vs handler reads individual fields
  - QR_CODE: `token` vs handler `qrToken`

### Fixes (2026-04-11 continued):
- **Face MFA camera FIXED**: Race condition — `getUserMedia()` ran before `<video>` element was in DOM (conditional on `cameraActive`). Added stream-attach useEffect + auto-start on mount.
- **NFC enrollment FIXED**: NfcController now auto-creates user_enrollments record. NFC_DOCUMENT added to AUTO_COMPLETE_TYPES. Hardcoded English in EnrollmentPage NFC replaced with t() i18n.
- **Session path B1-B6 FIXED**: All 6 backend handlers now accept both old and new field names.

### Known Issues (2026-04-11):
- **Mobile multi-tap**: Both Chrome and Brave on Android need 2-7 taps before fingerprint scanner appears. Console logging added to FingerprintStep (`[FingerprintStep]` prefix) to diagnose WebAuthn ceremony timing/retry behavior.
- ~~**Brave fingerprint**: "No passkey" error~~ — FIXED by base64 encoding fix. Brave fingerprint now works.

### Research Reports (2026-04-11):
- `docs/BIOMETRIC_FLOW_RESEARCH.md` (777 lines) — Full browser→DB trace for face/voice/fingerprint
- `docs/AUTH_TEST_VS_WEBAPP_ANALYSIS.md` (377 lines) — Forensic comparison auth-test vs web-app
- `docs/AUTH_METHOD_AUDIT.md` — Complete data contract audit across all 4 dispatchers × 2 backend paths

### Auth Widget / Verify App (2026-04-08):
- **LoginMfaFlow.tsx** — embedded login + N-step MFA flow component for widget mode
- **VerifyApp.tsx** — supports two modes: `session` (existing enrollment verification) and `login` (new login+MFA flow)
- **MultiStepAuthFlow.tsx** — all hardcoded English strings replaced with i18n (EN+TR)
- **SDK IIFE fix** — `new FivucsasAuth(...)` now works correctly in browser script tag
- **Deployed** to https://verify.fivucsas.com (Docker + nginx + Traefik)
- **SDK URL**: `https://verify.fivucsas.com/fivucsas-auth.js`
- BYS Demo updated to use official SDK from verify.fivucsas.com
- **VerificationFlowBuilderPage** (`/verification/flows`) — verification pipeline builder with template selector
- **VerificationDashboardPage** (`/verification/dashboard`) — completion rates, avg time, failure reasons
- **VerificationSessionDetailPage** (`/verification/sessions/:id`) — step-by-step results with confidence scores
- **VerificationRepository** — API client for verification pipeline CRUD
- **useVerification hook** — verification flow state management
- **Admin-only route guard** — ProtectedRoute pattern for admin pages (verification)
- **Widget-demo and developer-portal are now public routes** (AdminRoute removed, 2026-04-05)
- **SessionsSection** added to Settings page for cross-device session awareness (W16, i18n EN+TR)
- **Continuous Face Verification removed from Settings** (W24, duplicate enrollment feature removed)

### Verification pipeline (2026-03-28):
- Verification flow builder extends auth flow builder pattern for document/biometric verification
- Template selector with 5 industry templates (Banking KYC, Healthcare, Education, Government, Fintech)
- Per-step threshold configuration (face match %, liveness %)
- Session detail shows step-by-step results with confidence scores and document images

### Playwright E2E tests (2026-03-28):
- 28 Playwright spec files covering verification pages, auth flows, and admin pages
- Verification flow builder E2E test
- Verification dashboard E2E test

### CI/CD (2026-03-28):
- Playwright E2E workflow added to GitHub Actions (`playwright.yml`)
- E2E test failures reduced: 54→0
- Current test counts: 304 unit (Vitest), 28 Playwright spec files
- Android CI and iOS CI GitHub Actions workflows added

### Connected (March 2026):
- TotpEnrollment.tsx connected to backend TotpController (setup, verify, status, disable)
- QrCodeStep.tsx connected to backend QrCodeController (generate, invalidate, countdown, auto-refresh)
- GuestsPage.tsx with sidebar link, route, i18n (invite, extend, revoke)
- ForgotPasswordPage + ResetPasswordPage with routes
- AnalyticsPage CSV export
- AuditLog filter dropdown has all 30 backend action types
- OtpManagement.tsx in SettingsPage (email/SMS OTP send/verify)
- StepUpDeviceRegistration.tsx in SettingsPage (device register, challenge, verify)
- useAuthMethods hook fetches from backend with DEFAULT_AUTH_METHODS fallback
- TenantRepository.findBySlug() for slug-based lookup
- Per-user enrollment endpoints (findByUserId, createForUser, deleteForUser) + useUserEnrollments hook
- DashboardStats.exportFormats field, AuthFlowResponse.stepCount field
- BiometricService documented as direct-call (not proxied)
- NotificationPanel documented as audit-log polling interim
- FingerprintStep.tsx: WebAuthn assertion flow (credentials.get) for platform authenticators
- HardwareKeyStep.tsx: server-side challenge via onRequestChallenge callback + WebAuthn assertion
- AuthSessionRepository.completeStep(): proper { data } wrapping for all secondary auth methods
- VoiceStep.tsx: Resemblyzer 256-dim voice verification via biometric-processor
- All 10 auth step components wired to backend (9 working, NFC stub)
- Liveness 415 fix: explicit multipart Content-Type header for face upload
- Quality score display fix in face capture step
- Profile menu and card type display fixes
- Login page cleanup (removed debug elements)
- Hardware key info tooltip added

### Model alignment with backend (all resolved):
- AuthMethodType UPPERCASE, Enrollment fields, EnrollmentStatus enum, User pagination, DeviceResponse fields
- OperationType 9 values verified matching backend enum exactly
- All model mismatches from integration audit resolved

### Production deployment (Hostinger, last deployed 2026-04-05):
- URL: https://app.fivucsas.com
- API: `VITE_API_BASE_URL=https://api.fivucsas.com/api/v1` (in `.env.production`)
- Deploy: `npm run build` → `rsync dist/ u349700627@46.202.158.52:~/domains/app.fivucsas.com/public_html/` (SSH port 65002, password in .env.prod)
- SPA routing: `public/.htaccess` with RewriteEngine
- CSP: defined in **both** `vite.config.ts` (meta tag injected into index.html at build time) AND `public/.htaccess` (HTTP header). Both must be kept in sync. The meta tag takes precedence in browsers.
- ⚠️ `connect-src` must include `https://api.fivucsas.com` — NOT `api-fivucsas` (that domain doesn't exist)

### Critical fixes applied (2026-03-16):
- **CSP domain** in `vite.config.ts` and `public/.htaccess` changed from `api.fivucsas.com` to `api.fivucsas.com`
- Added `api.qrserver.com` to connect-src for TOTP QR code generation
- Added `camera=(self)` to Permissions-Policy so face capture works
- Added `blob:` to `media-src` and `worker-src`

### UI/UX audit fixes (2026-03-16, all resolved):
- **P0 ✅**: Dashboard — AdminDashboardContent extracted; non-admin sees info message, no API calls made
- **P0 ✅**: Settings — SettingsRepository returns defaults on 403; profile names pre-populated from auth state
- **P1 ✅**: "Check your email" card shown after registration with OTP instructions
- **P2 ✅**: Page `<title>` now updates per route via PageTitle component in App.tsx
- **P2 ✅**: Duplicate dark mode toggle removed from Settings Appearance (TopBar is authoritative)
- **P3 ✅**: Breadcrumb labels added for all routes (auth-flows, devices, user-enrollment → "Identity Enrollment", etc.)
- **P3 ✅**: Date of birth field shows format hint + respects html lang attribute

See TODO.md for full integration audit (38 items, only AE-7 + IL8 remain — blocked on external deps).

### Security fixes (2026-03-16):
- **Email OTP enforcement**: RegisterPage now captures registration JWT token, shows 6-digit OTP
  input after registration, and calls `/auth/verify-email` with Bearer token before allowing login.
  "Skip for now" fallback still available. Fixed response access: `response.data.accessToken`
  (HttpResponse wraps data in `.data` property).
- **Admin nav gating**: Sidebar.tsx filters menu items by `user.isAdmin()` — non-admins no longer
  see admin-only routes, eliminating 403 flood in browser console.
- **CSP fix**: Added `cdn.jsdelivr.net` to `script-src` in both `vite.config.ts` and `.htaccess`
  so MediaPipe face detection loads without being blocked.
