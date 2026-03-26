# FIVUCSAS Web App - Roadmap

> Last updated: March 2026. Reflects actual state from TODO.md integration audit.

## Auth Method & Enrollment Roadmap

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
