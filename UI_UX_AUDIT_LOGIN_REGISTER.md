# UI/UX Audit: Login & Register Pages
> Audited: 2026-03-17 | Source: Chrome DevTools + Manual Review

## Priority: HIGH (Security + Accessibility)

### Login Page
1. **Password validation leaks policy** — Shows "must be 8+ chars" on login. Should show generic "Invalid credentials" only after server check
2. **No loading state** — Blank purple card for 2-3s, no skeleton/spinner
3. **Gradient inconsistency** — Login=purple, forgot-password=pink, register=different
4. **"Face ID/Fingerprint/QR" are dead text** — Look clickable but aren't
5. **"Forgot Password?" is button, not link** — Breaks right-click/new-tab, semantics
6. **Missing autocomplete** — email, current-password attributes missing
7. **Missing required/aria-required** — On all inputs
8. **No main landmark** — No `<main>` element
9. **No skip-to-content link** — WCAG failure
10. **Errors lack role="alert"** — Screen readers don't announce validation errors
11. **Show password icon invisible** — White on white, fails contrast
12. **No auto-focus on email** — Standard UX best practice missing

### Register Page
13. **Last Name has no `<label>`** — Critical a11y: screen readers can't announce it
14. **Inconsistent field icons** — First Name has icon, Last Name doesn't
15. **Show password buttons missing aria-label** — Unlabeled for screen readers
16. **Shows requirements one at a time** — Should show checklist of all requirements
17. **No password strength meter** — No visual guidance
18. **No Terms/Privacy checkbox** — Legal/compliance issue
19. **Missing autocomplete** — given-name, family-name, new-password missing
20. **Missing required/aria-required** — On all fields
21. **"Sign In" link is a button** — Same semantic issue as login

### Both Pages
22. **No CAPTCHA/bot protection** — Despite "enterprise-grade security" claim
23. **No form action/method** — Non-functional without JS
24. **No aria-label on form** — Screen readers can't describe form purpose
25. **Auto-generated MUI IDs** — `:r1v:`, `:r20:` — not human-readable
26. **"Enterprise-grade security" footer** — Vague, no link to security page
