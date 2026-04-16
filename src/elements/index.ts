/**
 * FIVUCSAS Web Components
 *
 * Exports the <fivucsas-verify> and <fivucsas-button> custom elements.
 *
 * Usage (ESM module):
 *   import { registerFivucsasElements } from '@fivucsas/elements';
 *   registerFivucsasElements();
 *
 * Usage (script tag, UMD / IIFE):
 *   <script src="fivucsas-elements.js"></script>
 *   <!-- Elements are auto-registered when the script loads -->
 */

export { FivucsasVerify } from './FivucsasVerify';
export { FivucsasButton } from './FivucsasButton';

import { FivucsasVerify } from './FivucsasVerify';
import { FivucsasButton } from './FivucsasButton';

/**
 * Register both custom elements. Safe to call multiple times —
 * skips registration if an element is already defined.
 *
 * NOTE: FivucsasVerify is registered first so that the inner
 * <fivucsas-verify> inside FivucsasButton's shadow template is
 * already a known custom element when the button renders.
 */
export function registerFivucsasElements(): void {
    if (!customElements.get('fivucsas-verify')) {
        customElements.define('fivucsas-verify', FivucsasVerify);
    }
    if (!customElements.get('fivucsas-button')) {
        customElements.define('fivucsas-button', FivucsasButton);
    }
}

// Auto-register when loaded as a browser bundle (script tag)
if (typeof window !== 'undefined') {
    registerFivucsasElements();
}
