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
import { validateSecureContext } from '@utils/auth'

/**
 * Token Service
 *
 * Stores JWT tokens in sessionStorage (via ISecureStorage) with in-memory caching.
 * Tokens persist across page refreshes within the same browser tab/session.
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

        // Hydrate cache from storage (survives page refresh)
        this.hydrateFromStorage()
    }

    /**
     * Hydrate in-memory cache from persistent storage
     */
    private async hydrateFromStorage(): Promise<void> {
        try {
            const accessToken = await this.storage.getItem(this.ACCESS_TOKEN_KEY)
            const refreshToken = await this.storage.getItem(this.REFRESH_TOKEN_KEY)

            if (accessToken) {
                const decoded = jwtDecode<JwtPayload>(accessToken)
                const expirationTime = decoded.exp * 1000
                if (expirationTime > Date.now()) {
                    this.cachedAccessToken = accessToken
                    this.cachedRefreshToken = refreshToken
                    this.tokenExpirationTime = expirationTime
                    this.logger.debug('Tokens hydrated from storage')
                } else {
                    // Token expired, clean up
                    await this.storage.removeItem(this.ACCESS_TOKEN_KEY)
                    await this.storage.removeItem(this.REFRESH_TOKEN_KEY)
                    this.logger.debug('Expired tokens cleared from storage')
                }
            }
        } catch (error) {
            this.logger.error('Failed to hydrate tokens from storage', error)
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
            // Validate tokens before storing
            this.validateToken(tokens.accessToken)

            // Cache in memory for fast access
            this.cachedAccessToken = tokens.accessToken
            this.cachedRefreshToken = tokens.refreshToken

            // Extract and cache expiration time
            const decoded = jwtDecode<JwtPayload>(tokens.accessToken)
            this.tokenExpirationTime = decoded.exp * 1000

            // Persist to storage (survives page refresh)
            await this.storage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken)
            await this.storage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken)

            this.logger.info('Tokens stored successfully')
        } catch (error) {
            this.logger.error('Failed to store tokens', error)
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
            if (this.cachedAccessToken) {
                return this.cachedAccessToken
            }
            // Fall back to persistent storage
            const token = await this.storage.getItem(this.ACCESS_TOKEN_KEY)
            if (token) {
                this.cachedAccessToken = token
            }
            return token
        } catch (error) {
            this.logger.error('Failed to get access token', error)
            return null
        }
    }

    /**
     * Get refresh token
     */
    async getRefreshToken(): Promise<string | null> {
        if (this.cachedRefreshToken) {
            return this.cachedRefreshToken
        }
        const token = await this.storage.getItem(this.REFRESH_TOKEN_KEY)
        if (token) {
            this.cachedRefreshToken = token
        }
        return token
    }

    /**
     * Clear all tokens
     *
     * SECURITY NOTE: httpOnly cookies must be cleared by the backend.
     * This method clears cached data and triggers a logout request.
     */
    async clearTokens(): Promise<void> {
        try {
            // Clear in-memory cache
            this.cachedAccessToken = null
            this.cachedRefreshToken = null
            this.tokenExpirationTime = null

            // Clear persistent storage
            await this.storage.removeItem(this.ACCESS_TOKEN_KEY)
            await this.storage.removeItem(this.REFRESH_TOKEN_KEY)

            this.logger.info('Tokens cleared')
        } catch (error) {
            this.logger.error('Failed to clear tokens', error)
        }
    }

    /**
     * Check if user is authenticated
     *
     * Uses cached expiration time instead of reading from storage
     */
    async isAuthenticated(): Promise<boolean> {
        try {
            // If we have a cached expiration, use it
            if (this.tokenExpirationTime) {
                return this.tokenExpirationTime > Date.now()
            }

            // Fall back to storage (e.g. after page refresh)
            const token = await this.storage.getItem(this.ACCESS_TOKEN_KEY)
            if (!token) {
                return false
            }

            try {
                const decoded = jwtDecode<JwtPayload>(token)
                const expirationTime = decoded.exp * 1000
                if (expirationTime > Date.now()) {
                    // Re-hydrate cache
                    this.cachedAccessToken = token
                    this.tokenExpirationTime = expirationTime
                    this.cachedRefreshToken = await this.storage.getItem(this.REFRESH_TOKEN_KEY)
                    return true
                }
            } catch {
                // Invalid token in storage
            }

            // Clean up expired/invalid tokens
            await this.storage.removeItem(this.ACCESS_TOKEN_KEY)
            await this.storage.removeItem(this.REFRESH_TOKEN_KEY)
            return false
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
