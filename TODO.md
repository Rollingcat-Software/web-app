# FIVUCSAS TODO — Round-5 Hardening + Hosted-First Auth

> Source of truth for current sprint. Derived from `docs/AUDIT_REPORT_2026-04-16.md` and Round-5 testing. Update as items close.

**Current branch:** `feat/hosted-first-auth-round5`
**Target PR:** PR-1 (Wave 1) — **IN REVIEW: needs revision before merge**
**Last updated:** 2026-04-16

---

## PR-1 Review Blockers (2026-04-16) — post-demo sprint, ~1 focused day

> Consolidated from three independent review passes (Copilot inline on identity-core-api#16, backend reviewer, web-app reviewer) + the 5-agent audit. Order: security show-stopper first, then security correctness, then code quality. **Must land before PR-1 merges.**

### Show-stopper (anonymous endpoint auth chain)
- [ ] **B1 — SecurityConfig.java:86-91** add `/oauth2/authorize/complete` and `/oauth2/clients/*/public` to the `permitAll()` chain. New endpoints are currently caught by the default `authenticated()` rule so every hosted-login hit returns 401 before it reaches the controller. 2-line diff, 5 minutes, zero risk. *Unit tests with `addFilters=false` missed this; add an integration test that hits the real SecurityFilterChain.*

### Security correctness
- [ ] **B2 — OAuth2Controller.authorizeComplete** bind `clientId` to `MfaSession` when the session is created. Today `/authorize/complete` accepts any completed MfaSession for any clientId belonging to the same tenant → cross-client code replay within the tenant. Add `mfa_sessions.client_id` column + check at complete-time.
- [ ] **B3 — OAuth2Controller.authorizeComplete** require PKCE S256 when `OAuth2Client.confidential == false`. RFC 6749+RFC 7636; hosted login flow is a public-client surface by design.
- [ ] **B4 — OAuth2Controller.authorizeComplete** atomicity: code-mint + `mfaSessionRepository.delete(session)` must be `@Transactional`, and the session must carry a `consumedAt` timestamp so a crash between the two calls doesn't leave the session replayable. Current order mints the code first; if delete fails, attacker with session token can mint again.
- [ ] **B5 — OAuth2Client.matchesLoopbackRegistration** (a) reject query-param smuggling (`http://127.0.0.1:*` must match host+port only, never query string); (b) drop `localhost` hostname entirely — RFC 8252 §7.3 says loopback IP literal only.
- [ ] **B7 — FivucsasAuth.handleRedirectCallback** validate `nonce` against the `id_token` claim (OIDC §3.1.3.7). Today nonce is stored in sessionStorage and never checked after issuance → ID token replay from another session. Either implement the check or remove nonce handling so we don't pretend to protect.
- [ ] **B9 — .htaccess + vite.config.ts** split CSP `frame-ancestors` per route: `/login` must be `'none'` (hosted page must not be framable — prevents click-jacking against the password field); widget routes keep the existing allowlist. Add runtime frame-bust (`if (window.top !== window.self) window.top.location = window.location`) to `HostedLoginApp.tsx` as defense-in-depth.

### Code quality
- [ ] **B6 — OAuth2Client.splitRegisteredRedirectUris** replace the string-splitting parser with Jackson `ObjectMapper.readValue(..., new TypeReference<List<String>>(){})`. Today a URI containing a comma would silently corrupt the allowlist.
- [ ] **B8 — HostedLoginApp.tsx** test coverage: missing-params (no `client_id`), invalid-client (revoked tenant), expired MFA session, happy-path (code → `/authorize/complete` → `window.location.replace`), and redirect URL shape (`?code=&state=` formatted correctly). Component is security-sensitive and currently has zero tests.

### Smaller fixes surfaced in review (same sprint, minutes each)
- [ ] Validate `redirectUri` scheme (http/https/custom) before `window.location.replace` in `FivucsasAuth.handleRedirectCallback` — even though backend validates, belt-and-suspenders against XSS in stored state.
- [ ] `/oauth2/authorize/complete` 403 → 400 on tenant-mismatch. OAuth error responses are 400 per RFC 6749 §5.2; 403 leaks policy info to unauthenticated callers.
- [ ] Remove `isHtmlAccept` branch from `OAuth2Controller.authorize` (redundant with `display=page` now that SDK always sets it explicitly; reduces conditional surface).
- [ ] Add `Retry-After` header on the `/authorize/complete` rate-limit 429 branch so well-behaved clients back off correctly.
- [ ] Derive `completedMethods` from `MfaSession.getCompletedMethods()` in the initial `/auth/login` response instead of the current hardcoded `[PASSWORD]` — the hardcoded value assumes password-first, which breaks for tenants whose first step is NOT password.

---

## Audit-surfaced items (this week, parallel to blocker fixes)

> Not PR-1-merge-blocking but called out by the 5-agent audit (docs/AUDIT_REPORT_2026-04-16.md). Grades: **hygiene B+ / security A- / compliance B-**.

- [ ] **Compliance — GDPR/KVKK export + soft-delete purge**: UI exists (`ProfilePage.tsx` → export button), backend endpoint `/users/{id}/export` does NOT. Soft-delete purge job (30-day retention) missing entirely. *Matrix row: GDPR Art. 17/20 = GAP.*
- [ ] **OIDC discovery** — `.well-known/openid-configuration` endpoint exists but needs verification against conformance suite (code + id_token + PKCE S256 + JWKS reachable).
- [ ] **`.gitignore`** verify-widget/html/assets/*.js — bundle artifacts currently tracked. Purge from history after adding ignore.
- [ ] **Lazy-load ONNX Runtime + BlazeFace** via dynamic `import()` so the face capture bundle (~8MB) doesn't hit the critical path for users who never use face auth.
- [ ] **`oauth2_clients.tenant_id` index** — query plan shows seq scan on tenant lookup; hot path during `/authorize`.
- [ ] **CI speed** — Maven `<parallel>` + Vitest `--pool=threads --poolOptions.threads.maxThreads=4` to halve CI wall-clock.
- [ ] **Stuck Deploy-to-Hetzner run** — self-hosted runner queued 8h+; clear queue, investigate runner registration.

---

## Wave 0 — Immediate ops (awaiting user go-ahead)

- [ ] **Rotate all production secrets** (DB password, Redis password, JWT secret, Twilio auth token, biometric API key)
- [ ] **Purge secrets from git history** via `git filter-repo` on identity-core-api, biometric-processor, web-app
- [ ] **Move secrets to runtime injection** — GitHub Actions secrets for CI, `--env-file .env.prod` for Docker
- [ ] **Tighten `bio.fivucsas.com` Traefik labels** — add `rate-limit` + `admin-whitelist` middlewares

---

## Wave 1 — PR-1: Hosted-first V1 + shared bug fixes

### Part A — Shared bug fixes (ship in both widget + hosted modes)

#### A1. Method-reuse resilience
- [x] Frontend type extensions — `IAuthRepository.ts` `MfaStepResponse.completedMethods`, `AuthResponse.completedMethods`
- [x] Frontend hydration — `LoginMfaFlow.tsx` merges `completedMethods` from all responses into `usedMethods`
- [ ] Backend echo — `AuthController.java` STEP_COMPLETED response (~line 893-899) adds `completedMethods: mfaSession.getCompletedMethods()`
- [ ] Backend echo — initial `/auth/login` response when `twoFactorRequired=true` adds `completedMethods`
- [ ] `AuthSessionRepository.ts` response type extension

#### A2. Mobile layout
- [x] `VerifyApp.tsx` root Box flex column + responsive padding
- [x] `MethodPickerStep.tsx:80` drop `maxHeight:'60vh'` + `overflowY:'auto'`
- [x] `sdk/FivucsasAuth.ts` iframe CSS `min-height:560px; height:auto` + `allow-popups-to-escape-sandbox`
- [ ] `QrCodeStep.tsx` root Box — strip `height:'100%'` / `flex:1`
- [ ] `VoiceStep.tsx` root Box — same simplification
- [ ] Confirm `useResizeObserver.ts:26` observes `document.body` (done)

#### A4. Dashboard typos + notification i18n
- [x] `tr.json:567` — `Kullanım Koşullları` → `Kullanım Koşulları`
- [x] `tr.json` + `en.json` added `MFA_STARTED`, `MFA_STEP_COMPLETED`, `MFA_STEP_FAILED`, `MFA_COMPLETE`
- [x] `NotificationPanel.tsx:53-64` MFA codes mapped to 'login' category
- [ ] Audit sweep — grep backend `saveAuditLog("<CODE>"` and cross-check all codes have i18n keys in both locales

### Part B — Hosted login V1 (primary new surface)

#### B.1 Backend — OAuth2 content negotiation
- [ ] `OAuth2Controller.authorize` — add `display=page` branch → 302 to `verify.fivucsas.com/login?<params>`
- [ ] `POST /oauth2/authorize/complete` — NEW endpoint; accepts `{mfaSessionToken, clientId, redirectUri, scope, state?, nonce?, codeChallenge, codeChallengeMethod}`; validates + mints code via existing `OAuth2Service.generateAuthorizationCode()`; returns `{code, state, redirectUri}`
- [ ] `GET /oauth2/clients/{clientId}/public` — NEW; returns `{clientName, logoUrl?, homepageUrl?}` for tenant branding header
- [ ] Extend `OAuth2Client.isRedirectUriAllowed()` — support custom schemes (`com.acme://auth`) + loopback wildcard (`http://127.0.0.1:*`) per RFC 8252
- [ ] `RateLimitInterceptor` — register 2 new paths

#### B.2 Frontend — HostedLoginApp
- [ ] `HostedLoginApp.tsx` NEW (~200 LOC) — top-level shell at `/login`, wraps `LoginMfaFlow`, fetches tenant branding, POSTs to `/oauth2/authorize/complete` on completion, `window.location.replace`
- [ ] `main.tsx` — mount `<HostedLoginApp />` when pathname is `/login`
- [ ] `VerifyApp.tsx` — extend `WidgetMode` union; mode detection via `window.top === window.self && pathname === '/login'`
- [ ] Graceful handling of missing `client_id`, revoked tenant, expired MFA session

#### B.3 SDK — loginRedirect
- [ ] `FivucsasAuth.loginRedirect({ redirectUri, scope?, state?, nonce? })` — generates PKCE S256, sessionStorage, `window.location.assign`
- [ ] `FivucsasAuth.handleRedirectCallback()` — parses `?code=&state=`, validates state, POSTs to `/oauth2/token`, returns tokens
- [ ] PKCE helper — `generatePkce()` using WebCrypto SubtleCrypto
- [ ] State generator — 32-byte cryptographically random base64url
- [ ] Preserve existing `verify()` for step-up use case

#### B.4 Demo + tenant docs
- [ ] `bys-demo/index.html` — flip primary CTA to `loginRedirect()`; demote widget to "İnline MFA (gelişmiş)" button; rename brand "Marmara Üniversitesi BYS" → "Örnek Üniversite Portalı"
- [ ] `bys-demo/callback.html` NEW — calls `handleRedirectCallback()`
- [ ] `bys-demo/dashboard.html` — same rename
- [ ] `docs/plans/HOSTED_LOGIN_INTEGRATION.md` NEW — tenant integration recipe, PKCE walkthrough, redirect-URI registration, state/nonce, troubleshooting

### Part C — Widget repositioning (light touch)

- [ ] `NfcStep.tsx` — detect `window.top !== window.self`; render fallback card "Tarayıcıda yeni sekmede tamamla" opening hosted login URL
- [ ] i18n keys `mfa.nfc.framedTitle`, `mfa.nfc.framedBody`, `mfa.nfc.framedCta`, `mfa.nfc.framedSecondary` (tr+en)
- [ ] `docs/EMBEDDABLE_AUTH_WIDGET_ARCHITECTURE.md` — rewrite to position widget as step-up MFA only; recommend hosted for full auth

### Part D — Dashboard P0 i18n fixes (Wave 1 essential)

- [ ] `AuditLogsPage.tsx` — wrap all 12 hardcoded strings in `t()` + keys in tr/en
- [ ] `RolesListPage.tsx` — wrap all 10 hardcoded strings
- [ ] `TenantsListPage.tsx` — wrap all 8 hardcoded strings
- [ ] `RoleFormPage.tsx` — wrap hardcoded alert
- [ ] `useLivenessPuzzle.ts` — i18n-wrap action instructions
- [ ] Dashboard dates — `.toLocaleString(i18n.language, ...)` across `AnalyticsPage`, `VerificationDashboardPage`, `DashboardPage`
- [ ] `LoginPage.tsx` — remove demo credentials from UI
- [ ] Swallowed-catch fixes — `EnrollmentPage.tsx:354`, `MultiStepAuthFlow.tsx:97-99` log errors properly

---

## Wave 2 — PR-2 backlog

- [ ] Unify `LoginMfaFlow` + `MultiStepAuthFlow` (~1000 LOC dedup)
- [ ] Backend DTO migration — replace 135 `Map.of()` responses with typed DTOs
- [ ] Unified `ErrorResponse` DTO across OAuth + Auth controllers
- [ ] Admin endpoint `@PreAuthorize("@rbac.isTenantAdmin()")` on `TenantController`, `RoleController`, `AdminOverviewController`
- [ ] PKCE failure audit logging + rate limit
- [ ] SDK `loginRedirect` → native-app docs (iOS AppAuth, Android Custom Tabs, Electron AppAuth-JS)
- [ ] SDK `CHANGELOG.md` separated from web-app

## Wave 3 — PR-3 backlog

- [ ] 17 backend controllers `@WebMvcTest` coverage
- [ ] `@Version` on `User`, `AuthFlow`, `Tenant`
- [ ] Refactor `CascadeType.ALL` → `PERSIST, MERGE` + explicit service-layer deletion
- [ ] `AuthFlowStep.alternativeMethods` `FetchType.EAGER` → LAZY
- [ ] `@Transactional(readOnly=true)` sweep on 50+ query services
- [ ] CI i18n lint rule — reject untranslated English in `.tsx` via ESLint custom rule

## Wave 4 — Polish backlog

- [ ] Terminology sweep (MFA vs 2FA vs multi-step)
- [ ] `docs/04-api/ERROR_CODES.md` NEW
- [ ] `docs/guides/tenant-integration/QUICKSTART.md` NEW
- [ ] `docs/06-deployment/FEATURE_FLAGS.md` NEW
- [ ] Align `package.json` version with README
- [ ] `console.log` purge in auth paths (`VoiceStep`, `FingerprintStep`)
- [ ] `aria-describedby` sweep on form pages
- [ ] Mobile table responsive breakpoints (`AuditLogs`, `Roles`, `Tenants`)
- [ ] Magic-number style tokens → theme
- [ ] Request timeouts on `fetch()` in `useLivenessPuzzle.ts`, `VoiceEnrollmentFlow.tsx`, `useBankEnrollment.ts`

---

## Completed this session (moved from above when PR-1 merges)

See `CHANGELOG.md [Unreleased]` section.

## Open tickets reference

- Audit full report: `docs/AUDIT_REPORT_2026-04-16.md`
- Architecture plan: `docs/plans/HOSTED_LOGIN_INTEGRATION.md` (NEW in PR-1)
- Session logs: `memory/project_session_2026041*.md`
