# FIVUCSAS Web Dashboard - TODO

> Comprehensive audit completed February 2026. All issues documented below.

## CRITICAL (Must fix - Broken functionality)

- [x] **C1** User model missing 6+ backend fields (`phoneNumber`, `address`, `idNumber`, `roles[]`, `isBiometricEnrolled`, `enrolledAt`, `lastVerifiedAt`, `verificationCount`) — `User.ts`
- [x] **C2** Tenant model missing config fields (`biometricEnabled`, `sessionTimeoutMinutes`, `refreshTokenValidityDays`, `mfaRequired`) — `Tenant.ts`
- [x] **C3** No server-side pagination — All repositories (User, Tenant, Enrollment, Role, AuditLog) now handle both flat array and Spring Data `Page<T>` responses. Params properly flattened (`pageSize` → `size`). Frontend pagination-ready for when backend adds `Pageable` support.
- [x] **C4** Login sends `mfaCode` but backend ignores it — Removed from `AuthRepository.ts`
- [x] **C5** Statistics `averageVerificationsPerUser` — Computed client-side via getter in `DashboardStats.ts`
- [x] **C6** SettingsRepository returns empty profile data — Fixed mapping in `SettingsRepository.ts`
- [x] **C7** Password validation inconsistent — Standardized to 8+ chars across Login, Register, UserForm

## HIGH (Should fix - Broken UX or fragile code)

- [x] **H1** `useAuth` context value recreated every render — Added `useMemo` in `useAuth.tsx`
- [x] **H2** Filter JSON.stringify causes refetch spam — Wrapped in `useMemo` in `useTenants.ts`, `useUsers.ts`
- [x] **H3** 15+ HTTP calls typed as `any` — Replaced with `UserJSON`, `TenantJSON`, `EnrollmentJSON`, `AuditLogJSON`, `DashboardStatsJSON` across all repositories. Also fixed `error: any` to `error: unknown` in catch blocks.
- [x] **H4** Single ErrorBoundary wraps entire app — Added page-level ErrorBoundary per route in `App.tsx`
- [x] **H5** AuditLog handles 3 different response formats — Fully typed with `AuditLogListResponse` union type and exhaustive type guards in `AuditLogRepository.ts`
- [x] **H6** Demo credentials shown in production — Wrapped in `import.meta.env.DEV` in `LoginPage.tsx`
- [x] **H7** Delete operations silently swallow errors — Added error state and Alert in `TenantsListPage`, `EnrollmentsListPage`
- [x] **H8** RegisterPage uses raw `axios.post` — Replaced with DI httpClient in `RegisterPage.tsx`
- [x] **H9** Role/Permission management not integrated — Full feature: `Permission.ts`, `Role.ts`, `IRoleRepository.ts`, `IRoleService.ts`, `RoleRepository.ts`, `RoleService.ts`, `useRoles.ts`, `RolesListPage.tsx`, `RoleFormPage.tsx`, DI registration, routes, sidebar
- [x] **H10** Tenant activate/suspend endpoints unused — Added buttons in `TenantsListPage.tsx`, full stack: interface → repo → service → hook → page
- [x] **H11** Settings endpoint structure mismatch — Handled with `SettingsApiResponse` interface mapping nested backend format to flat frontend format in `SettingsRepository.ts`

## MEDIUM (Code quality and polish)

- [x] **M1** Enrollment model missing `userName`/`userEmail` — Added to `Enrollment.ts`
- [x] **M2** AuditLog missing `success` and `errorMessage` fields — Added to `AuditLog.ts`
- [x] **M3** Audit log timestamp fallback — Fixed dual field `timestamp`/`createdAt` in `AuditLog.ts`
- [x] **M4** `vite-env.d.ts` only declares 3 of 13+ env vars — Expanded to 16 declarations
- [x] **M5** No debounce loading indicator — Added `LinearProgress` bar during 300ms debounce in `UsersListPage.tsx` and `AuditLogsPage.tsx`
- [x] **M6** Tenant `slug` vs `domain` naming inconsistent — Renamed `Tenant.domain` to `Tenant.slug` throughout: model, `toJSON`, `TenantsListPage`, `TenantFormPage`, `UserFormPage`. `fromJSON` still accepts both for backward compat.
- [x] **M7** Client-side audit log pagination — All repositories now support server-side pagination via Spring Data `Page<T>` response format (see C3). Client-side fallback maintained.
- [x] **M8** No confirmation for destructive settings changes — Added `window.confirm()` for 2FA/timeout in `SettingsPage.tsx`
- [x] **M9** User creation: missing TENANT_ADMIN role — Added to dropdown in `UserFormPage.tsx`
- [x] **M10** Missing breadcrumb navigation — Added `PageBreadcrumbs` in `DashboardLayout.tsx`
- [x] **M11** Notification icon renders but does nothing — Wrapped in Tooltip "coming soon" + disabled in `TopBar.tsx`
- [x] **M12** Missing Prettier config — Created `.prettierrc` with project settings
- [x] **M13** ESLint missing rules — Added `no-console`, `no-debugger`, `prefer-const`, `no-explicit-any` to `.eslintrc.cjs`
- [x] **M14** Double 401 error handling — Fixed in `ErrorHandler.ts` to only notify on refresh failure
- [x] **M15** No activity feed on dashboard — Added "Recent Activity" section to `DashboardPage.tsx` using `useAuditLogs`
- [x] **M16** `/tenants/:id` (view details) route doesn't exist — Redirected to `/tenants/:id/edit`

## LOW (Polish and best practices)

- [x] **L1** Delete dialogs don't show resource name — Fixed in `TenantsListPage` (shows tenant name)
- [x] **L2** No keyboard shortcuts — Added Ctrl+Enter (Cmd+Enter on Mac) submit to `UserFormPage`, `TenantFormPage`, `RoleFormPage`
- [x] **L3** No `prefers-reduced-motion` check — Added CSS `@media (prefers-reduced-motion)` in `index.css`
- [x] **L4** Avatar initials can be undefined — Safe fallback in `TopBar.tsx`
- [x] **L5** Missing HTML meta tags — Added theme-color, OG tags, apple-touch-icon in `index.html`
- [x] **L6** Unused `PageTransition` animation variants — Removed unused exports
- [x] **L7** No dark mode toggle — `ThemeModeProvider.tsx` context, `createAppTheme(mode)` refactor, dark-aware Chip/Alert/Skeleton overrides, toggle in `TopBar.tsx`, localStorage persistence with system preference fallback
- [x] **L8** LinearProgress in tenants list has no aria-label — Added
- [x] **L9** Profile menu item label — Changed to "Profile & Settings" in `TopBar.tsx`
- [~] **L10** Dev env uses `localStorage` for tokens — **Requires httpOnly cookies from backend; cannot fix frontend-only**
- [x] **L11** No bundle size analysis tool — Added `build:analyze` script + Vite `reportCompressedSize` in `vite.config.ts`
- [x] **L12** Enrollment quality scores have no context — Added color-coded Chips with Tooltips (Good/Acceptable/Poor)
- [x] **L13** Action type filter uses hardcoded string array — Extracted `AUDIT_LOG_ACTION_TYPES` constant from `AuditLog.ts`
- [x] **L14** No favicon files in public/ — Created `favicon.svg` with FIVUCSAS brand, updated `index.html`

---

## Summary

| Priority | Total | Fixed | Deferred | Notes |
|----------|-------|-------|----------|-------|
| Critical | 7 | **7** | 0 | All fixed |
| High | 11 | **11** | 0 | All fixed |
| Medium | 16 | **16** | 0 | All fixed |
| Low | 14 | **13** | 1 | L10 needs backend httpOnly cookies |
| **Total** | **48** | **47** | **1** | **98% complete** |

### Only Remaining Item
- **L10**: httpOnly cookies for token storage — Requires backend to set `Set-Cookie` headers with `HttpOnly; Secure; SameSite=Strict` flags. Cannot be implemented frontend-only.
