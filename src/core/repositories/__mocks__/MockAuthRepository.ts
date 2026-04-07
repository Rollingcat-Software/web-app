import { injectable } from 'inversify'
import type { AuthResponse, IAuthRepository, LoginCredentials, MfaStepResponse } from '@domain/interfaces/IAuthRepository'
import { User, UserRole, UserStatus } from '@domain/models/User'

@injectable()
export class MockAuthRepository implements IAuthRepository {
    private currentUser: User | null = this.createDefaultUser()

    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        if (!credentials.email || !credentials.password) {
            throw new Error('Invalid credentials')
        }

        const user = new User(
            this.currentUser?.id ?? '1',
            credentials.email,
            this.currentUser?.firstName ?? 'Test',
            this.currentUser?.lastName ?? 'User',
            this.currentUser?.role ?? UserRole.ADMIN,
            UserStatus.ACTIVE,
            this.currentUser?.tenantId ?? '1',
            this.currentUser?.createdAt ?? new Date(),
            new Date()
        )

        this.currentUser = user

        return {
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            user,
            expiresIn: 3600,
        }
    }

    async logout(): Promise<void> {
        this.currentUser = null
    }

    async refresh(_refreshToken: string): Promise<AuthResponse> {
        const user = this.currentUser ?? this.createDefaultUser()
        return {
            accessToken: 'mock-access-token-refreshed',
            refreshToken: 'mock-refresh-token-refreshed',
            user,
            expiresIn: 3600,
        }
    }

    async getCurrentUser(): Promise<User> {
        return this.currentUser ?? this.createDefaultUser()
    }

    async verifyMfaStep(_sessionToken: string, _method: string, _data: Record<string, unknown>): Promise<MfaStepResponse> {
        return { status: 'AUTHENTICATED', accessToken: 'mock-token', refreshToken: 'mock-refresh' }
    }

    private createDefaultUser(): User {
        return new User(
            '1',
            'admin@fivucsas.com',
            'Admin',
            'User',
            UserRole.ADMIN,
            UserStatus.ACTIVE,
            '1',
            new Date(),
            new Date()
        )
    }
}
