import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'

/**
 * Verification Pipeline API Types
 */
export interface VerificationStepSpec {
    stepOrder: number
    stepType: string
    isRequired: boolean
    confidenceThreshold: number
    timeoutSeconds: number
    config?: Record<string, unknown>
}

export interface VerificationTemplate {
    id: string
    name: string
    description: string
    industry: string
    flowType: string
    steps: VerificationStepSpec[]
    estimatedTimeMinutes: number
    createdAt: string
}

export interface VerificationFlow {
    id: string
    tenantId: string
    name: string
    flowType: string
    templateId?: string
    templateName?: string
    steps: VerificationStepSpec[]
    status: 'active' | 'inactive' | 'draft'
    createdAt: string
    updatedAt: string
}

export interface CreateVerificationFlowCommand {
    name: string
    flowType: string
    templateId?: string
    steps: VerificationStepSpec[]
}

export interface VerificationSessionResponse {
    id: string
    userId: string
    flowId: string
    flowName: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired'
    currentStep: number
    totalSteps: number
    steps: VerificationSessionStep[]
    verificationLevel?: string
    startedAt: string
    completedAt?: string
}

export interface VerificationSessionStep {
    stepOrder: number
    stepType: string
    status: 'pending' | 'completed' | 'failed' | 'skipped'
    confidenceScore?: number
    completedAt?: string
    failureReason?: string
}

export interface VerificationResult {
    userId: string
    verificationLevel: string
    isVerified: boolean
    completedFlows: number
    lastVerifiedAt?: string
}

export interface VerificationStats {
    totalVerifications: number
    completionRate: number
    avgTimeMinutes: number
    failureRate: number
    dailyVerifications: Array<{ date: string; count: number }>
    statusDistribution: Array<{ status: string; count: number }>
    failureReasons: Array<{ reason: string; count: number }>
}

/**
 * Verification Repository
 * Handles verification pipeline API calls
 */
@injectable()
export class VerificationRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Fetch available industry templates
     */
    async getTemplates(): Promise<VerificationTemplate[]> {
        try {
            this.logger.debug('Fetching verification templates')
            const response = await this.httpClient.get<VerificationTemplate[]>(
                '/verification/templates'
            )
            return response.data
        } catch (error) {
            this.logger.error('Failed to fetch verification templates', error)
            throw error
        }
    }

    /**
     * List verification flows for the tenant
     */
    async listFlows(tenantId: string): Promise<VerificationFlow[]> {
        try {
            this.logger.debug('Fetching verification flows', { tenantId })
            const response = await this.httpClient.get<VerificationFlow[]>(
                `/verification/flows`,
                { params: { tenantId } }
            )
            return response.data
        } catch (error) {
            this.logger.error('Failed to fetch verification flows', error)
            throw error
        }
    }

    /**
     * Create a new verification flow
     */
    async createFlow(command: CreateVerificationFlowCommand): Promise<VerificationFlow> {
        try {
            this.logger.info('Creating verification flow', { name: command.name })
            const response = await this.httpClient.post<VerificationFlow>(
                '/verification/flows',
                command
            )
            this.logger.info('Verification flow created', { flowId: response.data.id })
            return response.data
        } catch (error) {
            this.logger.error('Failed to create verification flow', error)
            throw error
        }
    }

    /**
     * Delete a verification flow
     */
    async deleteFlow(flowId: string): Promise<void> {
        try {
            this.logger.info(`Deleting verification flow ${flowId}`)
            await this.httpClient.delete(`/verification/flows/${flowId}`)
            this.logger.info('Verification flow deleted', { flowId })
        } catch (error) {
            this.logger.error(`Failed to delete verification flow ${flowId}`, error)
            throw error
        }
    }

    /**
     * Create a verification session
     */
    async createSession(flowId: string, userId: string): Promise<VerificationSessionResponse> {
        try {
            this.logger.info('Creating verification session', { flowId, userId })
            const response = await this.httpClient.post<VerificationSessionResponse>(
                '/verification/sessions',
                { flowId, userId }
            )
            return response.data
        } catch (error) {
            this.logger.error('Failed to create verification session', error)
            throw error
        }
    }

    /**
     * Get verification session by ID
     */
    async getSession(sessionId: string): Promise<VerificationSessionResponse> {
        try {
            this.logger.debug(`Fetching verification session ${sessionId}`)
            const response = await this.httpClient.get<VerificationSessionResponse>(
                `/verification/sessions/${sessionId}`
            )
            return response.data
        } catch (error) {
            this.logger.error(`Failed to fetch verification session ${sessionId}`, error)
            throw error
        }
    }

    /**
     * Submit step result for a verification session
     */
    async submitStepResult(
        sessionId: string,
        stepOrder: number,
        data: Record<string, unknown>
    ): Promise<VerificationSessionResponse> {
        try {
            this.logger.info('Submitting step result', { sessionId, stepOrder })
            const response = await this.httpClient.post<VerificationSessionResponse>(
                `/verification/sessions/${sessionId}/steps/${stepOrder}`,
                { data }
            )
            return response.data
        } catch (error) {
            this.logger.error('Failed to submit step result', error)
            throw error
        }
    }

    /**
     * List verification sessions with optional filters
     */
    async listSessions(filters?: {
        status?: string
        dateFrom?: string
        dateTo?: string
        templateId?: string
    }): Promise<VerificationSessionResponse[]> {
        try {
            this.logger.debug('Fetching verification sessions', { filters })
            const params: Record<string, unknown> = {}
            if (filters?.status) params.status = filters.status
            if (filters?.dateFrom) params.dateFrom = filters.dateFrom
            if (filters?.dateTo) params.dateTo = filters.dateTo
            if (filters?.templateId) params.templateId = filters.templateId

            const response = await this.httpClient.get<VerificationSessionResponse[]>(
                '/verification/sessions',
                { params }
            )
            return response.data
        } catch (error) {
            this.logger.error('Failed to fetch verification sessions', error)
            throw error
        }
    }

    /**
     * Get user verification result/status
     */
    async getUserResult(userId: string): Promise<VerificationResult> {
        try {
            this.logger.debug(`Fetching verification result for user ${userId}`)
            const response = await this.httpClient.get<VerificationResult>(
                `/verification/results/${userId}`
            )
            return response.data
        } catch (error) {
            this.logger.error(`Failed to fetch verification result for user ${userId}`, error)
            throw error
        }
    }

    /**
     * Get verification statistics/dashboard data
     */
    async getStats(): Promise<VerificationStats> {
        try {
            this.logger.debug('Fetching verification stats')
            const response = await this.httpClient.get<VerificationStats>(
                '/verification/stats'
            )
            return response.data
        } catch (error) {
            this.logger.error('Failed to fetch verification stats', error)
            throw error
        }
    }
}
