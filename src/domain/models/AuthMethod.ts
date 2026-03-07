/**
 * Authentication Method Types
 * Represents all supported authentication methods in the platform
 */
export enum AuthMethodType {
    PASSWORD = 'PASSWORD',
    FACE = 'FACE',
    FINGERPRINT = 'FINGERPRINT',
    QR_CODE = 'QR_CODE',
    NFC_DOCUMENT = 'NFC_DOCUMENT',
    TOTP = 'TOTP',
    SMS_OTP = 'SMS_OTP',
    EMAIL_OTP = 'EMAIL_OTP',
    VOICE = 'VOICE',
    HARDWARE_KEY = 'HARDWARE_KEY',
}

/**
 * Platform availability for authentication methods
 */
export type Platform = 'web' | 'mobile' | 'desktop'

/**
 * Authentication Method
 * Represents a single authentication method available in the system
 */
export type AuthMethodCategory = 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';

export interface AuthMethod {
    id: string
    name: string
    type: AuthMethodType
    description: string
    icon: string
    platforms: Platform[]
    isActive: boolean
    category: AuthMethodCategory
}

/**
 * Authentication Flow Step
 * Represents a single step in an authentication flow
 */
export interface AuthFlowStep {
    id: string
    order: number
    methodId: string
    methodType: AuthMethodType
    isRequired: boolean
    timeout: number // seconds
    maxAttempts: number
    fallbackMethodId?: string
}

/**
 * Authentication Flow
 * Represents a complete authentication flow configuration
 */
export interface AuthenticationFlow {
    id: string
    tenantId: string
    name: string
    description: string
    steps: AuthFlowStep[]
    isDefault: boolean
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

/**
 * Default authentication methods available in the system.
 * NOTE: These are fallback defaults. Auth methods should ideally be fetched
 * from the backend via GET /api/v1/auth-methods when available.
 */
export const DEFAULT_AUTH_METHODS: AuthMethod[] = [
    {
        id: 'PASSWORD',
        name: 'Password',
        type: AuthMethodType.PASSWORD,
        description: 'Traditional password authentication',
        icon: 'Lock',
        platforms: ['web', 'mobile', 'desktop'],
        isActive: true,
        category: 'BASIC',
    },
    {
        id: 'EMAIL_OTP',
        name: 'Email OTP',
        type: AuthMethodType.EMAIL_OTP,
        description: 'One-time password sent via email',
        icon: 'Email',
        platforms: ['web', 'mobile', 'desktop'],
        isActive: true,
        category: 'BASIC',
    },
    {
        id: 'SMS_OTP',
        name: 'SMS OTP',
        type: AuthMethodType.SMS_OTP,
        description: 'One-time password sent via SMS',
        icon: 'Sms',
        platforms: ['web', 'mobile', 'desktop'],
        isActive: true,
        category: 'STANDARD',
    },
    {
        id: 'TOTP',
        name: 'Authenticator App',
        type: AuthMethodType.TOTP,
        description: 'Time-based OTP via authenticator app',
        icon: 'PhonelinkLock',
        platforms: ['web', 'mobile', 'desktop'],
        isActive: true,
        category: 'STANDARD',
    },
    {
        id: 'QR_CODE',
        name: 'QR Code',
        type: AuthMethodType.QR_CODE,
        description: 'Scan QR code for authentication',
        icon: 'QrCode2',
        platforms: ['web', 'mobile', 'desktop'],
        isActive: true,
        category: 'STANDARD',
    },
    {
        id: 'FACE',
        name: 'Face Recognition',
        type: AuthMethodType.FACE,
        description: 'Biometric face verification',
        icon: 'Face',
        platforms: ['web', 'mobile', 'desktop'],
        isActive: true,
        category: 'PREMIUM',
    },
    {
        id: 'FINGERPRINT',
        name: 'Fingerprint',
        type: AuthMethodType.FINGERPRINT,
        description: 'Biometric fingerprint verification',
        icon: 'Fingerprint',
        platforms: ['mobile', 'desktop'],
        isActive: true,
        category: 'PREMIUM',
    },
    {
        id: 'VOICE',
        name: 'Voice Recognition',
        type: AuthMethodType.VOICE,
        description: 'Biometric voice verification',
        icon: 'RecordVoiceOver',
        platforms: ['web', 'mobile', 'desktop'],
        isActive: false,
        category: 'PREMIUM',
    },
    {
        id: 'NFC_DOCUMENT',
        name: 'NFC Document',
        type: AuthMethodType.NFC_DOCUMENT,
        description: 'ID document verification via NFC',
        icon: 'Nfc',
        platforms: ['web', 'mobile'],
        isActive: true,
        category: 'ENTERPRISE',
    },
    {
        id: 'HARDWARE_KEY',
        name: 'Hardware Key',
        type: AuthMethodType.HARDWARE_KEY,
        description: 'FIDO2/WebAuthn hardware key',
        icon: 'Key',
        platforms: ['web', 'desktop'],
        isActive: true,
        category: 'ENTERPRISE',
    },
]

/**
 * Get method icon component name
 */
export function getMethodIcon(type: AuthMethodType): string {
    const method = DEFAULT_AUTH_METHODS.find((m) => m.type === type)
    return method?.icon ?? 'Lock'
}

/**
 * Get method category color
 */
export function getMethodCategoryColor(category: AuthMethod['category']): string {
    switch (category) {
        case 'BASIC':
            return '#10b981'
        case 'STANDARD':
            return '#3b82f6'
        case 'PREMIUM':
            return '#8b5cf6'
        case 'ENTERPRISE':
            return '#f59e0b'
        default:
            return '#64748b'
    }
}
