import type { User } from '@domain/models/User'
import type { LoginCredentials } from './IAuthRepository'

/**
 * Auth result after successful login
 */
export interface AuthResult {
    user: User
    expiresAt: Date
    twoFactorRequired?: boolean
    /** The auth method type for 2FA (e.g. "TOTP", "FACE", "EMAIL_OTP"). Null when twoFactorRequired is false. */
    twoFactorMethod?: string
}

/**
 * Auth Service interface
 * Handles authentication business logic
 */
export interface IAuthService {
    /**
     * Login with credentials
     * @throws ValidationError if credentials are invalid
     * @throws UnauthorizedError if authentication fails
     */
    login(credentials: LoginCredentials): Promise<AuthResult>

    /**
     * Logout current user
     * Clears tokens and invalidates session
     */
    logout(): Promise<void>

    /**
     * Refresh authentication token
     * @throws UnauthorizedError if refresh fails
     */
    refreshToken(): Promise<void>

    /**
     * Get current authenticated user
     * @returns User if authenticated, null otherwise
     */
    getCurrentUser(): Promise<User | null>

    /**
     * Check if user is currently authenticated
     */
    isAuthenticated(): Promise<boolean>
}
