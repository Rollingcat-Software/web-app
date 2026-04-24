/**
 * Stubbed IAuthRepository for Biometric Puzzle playground.
 *
 * Returns canned, deterministic responses so step components can be exercised
 * end-to-end without hitting the real backend. Every `verifyMfaStep` call
 * resolves with `status: 'AUTHENTICATED'` after a 500ms artificial delay.
 */
import { injectable } from 'inversify'
import type {
    AuthResponse,
    IAuthRepository,
    LoginCredentials,
    MfaStepResponse,
} from '@domain/interfaces/IAuthRepository'
import { User, UserRole, UserStatus } from '@domain/models/User'

const STUB_DELAY_MS = 500

/**
 * Creates a deterministic demo user so nothing in the tree trips on null.
 */
function createStubUser(): User {
    return new User(
        'stub-user-1',
        'puzzle@fivucsas.com',
        'Puzzle',
        'Player',
        UserRole.USER,
        UserStatus.ACTIVE,
        'stub-tenant',
        new Date('2026-01-01T00:00:00Z'),
        new Date('2026-01-01T00:00:00Z'),
    )
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

@injectable()
export class StubAuthRepository implements IAuthRepository {
    async login(_credentials: LoginCredentials): Promise<AuthResponse> {
        await delay(STUB_DELAY_MS)
        return {
            accessToken: 'puzzle-stub-access-token',
            refreshToken: 'puzzle-stub-refresh-token',
            user: createStubUser(),
            expiresIn: 3600,
        }
    }

    async logout(): Promise<void> {
        await delay(STUB_DELAY_MS)
    }

    async refresh(_refreshToken: string): Promise<AuthResponse> {
        await delay(STUB_DELAY_MS)
        return {
            accessToken: 'puzzle-stub-access-token-refreshed',
            refreshToken: 'puzzle-stub-refresh-token-refreshed',
            user: createStubUser(),
            expiresIn: 3600,
        }
    }

    async getCurrentUser(): Promise<User> {
        await delay(STUB_DELAY_MS)
        return createStubUser()
    }

    /**
     * Every MFA step succeeds — the puzzle playground is for UX rehearsal only.
     * Returns AUTHENTICATED so consumers that branch on `status` treat the
     * challenge as "done".
     */
    async verifyMfaStep(
        _sessionToken: string,
        _method: string,
        _data: Record<string, unknown>,
    ): Promise<MfaStepResponse> {
        await delay(STUB_DELAY_MS)
        return {
            status: 'AUTHENTICATED',
            message: 'Puzzle stub: verification accepted.',
            accessToken: 'puzzle-stub-access-token',
            refreshToken: 'puzzle-stub-refresh-token',
            expiresIn: 3600,
        }
    }
}

/**
 * Factory — useful where inversify isn't in play (tests, small call sites).
 */
export function createStubAuthRepository(): IAuthRepository {
    return new StubAuthRepository()
}
