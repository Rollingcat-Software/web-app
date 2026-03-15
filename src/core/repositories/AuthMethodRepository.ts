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
     * Fetch auth methods from backend.
     * Falls back to DEFAULT_AUTH_METHODS if the API call fails.
     */
    async listMethods(): Promise<AuthMethod[]> {
        try {
            this.logger.debug('Fetching auth methods from backend')
            const response = await this.httpClient.get<AuthMethodApiResponse[]>('/auth-methods')

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
}
