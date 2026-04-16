# FIVUCSAS Comprehensive Audit — 2026-04-16

> Commissioned after Round-5 testing surfaced iframe-specific regressions on Chrome Android. Scope expanded to cover the entire project: auth surface, backend, admin dashboard, infrastructure, documentation. Produced by 5 parallel investigation agents covering non-overlapping surfaces.

**Total findings:** 97. **Critical (P0):** 17. **Professional standard (P1):** 42. **Polish (P2):** 38.

The audits independently converged on three themes: (a) iframe-era patterns are increasingly hostile to native platform features (NFC, WebAuthn, Safari ITP), (b) i18n discipline has regressed on admin-facing surfaces, (c) backend coverage and response-shape consistency have drifted. Each reinforces the architectural pivot to **hosted-first redirective auth**.

---

## Strategic observations

1. **Hosted-first pivot is correct.** Most P0/P1 widget findings (postMessage wildcard, NFC iframe block, duplicated flow orchestration, SDK URL hardcoding, iframe-only architecture doc) shrink or evaporate under hosted mode. Pivoting now delivers a net reduction in hardening backlog.
2. **i18n is the most repeated failure.** 3 of 5 agents independently flagged hardcoded English across admin pages, liveness puzzle instructions, auth validation messages. The "NEVER hardcode English" rule isn't enforced — we need a CI lint rule that rejects untranslated strings in `.tsx`.
3. **Backend test coverage is the weakest link.** 17 of 25 controllers untested; admin endpoints missing `@PreAuthorize`. A focused 2-day effort on `@WebMvcTest` coverage would close most of the admin-surface regression gap.
4. **Docs are 2+ months behind reality.** README says 80%, roadmap marks shipped items "in progress", architecture doc still iframe-only. Solution: a release-driven single-source-of-truth snapshot doc, not a proliferation of evergreen files.

---

## P0 — Act immediately

| # | Finding | File:line | Risk | Owner |
|---|---------|-----------|------|-------|
| 1 | Production secrets committed to git history | `identity-core-api/.env.prod`, `biometric-processor/.env.prod`, `web-app/.env.production` | DB/Redis/JWT/Twilio creds exposed to any repo reader | Ops |
| 2 | Biometric API publicly routable, no rate-limit middleware | `biometric-processor/docker-compose.prod.yml:80-85` | Model harvesting, DoS, brute-force enrollment | Ops |
| 3 | postMessage bridge starts as `parentOrigin = '*'` | `verify-app/postMessageBridge.ts:42` | Init-window origin-hijack; obsolete in hosted mode | Widget |
| 4 | Double-unknown cast on session ID | `SecondaryAuthFlow.tsx:195` | Type-safety bypass; accepts arbitrary session shapes | Auth |
| 5 | `CascadeType.ALL + orphanRemoval=true` on critical aggregates | `User`, `AuthFlow`, `Tenant`, `AuthSession`, `VerificationSession` | Cascade-delete → GDPR audit trail loss | Backend |
| 6 | `@ManyToMany(fetch = EAGER)` on auth flow steps | `AuthFlowStep.java:45` | N+1 queries; memory exhaustion under load | Backend |
| 7 | JWT secret min length 32 chars | `JwtSecretProvider.java:70-79` | 24 bytes < HMAC-SHA256 256-bit spec; brute-force risk | Backend |
| 8 | Admin CRUD endpoints missing `@PreAuthorize` | `TenantController`, `RoleController`, `AdminOverviewController` | Privilege escalation | Backend |
| 9 | PKCE verifier failures unlogged + unrate-limited | `OAuth2Controller.java:156-173` | Brute-force / code reuse attacks invisible | Backend |
| 10 | 18 hardcoded English strings on admin pages | `AuditLogsPage`, `RolesListPage`, `TenantsListPage`, `RoleFormPage` | Turkish users see English on security-critical surfaces | Frontend |
| 11 | Hardcoded English in liveness puzzle instructions | `useLivenessPuzzle.ts:129-138` | `'Blink your eyes'` bypasses i18n entirely | Auth |
| 12 | Demo credentials visible in LoginPage UI | `LoginPage.tsx` | `admin@fivucsas.local / Test@123` exposed to tenants | Frontend |
| 13 | Swallowed errors in auth critical paths | `EnrollmentPage.tsx:354`, `MultiStepAuthFlow.tsx:97-99` | Silent failures hide API/network issues | Auth |
| 14 | Dashboard dates not locale-aware | `AnalyticsPage:201`, `VerificationDashboardPage:407`, `DashboardPage:726-775` | US format regardless of UI language | Frontend |
| 15 | Demo branded to "Marmara Üniversitesi BYS" | `bys-demo/index.html`, `dashboard.html`, `callback.html` | Makes FIVUCSAS look single-tenant | Docs/Demo |
| 16 | Widget architecture doc iframe-only | `docs/EMBEDDABLE_AUTH_WIDGET_ARCHITECTURE.md` | Contradicts hosted-first direction | Docs |
| 17 | README claims 80% complete | `docs/README.md:7` | Actual state 99%; tenant-facing embarrassment | Docs |

---

## P1 — Before hosted-first launch

### Architecture / code quality
- `LoginMfaFlow` + `MultiStepAuthFlow` duplicate ~1000 LOC of step-orchestration. Unify during hosted-login work — HostedLoginApp wraps single controller, not a third copy.
- 17 of 25 backend controllers have zero unit tests. Prioritize OAuth2 + admin endpoints.
- 135 `Map.of()` responses in controllers. Create `OAuth2AuthorizationResponse`, `OAuth2TokenResponse`, `MfaStepResponse`, `ErrorResponse` DTOs.
- Error shape split: OAuth uses RFC 6749 `{error, error_description}`; AuthController uses `{success, message}`. Unify.
- 50+ query services missing `@Transactional(readOnly=true)`.
- No `@Version` optimistic locking on `User`, `AuthFlow`, `Tenant`.
- `@Autowired` field injection in `RedisMessagingConfig.java`. Migrate to `@RequiredArgsConstructor`.

### Security hardening
- PostgreSQL 5432 + Redis 6379 on `0.0.0.0` in dev compose.
- `prom/prometheus:latest`, `grafana/grafana:latest`, `nginx:alpine` unpinned.
- Traefik rate-limit = 100/s globally; needs tighter per-endpoint on `/api/auth/*`.
- Traefik `camera`/`microphone` Permissions-Policy missing for `demo.fivucsas.com`.
- `setup-env.sh` writes plaintext `.credentials`.
- `deploy-ubuntu-coolify.sh` uses `set -e` without `-u -o pipefail`.
- Nginx `server_tokens off` not set globally; HSTS only via Traefik.

### Professional polish
- Hardcoded Turkish `defaultValue` in `QrCodeStep.tsx:101`.
- `console.log/warn` in `VoiceStep.tsx`, `FingerprintStep.tsx` leaks credential/challenge details.
- `aria-describedby` missing on TextField helpers across `UserFormPage`, `TenantFormPage`, `RoleFormPage`.
- Tables don't collapse on mobile — `AuditLogs`, `Roles`, `Tenants` show horizontal scroll.
- No request timeouts on `fetch()` in auth hooks.
- SDK `DEFAULT_BASE_URL`, `DEFAULT_API_BASE_URL` pinned to prod.
- SDK public methods missing JSDoc.

---

## P2 — Polish backlog

- Terminology chaos: "2FA" / "MFA" / "multi-step" / "multifactor" used interchangeably across ~150 doc locations. Standardize to "MFA."
- Audit log codes not cross-referenced to i18n keys. Build shared typed enum.
- SDK has no separate CHANGELOG. Split out `sdk/CHANGELOG.md`.
- `package.json` says `1.0.0`, README claims `2.0.0`. Align.
- Feature flags undocumented (`VITE_ENABLE_MOCK_API`). Create `docs/06-deployment/FEATURE_FLAGS.md`.
- No tenant integration quickstart. Create `docs/guides/tenant-integration/QUICKSTART.md`.
- No API error code catalog. Create `docs/04-api/ERROR_CODES.md`.
- SDK `z-index: 2147483647` is defensive code smell.
- `AuthController /2fa/verify-method` is 140 lines with 8-branch switch — extract per-method helpers.
- Magic style numbers in `SmsOtpStep`, `EmailOtpStep`, `PasswordStep` — move to theme tokens.

---

## Recommended wave sequencing

| Wave | Scope | Effort | Ships With |
|------|-------|--------|------------|
| Wave 0 | Rotate secrets + purge git history + tighten bio.fivucsas Traefik route | 2–4 hr | Standalone ops PR |
| Wave 1 (PR-1) | A1+A2+A4 + hosted-login V1 + i18n sweep of admin pages + kill demo creds in UI + rename bys-demo + rewrite widget architecture doc + RFC 8252 native-app redirect-URI support | 3–5 days | **feat/hosted-first-auth-round5** |
| Wave 2 (PR-2) | Widget step-up repositioning + unify `LoginMfaFlow`/`MultiStepAuthFlow` + backend DTO migration + admin `@PreAuthorize` + PKCE audit logging | 2–3 days | Separate PR |
| Wave 3 (PR-3) | 17-controller test coverage + `@Version` fields + JPA cascade refactor + CI i18n lint | 3–4 days | Separate PR |
| Wave 4 | Docs rewrite, terminology sweep, API error catalog, tenant quickstart, CHANGELOG split | 1–2 days | Continuous |

---

## Verification plan

Each wave has explicit acceptance criteria in `TODO.md` and `ROADMAP.md`. Wave 1 verification on Chrome Android incognito:
1. `demo.fivucsas.com` → "Yönlendirmeli giriş" → browser URL changes to `verify.fivucsas.com/login?client_id=…`
2. All 8 MFA methods reachable (including NFC natively, no iframe error)
3. Completion → `demo.fivucsas.com/callback?code=…&state=…`
4. SDK exchanges code → tokens received → dashboard loads
5. Mutated `redirect_uri` → `invalid_request` error
6. OIDC: `id_token` verifies against JWKS
7. All admin pages (AuditLogs, Roles, Tenants) display Turkish
8. Dashboard notifications localized, no raw `mfa_step_completed` codes
9. Footer `Kullanım Koşulları` (single L)
