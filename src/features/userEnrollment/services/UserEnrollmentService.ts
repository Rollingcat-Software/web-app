import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IUserEnrollmentService } from '@domain/interfaces/IUserEnrollmentService'
import type { IUserEnrollmentRepository } from '@domain/interfaces/IUserEnrollmentRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type {
    UserEnrollmentStatusResponse,
    IdInfoData,
    LivenessChallenge,
    LivenessResult,
} from '@domain/models/UserEnrollment'
import { UserEnrollmentStatus } from '@domain/models/UserEnrollment'
import { validateIdInfo } from '@domain/validators/userEnrollmentValidator'
import { BusinessError, ValidationError } from '@core/errors/AppError'

@injectable()
export class UserEnrollmentService implements IUserEnrollmentService {
    constructor(
        @inject(TYPES.UserEnrollmentRepository)
        private readonly repository: IUserEnrollmentRepository,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    async submitEnrollment(
        idInfo: IdInfoData,
        livenessToken: string,
        livenessScore: number,
        faceImage: Blob
    ): Promise<UserEnrollmentStatusResponse> {
        // Validate ID info
        const validation = validateIdInfo(idInfo)
        if (!validation.success) {
            const errors = validation.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            }))
            throw new ValidationError('ID information validation failed', errors)
        }

        if (!faceImage || faceImage.size === 0) {
            throw new ValidationError('Face image capture failed. Please try again.')
        }

        // Ghost enrollment check
        try {
            const currentStatus = await this.repository.getStatus()
            if (
                currentStatus.status === UserEnrollmentStatus.COMPLETED ||
                currentStatus.status === UserEnrollmentStatus.PROCESSING
            ) {
                throw new BusinessError(
                    `Enrollment already ${currentStatus.status.toLowerCase()}. Cannot submit again.`
                )
            }
        } catch (error) {
            if (error instanceof BusinessError) throw error
            // If status check fails (e.g., no prior enrollment), continue
            this.logger.debug('No existing enrollment found, proceeding with submission')
        }

        try {
            this.logger.info('Submitting user enrollment with biometric data')
            const result = await this.repository.submit({
                idInfo,
                livenessToken,
                livenessScore,
                faceImage,
            })
            this.logger.info('User enrollment submitted successfully', { status: result.status })
            return result
        } catch (error) {
            this.logger.error('Failed to submit user enrollment', error)
            throw error
        }
    }

    async getEnrollmentStatus(): Promise<UserEnrollmentStatusResponse> {
        try {
            this.logger.debug('Getting user enrollment status')
            return await this.repository.getStatus()
        } catch (error) {
            this.logger.error('Failed to get enrollment status', error)
            throw error
        }
    }

    async requestLivenessChallenge(): Promise<LivenessChallenge> {
        try {
            this.logger.debug('Requesting liveness challenge')
            return await this.repository.requestLivenessChallenge()
        } catch (error) {
            this.logger.error('Failed to request liveness challenge', error)
            throw error
        }
    }

    async verifyLiveness(challengeId: string, frames: Blob[]): Promise<LivenessResult> {
        try {
            this.logger.debug('Verifying liveness', { challengeId, frameCount: frames.length })
            return await this.repository.verifyLiveness(challengeId, frames)
        } catch (error) {
            this.logger.error('Failed to verify liveness', error)
            throw error
        }
    }
}
