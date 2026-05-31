import type { User } from '@domain/models/User'
import type { LoginConfig } from '@domain/models/LoginConfig'

/**
 * Login credentials
 */
export interface LoginCredentials {
    email: string
    password: string
    mfaCode?: string
    /**
     * Optional OAuth2 client_id when login originates from a hosted-login or
     * widget surface bound to a specific tenant. When present, the backend
     * applies a tenant-lock: if the user's home tenant does not match the
     * client's bound tenant, login is rejected at the password step with
     * HTTP 403 + errorCode TENANT_MISMATCH (carrying `requiredTenant`).
     * See T-TENANT-GATE 2026-05-07.
     */
    clientId?: string
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
    /** 1-based index of the step the flow is now ON (backend-authoritative). */
    currentStep?: number
    /** Total number of steps in the resolved login flow (backend-authoritative). */
    totalSteps?: number
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
     * Begin an identifier-first (password-less) login flow.
     *
     * Used when the tenant's login-config offers a Layer-1 flow that does NOT
     * include PASSWORD (e.g. EMAIL_OTP-first). The backend opens an MFA session
     * for the identifier and returns the available Layer-1 methods +
     * `mfaSessionToken`, which then drives the existing `/auth/mfa/step`
     * machinery. POST /auth/login/begin (provisional — agent-api3 task #16).
     */
    beginIdentifierLogin(identifier: string, clientId?: string): Promise<AuthResponse>

    /**
     * Identifier-first pre-flight: check whether `identifier` (email) is eligible
     * to sign in on a tenant-bound hosted surface, WITHOUT a password. Resolves
     * when eligible; REJECTS with the backend's HTTP 403 + errorCode
     * `TENANT_MISMATCH` (carrying `requiredTenant`) when the email belongs to a
     * different tenant — so the login UI shows "not a {tenant} member" on the
     * EMAIL step instead of one step later at the password step. No password is
     * sent and no lockout counter is touched. POST /auth/login/preflight.
     *
     * Resolves with the caller's tenant login-config (Layer-1 methods + step
     * count) when the backend can resolve the email to a tenant, else `null`
     * (unknown email / older API). The cross-tenant dashboard uses it to show
     * the real flow ("1/3") at the email step. Still REJECTS with 403
     * `TENANT_MISMATCH` on a tenant-locked surface.
     */
    checkLoginEligibility(identifier: string, clientId?: string): Promise<LoginConfig | null>

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
