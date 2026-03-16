# CLAUDE.md - FIVUCSAS Web App

## Project Overview

React 18 / TypeScript 5 admin dashboard for FIVUCSAS biometric identity platform.
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

### MISSING enrollment UIs:
1. **Hardware Key (WebAuthn)** - Backend ready (WebAuthnController), needs enrollment component
2. **Fingerprint** - Could use WebAuthn platform authenticators, needs enrollment component
3. **Voice** - Backend is stub, needs both backend and frontend work
4. **NFC Document** - Platform dependent, mobile only

### BROKEN at runtime:
- Fingerprint auth always fails (biometric-processor stub)
- Voice auth disabled (`isActive: false` in DEFAULT_AUTH_METHODS)
- NFC shows "not available on this device" placeholder

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

### Model alignment with backend (all resolved):
- AuthMethodType UPPERCASE, Enrollment fields, EnrollmentStatus enum, User pagination, DeviceResponse fields
- OperationType 9 values verified matching backend enum exactly
- All model mismatches from integration audit resolved

### Production deployment (Hostinger, 2026-03-16):
- URL: https://ica-fivucsas.rollingcatsoftware.com
- API: `VITE_API_BASE_URL=https://auth.rollingcatsoftware.com/api/v1` (in `.env.production`)
- Deploy: `npm run build` → `rsync dist/ u349700627@46.202.158.52:~/domains/ica-fivucsas.rollingcatsoftware.com/public_html/` (SSH port 65002, password in .env.prod)
- SPA routing: `public/.htaccess` with RewriteEngine
- CSP: defined in **both** `vite.config.ts` (meta tag injected into index.html at build time) AND `public/.htaccess` (HTTP header). Both must be kept in sync. The meta tag takes precedence in browsers.
- ⚠️ `connect-src` must include `https://auth.rollingcatsoftware.com` — NOT `api-fivucsas` (that domain doesn't exist)

### Critical fixes applied (2026-03-16):
- **CSP domain** in `vite.config.ts` and `public/.htaccess` changed from `api-fivucsas.rollingcatsoftware.com` to `auth.rollingcatsoftware.com`
- Added `api.qrserver.com` to connect-src for TOTP QR code generation
- Added `camera=(self)` to Permissions-Policy so face capture works
- Added `blob:` to `media-src` and `worker-src`

### Known UI/UX bugs (see `UI_UX_AUDIT_REPORT.md`):
- **P0**: Dashboard shows 403 to non-admin users (no role check before stats API call)
- **P0**: Settings shows 403 (user settings endpoint scope issue)
- **P1**: Profile name fields empty after login (not pre-populated from auth state)
- **P1**: No "check your email" step shown after registration

See TODO.md for full integration audit (38 items, only AE-2/3/6/7 + IL8 remain — blocked on external deps).
