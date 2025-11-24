import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import type {
    IAuthRepository,
    LoginCredentials,
    AuthResponse,
} from '@domain/interfaces/IAuthRepository'
import { User } from '@domain/models/User'

/**
 * Auth Repository
 * Handles authentication API calls
 */
@injectable()
export class AuthRepository implements IAuthRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Login with credentials
     */
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        try {
            this.logger.info('Attempting login', { email: credentials.email })

            const response = await this.httpClient.post<any>('/auth/login', {
                email: credentials.email,
                password: credentials.password,
                mfaCode: credentials.mfaCode,
            })

            const data = response.data
            this.logger.debug('Auth response data:', data); // Added logging

            this.logger.debug('Access token from data:', data.accessToken); // Added logging
            const authResponse: AuthResponse = {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                expiresIn: data.expiresIn || 3600,
                user: User.fromJSON(data.user),
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
            await this.httpClient.post('/auth/logout')
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

            const response = await this.httpClient.post<any>('/auth/refresh', {
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
     * Get current authenticated user
     */
    async getCurrentUser(): Promise<User> {
        try {
            this.logger.debug('Fetching current user')

            const response = await this.httpClient.get<any>('/auth/me')

            const user = User.fromJSON(response.data)

            this.logger.debug('Current user fetched', { userId: user.id })
            return user
        } catch (error) {
            this.logger.error('Failed to fetch current user', error)
            throw error
        }
    }
}
