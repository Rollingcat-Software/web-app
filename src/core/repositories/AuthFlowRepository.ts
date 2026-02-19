import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'

/**
 * Auth Flow API Types
 */
export interface FlowStepSpec {
    stepOrder: number
    authMethodType: string
    isRequired: boolean
    timeoutSeconds?: number
    maxAttempts?: number
    allowsDelegation?: boolean
    fallbackMethodType?: string
    config?: string
}

export interface AuthFlowResponse {
    id: string
    tenantId: string
    name: string
    description: string
    operationType: string
    steps: FlowStepSpec[]
    isActive: boolean
    isDefault: boolean
    createdAt: string
    updatedAt: string
}

export interface CreateAuthFlowCommand {
    name: string
    description?: string
    operationType: string
    isDefault?: boolean
    steps: FlowStepSpec[]
}

export interface UpdateAuthFlowCommand {
    name?: string
    description?: string
    isDefault?: boolean
    isActive?: boolean
}

/**
 * Auth Flow Repository
 * Handles auth flow configuration API calls
 */
@injectable()
export class AuthFlowRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * List auth flows for a tenant
     */
    async listFlows(tenantId: string, operationType?: string): Promise<AuthFlowResponse[]> {
        try {
            this.logger.debug('Fetching auth flows', { tenantId, operationType })

            const params: Record<string, unknown> = {}
            if (operationType) {
                params.operationType = operationType
            }

            const response = await this.httpClient.get<AuthFlowResponse[]>(
                `/tenants/${tenantId}/auth-flows`,
                { params }
            )

            this.logger.debug('Auth flows fetched', { count: response.data.length })
            return response.data
        } catch (error) {
            this.logger.error('Failed to fetch auth flows', error)
            throw error
        }
    }

    /**
     * Get a single auth flow by ID
     */
    async getFlow(tenantId: string, flowId: string): Promise<AuthFlowResponse> {
        try {
            this.logger.debug(`Fetching auth flow ${flowId}`, { tenantId })

            const response = await this.httpClient.get<AuthFlowResponse>(
                `/tenants/${tenantId}/auth-flows/${flowId}`
            )

            return response.data
        } catch (error) {
            this.logger.error(`Failed to fetch auth flow ${flowId}`, error)
            throw error
        }
    }

    /**
     * Create a new auth flow
     */
    async createFlow(tenantId: string, command: CreateAuthFlowCommand): Promise<AuthFlowResponse> {
        try {
            this.logger.info('Creating auth flow', { tenantId, name: command.name })

            const response = await this.httpClient.post<AuthFlowResponse>(
                `/tenants/${tenantId}/auth-flows`,
                command
            )

            this.logger.info('Auth flow created successfully', { flowId: response.data.id })
            return response.data
        } catch (error) {
            this.logger.error('Failed to create auth flow', error)
            throw error
        }
    }

    /**
     * Update an existing auth flow
     */
    async updateFlow(tenantId: string, flowId: string, command: UpdateAuthFlowCommand): Promise<AuthFlowResponse> {
        try {
            this.logger.info(`Updating auth flow ${flowId}`, { tenantId })

            const response = await this.httpClient.put<AuthFlowResponse>(
                `/tenants/${tenantId}/auth-flows/${flowId}`,
                command
            )

            this.logger.info('Auth flow updated successfully', { flowId })
            return response.data
        } catch (error) {
            this.logger.error(`Failed to update auth flow ${flowId}`, error)
            throw error
        }
    }

    /**
     * Delete an auth flow
     */
    async deleteFlow(tenantId: string, flowId: string): Promise<void> {
        try {
            this.logger.info(`Deleting auth flow ${flowId}`, { tenantId })

            await this.httpClient.delete(`/tenants/${tenantId}/auth-flows/${flowId}`)

            this.logger.info('Auth flow deleted successfully', { flowId })
        } catch (error) {
            this.logger.error(`Failed to delete auth flow ${flowId}`, error)
            throw error
        }
    }
}
