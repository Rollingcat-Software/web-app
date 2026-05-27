# User Profile / Dashboard Bug List — 2026-04-30

> **All four P1/P2 items below were fixed in commit immediately following
> this file's introduction.** Kept here as a record of what was wrong and
> how. P3 (session count vs login count) is left open as it depends on
> reconciling two different concepts (login events vs active sessions);
> revisit when /sessions endpoint stabilizes.

## Status (2026-04-30 ~05:55 UTC)

- [x] P1 Tenant label mismatch — fixed (was a hardcoded "Marmara University" string in DashboardPage.tsx:434, replaced with `user?.tenantName || t('common.default')`)
- [x] P1 Date locale leak — fixed (MyProfilePage formatDate / formatDateShort now accept `lang` param, use date-fns/locale tr|enUS)
- [x] P2 "Kayıtlı Biyometrik Yöntemler" label — fixed (TR → "Kayıtlı Doğrulama Yöntemleri", EN → "Registered Authentication Methods")
- [x] P2 "Kayıtlı Gün" label — fixed (TR → "Kayıtlı Gün Sayısı", EN was already "Days Registered")
- [x] P3 Session count 2 vs 3 — closed (commit `0654b27`). Verified
  in DB: counts are correct per design — each `createRefreshToken`
  starts a new family (BE-M5), and signup auto-login mints a token
  but emits `USER_CREATED` not `USER_LOGIN`, so 3 active sessions
  with 2 USER_LOGIN events on the same device is expected for
  signup + 2 logins. Added `activeSessionsHelper` i18n string under
  the Profile stat to explain it.

---

## Original report

Reported during a fresh user-enrollment smoke test. User signed up and
landed on Dashboard then Profile; the two pages disagree about basic
fields. **All bugs are display-only — no data corruption.**

## P1 — Tenant name mismatch between Dashboard and Profile

- Dashboard: `Kiracı: Marmara University`
- Profile:   `Kiracı: E2E Tenant 384401`

Same logged-in user, two different tenant labels. The "E2E Tenant
${rand}" pattern is what Playwright e2e tests generate (see
`web-app/e2e/auth.setup.ts` and similar). Possible causes:

1. Dashboard hardcodes `t('home.tenant.marmara')` or similar i18n key
   instead of reading the live `tenant.name` from API.
2. Two pages call different endpoints (`/auth/me` vs `/users/me`) and
   one falls back to a stale Redux slice.
3. The user was actually enrolled under an E2E-leftover tenant; the
   Dashboard string is the bug.

**Repro:** create a fresh user, go to /dashboard then /profile, compare
the "Kiracı" label.

## P1 — Date formatting bypasses i18n on Profile

Profile page renders dates via JS default `toLocaleDateString()` with
no locale arg, so English-locale runner spits out `Apr 30, 2026` even
when `i18n.language === 'tr'`.

Dashboard correctly shows `30 Nisan 2026`.

Replace raw `Date.toLocaleDateString()` in:
- Profile "Üyelik Tarihi" stat
- Profile "Son Giriş" stat
- Profile login activity table

Use `t('common.dateLong', { value })` or `Intl.DateTimeFormat(i18n.language, …)`.

## P2 — "Kayıtlı Biyometrik Yöntemler" lists non-biometric methods

The detail block titled `Kayıtlı Biyometrik Yöntemler — 2 aktif` lists
**Email OTP** and **QR Code**, neither of which is a biometric method.

Either:

- Rename the section to `Kayıtlı Doğrulama Yöntemleri` (Registered
  authentication methods); OR
- Filter the list to biometric methods only (Face/Fingerprint/Voice/NFC).

## P2 — "Kayıtlı Gün" stat label is wrong for the value

The stat card labeled `Kayıtlı Gün` (Registered Day) shows the value
`Apr 30, 2026 08:31` — that's a last-login timestamp, not a "registration
day" count. Probably:

- The label should be `Son Giriş Zamanı`; OR
- The value should be a day-count like `0` (today) and the label `Kayıtlı Gün` is correct, but the timestamp shown is from the wrong field.

Looking at the layout, "Son Giriş" already has its own card showing the
same timestamp, so the `Kayıtlı Gün` card is duplicating that value
under a wrong label. Drop one or fix the field.

## P3 — Session count differs between Dashboard and Profile

- Dashboard: shows 2 logins in "Son Giriş Aktivitesi"
- Profile:   `Aktif Oturumlar: 3`

Different concepts (login *events* vs active *sessions*) but worth
verifying whether the `3` matches `auth_sessions WHERE user_id=…
AND revoked_at IS NULL` actually has 3 rows or if one is stale.

---

None of these block production. P1 items are visible to every user on
their first login, so address those first. P2/P3 are polish.
