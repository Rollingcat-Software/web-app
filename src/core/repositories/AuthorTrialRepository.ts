import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { IAuthorTrialRepository } from '@domain/interfaces/IAuthorTrialRepository'
import type {
    AuthorTrialAttemptFinishRequest,
    AuthorTrialEnrollRequest,
    AuthorTrialExportFormat,
    AuthorTrialParticipantsResponse,
    AuthorTrialSessionRequest,
    AuthorTrialSessionResponse,
} from '@domain/models/AuthorTrial'

const AUTHOR_TRIAL_KEY_HEADER = 'X-Author-Trial-Key'

/**
 * HTTP adapter for the authors-only trial surface.
 *
 * Every call carries the shared access code in `X-Author-Trial-Key`; there is
 * no JWT and no user session on this page. The code is never logged by this
 * class (the HTTP client logs only method/url).
 */
@injectable()
export class AuthorTrialRepository implements IAuthorTrialRepository {
    constructor(@inject(TYPES.HttpClient) private readonly httpClient: IHttpClient) {}

    private authHeaders(accessCode: string): Record<string, string> {
        return { [AUTHOR_TRIAL_KEY_HEADER]: accessCode }
    }

    async getParticipants(accessCode: string): Promise<AuthorTrialParticipantsResponse> {
        const response = await this.httpClient.get<AuthorTrialParticipantsResponse>(
            '/author-trial/participants',
            { headers: this.authHeaders(accessCode) },
        )
        return response.data
    }

    async createSession(
        accessCode: string,
        request: AuthorTrialSessionRequest,
    ): Promise<AuthorTrialSessionResponse> {
        const response = await this.httpClient.post<AuthorTrialSessionResponse>(
            '/author-trial/session',
            request,
            { headers: this.authHeaders(accessCode) },
        )
        return response.data
    }

    async finishAttempt(
        accessCode: string,
        attemptId: string,
        body: AuthorTrialAttemptFinishRequest,
    ): Promise<void> {
        await this.httpClient.post(
            `/author-trial/attempts/${encodeURIComponent(attemptId)}/finish`,
            body,
            { headers: this.authHeaders(accessCode) },
        )
    }

    async enroll(accessCode: string, request: AuthorTrialEnrollRequest): Promise<void> {
        await this.httpClient.post('/author-trial/enroll', request, {
            headers: this.authHeaders(accessCode),
        })
    }

    async exportSessions(
        accessCode: string,
        format: AuthorTrialExportFormat,
    ): Promise<string> {
        const response = await this.httpClient.get<string>('/author-trial/export', {
            params: { format },
            headers: this.authHeaders(accessCode),
            responseType: 'text',
        })
        return response.data
    }
}