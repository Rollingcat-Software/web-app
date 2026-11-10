import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import {
    DEFAULT_AUTH_METHODS,
    mapAuthMethodResponseToModel,
    type AuthMethod,
    type AuthMethodApiResponse,
} from '@domain/models/AuthMethod'

@injectable()
export class AuthMethodRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Fetch the login-method catalog from the backend.
     *
     * With a `tenantId` this asks for that tenant's catalog
     * (`/tenants/{id}/auth-methods/catalog`), which also lists methods enabled
     * for that tenant only, such as PUZZLE on a canary tenant. If that endpoint
     * is unavailable it falls back to the global `/auth-methods` catalog, and
     * to DEFAULT_AUTH_METHODS if that fails too.
     */
    async listMethods(tenantId?: string): Promise<AuthMethod[]> {
        try {
            this.logger.debug('Fetching auth methods from backend', { tenantId })
            const response = await this.fetchCatalog(tenantId)

            const mappedMethods = response.data
                .map(mapAuthMethodResponseToModel)
                .filter((method): method is AuthMethod => method !== null)

            if (mappedMethods.length === 0) {
                this.logger.warn('Backend auth methods could not be mapped; using defaults')
                return DEFAULT_AUTH_METHODS
            }

            if (mappedMethods.length !== response.data.length) {
                this.logger.warn('Some backend auth methods were skipped due to unknown type values', {
                    total: response.data.length,
                    mapped: mappedMethods.length,
                })
            }

            return mappedMethods
        } catch (error) {
            this.logger.warn('Failed to fetch auth methods from backend; returning defaults', error)
            return DEFAULT_AUTH_METHODS
        }
    }

    private async fetchCatalog(tenantId?: string) {
        if (tenantId) {
            try {
                return await this.httpClient.get<AuthMethodApiResponse[]>(
                    `/tenants/${encodeURIComponent(tenantId)}/auth-methods/catalog`,
                )
            } catch (error) {
                this.logger.warn('Tenant auth-method catalog unavailable; using the global catalog', error)
            }
        }
        return this.httpClient.get<AuthMethodApiResponse[]>('/auth-methods')
    }
}
