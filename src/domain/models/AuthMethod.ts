/**
 * Authentication Method Types
 * Represents all supported authentication methods in the platform
 */
export enum AuthMethodType {
    PASSWORD = 'password',
    FACE = 'face',
    FINGERPRINT = 'fingerprint',
    QR_CODE = 'qr_code',
    NFC_DOCUMENT = 'nfc_document',
    TOTP = 'totp',
    SMS_OTP = 'sms_otp',
    EMAIL_OTP = 'email_otp',
    VOICE = 'voice',
    HARDWARE_KEY = 'hardware_key',
}

/**
 * Platform availability for authentication methods
 */
export type Platform = 'web' | 'mobile' | 'desktop'

/**
 * Authentication Method
 * Represents a single authentication method available in the system
 */
export interface AuthMethod {
    id: string
    name: string
    type: AuthMethodType
    description: string
    icon: string
    platforms: Platform[]
    pricePerMonth: number
    setupFee: number
    isActive: boolean
    category: 'basic' | 'standard' | 'premium' | 'enterprise'
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
 * Default authentication methods available in the system
 */
export const DEFAULT_AUTH_METHODS: AuthMethod[] = [
    {
        id: 'password',
        name: 'Password',
        type: AuthMethodType.PASSWORD,
        description: 'Traditional password authentication',
        icon: 'Lock',
        platforms: ['web', 'mobile', 'desktop'],
        pricePerMonth: 0,
        setupFee: 0,
        isActive: true,
        category: 'basic',
    },
    {
        id: 'email_otp',
        name: 'Email OTP',
        type: AuthMethodType.EMAIL_OTP,
        description: 'One-time password sent via email',
        icon: 'Email',
        platforms: ['web', 'mobile', 'desktop'],
        pricePerMonth: 0,
        setupFee: 0,
        isActive: true,
        category: 'basic',
    },
    {
        id: 'sms_otp',
        name: 'SMS OTP',
        type: AuthMethodType.SMS_OTP,
        description: 'One-time password sent via SMS',
        icon: 'Sms',
        platforms: ['web', 'mobile', 'desktop'],
        pricePerMonth: 50,
        setupFee: 0,
        isActive: true,
        category: 'standard',
    },
    {
        id: 'totp',
        name: 'Authenticator App',
        type: AuthMethodType.TOTP,
        description: 'Time-based OTP via authenticator app',
        icon: 'PhonelinkLock',
        platforms: ['web', 'mobile', 'desktop'],
        pricePerMonth: 50,
        setupFee: 0,
        isActive: true,
        category: 'standard',
    },
    {
        id: 'qr_code',
        name: 'QR Code',
        type: AuthMethodType.QR_CODE,
        description: 'Scan QR code for authentication',
        icon: 'QrCode2',
        platforms: ['web', 'mobile', 'desktop'],
        pricePerMonth: 75,
        setupFee: 0,
        isActive: true,
        category: 'standard',
    },
    {
        id: 'face',
        name: 'Face Recognition',
        type: AuthMethodType.FACE,
        description: 'Biometric face verification',
        icon: 'Face',
        platforms: ['web', 'mobile', 'desktop'],
        pricePerMonth: 200,
        setupFee: 500,
        isActive: true,
        category: 'premium',
    },
    {
        id: 'fingerprint',
        name: 'Fingerprint',
        type: AuthMethodType.FINGERPRINT,
        description: 'Biometric fingerprint verification',
        icon: 'Fingerprint',
        platforms: ['mobile', 'desktop'],
        pricePerMonth: 150,
        setupFee: 0,
        isActive: true,
        category: 'premium',
    },
    {
        id: 'voice',
        name: 'Voice Recognition',
        type: AuthMethodType.VOICE,
        description: 'Biometric voice verification',
        icon: 'RecordVoiceOver',
        platforms: ['web', 'mobile', 'desktop'],
        pricePerMonth: 250,
        setupFee: 750,
        isActive: false,
        category: 'premium',
    },
    {
        id: 'nfc_document',
        name: 'NFC Document',
        type: AuthMethodType.NFC_DOCUMENT,
        description: 'ID document verification via NFC',
        icon: 'Nfc',
        platforms: ['web', 'mobile'],
        pricePerMonth: 500,
        setupFee: 1000,
        isActive: true,
        category: 'enterprise',
    },
    {
        id: 'hardware_key',
        name: 'Hardware Key',
        type: AuthMethodType.HARDWARE_KEY,
        description: 'FIDO2/WebAuthn hardware key',
        icon: 'Key',
        platforms: ['web', 'desktop'],
        pricePerMonth: 100,
        setupFee: 0,
        isActive: true,
        category: 'enterprise',
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
        case 'basic':
            return '#10b981'
        case 'standard':
            return '#3b82f6'
        case 'premium':
            return '#8b5cf6'
        case 'enterprise':
            return '#f59e0b'
        default:
            return '#64748b'
    }
}
