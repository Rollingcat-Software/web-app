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

- [x] **IH1** **Guest Management** - GuestsPage.tsx with invite/extend/revoke dialogs, sidebar link, route, i18n. **RESOLVED (March 2026)**.
- [ ] **IH2** **OTP Management** - Backend has `OtpController` with standalone OTP send/verify for email and SMS (`/api/v1/otp/email/send/{userId}`, `/email/verify/{userId}`, `/sms/send/{userId}`, `/sms/verify/{userId}`) but frontend has no OTP management UI.
- [x] **IH3** **TOTP Setup** - TotpEnrollment.tsx connected to backend (setup, verify, status, disable). **RESOLVED (March 2026)**.
- [x] **IH4** **WebAuthn/FIDO2** - WebAuthnEnrollment.tsx fixed (base64url encoding, challenge, transports, browser check). Already wired in SettingsPage. **RESOLVED (March 2026)**.
- [x] **IH5** **QR Code Authentication** - QrCodeStep.tsx connected to backend (generate, invalidate, countdown, auto-refresh). **RESOLVED (March 2026)**.
- [ ] **IH6** **Step-Up Authentication** - Backend has `StepUpController` with device registration, challenge request, and verification (`/api/v1/step-up/register-device`, `/challenge`, `/verify-challenge`) but frontend has no step-up auth management UI.
- [x] **IH7** **User Role Assignment** - Linter reverted Autocomplete UI; backend role sync logic was added but removed. Re-add when linter config resolved. **PARTIAL**.
- [x] **IH8** **Permission Management** - RoleFormPage already fetches from `GET /permissions` + groups by resource. Fixed IRoleRepository interface to include `getAllPermissions()`. **RESOLVED (March 2026)**.
- [ ] **IH9** **Auth Method Listing** - Backend has `AuthMethodController` (`/api/v1/auth-methods`) that lists all available auth methods from DB but frontend uses hardcoded `DEFAULT_AUTH_METHODS` array in `AuthMethod.ts`.
- [x] **IH10** **Tenant Auth Method Config** - TenantAuthMethods.tsx component with toggle switches, wired into TenantFormPage edit mode. **RESOLVED (March 2026)**.
- [ ] **IH11** **Enrollment Management per User** - Backend has `EnrollmentManagementController` (`/api/v1/users/{userId}/enrollments`) with GET/POST/DELETE per-user enrollment but frontend enrollment page uses different structure via `/enrollments` not per-user.
- [x] **IH12** **Password Change** - Already fully implemented in SettingsPage (dialog with validation + i18n). **RESOLVED**.
- [x] **IH13** **User Search** - UsersListPage now calls `GET /users/search?query=` with debounce. UserRepository.searchUsers() added. **RESOLVED (March 2026)**.
- [x] **IH14** **Statistics Export** - AnalyticsPage CSV export button added. **RESOLVED (March 2026)**.
- [x] **IH15** **Forgot/Reset Password** - ForgotPasswordPage + ResetPasswordPage with routes and i18n. **RESOLVED (March 2026)**.
- [x] **IH16** **Auth Sessions Page** - Route `/auth-sessions` exists in `App.tsx` and sidebar link exists in `Sidebar.tsx`. **RESOLVED**.

### MEDIUM - Model/enum mismatches and missing fields

- [x] **IM1** Backend DeviceResponse uses @JsonProperty annotations to serialize deviceFingerprint as fingerprint, lastUsedAt as lastUsed, registeredAt as createdAt. Frontend DeviceResponse also includes optional capabilities and isTrusted fields. **RESOLVED**.
- [x] **IM2** Frontend already has `OperationType` union type with all 9 backend values + type guard + normalizer in `AuthMethod.ts`. **RESOLVED**.
- [x] **IM3** Frontend `AuthSessionResponse` (in `AuthSessionRepository.ts`) uses `sessionId`, `isRequired`, `delegated` matching backend. **RESOLVED**.
- [x] **IM4** AuditLog action types updated to all 30 backend values, grouped by category in filter dropdown. **RESOLVED (March 2026)**.
- [ ] **IM5** Frontend `DashboardStats` matches backend `StatisticsResponse` well but is missing the `export` capability (format parameter).
- [ ] **IM6** Backend `AuthenticationResponse` has `expiresIn` as `Long` but frontend `AuthRepository` treats it correctly. However, the `AuthFlowResponse` backend has `stepCount` field that frontend doesn't use.
- [x] **IM7** Frontend `Role.ts` has `systemRole` and `active` fields. `RoleFormPage` shows read-only view for system roles. **RESOLVED**.
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

- [x] **AE-1** WebAuthnEnrollment.tsx fixed and working (platform + hardware-key modes in SettingsPage). **RESOLVED (March 2026)**.
- [ ] **AE-2** Build fingerprint enrollment UI - could use WebAuthn platform authenticators (Touch ID / Windows Hello)
- [ ] **AE-3** Build voice enrollment UI - needs backend voice processing first (currently stub)
- [x] **AE-4** TotpEnrollment.tsx connected to backend TotpController. **RESOLVED (March 2026)**.
- [x] **AE-5** QrCodeStep.tsx connected to backend QrCodeController. **RESOLVED (March 2026)**.
- [ ] **AE-6** Voice auth method is disabled (`isActive: false`) in DEFAULT_AUTH_METHODS - enable when backend ready
- [ ] **AE-7** NfcStep shows "not available on this device" - needs mobile app support
- [ ] **AE-8** No enrollment management page per auth method - users can't initiate enrollment for specific methods
- [x] **AE-9** Auth sessions route and sidebar link both exist. **RESOLVED**.
