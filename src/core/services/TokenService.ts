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

/**
 * Token Service
 * Manages JWT tokens (access and refresh tokens)
 *
 * Features:
 * - Secure token storage (sessionStorage)
 * - Token expiration checking
 * - Automatic refresh threshold detection
 * - JWT decoding and validation
 *
 * Security Notes:
 * - Uses sessionStorage (cleared on tab close)
 * - Tokens are not accessible after logout
 * - Validates token structure before storing
 */
@injectable()
export class TokenService implements ITokenService {
    private readonly ACCESS_TOKEN_KEY = 'access_token'
    private readonly REFRESH_TOKEN_KEY = 'refresh_token'

    // Refresh token 5 minutes before expiration
    private readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000

    constructor(
        @inject(TYPES.SecureStorage) private readonly storage: ISecureStorage,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Store access and refresh tokens
     */
    async storeTokens(tokens: TokenPair): Promise<void> {
        try {
            // Validate tokens before storing
            this.validateToken(tokens.accessToken)
            this.validateToken(tokens.refreshToken)

            await Promise.all([
                this.storage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken),
                this.storage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken),
            ])

            this.logger.info('Tokens stored successfully')
        } catch (error) {
            this.logger.error('Failed to store tokens', error)
            throw new Error('Failed to store authentication tokens')
        }
    }

    /**
     * Get access token
     */
    async getAccessToken(): Promise<string | null> {
        try {
            const token = await this.storage.getItem(this.ACCESS_TOKEN_KEY)
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
        try {
            const token = await this.storage.getItem(this.REFRESH_TOKEN_KEY)
            return token
        } catch (error) {
            this.logger.error('Failed to get refresh token', error)
            return null
        }
    }

    /**
     * Clear all tokens
     */
    async clearTokens(): Promise<void> {
        try {
            await Promise.all([
                this.storage.removeItem(this.ACCESS_TOKEN_KEY),
                this.storage.removeItem(this.REFRESH_TOKEN_KEY),
            ])
            this.logger.info('Tokens cleared successfully')
        } catch (error) {
            this.logger.error('Failed to clear tokens', error)
        }
    }

    /**
     * Check if user is authenticated
     */
    async isAuthenticated(): Promise<boolean> {
        try {
            const token = await this.getAccessToken()
            if (!token) {
                return false
            }
            return !this.isTokenExpired(token)
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
     */
    private validateToken(token: string): void {
        this.logger.debug('Validating token: ' + token); // Added logging
        try {
            const decoded = jwtDecode<JwtPayload>(token)

            if (!decoded.exp) {
                throw new Error('Token missing expiration')
            }

            if (!decoded.sub) {
                throw new Error('Token missing subject')
            }
        } catch (error) {
            this.logger.error('Token validation failed', error)
            throw new Error('Invalid token format')
        }
    }
}
