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

Enrollment UIs (only 2 exist):
- FaceEnrollmentFlow.tsx - Multi-stage face enrollment with liveness
- TotpEnrollment.tsx - TOTP secret generation and QR code (disconnected from backend)

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

### Disconnected components:
- TotpEnrollment.tsx not connected to backend TotpController
- QrCodeStep.tsx not using backend QrCodeController endpoints
- Auth sessions page exists but has no sidebar navigation link

### Model mismatches with backend:
- AuthMethodType uses UPPERCASE which matches backend (IC1 - resolved)
- Enrollment domain model fields now match backend EnrollmentDto (IC2 - resolved)
- EnrollmentStatus enum aligned in both types/index.ts and domain model (IC3 - resolved)
- User pagination works - backend returns paginated format, UserRepository handles both formats (IC4 - resolved)
- DeviceResponse field names aligned via @JsonProperty in backend (IM1 - resolved)

See TODO.md for full integration audit (38+ items).
