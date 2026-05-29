# @fivucsas/auth-elements

The `<fivucsas-verify>` **Web Component** — a framework-agnostic custom element
that drops the [FIVUCSAS](https://fivucsas.com) biometric authentication flow
into any page with a single HTML tag. Built on top of
[`@fivucsas/auth-js`](https://www.npmjs.com/package/@fivucsas/auth-js) (inlined,
zero runtime dependencies), Shadow-DOM isolated.

## Install

```bash
npm install @fivucsas/auth-elements
```

Importing the package registers the `<fivucsas-verify>` custom element:

```ts
import '@fivucsas/auth-elements'; // registers <fivucsas-verify>
```

Or, idempotently, via the explicit registration function:

```ts
import { registerFivucsasElements } from '@fivucsas/auth-elements';
registerFivucsasElements();
```

Or straight from a CDN, no build step (IIFE global `FivucsasElements`,
auto-registers on load):

```html
<script src="https://unpkg.com/@fivucsas/auth-elements"></script>
```

## Usage

```html
<fivucsas-verify
  client-id="your-client-id"
  flow="login"
  locale="en"
  theme='{"mode":"dark"}'
  auto-verify
></fivucsas-verify>

<script>
  const el = document.querySelector('fivucsas-verify');
  el.addEventListener('fivucsas-complete', (e) => console.log('done', e.detail));
  el.addEventListener('fivucsas-error', (e) => console.error(e.detail));
  el.addEventListener('fivucsas-cancel', () => console.log('cancelled'));
  el.addEventListener('fivucsas-step-change', (e) => console.log(e.detail));
  // Or trigger programmatically:
  // el.startVerification();
</script>
```

### Attributes

| Attribute | Description |
| --- | --- |
| `client-id` | **Required.** Your FIVUCSAS OAuth client ID. |
| `flow` | Auth flow identifier (e.g. `login`). |
| `user-id` | Pre-bind the verification to a known user. |
| `locale` | `en` or `tr`. |
| `theme` | JSON string, e.g. `'{"mode":"dark"}'`. |
| `base-url` | Override the hosted UI origin. |
| `api-base-url` | Override the identity API base URL. |
| `auto-verify` | Present → start verification on mount. |

### Events

`fivucsas-complete` (detail: `VerifyResult`), `fivucsas-error`
(detail: `{ code?, message }`), `fivucsas-cancel`, `fivucsas-step-change`
(detail: `{ method, progress, total }`). All bubble and cross shadow boundaries
(`composed: true`).

## License

MIT © FIVUCSAS Team
