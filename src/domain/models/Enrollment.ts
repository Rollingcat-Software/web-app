/**
 * Enrollment domain model
 * Represents a biometric enrollment entity in the system
 */

export enum EnrollmentStatus {
    NOT_ENROLLED = 'NOT_ENROLLED',
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    ENROLLED = 'ENROLLED',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    REVOKED = 'REVOKED',
    EXPIRED = 'EXPIRED',
}

export interface EnrollmentJSON {
    id: string
    userId: string
    tenantId: string
    status: EnrollmentStatus
    authMethodType?: string
    faceImageUrl: string
    createdAt: string
    updatedAt: string
    qualityScore?: number
    livenessScore?: number
    errorCode?: string
    errorMessage?: string
    completedAt?: string
    userName?: string
    userEmail?: string
    enrolledAt?: string
}

/**
 * Enrollment entity
 */
export class Enrollment {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly tenantId: string,
        public readonly status: EnrollmentStatus,
        public readonly faceImageUrl: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly authMethodType?: string,
        public readonly qualityScore?: number,
        public readonly livenessScore?: number,
        public readonly errorCode?: string,
        public readonly errorMessage?: string,
        public readonly completedAt?: Date,
        public readonly userName?: string,
        public readonly userEmail?: string
    ) {}

    /**
     * Check if enrollment is complete (SUCCESS or FAILED)
     */
    isComplete(): boolean {
        return this.status === EnrollmentStatus.SUCCESS || this.status === EnrollmentStatus.ENROLLED || this.status === EnrollmentStatus.FAILED
    }

    /**
     * Check if enrollment was successful
     */
    isSuccessful(): boolean {
        return this.status === EnrollmentStatus.SUCCESS || this.status === EnrollmentStatus.ENROLLED
    }

    /**
     * Check if enrollment has failed
     */
    hasFailed(): boolean {
        return this.status === EnrollmentStatus.FAILED
    }

    /**
     * Check if enrollment is pending
     */
    isPending(): boolean {
        return this.status === EnrollmentStatus.PENDING
    }

    /**
     * Check if enrollment is processing
     */
    isProcessing(): boolean {
        return this.status === EnrollmentStatus.PROCESSING
    }

    /**
     * Check if enrollment is in progress (PENDING or PROCESSING)
     */
    isInProgress(): boolean {
        return this.isPending() || this.isProcessing()
    }

    /**
     * Check if enrollment can be retried (only FAILED enrollments can be retried)
     */
    canRetry(): boolean {
        return this.hasFailed()
    }

    /**
     * Get quality score as percentage
     */
    getQualityScorePercentage(): number | undefined {
        return this.qualityScore !== undefined ? Math.round(this.qualityScore * 100) : undefined
    }

    /**
     * Get liveness score as percentage
     */
    getLivenessScorePercentage(): number | undefined {
        return this.livenessScore !== undefined ? Math.round(this.livenessScore * 100) : undefined
    }

    /**
     * Convert to plain object (for serialization)
     */
    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            tenantId: this.tenantId,
            status: this.status,
            faceImageUrl: this.faceImageUrl,
            qualityScore: this.qualityScore,
            livenessScore: this.livenessScore,
            errorCode: this.errorCode,
            errorMessage: this.errorMessage,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
            completedAt: this.completedAt?.toISOString(),
        }
    }

    /**
     * Create Enrollment from plain object (deserialization)
     */
    static fromJSON(data: any): Enrollment {
        // Map status - backend may return various status strings
        const statusMap: Record<string, EnrollmentStatus> = {
            'NOT_ENROLLED': EnrollmentStatus.NOT_ENROLLED,
            'PENDING': EnrollmentStatus.PENDING,
            'PROCESSING': EnrollmentStatus.PROCESSING,
            'ENROLLED': EnrollmentStatus.ENROLLED,
            'SUCCESS': EnrollmentStatus.ENROLLED,
            'COMPLETED': EnrollmentStatus.ENROLLED,
            'FAILED': EnrollmentStatus.FAILED,
            'REVOKED': EnrollmentStatus.REVOKED,
            'EXPIRED': EnrollmentStatus.EXPIRED,
        }
        const status = statusMap[(data.status ?? '').toUpperCase()] ?? EnrollmentStatus.PENDING

        return new Enrollment(
            data.id,
            data.userId,
            data.tenantId ?? '',
            status,
            data.faceImageUrl ?? '',
            new Date(data.createdAt ?? data.enrolledAt ?? new Date()),
            new Date(data.updatedAt ?? data.enrolledAt ?? new Date()),
            data.authMethodType,
            data.qualityScore,
            data.livenessScore,
            data.errorCode,
            data.errorMessage,
            data.completedAt ? new Date(data.completedAt) : undefined,
            data.userName,
            data.userEmail
        )
    }
}
