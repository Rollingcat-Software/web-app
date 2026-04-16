# FIVUCSAS TODO — Round-5 Hardening + Hosted-First Auth

> Source of truth for current sprint. Derived from `docs/AUDIT_REPORT_2026-04-16.md` and Round-5 testing. Update as items close.

**Current branch:** `main`
**Target PR:** PR-1 (Wave 1) — ✅ **MERGED 2026-04-16** (identity-core-api#16 + web-app#22)
**Last updated:** 2026-04-16

---

## PR-1 Review Blockers — ✅ ALL MERGED 2026-04-16

> All nine blockers + smaller fixes landed in identity-core-api#16 (merged `8059ca9`) and web-app#22 (merged `048de42`). History preserved via merge-commit strategy; see CHANGELOG.md for per-blocker commit hashes.

### Show-stopper — done
- [x] **B1** SecurityConfig permitAll `/oauth2/authorize/complete` + `/oauth2/clients/*/public` + real SecurityFilterChain integration test (V34/V35/V36 Flyway stack applied)

### Security correctness — done
- [x] **B2** client_id bound to MfaSession (V36 migration)
- [x] **B3** PKCE S256 mandated for public clients (V34 `confidential` column)
- [x] **B4** @Transactional code-mint + V35 `consumed_at` replay guard
- [x] **B5** IPv4-only loopback + any-query rejected (RFC 8252 §7.3)
- [x] **B7** nonce validation against id_token claim + redirect URI scheme allowlist
- [x] **B9** per-route CSP `frame-ancestors` + runtime frame-bust

### Code quality — done
- [x] **B6** Jackson `ObjectMapper.readValue` for redirect URIs
- [x] **B8** HostedLoginApp.tsx end-to-end test coverage (407 LOC)

### Smaller fixes — done
- [x] redirectUri scheme validation in `handleRedirectCallback`
- [x] tenant-mismatch 403 → 400
- [x] `isHtmlAccept` branch removed
- [x] `Retry-After` header on 429
- [x] `completedMethods` derived from MfaSession

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

#### A1. Method-reuse resilience — ✅ shipped in PR-1
- [x] Frontend type extensions — `IAuthRepository.ts` `MfaStepResponse.completedMethods`, `AuthResponse.completedMethods`
- [x] Frontend hydration — `LoginMfaFlow.tsx` merges `completedMethods` from all responses into `usedMethods`
- [x] Backend echo — `AuthenticateUserService.java` derives `completedMethods` from `MfaSession.getCompletedMethods()`
- [x] Backend echo — initial `/auth/login` response when `twoFactorRequired=true` includes `completedMethods`
- [x] `AuthSessionRepository.ts` response type extension

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

### Part B — Hosted login V1 (primary new surface) — ✅ shipped in PR-1

#### B.1 Backend — OAuth2 content negotiation — done
- [x] `OAuth2Controller.authorize` `display=page` branch → 302 to `verify.fivucsas.com/login`
- [x] `POST /oauth2/authorize/complete` — endpoint live, validates + mints code
- [x] `GET /oauth2/clients/{clientId}/public` — returns branding metadata
- [x] `OAuth2Client.isRedirectUriAllowed()` — HTTPS + custom schemes + RFC 8252 loopback
- [x] `RateLimitInterceptor` paths registered

#### B.2 Frontend — HostedLoginApp — done
- [x] `HostedLoginApp.tsx` top-level shell at `/login` with tenant branding fetch + POST to `/authorize/complete`
- [x] `main.tsx` routes `<HostedLoginApp />` by pathname
- [x] `VerifyApp.tsx` WidgetMode union extended; hosted detection wired
- [x] Graceful missing-params / revoked-tenant / expired-session handling

#### B.3 SDK — loginRedirect — done
- [x] `FivucsasAuth.loginRedirect()` with PKCE S256 + state + nonce + sessionStorage
- [x] `FivucsasAuth.handleRedirectCallback()` with state + nonce validation
- [x] PKCE helper via WebCrypto SubtleCrypto
- [x] 32-byte crypto-random base64url state generator
- [x] `verify()` preserved for step-up use case

#### B.4 Demo + tenant docs — partial
- [ ] `bys-demo/index.html` flip primary CTA to `loginRedirect()` (demo still uses widget)
- [ ] `bys-demo/callback.html` NEW — calls `handleRedirectCallback()`
- [ ] `bys-demo/dashboard.html` brand rename
- [x] `docs/plans/HOSTED_LOGIN_INTEGRATION.md` NEW — tenant integration recipe shipped

### Part C — Widget repositioning (light touch)

- [ ] `NfcStep.tsx` — detect `window.top !== window.self`; render fallback card "Tarayıcıda yeni sekmede tamamla" opening hosted login URL
- [ ] i18n keys `mfa.nfc.framedTitle`, `mfa.nfc.framedBody`, `mfa.nfc.framedCta`, `mfa.nfc.framedSecondary` (tr+en)
- [ ] `docs/EMBEDDABLE_AUTH_WIDGET_ARCHITECTURE.md` — rewrite to position widget as step-up MFA only; recommend hosted for full auth

### Part D — Dashboard P0 i18n fixes — ✅ shipped in PR-1

- [x] `AuditLogsPage.tsx` — 50 keys wrapped in `t()` across both locales
- [x] `RolesListPage.tsx` — 15 keys
- [x] `TenantsListPage.tsx` — 17 keys
- [x] `RoleFormPage.tsx` — 21 keys
- [x] `useLivenessPuzzle.ts` — 9 action-instruction keys
- [x] Dashboard dates localized via `i18n.language` in `AnalyticsPage`, `VerificationDashboardPage`, `DashboardPage`
- [x] `LoginPage.tsx` — demo credentials gated behind `import.meta.env.DEV`
- [x] Swallowed-catch fixes in `EnrollmentPage.tsx:354` + `MultiStepAuthFlow.tsx:97-99`

### Wave 1 follow-ups (not blocking PR-1 merge)
- [ ] `QrCodeStep.tsx` / `VoiceStep.tsx` root Box — strip `height:'100%'` / `flex:1` for mobile fit
- [ ] Audit i18n sweep — grep backend `saveAuditLog("<CODE>"` and cross-check all codes in tr/en
- [ ] Part C widget repositioning — NfcStep framed-fallback card + docs
- [ ] Part B.4 demo-side — `bys-demo/` flip to `loginRedirect()` + callback.html

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
