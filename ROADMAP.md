# FIVUCSAS Web App - Roadmap

> Last updated: 2026-04-16. Hosted-first auth pivot + Round-5 hardening.

## Current initiative: Hosted-first auth (PR-1)

**Branch:** `feat/hosted-first-auth-round5`
**Plan:** `docs/AUDIT_REPORT_2026-04-16.md` + `TODO.md` + `docs/plans/HOSTED_LOGIN_INTEGRATION.md`

### Why
Round-5 testing on Chrome Android surfaced structural iframe limits (Web NFC spec only runs top-level, Safari ITP, 3P cookie death). Industry pattern for serious IdPs is hosted-first redirect (Auth0 Universal Login, Okta, Microsoft Entra, Google, Apple, AWS Cognito, Keycloak, Stripe, all Turkish banks, e-Devlet). Backend OAuth 2.0 + OIDC stack is already production-grade — hosted login is mostly a frontend + deployment lift.

### PR-1 scope (Wave 1)
- **Shared bug fixes:** A1 method-reuse resilience, A2 mobile layout, A4 dashboard typo + notification i18n
- **New hosted surface:** `verify.fivucsas.com/login` top-level page, full OIDC code+PKCE flow, tenant branding header, RFC 8252 native-app redirect-URI support
- **Widget repositioning:** demoted to inline step-up MFA; NFC in framed context redirects to hosted
- **Demo flip:** BYS demo primary CTA becomes `loginRedirect()`, widget demoted to secondary
- **Admin i18n sweep:** AuditLogs/Roles/Tenants/RoleForm pages — 30+ hardcoded English strings wrapped in `t()`
- **Demo credentials removed** from LoginPage UI

### Verification checkpoints
1. Chrome Android → `demo.fivucsas.com` → "Yönlendirmeli giriş" → hosted MFA (NFC native) → redirect back with code+state → SDK exchanges → tokens
2. Turkish UI on all admin pages end-to-end
3. Dashboard notifications localized, no raw audit codes
4. OIDC RP conformance (code+PKCE profile) passes

### Subsequent waves
- **Wave 2 (PR-2):** unify LoginMfaFlow + MultiStepAuthFlow; backend DTO migration; admin `@PreAuthorize`; PKCE audit logging; native-app SDK docs
- **Wave 3 (PR-3):** 17-controller test coverage; `@Version` fields; JPA cascade refactor; CI i18n lint
- **Wave 4 (polish):** terminology sweep; API error catalog; tenant quickstart; CHANGELOG split; `console.log` purge; mobile table responsive breakpoints

---

## Historical: Auth Method & Enrollment Roadmap

### Phase 1: Fix Critical Gaps (Priority: Critical) — COMPLETE

- [x] Fix AuthMethodType case mismatch (IC1) — already UPPERCASE
- [x] Rebuild Enrollment model to match backend EnrollmentResponse (IC2+IC3)
- [x] Fix user list pagination for backend paginated response (IC4)
- [x] Add emailVerified/phoneVerified to User model (IC5)
- [x] Add auth-sessions link to sidebar navigation

### Phase 2: Build Missing Enrollment UIs (Priority: High) — COMPLETE

- [x] **WebAuthn/Hardware Key enrollment** — WebAuthnEnrollment.tsx with register/verify/complete flow
- [x] **Fingerprint enrollment** — FingerprintEnrollment.tsx wrapping WebAuthn platform mode
- [x] Connect TotpEnrollment.tsx to backend TotpController endpoints
- [x] Connect QrCodeStep.tsx to backend QrCodeController endpoints
- [x] Add Forgot Password link and flow to LoginPage

### Phase 3: Backend Feature Integration (Priority: High) — COMPLETE

- [x] Build Guest Management page (GuestsPage.tsx with invite/extend/revoke)
- [x] Fetch auth methods from backend (useAuthMethods hook with fallback)
- [x] Add Change Password form in Settings page
- [x] Use backend search endpoint for user list (debounced search)
- [x] Add Statistics export button (AnalyticsPage CSV export)
- [x] Build multi-role assignment UI for users (Select with multiple + checkboxes)
- [x] Fetch permissions from backend for role form

### Phase 4: Model Fixes & Polish (Priority: Medium) — COMPLETE

- [x] Fix DeviceResponse field name mismatches (IM1)
- [x] Fix AuthSessionResponse field mismatches (IM3)
- [x] Complete AuditLog action types filter — all 30 backend values (IM4)
- [x] Fix DI container service bindings (IM9)
- [x] Remove dead code: useCsrf hook deleted
- [ ] Enable Voice auth method when backend is ready (BLOCKED — backend stub)

---

## Remaining Items (Blocked on External Dependencies)

| Item | Blocker |
|------|---------|
| Voice auth enrollment (AE-3/AE-6) | Backend voice processing is stub |
| NFC document scan (AE-7) | Requires mobile app with NFC hardware |
| httpOnly cookies (IL8) | Backend must send Set-Cookie headers |
