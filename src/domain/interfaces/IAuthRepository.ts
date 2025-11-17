import type { User } from '@domain/models/User'

/**
 * Login credentials
 */
export interface LoginCredentials {
    email: string
    password: string
    mfaCode?: string
}

/**
 * Auth response from API
 */
export interface AuthResponse {
    accessToken: string
    refreshToken: string
    user: User
    expiresIn: number // seconds
}

/**
 * Auth Repository interface
 * Handles authentication-related data access
 */
export interface IAuthRepository {
    /**
     * Authenticate user with credentials
     */
    login(credentials: LoginCredentials): Promise<AuthResponse>

    /**
     * Logout user (invalidate tokens on server)
     */
    logout(): Promise<void>

    /**
     * Refresh access token using refresh token
     */
    refresh(refreshToken: string): Promise<AuthResponse>

    /**
     * Get current authenticated user
     */
    getCurrentUser(): Promise<User>
}
