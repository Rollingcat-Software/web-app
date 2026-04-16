# Hosted Login Integration Guide

**Audience:** Tenant applications integrating FIVUCSAS identity as their sign-in provider.
**Status:** PR-1 shipping (2026-04-16). Hosted-first is the recommended primary integration mode.

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

## 6. Using the iframe widget instead (step-up MFA)

For sensitive actions inside an already-authenticated session —
approving a high-value transaction, changing security settings, reading
KVKK-protected data — the iframe widget provides a lighter-weight
step-up experience without leaving the host page.

```js
const result = await auth.verify({
    flow: 'step-up',
    userId: currentUser.id
});
if (result.success) {
    await api.post('/transactions/approve', { id, proof: result.sessionId });
}
```

**Known limitation:** Web NFC does not work inside iframes. The widget's
NFC step detects the framed context and offers a "Continue in new tab"
fallback that opens the hosted page to complete the NFC read.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `invalid_request — redirect_uri` | URL not in allowlist | Re-register with tenant admin; match case/path exactly |
| `invalid_grant — PKCE verifier mismatch` | Browser cleared sessionStorage between pages | Ensure callback is same-origin with sign-in page |
| `invalid_grant — expired` | Code older than 10 min | Restart the flow |
| `state mismatch` from SDK | Two tabs opened sign-in concurrently | Each `loginRedirect()` overwrites stored state; use one tab |
| Hosted page blank after login | `/oauth2/authorize/complete` 4xx — check Network tab | MFA session likely expired; retry |
| Tenant admin can't register custom URL scheme | DB check constraint blocks non-http(s) | None — custom schemes are explicitly supported |

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
