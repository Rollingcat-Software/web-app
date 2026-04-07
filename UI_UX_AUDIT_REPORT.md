# UI/UX Audit Report — FIVUCSAS Identity Platform (Web App)

> Date: 2026-03-16
> Auditor: Claude Code (Playwright-assisted live audit)
> URL: https://app.fivucsas.com
> Overall Score: **6.2 / 10**

---

## Summary

The web app has a visually polished auth shell (login/register) but exposes critical role-authorization bugs to non-admin users and has several UX gaps in the dashboard. Core flows (register → login → dashboard) now work end-to-end after CSP and audit-log FK fixes this session.

---

## Screen-by-Screen Findings

### 1. Login Page — 7.5/10

**Strengths:**
- Purple gradient background + white card creates clear visual hierarchy
- Fingerprint icon is distinctive and thematically appropriate
- Password show/hide toggle present
- "Protected by enterprise-grade security" footer builds trust
- "Login with Face ID" alternative nicely presented with sub-bullet list

**Issues:**
| Issue | Severity |
|-------|----------|
| Input label+icon alignment — mail/lock icon squeezes label width | Low |
| No app name or wordmark — fingerprint icon only, no "FIVUCSAS" text visible | Low |
| Purple text on white card may fail WCAG AA at small weights | Medium |
| Autocomplete attributes missing (browser warns in devtools) | Low |

---

### 2. Register Page — 7/10

**Strengths:**
- Consistent with login page style
- Name split into First/Last (correct for multi-tenant ID)

**Issues:**
| Issue | Severity |
|-------|----------|
| "Last Name" field has no icon — visual inconsistency with "First Name" | Low |
| No password strength indicator | Medium |
| No inline validation while typing (only on submit) | Medium |
| After successful registration, redirects to /login with no confirmation message | Medium |
| No "check your email" step shown after registration (email verification OTP exists in backend but not surfaced in UI) | High |

---

### 3. Dashboard (authenticated, USER role) — 4/10

**Critical Issues:**
| Issue | Severity |
|-------|----------|
| **Red 403 error banner is the ONLY thing shown** to non-admin users | **P0 Critical** |
| Dashboard is completely empty for USER role — no welcome, no CTA | **P0 Critical** |
| Page title (`<title>`) always says "FIVUCSAS Admin Dashboard" regardless of current page | P2 |

**Root Cause:** Dashboard component calls `/api/v1/statistics` and `/api/v1/audit-logs` unconditionally, both of which require ADMIN role. Frontend makes no role check before the API call.

**Fix:** Check `user.role === 'ADMIN'` before rendering admin widgets. Show a welcome/onboarding card for USER role.

---

### 4. Settings Page — 7/10

**Strengths:**
- Comprehensive: Profile, Security, Notifications, Appearance sections
- Security options impressive: TOTP, WebAuthn, Face ID, OTP, Step-Up Auth, passkey
- Toggle switches render correctly
- Language selector (EN/TR) functional

**Issues:**
| Issue | Severity |
|-------|----------|
| 403 error banner at top of page (user settings endpoint scoping issue) | High |
| First Name / Last Name fields empty (should pre-populate from auth state) | High |
| Role displays as "USER" (all caps) — should be "User" | Low |
| Duplicate dark mode toggle in Settings AND in TopBar | Low |
| Duplicate language toggle in Settings AND in TopBar | Low |
| "Change Avatar" button appears functional but backend upload likely missing | Medium |
| "Change Password" button hidden in Security section — consider floating it or making it more prominent | Low |

---

### 5. User Enrollment Page — 7.5/10

**Strengths:**
- Step indicator (1 → 2 → 3) clearly communicates progress
- Clean form card layout
- Required field markers (`*`) present

**Issues:**
| Issue | Severity |
|-------|----------|
| Breadcrumb shows raw slug `user-enrollment` instead of "Identity Enrollment" | Low |
| Date of Birth uses native `<input type="date">` — renders US format (mm/dd/yyyy), Turkish users expect dd/mm/yyyy | Medium |
| No indication of data persistence if user navigates back mid-flow | Low |

---

## Accessibility Audit — 5/10

| Issue | WCAG Criterion | Severity |
|-------|---------------|----------|
| Input elements missing `autocomplete` attributes | 1.3.5 | Medium |
| Purple text on white card — contrast ratio borderline for WCAG AA | 1.4.3 | High |
| No `aria-live` region for error/success alerts | 4.1.3 | Medium |
| Toast notifications appear without screen reader announcement | 4.1.3 | Medium |
| No skip-to-main-content link | 2.4.1 | Low |
| Form labels are floating Material-style — may confuse screen readers | 1.3.1 | Low |

---

## Priority Bug List

| Priority | Issue | File/Route | Effort |
|----------|-------|-----------|--------|
| **P0** | Dashboard shows 403 error to all non-admin users | `DashboardPage.tsx` | 30 min |
| **P0** | Settings shows 403 error (wrong API scope) | `SettingsPage.tsx` | 30 min |
| **P1** | Profile fields empty after login | `SettingsPage.tsx` | 15 min |
| **P1** | No "check your email" step after registration | `RegisterPage.tsx` | 1 hour |
| **P2** | Page `<title>` always "Admin Dashboard" | `App.tsx` | 15 min |
| **P2** | Duplicate dark mode / language controls | `TopBar.tsx` / `SettingsPage.tsx` | 20 min |
| **P3** | Date format not localized (enrollment) | `EnrollmentPage.tsx` | 30 min |
| **P3** | Raw route slug in breadcrumb | `DashboardLayout.tsx` | 15 min |

---

## What's Genuinely Good

- Purple gradient auth pages look professional
- Biometric options in Settings (TOTP, WebAuthn, Face ID, Step-Up) are impressive for an identity platform
- Step-progress enrollment flow (3 steps, numbered) is well-structured
- Dark mode toggle works
- i18n EN/TR infrastructure is functional
- Fingerprint branding icon is memorable

---

## Recommended Next Steps (UI/UX Sprint)

1. **Fix dashboard 403** — add role guard before statistics API call
2. **Fix settings 403** — scope settings API call to `/api/v1/users/me/settings`
3. **Populate profile fields** from auth state on settings page load
4. **Add email verification banner** after registration
5. **Fix breadcrumb slugs** → human-readable labels
6. **Fix `<title>` tags** per page
7. **Add password strength indicator** on register
