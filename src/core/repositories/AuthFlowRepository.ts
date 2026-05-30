import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { OperationType } from '@domain/models/AuthMethod'

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
    /**
     * CHOICE step (E): additional accepted method types. When present and
     * non-empty, the user satisfies the step by completing `authMethodType` OR
     * any of these. Backend treats `[authMethodType, ...alternativeMethodTypes]`
     * as a one-of set.
     */
    alternativeMethodTypes?: string[]
    /** Usernameless Layer-1 step (E) — valid only for stepOrder === 1. */
    usernameless?: boolean
}

export interface AuthFlowResponse {
    id: string
    tenantId: string
    name: string
    description: string
    operationType: OperationType
    stepCount: number
    steps: FlowStepSpec[]
    isActive: boolean
    isDefault: boolean
    createdAt: string
    updatedAt: string
}

export interface CreateAuthFlowCommand {
    name: string
    description?: string
    operationType: OperationType
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
 * Per-method breakdown of the lock-out impact of making a flow the default.
 */
export interface AuthFlowDefaultImpactMethod {
    /** Auth method enum, e.g. "SMS_OTP". */
    method: string
    /** Whether this step is a "choice" (one-of) rather than strictly required. */
    choice: boolean
    /** Active users who have already enrolled this method. */
    enrolledUsers: number
    /** Active users who have NOT enrolled this method. */
    missingUsers: number
}

/**
 * Advisory impact analysis returned by
 * GET /tenants/{tenantId}/auth-flows/{flowId}/default-impact.
 *
 * Tells the admin how many active users could be locked out if the flow is
 * made the default for its operation type, broken down per required method.
 */
export interface AuthFlowDefaultImpact {
    flowId: string
    flowName: string
    operationType: OperationType
    /** Total active users subject to this operation type. */
    activeUsers: number
    /** Active users who cannot complete at least one required method. */
    usersAtRisk: number
    methods: AuthFlowDefaultImpactMethod[]
    /**
     * F-web advisory flags (optional — present once agent-api3 emits them):
     *  - usernamelessOnly: every Layer-1 entry is usernameless, so users with
     *    no enrolled discoverable credential cannot start the flow.
     *  - noRecoveryMethod: the flow offers no recovery/fallback factor (e.g.
     *    EMAIL_OTP), so a lost device locks the user out permanently.
     */
    usernamelessOnly?: boolean
    noRecoveryMethod?: boolean
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
     * Fetch the advisory lock-out impact of making a flow the default.
     *
     * Backend: GET /tenants/{tenantId}/auth-flows/{flowId}/default-impact.
     * Used by the "Make Default" confirmation dialog to warn about users who
     * have not enrolled the methods the flow requires. Advisory only — it never
     * blocks the operation.
     */
    async getDefaultImpact(tenantId: string, flowId: string): Promise<AuthFlowDefaultImpact> {
        try {
            this.logger.debug(`Fetching default-impact for auth flow ${flowId}`, { tenantId })

            const response = await this.httpClient.get<AuthFlowDefaultImpact>(
                `/tenants/${tenantId}/auth-flows/${flowId}/default-impact`
            )

            return response.data
        } catch (error) {
            this.logger.error(`Failed to fetch default-impact for auth flow ${flowId}`, error)
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
