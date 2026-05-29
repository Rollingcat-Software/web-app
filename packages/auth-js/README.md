# @fivucsas/auth-js

Lightweight, **zero-dependency** vanilla JavaScript/TypeScript SDK for adding
[FIVUCSAS](https://fivucsas.com) biometric identity verification and
hosted-first OIDC login to any website or web app.

- **Hosted-first OIDC login** (primary) — `loginRedirect()` + `handleRedirectCallback()` with PKCE (S256), CSRF `state`, and OIDC `nonce` validation built in.
- **Embeddable step-up MFA** (secondary) — `verify()` opens the verification flow in a sandboxed iframe (modal or inline).
- Works in any framework or no framework. Tree-shakeable, ESM + CJS, TypeScript types included.

> Looking for the `<fivucsas-verify>` custom element? Install
> [`@fivucsas/auth-elements`](https://www.npmjs.com/package/@fivucsas/auth-elements).

## Install

```bash
npm install @fivucsas/auth-js
```

Or use it straight from a CDN, no build step (script-tag / IIFE global `FivucsasAuth`):

```html
<script src="https://verify.fivucsas.com/sdk/fivucsas-auth.js"></script>
<script>
  const auth = new FivucsasAuth({ clientId: 'your-client-id' });
</script>
```

## Quickstart — hosted login (recommended)

```ts
import { FivucsasAuth } from '@fivucsas/auth-js';

const auth = new FivucsasAuth({
  clientId: 'your-client-id',
  locale: 'en', // or 'tr'
});

// 1. Kick off login — redirects the browser to verify.fivucsas.com/login.
await auth.loginRedirect({
  redirectUri: 'https://yourapp.com/callback',
  scope: 'openid profile email',
});

// 2. On your /callback route, complete the flow:
const result = await auth.handleRedirectCallback();
// result.accessToken, result.idToken, result.userId, result.email, …
```

`loginRedirect()` generates and stores the PKCE verifier, `state`, and `nonce`
in `sessionStorage`. `handleRedirectCallback()` validates `state`, exchanges the
code at `/oauth2/token` with the PKCE verifier, validates the id_token `nonce`,
and enriches the result from `/oauth2/userinfo` when needed. The redirect URI
scheme is validated against an allowlist (HTTPS, RFC 8252 loopback, and custom
schemes) to prevent open-redirect injection.

## Quickstart — inline / modal MFA widget

```ts
import { FivucsasAuth } from '@fivucsas/auth-js';

const auth = new FivucsasAuth({ clientId: 'your-client-id' });

const result = await auth.verify({
  // Omit `container` for a centered modal overlay, or pass a CSS selector /
  // element to mount inline:
  // container: '#verify-mount',
  onStepChange: ({ method, progress, total }) =>
    console.log(`step ${progress}/${total}: ${method}`),
  onError: ({ code, message }) => console.error(code, message),
  onCancel: () => console.log('user cancelled'),
});

console.log(result.success, result.sessionId, result.completedMethods);
```

## Configuration

```ts
new FivucsasAuth({
  clientId: 'your-client-id',     // required
  baseUrl?: 'https://verify.fivucsas.com',          // hosted UI origin
  apiBaseUrl?: 'https://api.fivucsas.com/api/v1',    // identity API base
  locale?: 'en' | 'tr',
  theme?: { mode?: 'light' | 'dark', primaryColor?: string, borderRadius?: string, fontFamily?: string },
});
```

## API

| Member | Description |
| --- | --- |
| `new FivucsasAuth(config)` | Create an SDK instance. |
| `loginRedirect(options)` | Redirect to hosted login (PKCE + state + nonce). |
| `handleRedirectCallback()` | Complete the OAuth code exchange on return. |
| `verify(options)` | Open the inline/modal MFA widget; resolves with a `VerifyResult`. |
| `destroy()` | Tear down any active widget/listeners. |
| `assertSafeRedirectScheme(uri)` | Standalone redirect-URI scheme guard. |
| `decodeJwtPayload(jwt)` / `assertNonceMatches(idToken, nonce)` | Standalone OIDC helpers. |

Exported types: `FivucsasConfig`, `FivucsasTheme`, `VerifyOptions`,
`VerifyResult`, `LoginRedirectOptions`.

## License

MIT © FIVUCSAS Team
