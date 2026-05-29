/**
 * @fivucsas/auth-elements — public entry point.
 *
 * Registers and exports the `<fivucsas-verify>` custom element. Importing this
 * module has the side effect of calling `customElements.define('fivucsas-verify',
 * …)` (via FivucsasAuthElement), so this package is published with
 * `"sideEffects": ["./dist/*"]` — bundlers must NOT tree-shake the registration
 * away.
 *
 * Usage (bundler / ESM):
 *   import '@fivucsas/auth-elements';        // registers <fivucsas-verify>
 *   import { registerFivucsasElements } from '@fivucsas/auth-elements';
 *   registerFivucsasElements();              // idempotent explicit registration
 *
 * @see ../../packages/auth-elements
 */

import { FivucsasVerifyElement } from './FivucsasAuthElement';

export { FivucsasVerifyElement } from './FivucsasAuthElement';
export { FivucsasAuth } from './FivucsasAuth';
export type {
    FivucsasConfig,
    FivucsasTheme,
    VerifyOptions,
    VerifyResult,
    LoginRedirectOptions,
} from './FivucsasAuth';

/**
 * Explicitly register the `<fivucsas-verify>` custom element. Safe to call
 * multiple times — skips registration if the tag is already defined. The
 * element also self-registers on first import (FivucsasAuthElement module
 * side effect); this function is provided for callers who prefer an explicit,
 * idempotent registration call.
 */
export function registerFivucsasElements(): void {
    if (typeof customElements !== 'undefined' && !customElements.get('fivucsas-verify')) {
        customElements.define('fivucsas-verify', FivucsasVerifyElement);
    }
}
