/**
 * Centralized environment configuration (P0-Q1, QUALITY_REVIEW_2026-05-01.md).
 *
 * Before this module existed, 12 different call-sites read
 * `import.meta.env.VITE_API_BASE_URL` directly with three different inline
 * fallbacks (`/api/v1`, `http://localhost:8080/api/v1`, `https://api.fivucsas.com/api/v1`).
 * That meant a future Hostinger build with the env var unset would produce a
 * partially-broken SPA — login points at localhost (ECONNREFUSED) while
 * biometric routes target prod and "half work".
 *
 * This module is now the only place in the codebase allowed to read the env
 * var. It fails fast at module-load time if the var is unset, surfacing a
 * boot-time error instead of an obscure ECONNREFUSED at first request.
 *
 * Test environments: vitest stubs `import.meta.env.VITE_API_BASE_URL` via the
 * vite-env.d.ts type and the dev `.env.example` default. Tests that need a
 * specific URL should import `config.apiBaseUrl` and let vitest's env layer
 * resolve it; setting `VITE_API_BASE_URL` in `vitest.config` or a
 * `.env.test.local` works as a single source of truth.
 *
 * If you need to add a new env-driven config value, extend this module —
 * never reach for `import.meta.env.*` directly elsewhere.
 */

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!RAW_API_BASE_URL || typeof RAW_API_BASE_URL !== 'string') {
    // Fail-fast at boot. Throwing here causes the SPA to crash visibly at
    // module evaluation time, which is exponentially easier to triage than a
    // silent fallback that only manifests when one specific feature is touched.
    throw new Error(
        'VITE_API_BASE_URL is not configured. Set it in .env.<mode> (see .env.example) ' +
            'before building or running the app.'
    )
}

export interface AppConfig {
    /** Identity-core-api origin + path, e.g. https://api.fivucsas.com/api/v1 */
    readonly apiBaseUrl: string
}

export const config: AppConfig = Object.freeze({
    apiBaseUrl: RAW_API_BASE_URL,
})
