/**
 * Authors-only trial store (identity-core-api `/api/v1/author-trial`).
 *
 * This surface has NO user login: every call carries the shared access code
 * in the `X-Author-Trial-Key` header, passed as a method argument by the page.
 * No JWT is required (the backend marks the endpoints `permitAll` and gates
 * them on the key). The wire shapes are the ones in
 * `docs/AUTHOR_TRIAL_CONTRACT.md`.
 */
import type {
    AuthorTrialAttemptFinishRequest,
    AuthorTrialEnrollRequest,
    AuthorTrialExportFormat,
    AuthorTrialParticipantsResponse,
    AuthorTrialSessionRequest,
    AuthorTrialSessionResponse,
} from '@domain/models/AuthorTrial'

export interface IAuthorTrialRepository {
    /** Configured pseudonymous participants + the tenant flow. */
    getParticipants(accessCode: string): Promise<AuthorTrialParticipantsResponse>

    /** Creates a REAL MFA session for the target account and a pending attempt row. */
    createSession(
        accessCode: string,
        request: AuthorTrialSessionRequest,
    ): Promise<AuthorTrialSessionResponse>

    /**
     * Records the page's technical view of the attempt. The server keeps its
     * own authoritative decision; this can never turn a fail/pending attempt
     * into an accept.
     */
    finishAttempt(
        accessCode: string,
        attemptId: string,
        body: AuthorTrialAttemptFinishRequest,
    ): Promise<void>

    /** One-time trial enrollment of the participant's bound account (embedding only). */
    enroll(accessCode: string, request: AuthorTrialEnrollRequest): Promise<void>

    /** The server-rendered export as text (CSV or JSON). */
    exportSessions(accessCode: string, format: AuthorTrialExportFormat): Promise<string>
}