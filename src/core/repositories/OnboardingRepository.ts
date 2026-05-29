import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import type {
    IOnboardingRepository,
    RegisterTenantData,
    TenantOnboardingResult,
} from '@domain/interfaces/IOnboardingRepository'

/**
 * Onboarding Repository
 *
 * Drives the PUBLIC self-service tenant sign-up endpoints. Neither call carries
 * an Authorization header — they are reachable before any user/tenant exists.
 */
@injectable()
export class OnboardingRepository implements IOnboardingRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Register a new organisation (public self-service). On 201 the backend has
     * created the tenant in TRIAL state and emailed a verification link.
     */
    async registerTenant(data: RegisterTenantData): Promise<TenantOnboardingResult> {
        try {
            this.logger.info('Registering organisation', { orgName: data.orgName })

            const response = await this.httpClient.post<TenantOnboardingResult>(
                '/onboarding/register',
                data
            )

            this.logger.info('Organisation registered successfully', { orgName: data.orgName })
            return response.data
        } catch (error) {
            this.logger.error('Failed to register organisation', error)
            throw error
        }
    }

    /**
     * Verify the admin email and activate the TRIAL tenant. Uses the POST
     * variant of the endpoint with the token in the request body.
     */
    async verifyEmail(token: string): Promise<void> {
        try {
            this.logger.info('Verifying onboarding email')

            await this.httpClient.post('/onboarding/verify-email', { token })

            this.logger.info('Onboarding email verified successfully')
        } catch (error) {
            this.logger.error('Failed to verify onboarding email', error)
            throw error
        }
    }
}
