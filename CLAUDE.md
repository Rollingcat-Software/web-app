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

- `src/features/auth/components/` - Auth step components (10 methods) + enrollment UIs
- `src/features/auth/constants.ts` - Centralized enums: AuthMethodType, MfaStepStatus, WEBAUTHN, AUTH_API
- `src/features/auth/webauthn-utils.ts` - Shared WebAuthn: resolveChallenge, mapWebAuthnError, base64 helpers
- `src/features/authFlows/` - Auth flow builder and management
- `src/core/repositories/` - API repository implementations
- `src/domain/models/` - Domain models
- `src/core/di/` - InversifyJS DI container and TYPES
- `src/pages/` - Page components (17 pages)
- `src/utils/formatApiError.ts` - Centralized HTTP error → i18n message mapping
- `src/verify-app/` - Embeddable auth widget (LoginMfaFlow, VerifyApp, SDK)

## Auth Methods (ALL 10 WORKING)

Step components in `src/features/auth/components/`:
PasswordStep, EmailOtpStep, SmsOtpStep, TotpStep, QrCodeStep,
FaceCaptureStep, FingerprintStep, VoiceStep, NfcStep, HardwareKeyStep

## Key Patterns

- **i18n**: ALL strings use `t()` with keys in en.json + tr.json. NEVER hardcode English.
- **Error handling**: Use `formatApiError(err, t)` — NEVER show raw `err.message` to users.
- **WebAuthn base64**: Frontend `btoa()` = standard base64. Backend `decodeBase64()` normalizes to URL-safe.
- **Breadcrumbs**: `BREADCRUMB_I18N_MAP` in DashboardLayout.tsx with `t()` calls.
- **CSP**: Defined in BOTH `vite.config.ts` AND `public/.htaccess` — keep in sync.
- **Admin gating**: Sidebar.tsx filters by `user.isAdmin()`. ProtectedRoute for admin pages.

## Production Deployment (Hostinger)

```bash
npm run build
rsync -avz --delete -e "ssh -p 65002" dist/ u349700627@46.202.158.52:~/domains/app.fivucsas.com/public_html/
```

- URL: https://app.fivucsas.com
- API: `VITE_API_BASE_URL=https://api.fivucsas.com/api/v1` (in `.env.production`)
- SPA routing: `public/.htaccess` with RewriteEngine
- `connect-src` must include `https://api.fivucsas.com`

## Known Issue

- **Mobile multi-tap**: Chrome/Brave on Android need 2-7 taps for fingerprint scanner. Logging added.

See CHANGELOG.md for historical fix logs. See TODO.md for integration audit.
