/**
 * User Enrollment domain model
 * Represents a user-facing enrollment process with status tracking
 */

export enum UserEnrollmentStatus {
    NOT_STARTED = 'NOT_STARTED',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export interface IdInfoData {
    nationalId: string
    dateOfBirth: string
    fullName: string
}

export interface LivenessResult {
    passed: boolean
    score: number
    token: string
}

export interface LivenessChallenge {
    challengeId: string
    instruction: string
}

export interface UserEnrollmentSubmitData {
    idInfo: IdInfoData
    livenessToken: string
    livenessScore: number
    faceImage: Blob
}

export interface UserEnrollmentStatusResponse {
    status: UserEnrollmentStatus
    qualityScore?: number
    livenessScore?: number
    errorMessage?: string
    completedAt?: string
}
