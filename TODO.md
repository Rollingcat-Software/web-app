# FIVUCSAS Web Dashboard - Integration Audit & TODO

> Cross-module integration audit completed March 2026.
> Compares web-app frontend against identity-core-api (23 controllers) and biometric-processor (17 route modules).

---

## Previous Audit (Feb 2026) - 47/48 items COMPLETED

All previous items (C1-C7, H1-H11, M1-M16, L1-L14) are completed except L10 (httpOnly cookies - requires backend).

---

## NEW: Cross-Module Integration Gaps

### CRITICAL - Frontend features with no backend support or broken contract

- [x] **IC1** `AuthMethodType` enum already uses UPPERCASE values (`'PASSWORD'`, `'FACE'`) matching backend `AuthMethodType.java`. **RESOLVED**.
- [x] **IC2** Backend EnrollmentDto now includes faceImageUrl, qualityScore, livenessScore, errorCode, errorMessage, authMethodType fields matching frontend Enrollment model. **RESOLVED**.
- [x] **IC3** EnrollmentStatus enum aligned in both types/index.ts and domain model with all 8 values (NOT_ENROLLED, PENDING, PROCESSING, ENROLLED, SUCCESS, FAILED, REVOKED, EXPIRED). Domain model fromJSON handles all backend status strings. **RESOLVED**.
- [x] **IC4** Backend UserController already returns paginated format (content, totalElements, totalPages, page, size). Frontend UserRepository handles both array and paginated response formats. **RESOLVED**.
- [x] **IC5** Frontend User.ts already has emailVerified and phoneVerified fields with proper defaults and deserialization. **RESOLVED** (was already correct).

### HIGH - Missing backend features not exposed in frontend

- [ ] **IH1** **Guest Management** - Backend has full `GuestController` with 6 endpoints (`/api/v1/guests/invite`, `/accept`, `GET /`, `/count`, `/{id}/revoke`, `/{id}/extend`) but frontend has ZERO guest management UI or repository. No sidebar link, no page, no service.
- [ ] **IH2** **OTP Management** - Backend has `OtpController` with standalone OTP send/verify for email and SMS (`/api/v1/otp/email/send/{userId}`, `/email/verify/{userId}`, `/sms/send/{userId}`, `/sms/verify/{userId}`) but frontend has no OTP management UI.
- [ ] **IH3** **TOTP Setup** - Backend has `TotpController` with setup/verify/disable/status endpoints (`/api/v1/totp/setup/{userId}`, `/verify-setup/{userId}`, `/disable/{userId}`, `/status/{userId}`) but frontend `TotpEnrollment.tsx` component exists but is not connected to these endpoints.
- [ ] **IH4** **WebAuthn/FIDO2** - Backend has `WebAuthnController` with registration options, credential registration, and listing (`/api/v1/webauthn/register/options/{userId}`, `/register/{userId}`, `GET /{userId}`) but frontend has no WebAuthn management UI.
- [ ] **IH5** **QR Code Authentication** - Backend has `QrCodeController` with generate/invalidate endpoints (`/api/v1/qr/generate/{userId}`, `DELETE /{token}`) but frontend `QrCodeStep.tsx` doesn't call these endpoints.
- [ ] **IH6** **Step-Up Authentication** - Backend has `StepUpController` with device registration, challenge request, and verification (`/api/v1/step-up/register-device`, `/challenge`, `/verify-challenge`) but frontend has no step-up auth management UI.
- [ ] **IH7** **User Role Assignment** - Backend has `UserRoleController` (`/api/v1/users/{userId}/roles`) with GET/POST/DELETE for role assignment but frontend `UserFormPage` only has a single role dropdown - no multi-role assignment UI.
- [ ] **IH8** **Permission Management** - Backend has `PermissionController` with list/get/resource endpoints (`/api/v1/permissions`, `/{id}`, `/resource/{resource}`) but frontend `RoleFormPage` has no permission selection from backend - it should fetch available permissions.
- [ ] **IH9** **Auth Method Listing** - Backend has `AuthMethodController` (`/api/v1/auth-methods`) that lists all available auth methods from DB but frontend uses hardcoded `DEFAULT_AUTH_METHODS` array in `AuthMethod.ts`.
- [ ] **IH10** **Tenant Auth Method Config** - Backend has `TenantAuthMethodController` (`/api/v1/tenants/{tenantId}/auth-methods`) to configure which auth methods are enabled per tenant but frontend has no tenant auth method configuration UI.
- [ ] **IH11** **Enrollment Management per User** - Backend has `EnrollmentManagementController` (`/api/v1/users/{userId}/enrollments`) with GET/POST/DELETE per-user enrollment but frontend enrollment page uses different structure via `/enrollments` not per-user.
- [ ] **IH12** **Password Change** - Backend has `POST /api/v1/users/{id}/change-password` with password history check but frontend `SettingsPage` has no change password form.
- [ ] **IH13** **User Search** - Backend has `GET /api/v1/users/search?query=` but frontend `UsersListPage` does client-side filtering instead of calling the search endpoint.
- [ ] **IH14** **Statistics Export** - Backend has `GET /api/v1/statistics/export?format=` but frontend dashboard has no export button.
- [ ] **IH15** **Forgot/Reset Password** - Backend has `POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password` but frontend `LoginPage` has no "Forgot Password" link or flow.
- [x] **IH16** **Auth Sessions Page** - Route `/auth-sessions` exists in `App.tsx` and sidebar link exists in `Sidebar.tsx`. **RESOLVED**.

### MEDIUM - Model/enum mismatches and missing fields

- [x] **IM1** Backend DeviceResponse uses @JsonProperty annotations to serialize deviceFingerprint as fingerprint, lastUsedAt as lastUsed, registeredAt as createdAt. Frontend DeviceResponse also includes optional capabilities and isTrusted fields. **RESOLVED**.
- [ ] **IM2** Frontend `AuthFlowResponse` (in `AuthFlowRepository.ts`) has `operationType` as string but backend returns it as `OperationType` enum (`APP_LOGIN | DOOR_ACCESS | BUILDING_ACCESS | API_ACCESS | TRANSACTION | ENROLLMENT | GUEST_ACCESS | EXAM_PROCTORING | CUSTOM`). Frontend should validate/display these properly.
- [x] **IM3** Frontend `AuthSessionResponse` (in `AuthSessionRepository.ts`) uses `sessionId`, `isRequired`, `delegated` matching backend. **RESOLVED**.
- [ ] **IM4** Frontend `AuditLog` action types are hardcoded to 10 values but backend can produce many more (e.g., `USER_AUTHENTICATED`, `USER_REGISTERED`, `BIOMETRIC_ENROLLED`, `ROLE_ASSIGNED`, `PERMISSION_GRANTED`, `TENANT_CREATED`, etc.). The filter dropdown is incomplete.
- [ ] **IM5** Frontend `DashboardStats` matches backend `StatisticsResponse` well but is missing the `export` capability (format parameter).
- [ ] **IM6** Backend `AuthenticationResponse` has `expiresIn` as `Long` but frontend `AuthRepository` treats it correctly. However, the `AuthFlowResponse` backend has `stepCount` field that frontend doesn't use.
- [ ] **IM7** Backend `RoleResponse` has `systemRole` and `active` flags but frontend `Role.ts` model may not have these. The `RoleFormPage` should prevent editing system roles.
- [ ] **IM8** Backend `TenantController` has `GET /tenants/slug/{slug}` and `POST /{tenantId}/activate`, `POST /{tenantId}/suspend` endpoints but frontend `TenantRepository` doesn't expose slug lookup.
- [x] **IM9** DI container binds `AuthFlowService`, `AuthSessionService`, `DeviceService` along with their repositories. **RESOLVED**.

### LOW - Polish and completeness

- [x] **IL1** Frontend `AuthMethod.ts` no longer has `pricePerMonth`/`setupFee` fields. Uses `category` instead. **RESOLVED**.
- [ ] **IL2** Frontend `BiometricService.ts` directly calls biometric-processor API but identity-core-api also proxies biometric calls. Decide which path to use and ensure consistency.
- [x] **IL3** `auth-sessions` route exists and sidebar navigation item added in `Sidebar.tsx`. **RESOLVED**.
- [ ] **IL4** Backend has `AnalyticsPage` route in frontend but no corresponding backend analytics endpoint beyond `/statistics`. The page may be empty/placeholder.
- [ ] **IL5** `NotificationPanel.tsx` exists but notification endpoints don't exist in backend. Should be documented as planned feature or removed.
- [x] **IL6** `useCsrf.ts` hook removed. Backend doesn't use CSRF (disabled in SecurityConfig). **RESOLVED**.
- [ ] **IL7** Frontend has `OperationType` values used in `AuthFlowBuilder` but they may not match backend enum exactly. Need to fetch from backend or ensure sync.
- [~] **IL8** L10 from previous audit: httpOnly cookies for token storage - requires backend support.

---

## Summary

| Priority | Count | Description |
|----------|-------|-------------|
| Critical | 5 | Broken contracts, enum mismatches, model structure mismatches |
| High | 16 | Missing backend features not exposed in frontend |
| Medium | 9 | Field mismatches, missing fields, enum gaps |
| Low | 8 | Polish, dead code, navigation gaps |
| **Total** | **38** | New integration issues from cross-module audit |

### Priority Order

**Week 1** (Critical fixes + Quick wins):
1. IC1: Fix AuthMethodType case mismatch
2. IC2+IC3: Rebuild Enrollment model to match backend EnrollmentResponse
3. IC4: Fix User list pagination (backend returns flat array)
4. IC5: Add emailVerified/phoneVerified to User model
5. IH16: Add auth-sessions to sidebar or remove route
6. IH15: Add Forgot Password link and flow

**Week 2** (High-priority feature integrations):
7. IH1: Build Guest Management page + repository + service
8. IH7: Multi-role assignment UI for users
9. IH8: Fetch permissions from backend for role form
10. IH9: Fetch auth methods from backend instead of hardcoding
11. IH12: Add change password form in Settings
12. IH13: Use backend search endpoint instead of client-side filter
13. IH14: Add statistics export button

**Week 3** (Auth method management):
14. IH3: Connect TotpEnrollment to backend endpoints
15. IH4: Build WebAuthn management UI
16. IH5: Connect QR code step to backend endpoints
17. IH6: Build Step-Up auth management
18. IH10: Tenant auth method configuration UI
19. IH11: Fix enrollment management to use per-user endpoints

**Week 4** (Model fixes + Polish):
20. IM1-IM9: Fix all model/field mismatches
21. IL1-IL8: Clean up dead code, fix navigation, documentation

---

## AUTH METHOD INTEGRATION GAPS (March 2026)

### Auth Method UI Status

| Auth Method | Step Component | Enrollment UI | Backend Ready | Runtime Status |
|---|---|---|---|---|
| PASSWORD | PasswordStep | N/A | Yes | Working |
| EMAIL_OTP | EmailOtpStep | N/A | Yes | Working |
| SMS_OTP | SmsOtpStep | N/A | Yes | Working |
| TOTP | TotpStep | TotpEnrollment (disconnected) | Yes (TotpController) | Partially working |
| QR_CODE | QrCodeStep | N/A | Yes (QrCodeController) | Working |
| FACE | FaceCaptureStep | FaceEnrollmentFlow | Yes | Working |
| FINGERPRINT | FingerprintStep | **MISSING** | Stub (always fails) | **BROKEN** |
| VOICE | VoiceStep (disabled) | **MISSING** | Stub (always fails) | **BROKEN** |
| NFC_DOCUMENT | NfcStep (placeholder) | **MISSING** | Stub (always fails) | **BROKEN** |
| HARDWARE_KEY | HardwareKeyStep | **MISSING** | Yes (WebAuthnController) | Needs enrollment UI |

### Auth Enrollment TODOs

- [ ] **AE-1** Build WebAuthn/Hardware Key enrollment UI - backend WebAuthnController has `/register/options` and `/register/verify` ready
- [ ] **AE-2** Build fingerprint enrollment UI - could use WebAuthn platform authenticators (Touch ID / Windows Hello)
- [ ] **AE-3** Build voice enrollment UI - needs backend voice processing first (currently stub)
- [ ] **AE-4** Connect TotpEnrollment.tsx to backend TotpController endpoints (`/totp/setup/{userId}`, `/totp/verify-setup/{userId}`)
- [ ] **AE-5** Connect QrCodeStep.tsx to backend QrCodeController endpoints (`/qr/generate/{userId}`)
- [ ] **AE-6** Voice auth method is disabled (`isActive: false`) in DEFAULT_AUTH_METHODS - enable when backend ready
- [ ] **AE-7** NfcStep shows "not available on this device" - needs mobile app support
- [ ] **AE-8** No enrollment management page per auth method - users can't initiate enrollment for specific methods
- [ ] **AE-9** Auth sessions route exists but has no sidebar navigation link
