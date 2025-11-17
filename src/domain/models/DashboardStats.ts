/**
 * Dashboard Statistics Model
 * Represents platform statistics and metrics
 */
export class DashboardStats {
    constructor(
        public readonly totalUsers: number,
        public readonly activeUsers: number,
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
     * Create DashboardStats from JSON response
     */
    static fromJSON(data: any): DashboardStats {
        return new DashboardStats(
            data.totalUsers || 0,
            data.activeUsers || 0,
            data.pendingEnrollments || 0,
            data.successfulEnrollments || 0,
            data.failedEnrollments || 0,
            data.authSuccessRate || 0,
            data.verificationSuccessRate || 0
        )
    }
}
