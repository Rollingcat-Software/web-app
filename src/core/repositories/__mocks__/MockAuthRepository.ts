import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ILogger } from '@domain/interfaces/ILogger'
import type {
    IAuthRepository,
    LoginCredentials,
    AuthResponse,
} from '@domain/interfaces/IAuthRepository'
import { User, UserRole, UserStatus } from '@domain/models/User'

/**
 * Mock Auth Repository
 * Provides fake authentication for development/testing
 */
@injectable()
export class MockAuthRepository implements IAuthRepository {
    private readonly mockUser: User

    constructor(@inject(TYPES.Logger) private readonly logger: ILogger) {
        // Create mock user
        this.mockUser = new User(
            1,
            'admin@fivucsas.com',
            'Admin',
            'User',
            UserRole.ADMIN,
            UserStatus.ACTIVE,
            1,
            new Date(),
            new Date(),
            new Date(),
            '127.0.0.1'
        )
    }

    /**
     * Mock login - accepts any valid email/password
     */
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        this.logger.info('Mock login', { email: credentials.email })

        // Simulate network delay
        await this.delay(500)

        // Simple validation - accept any email with password >= 6 chars
        if (!credentials.email || credentials.password.length < 6) {
            throw new Error('Invalid credentials')
        }

        // Return mock auth response
        return {
            accessToken: this.generateMockToken(),
            refreshToken: this.generateMockToken('refresh'),
            expiresIn: 3600,
            user: new User(
                this.mockUser.id,
                credentials.email, // Use provided email
                this.mockUser.firstName,
                this.mockUser.lastName,
                this.mockUser.role,
                this.mockUser.status,
                this.mockUser.tenantId,
                this.mockUser.createdAt,
                this.mockUser.updatedAt,
                new Date(), // Update last login
                '127.0.0.1'
            ),
        }
    }

    /**
     * Mock logout
     */
    async logout(): Promise<void> {
        this.logger.info('Mock logout')
        await this.delay(200)
    }

    /**
     * Mock token refresh
     */
    async refresh(refreshToken: string): Promise<AuthResponse> {
        this.logger.info('Mock token refresh')
        await this.delay(300)

        return {
            accessToken: this.generateMockToken(),
            refreshToken,
            expiresIn: 3600,
            user: this.mockUser,
        }
    }

    /**
     * Mock get current user
     */
    async getCurrentUser(): Promise<User> {
        this.logger.debug('Mock get current user')
        await this.delay(200)
        return this.mockUser
    }

    /**
     * Generate mock JWT token
     */
    private generateMockToken(type: 'access' | 'refresh' = 'access'): string {
        const payload = {
            sub: this.mockUser.id.toString(),
            email: this.mockUser.email,
            role: this.mockUser.role,
            type,
            exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            iat: Math.floor(Date.now() / 1000),
        }

        // Simple base64 encoding (not real JWT, but good enough for mock)
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
        const encodedPayload = btoa(JSON.stringify(payload))
        const signature = btoa('mock-signature-' + Date.now())

        return `${header}.${encodedPayload}.${signature}`
    }

    /**
     * Simulate network delay
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
