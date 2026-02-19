/**
 * AuditLog domain model
 * Represents an audit log entry in the system
 */

export const AUDIT_LOG_ACTION_TYPES = [
    'USER_LOGIN',
    'USER_CREATED',
    'USER_UPDATED',
    'USER_DELETED',
    'BIOMETRIC_VERIFICATION',
    'FAILED_LOGIN_ATTEMPT',
    'PASSWORD_RESET',
    'SETTINGS_UPDATED',
    'SYSTEM_UPDATE',
    'AUTOMATED_CLEANUP',
] as const

export type AuditLogActionType = (typeof AUDIT_LOG_ACTION_TYPES)[number]

export interface AuditLogJSON {
    id: string
    userId: string
    tenantId: string
    action: string
    entityType: string
    ipAddress?: string
    userAgent?: string
    details?: Record<string, unknown>
    timestamp?: string
    createdAt?: string
    entityId?: string
    success?: boolean
    errorMessage?: string
}

/**
 * AuditLog entity
 */
export class AuditLog {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly tenantId: string,
        public readonly action: string,
        public readonly entityType: string,
        public readonly ipAddress: string,
        public readonly userAgent: string,
        public readonly details: Record<string, unknown>,
        public readonly createdAt: Date,
        public readonly entityId?: string,
        public readonly success?: boolean,
        public readonly errorMessage?: string
    ) {}

    /**
     * Check if this is a user action (performed by a user)
     */
    isUserAction(): boolean {
        const userActions = [
            'USER_LOGIN',
            'USER_CREATED',
            'USER_UPDATED',
            'USER_DELETED',
            'PASSWORD_RESET',
            'SETTINGS_UPDATED',
            'FAILED_LOGIN_ATTEMPT',
        ]
        return userActions.includes(this.action)
    }

    /**
     * Check if this is a system action (automated)
     */
    isSystemAction(): boolean {
        const systemActions = ['BIOMETRIC_VERIFICATION', 'SYSTEM_UPDATE', 'AUTOMATED_CLEANUP']
        return systemActions.includes(this.action)
    }

    /**
     * Check if this is a security-related action
     */
    isSecurityAction(): boolean {
        const securityActions = [
            'USER_LOGIN',
            'FAILED_LOGIN_ATTEMPT',
            'PASSWORD_RESET',
            'USER_DELETED',
            'BIOMETRIC_VERIFICATION',
        ]
        return securityActions.includes(this.action)
    }

    /**
     * Check if this is a failed action
     */
    isFailed(): boolean {
        return this.success === false || this.action.includes('FAILED') || this.details?.success === false
    }

    /**
     * Get a human-readable description of the action
     */
    getActionDescription(): string {
        const descriptions: Record<string, string> = {
            USER_LOGIN: 'User logged in',
            USER_CREATED: 'User created',
            USER_UPDATED: 'User updated',
            USER_DELETED: 'User deleted',
            PASSWORD_RESET: 'Password reset',
            SETTINGS_UPDATED: 'Settings updated',
            FAILED_LOGIN_ATTEMPT: 'Failed login attempt',
            BIOMETRIC_VERIFICATION: 'Biometric verification',
        }
        return descriptions[this.action] || this.action.replace(/_/g, ' ').toLowerCase()
    }

    /**
     * Convert to plain object (for serialization)
     */
    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            tenantId: this.tenantId,
            action: this.action,
            entityType: this.entityType,
            entityId: this.entityId,
            ipAddress: this.ipAddress,
            userAgent: this.userAgent,
            details: this.details,
            createdAt: this.createdAt.toISOString(),
        }
    }

    /**
     * Create AuditLog from plain object (deserialization)
     */
    static fromJSON(data: AuditLogJSON): AuditLog {
        return new AuditLog(
            data.id,
            data.userId,
            data.tenantId,
            data.action,
            data.entityType,
            data.ipAddress || '',
            data.userAgent || '',
            data.details || {},
            new Date(data.timestamp ?? data.createdAt ?? ''),
            data.entityId,
            data.success,
            data.errorMessage
        )
    }
}
