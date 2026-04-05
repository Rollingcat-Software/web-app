import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'

/**
 * Auth Session API Types
 */
export interface StartSessionCommand {
    tenantId: string
    userId: string
    operationType: string
    deviceFingerprint?: string
    ipAddress?: string
}

export interface SessionStepResponse {
    stepOrder: number
    authMethodType: string
    isRequired: boolean
    status: string
    completedAt?: string
    delegated?: boolean
}

export interface AuthSessionResponse {
    sessionId: string
    tenantId: string
    userId: string
    operationType: string
    status: string
    currentStepOrder: number
    totalSteps: number
    steps: SessionStepResponse[]
    expiresAt: string
    createdAt: string
    completedAt?: string
}

export interface StepResultResponse {
    sessionId: string
    stepOrder: number
    status: string
    message?: string
    nextStepOrder?: number
    sessionCompleted: boolean
    data?: Record<string, unknown>
}

export interface QrTokenResponse {
    token: string
    expiresInSeconds: number
    userId: string
}

/**
 * User session (refresh token) response — for cross-device session awareness
 */
export interface UserSessionResponse {
    sessionId: string
    ipAddress: string
    userAgent: string
    deviceInfo: string
    createdAt: string
    expiryDate: string
    isCurrent: boolean
}

/**
 * Auth Session Repository
 * Handles auth session runtime API calls
 */
@injectable()
export class AuthSessionRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Start a new auth session
     */
    async startSession(command: StartSessionCommand): Promise<AuthSessionResponse> {
        try {
            this.logger.info('Starting auth session', {
                tenantId: command.tenantId,
                userId: command.userId,
                operationType: command.operationType,
            })

            const response = await this.httpClient.post<AuthSessionResponse>(
                '/auth/sessions',
                command
            )

            this.logger.info('Auth session started', { sessionId: response.data.sessionId })
            return response.data
        } catch (error) {
            this.logger.error('Failed to start auth session', error)
            throw error
        }
    }

    /**
     * Get session by ID
     */
    async getSession(sessionId: string): Promise<AuthSessionResponse> {
        try {
            this.logger.debug(`Fetching auth session ${sessionId}`)

            const response = await this.httpClient.get<AuthSessionResponse>(
                `/auth/sessions/${sessionId}`
            )

            return response.data
        } catch (error) {
            this.logger.error(`Failed to fetch auth session ${sessionId}`, error)
            throw error
        }
    }

    /**
     * Complete a step in the session
     */
    async completeStep(
        sessionId: string,
        stepOrder: number,
        data: Record<string, unknown>
    ): Promise<StepResultResponse> {
        try {
            this.logger.info(`Completing step ${stepOrder} for session ${sessionId}`)

            const response = await this.httpClient.post<StepResultResponse>(
                `/auth/sessions/${sessionId}/steps/${stepOrder}`,
                { data }
            )

            this.logger.info('Step completed', {
                sessionId,
                stepOrder,
                status: response.data.status,
            })
            return response.data
        } catch (error) {
            this.logger.error(`Failed to complete step ${stepOrder} for session ${sessionId}`, error)
            throw error
        }
    }

    /**
     * Skip an optional step in the session
     */
    async skipStep(sessionId: string, stepOrder: number): Promise<StepResultResponse> {
        try {
            this.logger.info(`Skipping step ${stepOrder} for session ${sessionId}`)

            const response = await this.httpClient.post<StepResultResponse>(
                `/auth/sessions/${sessionId}/steps/${stepOrder}/skip`,
                {}
            )

            this.logger.info('Step skipped', {
                sessionId,
                stepOrder,
                status: response.data.status,
            })
            return response.data
        } catch (error) {
            this.logger.error(`Failed to skip step ${stepOrder} for session ${sessionId}`, error)
            throw error
        }
    }

    /**
     * Create a QR session for QR code authentication
     */
    async createQrSession(sessionId: string): Promise<{ qrImageUrl: string; qrSessionId: string }> {
        try {
            this.logger.info(`Creating QR session for auth session ${sessionId}`)

            const response = await this.httpClient.post<{ qrImageUrl: string; qrSessionId: string }>(
                '/auth/qr/session',
                { authSessionId: sessionId }
            )

            return response.data
        } catch (error) {
            this.logger.error(`Failed to create QR session for ${sessionId}`, error)
            throw error
        }
    }

    /**
     * Cancel an active session
     */
    async cancelSession(sessionId: string): Promise<void> {
        try {
            this.logger.info(`Cancelling auth session ${sessionId}`)

            await this.httpClient.post(`/auth/sessions/${sessionId}/cancel`, {})

            this.logger.info('Auth session cancelled', { sessionId })
        } catch (error) {
            this.logger.error(`Failed to cancel auth session ${sessionId}`, error)
            throw error
        }
    }

    /**
     * Generate QR authentication token for a user.
     */
    async generateQrToken(userId: string): Promise<QrTokenResponse> {
        try {
            this.logger.info('Generating QR authentication token', { userId })
            const response = await this.httpClient.post<QrTokenResponse>(`/qr/generate/${userId}`, {})
            return response.data
        } catch (error) {
            this.logger.error(`Failed to generate QR token for user ${userId}`, error)
            throw error
        }
    }

    /**
     * Invalidate QR token.
     */
    async invalidateQrToken(token: string): Promise<void> {
        try {
            this.logger.info('Invalidating QR authentication token')
            await this.httpClient.delete<void>(`/qr/${token}`)
        } catch (error) {
            this.logger.error('Failed to invalidate QR token', error)
            throw error
        }
    }

    // --- User session management (cross-device awareness) ---

    /**
     * Get all active sessions for the authenticated user
     */
    async getActiveSessions(currentTokenId?: string): Promise<UserSessionResponse[]> {
        try {
            this.logger.info('Fetching active user sessions')
            const params = currentTokenId ? `?currentTokenId=${encodeURIComponent(currentTokenId)}` : ''
            const response = await this.httpClient.get<UserSessionResponse[]>(
                `/sessions${params}`
            )
            return response.data
        } catch (error) {
            this.logger.error('Failed to fetch active sessions', error)
            throw error
        }
    }

    /**
     * Revoke a specific session (log out that device)
     */
    async revokeSession(sessionId: string): Promise<void> {
        try {
            this.logger.info(`Revoking session ${sessionId}`)
            await this.httpClient.delete(`/sessions/${sessionId}`)
            this.logger.info('Session revoked successfully', { sessionId })
        } catch (error) {
            this.logger.error(`Failed to revoke session ${sessionId}`, error)
            throw error
        }
    }

    /**
     * Revoke all other sessions (log out from all other devices)
     */
    async revokeAllOtherSessions(currentTokenId: string): Promise<void> {
        try {
            this.logger.info('Revoking all other sessions')
            await this.httpClient.delete(
                `/sessions/all?currentTokenId=${encodeURIComponent(currentTokenId)}`
            )
            this.logger.info('All other sessions revoked')
        } catch (error) {
            this.logger.error('Failed to revoke all other sessions', error)
            throw error
        }
    }
}
