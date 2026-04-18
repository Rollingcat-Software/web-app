# FIVUCSAS TODO — Round-5 Hardening + Hosted-First Auth

> Source of truth for current sprint. Derived from `docs/AUDIT_REPORT_2026-04-16.md` and Round-5 testing. Update as items close.

**Current branch:** `main`
**Target PR:** PR-1 (Wave 1) — ✅ **MERGED 2026-04-16** (identity-core-api#16 + web-app#22)
**Last updated:** 2026-04-18

---

## Open — 2026-04-18 (Phase A–H restructure)

> Authoritative list per `/home/deploy/.claude/plans/rustling-pondering-wind.md`. Items below supersede the Audit-surfaced / Wave 0 / Wave 2-4 sections further down when they overlap.

### Phase A — Green the PR CI (in flight — blocks Dependabot)
- [ ] **A1.** Refactor `src/verify-app/HostedLoginApp.tsx` — move all hook calls above the `if (!authParams)` early return; gate internal side-effects on `authParams` truthy (15 `react-hooks/rules-of-hooks` errors).
- [ ] **A2.** Misc lint errors: `src/verify-app/sdk/FivucsasAuth.ts:105` useless `\-` regex escape; `src/verify-app/postMessageBridge.ts:74` stale eslint-disable; test-file `no-unused-vars` (`act`, `afterEach`, `waitFor`, `userEvent`) — prefix `_` or remove.
- [ ] **A3.** Exhaustive-deps warnings (63) in `GuestsPage`, `NfcEnrollmentPage`, `SettingsPage`, `WidgetAuthPage`, `TenantFormPage`, `UserFormPage`, `useBlazeFace`. Intentional stale closures get inline `// eslint-disable-next-line react-hooks/exhaustive-deps` + one-line WHY.
- [ ] **A4.** `npm test -- --run` — 597 passing before push. Update `HostedLoginApp.test.tsx` if hook-order change breaks it.
- [ ] Ship as one commit: `fix(lint): unblock ubuntu-latest CI — hooks rules-of-hooks + unused vars`.

### Phase B — Dependabot merges (gated on A green)
- [ ] **B1.** `@dependabot rebase` web-app #23 protobufjs (CRITICAL) + #21 follow-redirects (MODERATE).
- [ ] **B2.** `gh pr merge --squash --delete-branch` each.
- [ ] **B3.** FIVUCSAS parent #8 Vite (MODERATE) — verify transitive vs direct; bump if direct.
- [ ] **B4.** Rsync rebuilt `dist/` to Hostinger post-protobufjs (TF.js runtime dep).

### Phase C — Wave 0 ops hardening (frontend-adjacent only)
- [ ] **C3.** Web-app `git filter-repo --path .env.prod --invert-paths`; force-push after team sync.
- [ ] **C5.** Enable GitHub push-protection on `Rollingcat-Software/web-app` + add `gitleaks` to PR workflow.

### Phase D — Security depth (frontend surfaces)
- [ ] **D1.** DNN liveness detection — evaluate DeepPixBiS / MiniFASNet / Silent-Face-v2 ONNX; target <8 MB, >15 FPS mid-phone; wire as 3rd pre-filter in `BiometricEngine.ts`, log-only per D2 rule.
- [ ] **D2.** Voice replay detection — spectral cosine > 0.95 reject (client-side pre-filter, log-only first).
- [ ] **D3.** Voice STT verification per `docs/plans/VOICE_STT_PLAN.md` (Whisper.cpp tiny.en WASM + server confirm). 2 weeks.
- [ ] **D4.** OIDC discovery conformance-suite run against `https://api.fivucsas.com/.well-known/openid-configuration`; fix reported deviations.
- [ ] **D5.** Front-end PKCE failure audit logging — surface `clientId` + `failureReason` on callback errors so backend can log them.

### Phase E — Performance (bundle + CI)
- [ ] **E1.** Recharts route-level lazy-load via `React.lazy()` on `AnalyticsPage` + `DashboardPage` — `PieChart-*.js` 397 KB + `container-*.js` 398 KB off critical path.
- [ ] **E2.** MUI vendor chunk split in `vite.config.ts` `manualChunks` — `mui-core` (Button/TextField/Box/Typography, loaded everywhere) vs `mui-data` (DataGrid/AutoComplete/DatePicker, form pages only). 548 KB → ~300 KB + ~250 KB.
- [ ] **E3.** Vitest `--pool=threads --poolOptions.threads.maxThreads=4` (halves CI wall-clock).
- [ ] **E5.** `size-limit` dev dep + CI step failing if any chunk grows >10 % from baseline — chart bundle-budget gate.

### Phase F — Compliance & observability
- [ ] **F2.** Backup restore verification cron — weekly unzip latest `/opt/projects/backups/`, restore to throwaway DB, `SELECT COUNT(*) FROM users`, alert on mismatch.
- [ ] **F3.** Loki + Grafana log aggregation sidecar; ship Traefik + identity-core-api + biometric-processor logs; `grafana.fivucsas.com` behind admin-whitelist.

### Phase G — Features
- [ ] **G1.** YubiKey hardware testing (needs purchase — YubiKey Security Key C NFC ~2,200 TRY).
- [ ] **G2.** Mobile QR scanner (Phase 2.1) — implement in `client-apps/` (mlkit-barcode-scanning).
- [ ] **G4.** Native-app SDK integration docs — `docs/guides/integration/{ios-appauth.md, android-customtabs.md, electron-loopback.md, cli-loopback.md}`.
- [ ] **G7.** `<fivucsas-verify>` + `<fivucsas-button>` Web Components with CSS Custom Properties theming.

---

## Completed — 2026-04-18

- [x] **MobileFaceNet deprecated** (commit `9e15cdd`) — `mobilefacenet.onnx` removed from manifest + fetch-models + dist. Client embedding is now 512-dim landmark-geometry (MediaPipe, log-only). 4.9 MB download + ONNX startup overhead eliminated; server DeepFace Facenet512 stays authoritative.
- [x] **`oauth2_clients.tenant_id` index** — present since V24 migration; V37 reaffirmed explicitly after audit. Not a seq-scan.
- [x] **GDPR backend** `GET /users/{id}/export` + `SoftDeletePurgeJob` + `PurgeAdminController` — shipped 2026-04-16b.
- [x] **Front-end GDPR export wire-up** — `MyProfilePage` export button wired to backend (commit `52f2fe1`, 2026-04-18).
- [x] **bys-demo `loginRedirect()` + `callback.html`** — shipped pre-today in the hosted-first rollout; `marmara-bys-demo` OAuth2 client registered 2026-04-18.
- [x] **Lazy-load ORT + BlazeFace** — already dynamic imports (commit `91064ed`); verified today by bundle audit. Off critical path; actual hotspots are MUI vendor 548 KB + Recharts chunks.

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

- [x] **Compliance — GDPR/KVKK export + soft-delete purge** — backend `/users/{id}/export` + `SoftDeletePurgeJob` shipped 2026-04-16b; front-end `MyProfilePage` export wire-up shipped 2026-04-18 (commit `52f2fe1`).
- [ ] **OIDC discovery** — `.well-known/openid-configuration` endpoint exists but needs verification against conformance suite (code + id_token + PKCE S256 + JWKS reachable). *Tracked as Phase D4.*
- [ ] **`.gitignore`** verify-widget/html/assets/*.js — bundle artifacts currently tracked. Purge from history after adding ignore. *(partial — `fcf91e1` stopped tracking generated assets; history-purge still pending.)*
- [x] **Lazy-load ONNX Runtime + BlazeFace** — already dynamic imports (commit `91064ed`). Bundle audit 2026-04-18 confirms they are off the critical path; actual hotspots are `mui-vendor` 548 KB + Recharts `container` 398 KB + `PieChart` 397 KB.
- [x] **MobileFaceNet deprecated (2026-04-18)** — `mobilefacenet.onnx` removed from manifest + fetch-models + dist (commit `9e15cdd`). Client embedding is now 512-dim landmark-geometry only (MediaPipe, log-only per D2). Eliminates the 4.9 MB download + ONNX Runtime startup overhead for zero functional loss (server DeepFace Facenet512 stays authoritative).
- [x] **`oauth2_clients.tenant_id` index** — present since V24; V37 reaffirms explicitly (commit `06a9f78`). Audit item was stale.
- [ ] **CI speed** — Maven `-T 2C` + Vitest `--pool=threads --poolOptions.threads.maxThreads=4` to halve CI wall-clock. *Tracked as Phase E3.*
- [ ] **Stuck Deploy-to-Hetzner run** — self-hosted runner queued 8h+; clear queue, investigate runner registration.

---

## Wave 0 — Immediate ops (awaiting user go-ahead)

> Superseded by the Phase C block at the top of this file (2026-04-18 restructure). Retained here for cross-reference during the maintenance-window scheduling conversation.

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

### Part B — Hosted login V1 (primary new surface) — ✅ shipped in PR-1 (bys-demo integration finalized 2026-04-18 with `marmara-bys-demo` client registration)

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

#### B.4 Demo + tenant docs — ✅ DONE
- [x] `bys-demo/index.html` flip primary CTA to `loginRedirect()` — shipped pre-2026-04-18
- [x] `bys-demo/callback.html` NEW — `handleRedirectCallback()` wired, shipped pre-2026-04-18
- [ ] `bys-demo/dashboard.html` brand rename
- [x] `docs/plans/HOSTED_LOGIN_INTEGRATION.md` NEW — tenant integration recipe shipped
- [x] `marmara-bys-demo` OAuth2 client registered 2026-04-18 for `demo.fivucsas.com`

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
