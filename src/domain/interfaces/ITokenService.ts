/**
 * Token Service interface
 * Defines contract for JWT token management
 */
export interface ITokenService {
    /**
     * Store access and refresh tokens securely
     */
    storeTokens(tokens: TokenPair): Promise<void>

    /**
     * Get access token
     * @returns Access token if exists, null otherwise
     */
    getAccessToken(): Promise<string | null>

    /**
     * Get refresh token
     * @returns Refresh token if exists, null otherwise
     */
    getRefreshToken(): Promise<string | null>

    /**
     * Clear all tokens (used during logout)
     */
    clearTokens(): Promise<void>

    /**
     * Check if user is authenticated (has valid, non-expired token)
     */
    isAuthenticated(): Promise<boolean>

    /**
     * Get token expiration time
     */
    getExpirationTime(token: string): Date

    /**
     * Check if token is expired
     */
    isTokenExpired(token: string): boolean

    /**
     * Check if token should be refreshed
     * Returns true if token will expire within the refresh threshold
     */
    shouldRefresh(token: string): boolean
}

/**
 * Token pair (access + refresh)
 */
export interface TokenPair {
    accessToken: string
    refreshToken: string
}

/**
 * JWT Payload structure
 */
export interface JwtPayload {
    exp: number // Expiration time (seconds since epoch)
    iat: number // Issued at (seconds since epoch)
    sub: string // Subject (user ID)
    [key: string]: unknown // Additional claims
}
