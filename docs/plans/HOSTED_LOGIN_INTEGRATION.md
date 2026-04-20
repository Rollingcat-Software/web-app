# Hosted Login Integration Guide

**Audience:** Tenant applications integrating FIVUCSAS identity as their sign-in provider.
**Status:** PR-1 merged to `main` 2026-04-16. Polished 2026-04-20 (step-up MFA section expanded; troubleshooting refreshed post CSP / permissionsPolicy / postMessage-origin fixes). Hosted-first is the recommended primary integration mode.

---

## 1. Why hosted login

Every serious identity provider launched since 2015 ships hosted-first:
Auth0 Universal Login, Okta, Microsoft Entra, Google, Apple, AWS Cognito,
Keycloak, Stripe Checkout, WorkOS, Clerk, and Turkish platforms like
e-Devlet, BTK, İŞKUR, and every major bank.

For FIVUCSAS specifically, hosted-first unblocks:

- **Web NFC** — `NDEFReader` only works in top-level browsing contexts
- **WebAuthn / passkeys** — no cross-frame origin rituals
- **Password managers + autofill** — browsers don't trust iframes
- **Safari ITP + Chrome 3P-cookie deprecation** — iframe sessions will keep breaking
- **Phishing defense** — users see `verify.fivucsas.com` in the URL bar

The iframe widget remains available but is now positioned for **inline
step-up MFA** (transaction signing, sensitive-action re-auth) rather than
primary sign-in.

---

## 2. Quickstart — 3 steps

### Step 1 — register your application

Contact your FIVUCSAS tenant admin to register an OAuth 2.0 client:

- `client_id` — your unique identifier (e.g. `acme-portal`)
- `redirect_uris` — exact-match allowlist, JSON array:
  - HTTPS URLs: `https://acme.com/auth/callback`
  - Custom schemes (mobile/desktop): `com.acme://auth`
  - Loopback (CLI/Electron): `http://127.0.0.1/callback` — any port accepted per RFC 8252 §7.3
- `allowed_scopes` — space-separated, default `"openid profile email"`

Registered clients live in the `oauth2_clients` table and are surfaced to
the hosted page via `GET /oauth2/clients/{id}/public` (branding only).

### Step 2 — install the SDK

```html
<script src="https://verify.fivucsas.com/fivucsas-auth.js"></script>
```

Or npm (for SPAs that bundle their own JS):

```bash
npm install @fivucsas/auth-js  # coming soon
```

### Step 3 — wire up the two entry points

**On your sign-in page:**

```html
<button onclick="startSignIn()">Sign in with FIVUCSAS</button>

<script>
function startSignIn() {
    const auth = new FivucsasAuth({
        clientId: 'acme-portal',
        apiBaseUrl: 'https://api.fivucsas.com/api/v1',
        locale: 'en'
    });

    auth.loginRedirect({
        redirectUri: 'https://acme.com/auth/callback',
        scope: 'openid profile email'
    });
}
</script>
```

`loginRedirect()` generates a PKCE S256 challenge, a random CSRF `state`,
and an OIDC `nonce`, stores them in `sessionStorage`, then navigates the
top-level browser to `https://verify.fivucsas.com/login`.

**On your callback page** (`https://acme.com/auth/callback`):

```html
<script src="https://verify.fivucsas.com/fivucsas-auth.js"></script>
<script>
(async () => {
    const auth = new FivucsasAuth({
        clientId: 'acme-portal',
        apiBaseUrl: 'https://api.fivucsas.com/api/v1'
    });

    try {
        const tokens = await auth.handleRedirectCallback();
        // tokens: { accessToken, refreshToken, idToken, tokenType, expiresIn, ... }

        // Persist to your app's session store
        localStorage.setItem('access_token', tokens.accessToken);

        // Redirect into the authenticated area
        window.location.replace('/dashboard');
    } catch (err) {
        console.error('Sign-in failed:', err);
        window.location.replace('/signin?error=' + encodeURIComponent(err.message));
    }
})();
</script>
```

`handleRedirectCallback()` validates the `state` parameter against
sessionStorage, exchanges the `code` at `/oauth2/token` using the PKCE
verifier, and returns the tokens.

---

## 3. What happens under the hood

```
┌─────────────┐                                     ┌──────────────────────┐
│  acme.com   │   1. User clicks "Sign in"         │ verify.fivucsas.com  │
│  /signin    │──────────loginRedirect()──────────>│ /login               │
└─────────────┘                                     └──────────────────────┘
       ▲                                                       │
       │                                                       │ 2. MFA
       │                                                       │    (all 10
       │                                                       │    methods,
       │                                                       │    NFC, passkeys)
       │                                                       │
       │           4. 302 back to acme.com                    ▼
       │           ?code=xyz&state=abc                  ┌──────────────────┐
       │<─────────────────────────────────────────────  │  POST /oauth2/   │
       │                                                │  authorize/      │
       ▼                                                │  complete        │
┌──────────────────┐                                    └──────────────────┘
│ acme.com         │   5. Exchange code at
│ /auth/callback   │   /oauth2/token with PKCE verifier
└──────────────────┘──────────────────────────────> api.fivucsas.com
       │
       │   6. Receives { access_token, id_token, refresh_token }
       ▼
┌─────────────┐
│ /dashboard  │
└─────────────┘
```

---

## 4. Security hygiene

| Concern | Who handles it | Notes |
|---|---|---|
| PKCE S256 | SDK (`loginRedirect`) | Verifier stored in `sessionStorage`, used once, cleared |
| CSRF `state` | SDK | 32-byte crypto random; SDK validates round-trip |
| OIDC `nonce` | SDK + backend | Binds `id_token` to the authorization request |
| Exact redirect-URI match | Backend | `OAuth2Client.isRedirectUriAllowed()` rejects mutations |
| Code single-use + 10-min TTL | Backend (Redis) | Replay → `invalid_grant` |
| `id_token` signature | Your app | Verify against `https://api.fivucsas.com/.well-known/jwks.json` |
| Token storage | Your app | Prefer `HttpOnly` cookies over `localStorage` for long-lived sessions |

**Never trust URL parameters alone** — the backend re-validates `client_id`
and `redirect_uri` at every step.

---

## 5. Platform coverage

| Platform | Mechanism | Loopback port? |
|---|---|---|
| Web SPA | `window.location.assign` | n/a — use HTTPS |
| iOS (native) | `ASWebAuthenticationSession` + AppAuth | n/a — use custom URL scheme |
| Android (native) | Chrome Custom Tabs + AppAuth | n/a — use custom URL scheme |
| Electron / desktop | Loopback redirect per RFC 8252 | ✅ `http://127.0.0.1/cb` — any port |
| CLI tools | Loopback redirect | ✅ `http://127.0.0.1/cb` — any port |

Registered redirect URI `http://127.0.0.1/callback` will match any port
chosen at runtime (e.g. `http://127.0.0.1:58471/callback`), but the
scheme, host, and path must match exactly.

---

## 6. Step-up MFA (iframe widget mode)

### When to use widget vs redirect

| Scenario | Use |
|---|---|
| Primary sign-in / first session | **Redirect** (`loginRedirect()`) |
| Native mobile / desktop app sign-in | **Redirect** (Custom Tabs / ASWebAuthenticationSession / RFC 8252 loopback) |
| Web-NFC, WebAuthn, password-manager autofill | **Redirect** (iframes cannot reliably do these) |
| Sensitive-action re-auth inside an authed session (approve transaction, change security settings, read KVKK data) | **Widget** |
| Transaction signing with a short-lived proof (`sessionId`) | **Widget** |
| Inline checkout confirmation | **Widget** |

### Step-up example

```js
const auth = new FivucsasAuth({
    clientId: 'acme-portal',
    apiBaseUrl: 'https://api.fivucsas.com/api/v1'
});

const result = await auth.verify({
    flow: 'step-up',
    userId: currentUser.id,
    // optional: pin a single method, otherwise tenant's step-up policy applies
    preferredMethod: 'TOTP'
});

if (result.success) {
    await api.post('/transactions/approve', {
        id,
        proof: result.sessionId  // short-lived MfaSession proof — server re-validates
    });
}
```

The widget iframe is served from `https://verify.fivucsas.com/widget` and
communicates with the host page via `postMessage`. Events emitted to the
parent: `ready`, `step-change`, `resize`, `complete` (with `sessionId`),
`error`.

### Known limitations (widget mode)

- **Web NFC does not work inside iframes.** The NFC step detects the framed
  context and offers a "Continue in new tab" fallback that opens the hosted
  page at `verify.fivucsas.com/login?display=page&...` to complete the read
  and returns via the OAuth code flow.
- **WebAuthn cross-origin** edge cases on Safari + older Firefox — the
  widget passes `rpId = verify.fivucsas.com` and relies on CORS-permissive
  headers; if your tenant has strict `COOP`/`COEP` these must allowlist
  `verify.fivucsas.com`.
- **Third-party cookies** are not used (auth state lives in an ephemeral
  MfaSession keyed by `sessionId`, not a cookie), so Safari ITP / Chrome
  3P-cookie deprecation do not break the widget. The redirect flow is
  still preferred for primary sign-in.

---

## 7. Troubleshooting

### OAuth / redirect issues

| Symptom | Cause | Fix |
|---|---|---|
| `invalid_request — redirect_uri` | URL not in allowlist | Re-register with tenant admin; match case/path exactly |
| `invalid_grant — PKCE verifier mismatch` | Browser cleared sessionStorage between pages | Ensure callback is same-origin with sign-in page |
| `invalid_grant — expired` | Code older than 10 min | Restart the flow |
| `state mismatch` from SDK | Two tabs opened sign-in concurrently | Each `loginRedirect()` overwrites stored state; use one tab |
| Hosted page blank after login | `/oauth2/authorize/complete` 4xx — check Network tab | MFA session likely expired; retry |
| Tenant admin can't register custom URL scheme | DB check constraint blocks non-http(s) | None — custom schemes are explicitly supported |

### Widget / iframe issues

| Symptom | Cause | Fix |
|---|---|---|
| Widget loads then CSP blocks `/widget.js` in console | Host page `Content-Security-Policy` does not allow `verify.fivucsas.com` | Add `https://verify.fivucsas.com` to `script-src`, `frame-src`, and `connect-src` directives |
| `Refused to frame … violates the Content Security Policy` | Host page `frame-src` / `frame-ancestors` too tight | Add `frame-src https://verify.fivucsas.com` on host page. Widget's own CSP already permits embedding by tenants. |
| Camera or microphone step stuck on "Requesting permission…" and silently fails | Host page omits `Permissions-Policy` for the iframe OR Traefik response lacked `camera=*, microphone=*` | Parent `<iframe>` needs `allow="camera; microphone; publickey-credentials-get; publickey-credentials-create"`. Recent fix (2026-04-19) loosened Traefik `permissionsPolicy` so `verify.fivucsas.com` responds with permissive camera/mic — deploy parent app without `Permissions-Policy: camera=()` overrides. |
| `postMessage` events never fire on parent | Listener registered before iframe mounted OR origin check rejecting | Listen on `window.addEventListener('message', …)` **before** creating the widget; accept only `event.origin === 'https://verify.fivucsas.com'` — do not use wildcard. SDK already validates this; custom integrations must too. |
| Widget flashes then goes blank | `X-Frame-Options: DENY` leaking from a CDN / reverse proxy in front of `verify.fivucsas.com` | Remove the XFO override — the verify surface intentionally omits it in favor of CSP `frame-ancestors` |
| WebAuthn step throws `NotAllowedError` inside widget | iframe missing `publickey-credentials-get` / `-create` in `allow=` | Add both tokens to the parent `<iframe allow="…">` — see row above |
| `sessionId` proof rejected by tenant backend | MfaSession consumed twice (V35 guard) or cross-client replay (V36 guard binds to `client_id`) | Use `sessionId` exactly once; pass the same `clientId` that minted it |

### CSP quickstart (copy-paste for host pages using the widget)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://verify.fivucsas.com;
  frame-src  https://verify.fivucsas.com;
  connect-src 'self' https://api.fivucsas.com https://verify.fivucsas.com;
  style-src  'self' 'unsafe-inline';
```

The SDK uses `connect-src` to post to `/oauth2/token` and may talk to
`verify.fivucsas.com` for widget-mode token exchange.

---

## 8. Reference endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/oauth2/authorize?display=page&...` | GET | Hosted login entry (302 to hosted page) |
| `/oauth2/authorize` (no `display`) | GET | JSON widget flow (backwards compat) |
| `/oauth2/authorize/complete` | POST | Internal — hosted page exchanges MfaSession for code |
| `/oauth2/token` | POST | Standard RFC 6749 §3.2 code exchange |
| `/oauth2/clients/{id}/public` | GET | Public branding metadata |
| `/oauth2/userinfo` | GET | OIDC Core §5.3 userinfo (Bearer JWT) |
| `/.well-known/openid-configuration` | GET | OIDC discovery |
| `/.well-known/jwks.json` | GET | Public keys for `id_token` verification |

All rate-limited. See the OpenAPI spec at `https://api.fivucsas.com/swagger-ui.html`.

---

## 9. Migration from the old widget-only integration

The legacy `auth.verify()` method still works — no breaking changes.
However, new tenants should prefer `loginRedirect()` because:

1. NFC + passkeys behave correctly without workarounds
2. Brand trust (users see `verify.fivucsas.com` in URL bar)
3. Future-proof against Safari ITP + 3P cookie deprecation
4. Standard OIDC — any OIDC-aware backend library can verify the `id_token`

Existing widget integrations will continue working indefinitely. We may
reposition the widget more explicitly toward step-up MFA in PR-3
(6-month review).

---

## 10. Questions?

File an issue at `github.com/fivucsas/fivucsas/issues` or email
`support@fivucsas.com`.
