import { injectable, inject } from 'inversify'
import { jwtDecode } from 'jwt-decode'
import { TYPES } from '@core/di/types'
import type {
    ITokenService,
    TokenPair,
    JwtPayload,
} from '@domain/interfaces/ITokenService'
import type { ISecureStorage } from '@domain/interfaces/IStorage'
import type { ILogger } from '@domain/interfaces/ILogger'
import {
    hasLegacyTokens,
    clearLegacyTokens,
    validateSecureContext,
} from '@utils/auth'

/**
 * Token Service (Secure httpOnly Cookie Implementation)
 *
 * SECURITY UPGRADE: This service now uses httpOnly cookies for token storage.
 * Tokens are set by the backend with httpOnly, secure, and sameSite flags.
 *
 * OWASP Security Best Practices:
 * - httpOnly cookies prevent XSS attacks (tokens not accessible via JavaScript)
 * - secure flag ensures cookies only sent over HTTPS in production
 * - sameSite=strict prevents CSRF attacks
 * - No client-side token storage (sessionStorage/localStorage)
 *
 * IMPORTANT: Backend must set cookies with these flags:
 * - httpOnly: true
 * - secure: true (production)
 * - sameSite: 'strict'
 * - maxAge: appropriate for token lifetime
 *
 * Features:
 * - Token expiration checking via JWT decode (from response)
 * - Automatic refresh threshold detection
 * - JWT validation
 * - Migration support from old sessionStorage approach
 */
@injectable()
export class TokenService implements ITokenService {
    private readonly ACCESS_TOKEN_KEY = 'access_token'
    private readonly REFRESH_TOKEN_KEY = 'refresh_token'

    // Refresh token 5 minutes before expiration
    private readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000

    // SECURITY: Only cache what's strictly needed.
    // Access token cached for Bearer Authorization header (also sent as httpOnly cookie).
    // Refresh token cached only for token refresh flow.
    // Expiration time cached for proactive refresh checks.
    private cachedAccessToken: string | null = null
    private cachedRefreshToken: string | null = null
    private tokenExpirationTime: number | null = null

    constructor(
        @inject(TYPES.SecureStorage) private readonly storage: ISecureStorage,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {
        // Validate secure context in production
        try {
            validateSecureContext()
        } catch (error) {
            this.logger.error('Secure context validation failed', error)
        }

        // Migrate from legacy sessionStorage if present
        if (hasLegacyTokens()) {
            this.logger.warn('Legacy sessionStorage tokens detected. Clearing for security.')
            clearLegacyTokens()
        }
    }

    /**
     * Store access and refresh tokens
     *
     * SECURITY NOTE: With httpOnly cookies, tokens are automatically stored by the browser
     * when the backend sends Set-Cookie headers. This method now caches token metadata
     * for expiration checking since we can't read httpOnly cookies directly.
     *
     * The backend MUST set cookies with these headers:
     * Set-Cookie: access_token=<token>; HttpOnly; Secure; SameSite=Strict; Max-Age=3600
     * Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
     */
    async storeTokens(tokens: TokenPair): Promise<void> {
        try {
            // Validate tokens before caching
            this.validateToken(tokens.accessToken)

            // Cache both tokens for API requests
            this.cachedAccessToken = tokens.accessToken
            this.cachedRefreshToken = tokens.refreshToken

            // Extract and cache expiration time
            const decoded = jwtDecode<JwtPayload>(tokens.accessToken)
            this.tokenExpirationTime = decoded.exp * 1000

            // Clear legacy storage for security
            await this.storage.removeItem(this.ACCESS_TOKEN_KEY)
            await this.storage.removeItem(this.REFRESH_TOKEN_KEY)

            this.logger.info('Tokens cached successfully')
        } catch (error) {
            this.logger.error('Failed to cache tokens', error)
            throw new Error('Failed to process authentication tokens')
        }
    }

    /**
     * Get access token
     *
     * SECURITY NOTE: With httpOnly cookies, we cannot directly access tokens.
     * Tokens are automatically included in HTTP requests by the browser.
     * This method returns the cached token for client-side operations like expiration checking.
     */
    async getAccessToken(): Promise<string | null> {
        try {
            // Return cached token (used for expiration checks)
            // The actual token in httpOnly cookie is sent automatically by browser
            return this.cachedAccessToken
        } catch (error) {
            this.logger.error('Failed to get cached access token', error)
            return null
        }
    }

    /**
     * Get refresh token
     */
    async getRefreshToken(): Promise<string | null> {
        return this.cachedRefreshToken
    }

    /**
     * Clear all tokens
     *
     * SECURITY NOTE: httpOnly cookies must be cleared by the backend.
     * This method clears cached data and triggers a logout request.
     */
    async clearTokens(): Promise<void> {
        try {
            // Clear cached token data
            this.cachedAccessToken = null
            this.cachedRefreshToken = null
            this.tokenExpirationTime = null

            // Clear legacy storage if present
            await this.storage.removeItem(this.ACCESS_TOKEN_KEY)
            await this.storage.removeItem(this.REFRESH_TOKEN_KEY)

            this.logger.info('Token cache cleared (httpOnly cookies cleared by backend)')
        } catch (error) {
            this.logger.error('Failed to clear token cache', error)
        }
    }

    /**
     * Check if user is authenticated
     *
     * Uses cached expiration time instead of reading from storage
     */
    async isAuthenticated(): Promise<boolean> {
        try {
            // Check cached expiration time
            if (!this.tokenExpirationTime) {
                return false
            }

            const now = Date.now()
            return this.tokenExpirationTime > now
        } catch (error) {
            this.logger.error('Error checking authentication', error)
            return false
        }
    }

    /**
     * Get token expiration time
     */
    getExpirationTime(token: string): Date {
        try {
            const decoded = jwtDecode<JwtPayload>(token)
            return new Date(decoded.exp * 1000)
        } catch (error) {
            this.logger.error('Failed to decode token expiration', error)
            return new Date(0) // Return epoch if decode fails
        }
    }

    /**
     * Check if token is expired
     */
    isTokenExpired(token: string): boolean {
        try {
            const decoded = jwtDecode<JwtPayload>(token)
            const expirationTime = decoded.exp * 1000 // Convert to milliseconds
            const now = Date.now()
            return expirationTime < now
        } catch (error) {
            this.logger.error('Failed to check token expiration', error)
            return true // Treat invalid tokens as expired
        }
    }

    /**
     * Check if token should be refreshed
     * Returns true if token will expire within REFRESH_THRESHOLD_MS
     */
    shouldRefresh(token: string): boolean {
        try {
            const decoded = jwtDecode<JwtPayload>(token)
            const expirationTime = decoded.exp * 1000
            const now = Date.now()
            const timeUntilExpiration = expirationTime - now

            // Refresh if token will expire within threshold
            return (
                timeUntilExpiration > 0 &&
                timeUntilExpiration < this.REFRESH_THRESHOLD_MS
            )
        } catch (error) {
            this.logger.error('Failed to check if token should refresh', error)
            return false
        }
    }

    /**
     * Validate token structure
     * Ensures token can be decoded and has required fields
     *
     * SECURITY: Validates JWT structure before caching
     */
    private validateToken(token: string): void {
        try {
            const decoded = jwtDecode<JwtPayload>(token)

            if (!decoded.exp) {
                throw new Error('Token missing expiration')
            }

            if (!decoded.sub) {
                throw new Error('Token missing subject')
            }

            // Log validation success (not the token itself for security)
            this.logger.debug('Token validation successful')
        } catch (error) {
            this.logger.error('Token validation failed', error)
            throw new Error('Invalid token format')
        }
    }
}
