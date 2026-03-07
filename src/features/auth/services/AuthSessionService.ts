import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import {
    AuthSessionRepository,
    type AuthSessionResponse,
    type StartSessionCommand,
    type StepResultResponse,
} from '@core/repositories/AuthSessionRepository'
import type { ILogger } from '@domain/interfaces/ILogger'

/**
 * Auth Session Service
 * Handles auth session business logic
 */
@injectable()
export class AuthSessionService {
    constructor(
        @inject(TYPES.AuthSessionRepository) private readonly authSessionRepository: AuthSessionRepository,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    async startSession(command: StartSessionCommand): Promise<AuthSessionResponse> {
        try {
            this.logger.info('Starting auth session', { operationType: command.operationType })
            return await this.authSessionRepository.startSession(command)
        } catch (error) {
            this.logger.error('Failed to start auth session', error)
            throw error
        }
    }

    async getSession(sessionId: string): Promise<AuthSessionResponse> {
        try {
            return await this.authSessionRepository.getSession(sessionId)
        } catch (error) {
            this.logger.error(`Failed to get auth session ${sessionId}`, error)
            throw error
        }
    }

    async completeStep(
        sessionId: string,
        stepOrder: number,
        data: Record<string, unknown>
    ): Promise<StepResultResponse> {
        try {
            return await this.authSessionRepository.completeStep(sessionId, stepOrder, data)
        } catch (error) {
            this.logger.error(`Failed to complete step ${stepOrder} for session ${sessionId}`, error)
            throw error
        }
    }

    async skipStep(sessionId: string, stepOrder: number): Promise<StepResultResponse> {
        try {
            return await this.authSessionRepository.skipStep(sessionId, stepOrder)
        } catch (error) {
            this.logger.error(`Failed to skip step ${stepOrder} for session ${sessionId}`, error)
            throw error
        }
    }

    async cancelSession(sessionId: string): Promise<void> {
        try {
            await this.authSessionRepository.cancelSession(sessionId)
        } catch (error) {
            this.logger.error(`Failed to cancel auth session ${sessionId}`, error)
            throw error
        }
    }
}
