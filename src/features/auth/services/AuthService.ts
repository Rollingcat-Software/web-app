import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IAuthService, AuthResult } from '@domain/interfaces/IAuthService'
import type { IAuthRepository, LoginCredentials } from '@domain/interfaces/IAuthRepository'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import type { ILogger } from '@domain/interfaces/ILogger'
import { User } from '@domain/models/User'
import { UnauthorizedError } from '@core/errors'
import { validateLoginCredentials } from '@domain/validators/authValidator'
import i18n from '@/i18n/index'

/**
 * Auth Service
 * Handles authentication business logic
 */
@injectable()
export class AuthService implements IAuthService {
    private static readonly MAX_LOGIN_ATTEMPTS = 5
    private static readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes
    private loginAttempts = 0
    private lockoutUntil: number | null = null

    constructor(
        @inject(TYPES.AuthRepository) private readonly authRepository: IAuthRepository,
        @inject(TYPES.TokenService) private readonly tokenService: ITokenService,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Login with credentials
     */
    async login(credentials: LoginCredentials): Promise<AuthResult> {
        // Check rate limit
        if (this.lockoutUntil && Date.now() < this.lockoutUntil) {
            const remainingSeconds = Math.ceil((this.lockoutUntil - Date.now()) / 1000)
            throw new UnauthorizedError(
                i18n.t('mfa.errors.rateLimited', { seconds: remainingSeconds })
            )
        }

        // Reset lockout if expired
        if (this.lockoutUntil && Date.now() >= this.lockoutUntil) {
            this.lockoutUntil = null
            this.loginAttempts = 0
        }

        // Validate credentials — re-throw the raw ZodError so the caller
        // (LoginPage / hosted login) can render localized field messages via
        // formatApiError(err, t). We intentionally do not extract
        // `err.message` (Zod's English defaults would leak to the UI).
        const validation = validateLoginCredentials(credentials)
        if (!validation.success && validation.errors) {
            this.logger.warn('Login validation failed', { errors: validation.errors })
            throw validation.errors
        }

        try {
            // Authenticate with repository
            const response = await this.authRepository.login(credentials)

            const mfaPending = response.twoFactorRequired && !response.accessToken

            // Only store tokens if MFA is NOT pending (JWT issued)
            if (!mfaPending && response.accessToken) {
                await this.tokenService.storeTokens({
                    accessToken: response.accessToken,
                    refreshToken: response.refreshToken!,
                })
            }

            // Calculate expiration time
            const expiresAt = mfaPending
                ? new Date(Date.now() + 600000)  // 10 min MFA session TTL
                : new Date(Date.now() + response.expiresIn * 1000)

            // Reset attempts on success
            this.loginAttempts = 0
            this.lockoutUntil = null

            this.logger.info('User logged in successfully', {
                userId: response.user.id,
                email: response.user.email,
            })

            return {
                user: response.user,
                expiresAt,
                twoFactorRequired: response.twoFactorRequired ?? false,
                twoFactorMethod: response.twoFactorMethod ?? undefined,
                mfaSessionToken: response.mfaSessionToken ?? undefined,
                availableMethods: response.availableMethods ?? undefined,
                completedMethods: response.completedMethods ?? undefined,
            }
        } catch (error) {
            // Track failed attempts
            this.loginAttempts++
            if (this.loginAttempts >= AuthService.MAX_LOGIN_ATTEMPTS) {
                this.lockoutUntil = Date.now() + AuthService.LOCKOUT_DURATION_MS
                this.logger.warn('Login rate limit reached, account locked out', {
                    attempts: this.loginAttempts,
                    lockoutMinutes: AuthService.LOCKOUT_DURATION_MS / 60000,
                })
            }

            this.logger.error('Login failed', error)

            // Re-throw the original error untouched. Wrapping a 401 axios error
            // in a fresh `UnauthorizedError` strips the `response` property,
            // which is the very thing `formatApiError(err, t)` reads to map the
            // HTTP status + backend `errorCode` to the correct localized
            // message (auth.invalidCredentials for INVALID_CREDENTIALS,
            // mfa.errors.required for MFA_REQUIRED, etc.). With the wrapper in
            // place the call always fell through to `errors.unknown`
            // ("Beklenmeyen bir hata oluştu") — see USER-BUG-6.
            throw error
        }
    }

    /**
     * Logout current user
     */
    async logout(): Promise<void> {
        try {
            // Call logout on repository (to invalidate server-side session)
            await this.authRepository.logout()
        } catch (error) {
            // Log but don't fail - logout should always succeed on client
            this.logger.warn('Logout API call failed', error)
        } finally {
            // Always clear tokens locally
            await this.tokenService.clearTokens()
            this.logger.info('User logged out')
        }
    }

    /**
     * Refresh authentication token
     */
    async refreshToken(): Promise<void> {
        const refreshToken = await this.tokenService.getRefreshToken()

        if (!refreshToken) {
            throw new UnauthorizedError('No refresh token available')
        }

        try {
            const response = await this.authRepository.refresh(refreshToken)

            // Store new tokens
            await this.tokenService.storeTokens({
                accessToken: response.accessToken!,
                refreshToken: response.refreshToken!,
            })

            this.logger.info('Token refreshed successfully')
        } catch (error) {
            this.logger.error('Token refresh failed', error)

            // Clear tokens on refresh failure
            await this.tokenService.clearTokens()

            throw new UnauthorizedError('Session expired. Please login again.')
        }
    }

    /**
     * Get current authenticated user
     */
    async getCurrentUser(): Promise<User | null> {
        const isAuthenticated = await this.tokenService.isAuthenticated()

        if (!isAuthenticated) {
            return null
        }

        try {
            const user = await this.authRepository.getCurrentUser()
            return user
        } catch (error) {
            this.logger.error('Failed to get current user', error)

            // Clear tokens if we can't get user (invalid session)
            await this.tokenService.clearTokens()

            return null
        }
    }

    /**
     * Check if user is authenticated
     */
    async isAuthenticated(): Promise<boolean> {
        return this.tokenService.isAuthenticated()
    }
}
