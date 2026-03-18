/**
 * Secure Authentication Utilities
 *
 * SECURITY: This module provides utilities for secure token management using httpOnly cookies.
 * Tokens are stored in httpOnly cookies (set by backend) which are not accessible via JavaScript,
 * providing protection against XSS attacks.
 *
 * OWASP Security Best Practices:
 * - httpOnly cookies prevent XSS token theft
 * - secure flag ensures cookies only sent over HTTPS
 * - sameSite=strict prevents CSRF attacks
 * - No client-side token storage in localStorage/sessionStorage
 */

/**
 * Cookie configuration for secure token storage
 * These settings should match the backend cookie configuration
 */
export const COOKIE_CONFIG = {
    // httpOnly: true - Set by backend, not accessible via JavaScript
    // secure: true - Only sent over HTTPS in production
    // sameSite: 'strict' - Prevents CSRF attacks
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
 * Clear all authentication state from client storage.
 * Consolidates cleanup of all legacy token patterns into one function.
 * Note: httpOnly cookies can only be cleared by the backend logout endpoint.
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
            'httpOnly cookies and secure authentication require a secure context.'
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
