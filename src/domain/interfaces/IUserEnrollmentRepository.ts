import type {
    UserEnrollmentStatusResponse,
    UserEnrollmentSubmitData,
    LivenessChallenge,
    LivenessResult,
} from '@domain/models/UserEnrollment'

export interface IUserEnrollmentRepository {
    submit(data: UserEnrollmentSubmitData): Promise<UserEnrollmentStatusResponse>
    getStatus(): Promise<UserEnrollmentStatusResponse>
    requestLivenessChallenge(): Promise<LivenessChallenge>
    verifyLiveness(challengeId: string, frames: Blob[]): Promise<LivenessResult>
}
