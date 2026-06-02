/**
 * Authentication storage utilities.
 *
 * REALITY (do not let the names below mislead you): access + refresh tokens are
 * currently held in `sessionStorage`, NOT in httpOnly cookies. The API is a
 * pure-Bearer JSON API (no cookie auth, CSRF intentionally disabled). XSS token
 * theft is mitigated by a strong CSP and a short (15-min) access-token TTL, not
 * by httpOnly. Moving tokens to backend-set httpOnly cookies is a tracked
 * post-launch hardening item; until then this module only CLEARS the
 * sessionStorage tokens (logout / legacy migration) and validates the secure
 * context. The cookie helpers below are reserved for that future migration and
 * are inert today (the backend sets no such cookies).
 */

/**
 * Cookie names RESERVED for the future httpOnly-cookie migration.
 * NOT active today — the backend sets none of these; tokens live in
 * sessionStorage. Kept so the migration has a single source of truth.
 */
export const COOKIE_CONFIG = {
    ACCESS_TOKEN_COOKIE: 'access_token',
    REFRESH_TOKEN_COOKIE: 'refresh_token',
    CSRF_TOKEN_COOKIE: 'csrf_token',
} as const

/**
 * Check if running in secure context (HTTPS or localhost)
 */
export function isSecureContext(): boolean {
    if (typeof window === 'undefined') return false

    return (
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
    )
}

/**
 * Get CSRF token from cookie
 * Unlike httpOnly cookies, CSRF tokens are readable by JavaScript
 * so they can be included in request headers
 */
export function getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null

    const cookies = document.cookie.split(';')
    const csrfCookie = cookies.find(cookie =>
        cookie.trim().startsWith(`${COOKIE_CONFIG.CSRF_TOKEN_COOKIE}=`)
    )

    if (!csrfCookie) return null

    // Handle URL-encoded cookie values by using decodeURIComponent
    const value = csrfCookie.substring(csrfCookie.indexOf('=') + 1).trim()
    try {
        return decodeURIComponent(value) || null
    } catch {
        return value || null
    }
}

/**
 * Check if authentication cookies exist
 * Note: We can't read httpOnly cookies, but we can check if they're present
 * by attempting an authenticated request
 */
export function hasAuthCookies(): boolean {
    if (typeof document === 'undefined') return false

    // Check for CSRF token as indicator that auth cookies may exist
    // The actual access_token is httpOnly and not readable
    const csrfToken = getCsrfToken()
    return csrfToken !== null
}

/**
 * Clear all authentication state from client storage (sessionStorage +
 * legacy localStorage patterns). This is where the live tokens actually are.
 * Consolidates cleanup of all token patterns into one function.
 */
export function clearAuthState(): void {
    if (typeof window === 'undefined') return

    // Clear all known legacy token patterns from sessionStorage
    const sessionKeys = [
        'access_token',
        'refresh_token',
        'fivucsas_dev_access_token',
        'fivucsas_dev_refresh_token',
        'fivucsas_prod_access_token',
        'fivucsas_prod_refresh_token',
    ]
    sessionKeys.forEach(key => sessionStorage.removeItem(key))

    // Clear all known legacy token patterns from localStorage
    const localKeys = [
        'persist:auth',
        'fivucsas_token',
    ]
    localKeys.forEach(key => localStorage.removeItem(key))
}

/**
 * Validate secure context in production
 * Throws error if not using HTTPS in production
 */
export function validateSecureContext(): void {
    const isProduction = import.meta.env.PROD

    if (isProduction && !isSecureContext()) {
        throw new Error(
            'Security Error: Application must be served over HTTPS in production. ' +
            'Secure authentication requires a secure context.'
        )
    }
}

/**
 * Migration: clear any legacy tokens left behind from previous storage patterns.
 * Call once on app startup. Safe to call multiple times (idempotent).
 */
export function clearLegacyTokens(): void {
    clearAuthState()
}
