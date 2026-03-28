import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IUserEnrollmentRepository } from '@domain/interfaces/IUserEnrollmentRepository'
import type {
    UserEnrollmentStatusResponse,
    UserEnrollmentSubmitData,
    LivenessChallenge,
    LivenessResult,
} from '@domain/models/UserEnrollment'

@injectable()
export class UserEnrollmentRepository implements IUserEnrollmentRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    async submit(data: UserEnrollmentSubmitData): Promise<UserEnrollmentStatusResponse> {
        try {
            this.logger.info('[UserEnrollmentRepo] POST /enrollment/submit', {
                nationalId: data.idInfo.nationalId,
                dateOfBirth: data.idInfo.dateOfBirth,
                fullName: data.idInfo.fullName,
                livenessToken: data.livenessToken.substring(0, 20) + '...',
                livenessScore: data.livenessScore,
                faceImageSize: `${(data.faceImage.size / 1024).toFixed(1)} KB`,
                faceImageType: data.faceImage.type,
            })
            const formData = new FormData()
            formData.append('nationalId', data.idInfo.nationalId)
            formData.append('dateOfBirth', data.idInfo.dateOfBirth)
            formData.append('fullName', data.idInfo.fullName)
            formData.append('livenessToken', data.livenessToken)
            formData.append('livenessScore', data.livenessScore.toString())
            formData.append('faceImage', data.faceImage, 'face.jpg')
            const response = await this.httpClient.post<UserEnrollmentStatusResponse>(
                '/enrollment/submit',
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            )
            this.logger.info('[UserEnrollmentRepo] POST /enrollment/submit → response', {
                status: response.data.status,
                qualityScore: response.data.qualityScore,
                livenessScore: response.data.livenessScore,
            })
            return response.data
        } catch (error) {
            this.logger.error('[UserEnrollmentRepo] POST /enrollment/submit → FAILED', error)
            throw error
        }
    }

    async getStatus(): Promise<UserEnrollmentStatusResponse> {
        try {
            this.logger.info('[UserEnrollmentRepo] GET /enrollment/status')
            const response = await this.httpClient.get<UserEnrollmentStatusResponse>(
                '/enrollment/status'
            )
            this.logger.info('[UserEnrollmentRepo] GET /enrollment/status → response', {
                status: response.data.status,
                qualityScore: response.data.qualityScore,
                livenessScore: response.data.livenessScore,
                errorMessage: response.data.errorMessage,
            })
            return response.data
        } catch (error) {
            this.logger.error('[UserEnrollmentRepo] GET /enrollment/status → FAILED', error)
            throw error
        }
    }

    async requestLivenessChallenge(): Promise<LivenessChallenge> {
        try {
            this.logger.info('[UserEnrollmentRepo] POST /enrollment/liveness/challenge')
            const response = await this.httpClient.post<LivenessChallenge>(
                '/enrollment/liveness/challenge',
                {}
            )
            this.logger.info('[UserEnrollmentRepo] POST /enrollment/liveness/challenge → response', {
                challengeId: response.data.challengeId,
                instruction: response.data.instruction,
            })
            return response.data
        } catch (error) {
            this.logger.error('[UserEnrollmentRepo] POST /enrollment/liveness/challenge → FAILED', error)
            throw error
        }
    }

    async verifyLiveness(challengeId: string, frames: Blob[]): Promise<LivenessResult> {
        try {
            const totalFrameSize = frames.reduce((sum, f) => sum + f.size, 0)
            this.logger.info('[UserEnrollmentRepo] POST /enrollment/liveness/verify', {
                challengeId,
                frameCount: frames.length,
                totalFrameSize: `${(totalFrameSize / 1024).toFixed(1)} KB`,
            })
            const formData = new FormData()
            formData.append('challengeId', challengeId)
            frames.forEach((frame, index) => {
                formData.append(`frame_${index}`, frame, `frame_${index}.jpg`)
            })
            // Explicitly set Content-Type to multipart/form-data so Spring
            // accepts the request (fixes 415 Unsupported Media Type).
            // Axios will append the boundary parameter automatically.
            const response = await this.httpClient.post<LivenessResult>(
                '/enrollment/liveness/verify',
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            )
            this.logger.info('[UserEnrollmentRepo] POST /enrollment/liveness/verify → response', {
                passed: response.data.passed,
                score: response.data.score,
                token: response.data.token.substring(0, 20) + '...',
            })
            return response.data
        } catch (error) {
            this.logger.error('[UserEnrollmentRepo] POST /enrollment/liveness/verify → FAILED', error)
            throw error
        }
    }
}
