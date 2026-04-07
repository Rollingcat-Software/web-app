import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import type {
    IAuthRepository,
    LoginCredentials,
    AuthResponse,
    MfaStepResponse,
} from '@domain/interfaces/IAuthRepository'
import { User, type UserJSON } from '@domain/models/User'

/**
 * Auth API Response Types
 * SECURITY: Explicit types prevent type confusion vulnerabilities
 */
interface AuthApiResponse {
    accessToken: string
    refreshToken: string
    expiresIn?: number
    user: UserJSON
    twoFactorRequired?: boolean
    twoFactorMethod?: string
    mfaRequired?: boolean
    mfaSessionToken?: string
    totalSteps?: number
    currentStep?: number
    availableMethods?: Array<{
        methodType: string
        name: string
        category: string
        enrolled: boolean
        preferred: boolean
        requiresEnrollment: boolean
    }>
}

/**
 * Auth Repository
 * Handles authentication API calls
 */
@injectable()
export class AuthRepository implements IAuthRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger,
        @inject(TYPES.TokenService) private readonly tokenService: ITokenService
    ) {}

    /**
     * Login with credentials
     */
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        try {
            this.logger.info('Attempting login', { email: credentials.email })

            // SECURITY: Properly typed API response
            const response = await this.httpClient.post<AuthApiResponse>('/auth/login', {
                email: credentials.email,
                password: credentials.password,
            })

            const data = response.data

            const authResponse: AuthResponse = {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                expiresIn: data.expiresIn || 3600,
                user: User.fromJSON(data.user),
                twoFactorRequired: data.twoFactorRequired ?? data.mfaRequired ?? false,
                twoFactorMethod: data.twoFactorMethod,
                mfaSessionToken: data.mfaSessionToken,
                availableMethods: data.availableMethods,
            }

            this.logger.info('Login successful', { userId: authResponse.user.id })
            return authResponse
        } catch (error) {
            this.logger.error('Login failed', error)
            throw error
        }
    }

    /**
     * Logout (invalidate tokens on server)
     */
    async logout(): Promise<void> {
        try {
            this.logger.info('Logging out')
            const refreshToken = await this.tokenService.getRefreshToken()
            await this.httpClient.post('/auth/logout', {
                refreshToken: refreshToken || '',
            })
            this.logger.info('Logout successful')
        } catch (error) {
            this.logger.warn('Logout API call failed', error)
            // Don't throw - logout should always succeed on client side
        }
    }

    /**
     * Refresh access token
     */
    async refresh(refreshToken: string): Promise<AuthResponse> {
        try {
            this.logger.info('Refreshing token')

            // SECURITY: Properly typed API response
            const response = await this.httpClient.post<AuthApiResponse>('/auth/refresh', {
                refreshToken,
            })

            const data = response.data

            const authResponse: AuthResponse = {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                expiresIn: data.expiresIn || 3600,
                user: User.fromJSON(data.user),
            }

            this.logger.info('Token refresh successful')
            return authResponse
        } catch (error) {
            this.logger.error('Token refresh failed', error)
            throw error
        }
    }

    /**
     * Verify an MFA step (public endpoint — no JWT required, uses session token)
     */
    async verifyMfaStep(sessionToken: string, method: string, data: Record<string, unknown>): Promise<MfaStepResponse> {
        try {
            this.logger.info('Verifying MFA step', { method })
            const response = await this.httpClient.post<MfaStepResponse>('/auth/mfa/step', {
                sessionToken,
                method,
                data,
            })
            return response.data
        } catch (error) {
            this.logger.error('MFA step verification failed', error)
            throw error
        }
    }

    /**
     * Get current authenticated user
     */
    async getCurrentUser(): Promise<User> {
        try {
            this.logger.debug('Fetching current user')

            // SECURITY: Properly typed API response
            const response = await this.httpClient.get<UserJSON>('/auth/me')

            const user = User.fromJSON(response.data)

            this.logger.debug('Current user fetched', { userId: user.id })
            return user
        } catch (error) {
            this.logger.error('Failed to fetch current user', error)
            throw error
        }
    }
}
