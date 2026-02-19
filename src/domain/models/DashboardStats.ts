/**
 * Dashboard Statistics Model
 * Represents platform statistics and metrics
 */

export interface DashboardStatsJSON {
    totalUsers?: number
    activeUsers?: number
    inactiveUsers?: number
    suspendedUsers?: number
    biometricEnrolledUsers?: number
    totalVerifications?: number
    totalTenants?: number
    pendingEnrollments?: number
    successfulEnrollments?: number
    failedEnrollments?: number
    authSuccessRate?: number
    verificationSuccessRate?: number
}

export class DashboardStats {
    constructor(
        public readonly totalUsers: number,
        public readonly activeUsers: number,
        public readonly inactiveUsers: number,
        public readonly suspendedUsers: number,
        public readonly biometricEnrolledUsers: number,
        public readonly totalVerifications: number,
        public readonly totalTenants: number,
        public readonly pendingEnrollments: number,
        public readonly successfulEnrollments: number,
        public readonly failedEnrollments: number,
        public readonly authSuccessRate: number,
        public readonly verificationSuccessRate: number
    ) {}

    /**
     * Get total enrollments (success + failed)
     */
    get totalEnrollments(): number {
        return this.successfulEnrollments + this.failedEnrollments
    }

    /**
     * Get enrollment success rate
     */
    get enrollmentSuccessRate(): number {
        if (this.totalEnrollments === 0) return 0
        return (this.successfulEnrollments / this.totalEnrollments) * 100
    }

    /**
     * Get active user percentage
     */
    get activeUserPercentage(): number {
        if (this.totalUsers === 0) return 0
        return (this.activeUsers / this.totalUsers) * 100
    }

    /**
     * Get average verifications per user
     */
    get averageVerificationsPerUser(): number {
        if (this.biometricEnrolledUsers === 0) return 0
        return this.totalVerifications / this.biometricEnrolledUsers
    }

    /**
     * Create DashboardStats from JSON response
     */
    static fromJSON(data: DashboardStatsJSON): DashboardStats {
        return new DashboardStats(
            data.totalUsers ?? 0,
            data.activeUsers ?? 0,
            data.inactiveUsers ?? 0,
            data.suspendedUsers ?? 0,
            data.biometricEnrolledUsers ?? 0,
            data.totalVerifications ?? 0,
            data.totalTenants ?? 0,
            data.pendingEnrollments ?? 0,
            data.successfulEnrollments ?? 0,
            data.failedEnrollments ?? 0,
            data.authSuccessRate ?? 0,
            data.verificationSuccessRate ?? 0
        )
    }
}
