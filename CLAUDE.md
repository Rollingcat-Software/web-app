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
- `src/features/auth/constants.ts` - Centralized enums: AuthMethodType, MfaStepStatus, WEBAUTHN, AUTH_API
- `src/features/auth/webauthn-utils.ts` - Shared WebAuthn: resolveChallenge, mapWebAuthnError, base64 helpers
- `src/features/authFlows/` - Auth flow builder and management. The builder
  (`AuthFlowBuilder.tsx`) treats **password as a normal removable + reorderable
  method** (no mandatory-password lock), supports **CHOICE steps** (pick N
  one-of alternative methods per step → `alternativeMethodTypes`) and a
  **usernameless Layer-1 toggle** gated by `AuthMethod.supportsUsernameless`.
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
- `Layer1Shortcuts.tsx` renders the usernameless shortcuts (passkey / approve)
  **strictly per the config when it positively declares a usernameless Layer-1
  method**; when it declares none (null config OR the flag-OFF password-first
  shape) `fallbackAll` keeps today's passkey + approve buttons.
- **Reversibility**: the UI is 100% config-driven + always has the
  email+password fallback, so flipping the API flag OFF (which returns the
  current password-first shape) reverts the whole feature with **no web
  redeploy**. Don't bake the new behaviour into the components.

Contract is provisional (api task #16): the client normalizer absorbs
field/casing deltas and never hard-fails.

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
