import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import { AuthFlowRepository, type AuthFlowResponse, type CreateAuthFlowCommand } from '@core/repositories/AuthFlowRepository'
import type { ILogger } from '@domain/interfaces/ILogger'

/**
 * Auth Flow Service
 * Handles auth flow business logic
 */
@injectable()
export class AuthFlowService {
    constructor(
        @inject(TYPES.AuthFlowRepository) private readonly authFlowRepository: AuthFlowRepository,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    async getFlows(tenantId: string): Promise<AuthFlowResponse[]> {
        try {
            return await this.authFlowRepository.listFlows(tenantId)
        } catch (error) {
            this.logger.error('Failed to get auth flows', error)
            throw error
        }
    }

    async getFlowById(tenantId: string, flowId: string): Promise<AuthFlowResponse> {
        try {
            return await this.authFlowRepository.getFlow(tenantId, flowId)
        } catch (error) {
            this.logger.error(`Failed to get auth flow ${flowId}`, error)
            throw error
        }
    }

    async createFlow(tenantId: string, command: CreateAuthFlowCommand): Promise<AuthFlowResponse> {
        try {
            this.logger.info('Creating auth flow', { name: command.name })
            return await this.authFlowRepository.createFlow(tenantId, command)
        } catch (error) {
            this.logger.error('Failed to create auth flow', error)
            throw error
        }
    }

    async deleteFlow(tenantId: string, flowId: string): Promise<void> {
        try {
            this.logger.info(`Deleting auth flow ${flowId}`)
            await this.authFlowRepository.deleteFlow(tenantId, flowId)
        } catch (error) {
            this.logger.error(`Failed to delete auth flow ${flowId}`, error)
            throw error
        }
    }
}
