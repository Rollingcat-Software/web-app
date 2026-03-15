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

See TODO.md for full integration audit (38 items, only AE-2/3/6/7 + IL8 remain — blocked on external deps).
