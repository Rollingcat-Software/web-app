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
- `src/features/auth/constants.ts` - Centralized enums: AuthMethodType, MfaStepStatus, WEBAUTHN, AUTH_API
- `src/features/auth/webauthn-utils.ts` - Shared WebAuthn: resolveChallenge, mapWebAuthnError, base64 helpers
- `src/features/authFlows/` - Auth flow builder and management
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
