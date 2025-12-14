import { useState, useEffect } from 'react'
import { getCsrfToken } from '@utils/auth'

/**
 * CSRF Token Hook
 *
 * SECURITY: Provides access to CSRF token for forms and manual API calls
 * CSRF (Cross-Site Request Forgery) tokens prevent attackers from making
 * unauthorized requests on behalf of authenticated users.
 *
 * OWASP Best Practices:
 * - CSRF tokens are unique per session
 * - Tokens are validated on the backend for state-changing requests
 * - Tokens are rotated after sensitive operations
 * - Tokens are different from authentication tokens
 *
 * Usage:
 * ```tsx
 * const { csrfToken, isLoading, refresh } = useCsrf()
 *
 * // Token is automatically included in axios requests
 * // But you can use it manually for FormData or custom requests
 * ```
 */
export function useCsrf() {
    const [csrfToken, setCsrfToken] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    /**
     * Load CSRF token from cookie
     */
    const loadToken = () => {
        try {
            const token = getCsrfToken()
            setCsrfToken(token)
            setIsLoading(false)
        } catch (error) {
            console.error('Failed to load CSRF token:', error)
            setCsrfToken(null)
            setIsLoading(false)
        }
    }

    /**
     * Refresh CSRF token (after sensitive operations)
     */
    const refresh = () => {
        loadToken()
    }

    // Load token on mount
    useEffect(() => {
        loadToken()

        // Set up interval to check for token changes
        // CSRF tokens may be rotated by backend
        const interval = setInterval(loadToken, 60000) // Check every minute

        return () => clearInterval(interval)
    }, [])

    return {
        csrfToken,
        isLoading,
        refresh,
        /**
         * Check if CSRF token is available
         */
        hasToken: csrfToken !== null,
    }
}

/**
 * CSRF Token Provider Context (if needed for global access)
 *
 * Example usage:
 * ```tsx
 * import { createContext, useContext } from 'react'
 *
 * const CsrfContext = createContext<ReturnType<typeof useCsrf> | null>(null)
 *
 * export function CsrfProvider({ children }: { children: React.ReactNode }) {
 *     const csrf = useCsrf()
 *     return <CsrfContext.Provider value={csrf}>{children}</CsrfContext.Provider>
 * }
 *
 * export function useCsrfContext() {
 *     const context = useContext(CsrfContext)
 *     if (!context) {
 *         throw new Error('useCsrfContext must be used within CsrfProvider')
 *     }
 *     return context
 * }
 * ```
 */
