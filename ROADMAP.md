# FIVUCSAS Web App - Roadmap

## Auth Method & Enrollment Roadmap

### Phase 1: Fix Critical Gaps (Priority: Critical)

- [ ] Fix AuthMethodType case mismatch (IC1: frontend lowercase vs backend UPPERCASE)
- [ ] Rebuild Enrollment model to match backend EnrollmentResponse (IC2+IC3)
- [ ] Fix user list pagination for backend flat array response (IC4)
- [ ] Add emailVerified/phoneVerified to User model (IC5)
- [ ] Add auth-sessions link to sidebar navigation

### Phase 2: Build Missing Enrollment UIs (Priority: High)

- [ ] **WebAuthn/Hardware Key enrollment** - Build enrollment component using backend WebAuthnController
  - Call `/webauthn/register/options/{userId}` to get registration options
  - Use `navigator.credentials.create()` for key registration
  - Call `/webauthn/register/{userId}` to complete registration
- [ ] **Fingerprint enrollment** - Use WebAuthn platform authenticators (Touch ID, Windows Hello)
  - Same WebAuthn flow with `authenticatorAttachment: "platform"`
- [ ] Connect TotpEnrollment.tsx to backend TotpController endpoints
- [ ] Connect QrCodeStep.tsx to backend QrCodeController endpoints
- [ ] Add Forgot Password link and flow to LoginPage

### Phase 3: Backend Feature Integration (Priority: High)

- [ ] Build Guest Management page (backend GuestController ready)
- [ ] Fetch auth methods from backend instead of hardcoding DEFAULT_AUTH_METHODS
- [ ] Add Change Password form in Settings page
- [ ] Use backend search endpoint for user list instead of client-side filtering
- [ ] Add Statistics export button to dashboard
- [ ] Build multi-role assignment UI for users
- [ ] Fetch permissions from backend for role form

### Phase 4: Model Fixes & Polish (Priority: Medium)

- [ ] Fix DeviceResponse field name mismatches (IM1)
- [ ] Fix AuthSessionResponse field mismatches (IM3)
- [ ] Complete AuditLog action types filter (IM4)
- [ ] Fix DI container missing service bindings (IM9)
- [ ] Remove dead code: useCsrf hook, notification panel
- [ ] Enable Voice auth method when backend is ready
