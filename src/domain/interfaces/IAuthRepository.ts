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
 * Available MFA method descriptor returned by the backend
 */
export interface AvailableMfaMethod {
    methodType: string
    name: string
    category: string
    enrolled: boolean
    preferred: boolean
    requiresEnrollment: boolean
}

/**
 * Auth response from API
 */
/** Response from MFA step verification */
export interface MfaStepResponse {
    status: 'STEP_COMPLETED' | 'AUTHENTICATED' | 'FAILED' | 'ERROR' | 'CHALLENGE'
    message?: string
    // Present when status = STEP_COMPLETED
    mfaSessionToken?: string
    currentStep?: number
    totalSteps?: number
    availableMethods?: AvailableMfaMethod[]
    /** Authoritative list of already-completed AuthMethodType names in this MFA session */
    completedMethods?: string[]
    // Present when status = AUTHENTICATED
    accessToken?: string
    refreshToken?: string
    expiresIn?: number
    user?: Record<string, unknown>
    // Present when status = CHALLENGE (WebAuthn challenge data)
    data?: Record<string, string>
}

export interface AuthResponse {
    accessToken: string | null
    refreshToken: string | null
    user: User
    expiresIn: number // seconds
    twoFactorRequired?: boolean
    /** The auth method type for 2FA (e.g. "TOTP", "FACE", "EMAIL_OTP"). Null when twoFactorRequired is false. */
    twoFactorMethod?: string
    /** Session token for multi-step MFA verification */
    mfaSessionToken?: string
    /** Available MFA methods when the user has multiple enrolled */
    availableMethods?: AvailableMfaMethod[]
    /** Authoritative list of already-completed AuthMethodType names (after password passes) */
    completedMethods?: string[]
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

    /**
     * Verify an MFA step (public endpoint, no JWT required)
     */
    verifyMfaStep(sessionToken: string, method: string, data: Record<string, unknown>): Promise<MfaStepResponse>
}
