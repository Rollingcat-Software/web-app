import type {
    UserEnrollmentStatusResponse,
    IdInfoData,
    LivenessChallenge,
    LivenessResult,
} from '@domain/models/UserEnrollment'

export interface IUserEnrollmentService {
    submitEnrollment(idInfo: IdInfoData, livenessToken: string, livenessScore: number, faceImage: Blob): Promise<UserEnrollmentStatusResponse>
    getEnrollmentStatus(): Promise<UserEnrollmentStatusResponse>
    requestLivenessChallenge(): Promise<LivenessChallenge>
    verifyLiveness(challengeId: string, frames: Blob[]): Promise<LivenessResult>
}
