/**
 * @fivucsas/auth-js — public entry point (core, side-effect-free).
 *
 * Exports the vanilla `FivucsasAuth` SDK plus its public types and the
 * standalone security helpers. This entry intentionally does NOT import the
 * `<fivucsas-verify>` custom element (which registers itself with
 * `customElements.define` on import) so that the package stays fully
 * tree-shakeable (`"sideEffects": false`). Consumers who want the web
 * component should depend on `@fivucsas/auth-elements` instead.
 *
 * @see ../../packages/auth-js
 */

export { FivucsasAuth } from './FivucsasAuth';
export {
    assertSafeRedirectScheme,
    assertNonceMatches,
    decodeJwtPayload,
} from './FivucsasAuth';
export type {
    FivucsasConfig,
    FivucsasTheme,
    VerifyOptions,
    VerifyResult,
    LoginRedirectOptions,
} from './FivucsasAuth';
