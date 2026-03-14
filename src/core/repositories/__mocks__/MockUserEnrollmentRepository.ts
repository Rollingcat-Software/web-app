import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IUserEnrollmentRepository } from '@domain/interfaces/IUserEnrollmentRepository'
import type {
    UserEnrollmentStatusResponse,
    UserEnrollmentSubmitData,
    LivenessChallenge,
    LivenessResult,
} from '@domain/models/UserEnrollment'
import { UserEnrollmentStatus } from '@domain/models/UserEnrollment'

@injectable()
export class MockUserEnrollmentRepository implements IUserEnrollmentRepository {
    private currentStatus: UserEnrollmentStatusResponse = {
        status: UserEnrollmentStatus.NOT_STARTED,
    }

    constructor(@inject(TYPES.Logger) private readonly logger: ILogger) {}

    async submit(data: UserEnrollmentSubmitData): Promise<UserEnrollmentStatusResponse> {
        this.logger.info('[MockUserEnrollmentRepo] POST /enrollment/submit', {
            nationalId: data.idInfo.nationalId,
            dateOfBirth: data.idInfo.dateOfBirth,
            fullName: data.idInfo.fullName,
            livenessToken: data.livenessToken.substring(0, 30) + '...',
            livenessScore: data.livenessScore,
            faceImageSize: `${(data.faceImage.size / 1024).toFixed(1)} KB`,
            faceImageType: data.faceImage.type,
        })
        await this.delay(1500)

        this.currentStatus = {
            status: UserEnrollmentStatus.PROCESSING,
        }

        // Simulate async processing completing after 3 seconds
        setTimeout(() => {
            this.currentStatus = {
                status: UserEnrollmentStatus.COMPLETED,
                qualityScore: 0.92,
                livenessScore: 0.97,
                completedAt: new Date().toISOString(),
            }
        }, 3000)

        this.logger.info('[MockUserEnrollmentRepo] POST /enrollment/submit → response', {
            status: this.currentStatus.status,
        })
        return { ...this.currentStatus }
    }

    async getStatus(): Promise<UserEnrollmentStatusResponse> {
        this.logger.info('[MockUserEnrollmentRepo] GET /enrollment/status')
        await this.delay(300)
        this.logger.info('[MockUserEnrollmentRepo] GET /enrollment/status → response', {
            status: this.currentStatus.status,
            qualityScore: this.currentStatus.qualityScore,
            livenessScore: this.currentStatus.livenessScore,
        })
        return { ...this.currentStatus }
    }

    async requestLivenessChallenge(): Promise<LivenessChallenge> {
        this.logger.info('[MockUserEnrollmentRepo] POST /enrollment/liveness/challenge')
        await this.delay(400)
        const result = {
            challengeId: `challenge_${Date.now()}`,
            instruction: 'Please blink twice while looking at the camera',
        }
        this.logger.info('[MockUserEnrollmentRepo] POST /enrollment/liveness/challenge → response', result)
        return result
    }

    async verifyLiveness(challengeId: string, frames: Blob[]): Promise<LivenessResult> {
        const totalFrameSize = frames.reduce((sum, f) => sum + f.size, 0)
        this.logger.info('[MockUserEnrollmentRepo] POST /enrollment/liveness/verify', {
            challengeId,
            frameCount: frames.length,
            totalFrameSize: `${(totalFrameSize / 1024).toFixed(1)} KB`,
        })
        await this.delay(1000)
        const result = {
            passed: true,
            score: 0.97,
            token: `liveness_token_${Date.now()}`,
        }
        this.logger.info('[MockUserEnrollmentRepo] POST /enrollment/liveness/verify → response', {
            passed: result.passed,
            score: result.score,
            token: result.token.substring(0, 30) + '...',
        })
        return result
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
