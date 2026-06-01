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
    GESTURE_LIVENESS = 'GESTURE_LIVENESS',
    /**
     * Usernameless login-config entry points (api task #16 frozen contract):
     *  - PASSKEY: discoverable WebAuthn (no identifier typed) →
     *    /webauthn/passkey/authenticate-options → /authenticate.
     *  - APPROVE_LOGIN: number-matching cross-device approval →
     *    /auth/approve-login/session.
     * Both can return MFA_PENDING for multi-step tenant flows, then continue via
     * /auth/mfa/step exactly like a password login.
     */
    PASSKEY = 'PASSKEY',
    APPROVE_LOGIN = 'APPROVE_LOGIN',
}

/**
 * Platform availability for authentication methods
 */
export type Platform = 'web' | 'mobile' | 'desktop'
const PLATFORM_VALUES: Platform[] = ['web', 'mobile', 'desktop']

function isPlatform(value: string): value is Platform {
    return PLATFORM_VALUES.includes(value as Platform)
}

/**
 * Authentication Method
 * Represents a single authentication method available in the system
 */
export type AuthMethodCategory = 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
const AUTH_METHOD_CATEGORIES: AuthMethodCategory[] = ['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE']

export interface AuthMethod {
    id: string
    name: string
    type: AuthMethodType
    description: string
    icon: string
    platforms: Platform[]
    isActive: boolean
    category: AuthMethodCategory
    /**
     * True when this method can be used WITHOUT the user first typing an
     * identifier (discoverable passkey, cross-device QR/approve). Drives which
     * methods may be selected as a usernameless Layer-1 step in the flow builder.
     */
    supportsUsernameless: boolean
}

/**
 * Methods that authenticate WITHOUT the user typing an identifier first —
 * the factor itself resolves the user. Exactly two qualify here:
 *   - PASSKEY  — discoverable / resident-key WebAuthn (registered with
 *                residentKey="required"); the credential carries the user handle.
 *   - QR_CODE  — scan-to-approve by an already-authenticated device.
 *
 * Deliberately EXCLUDED (all identifier-first → the login UI must collect email):
 *   - APPROVE_LOGIN — number-matching needs the initiator's email so the server
 *     knows whose device to push to (see API migration V74).
 *   - FINGERPRINT / HARDWARE_KEY — registered NON-discoverable
 *     (requireResidentKey=false), so the server must send allowCredentials and
 *     therefore must know the user first. (A discoverable WebAuthn credential is
 *     surfaced as PASSKEY, which IS usernameless.)
 * Listing any of these made the login page promise "no email needed" and then
 * demand an email — the operator-reported contradiction.
 */
const USERNAMELESS_CAPABLE_TYPES: ReadonlySet<AuthMethodType> = new Set([
    AuthMethodType.QR_CODE,
    AuthMethodType.PASSKEY,
])

export function isUsernamelessCapable(type: AuthMethodType): boolean {
    return USERNAMELESS_CAPABLE_TYPES.has(type)
}

/**
 * The canonical set of LOGIN methods — factors a user can present to sign in.
 * Mirrors the backend `AuthMethodType.isLoginMethod()` allow-list (api
 * 2026-06-01): the documented 10 (PASSWORD, EMAIL_OTP, SMS_OTP, TOTP, FACE,
 * VOICE, FINGERPRINT, HARDWARE_KEY, QR_CODE, NFC_DOCUMENT) + PASSKEY +
 * APPROVE_LOGIN.
 *
 * Anything NOT in this set is a verification-pipeline step type or a
 * sub-component of another factor and must NEVER appear as a selectable login
 * method (tenant Auth-Methods toggles, auth-flow builder).
 *
 * GESTURE_LIVENESS is DELIBERATELY EXCLUDED: it is a FACE active-liveness
 * anti-spoofing sub-component (no auth handler), NOT a standalone login factor.
 * It must never be listed, seeded, or offered. Keep this in lockstep with the
 * backend allow-list.
 */
const LOGIN_METHOD_TYPES: ReadonlySet<AuthMethodType> = new Set([
    AuthMethodType.PASSWORD,
    AuthMethodType.EMAIL_OTP,
    AuthMethodType.SMS_OTP,
    AuthMethodType.TOTP,
    AuthMethodType.FACE,
    AuthMethodType.VOICE,
    AuthMethodType.FINGERPRINT,
    AuthMethodType.HARDWARE_KEY,
    AuthMethodType.QR_CODE,
    AuthMethodType.NFC_DOCUMENT,
    AuthMethodType.PASSKEY,
    AuthMethodType.APPROVE_LOGIN,
])

/**
 * True when `type` is a real login factor (see {@link LOGIN_METHOD_TYPES}).
 * Drives the tenant Auth-Methods list filter and the auth-flow builder catalog
 * so verification-pipeline steps and GESTURE_LIVENESS never leak in as a
 * selectable login method.
 */
export function isLoginMethodType(type: AuthMethodType): boolean {
    return LOGIN_METHOD_TYPES.has(type)
}

export function isAuthMethodType(value: string): value is AuthMethodType {
    return Object.values(AuthMethodType).includes(value as AuthMethodType)
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
    /**
     * CHOICE step (E): when present and non-empty, the user satisfies this step
     * by completing ANY ONE of these methods. `methodType` is the step's primary
     * method; `alternativeMethodTypes` lists the additional accepted methods.
     * An empty/absent list = a single-method (strict) step.
     */
    alternativeMethodTypes?: AuthMethodType[]
    /**
     * Usernameless Layer-1 (E): when true, this step can run before any
     * identifier is typed. Only valid for the first step and for methods whose
     * {@link AuthMethod.supportsUsernameless} is true.
     */
    usernameless?: boolean
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

export type OperationType =
    | 'APP_LOGIN'
    | 'DOOR_ACCESS'
    | 'BUILDING_ACCESS'
    | 'API_ACCESS'
    | 'TRANSACTION'
    | 'ENROLLMENT'
    | 'GUEST_ACCESS'
    | 'EXAM_PROCTORING'
    | 'CUSTOM'

export const OPERATION_TYPE_OPTIONS: ReadonlyArray<{ value: OperationType; label: string }> = [
    { value: 'APP_LOGIN', label: 'App Login' },
    { value: 'DOOR_ACCESS', label: 'Door Access' },
    { value: 'BUILDING_ACCESS', label: 'Building Access' },
    { value: 'API_ACCESS', label: 'API Access' },
    { value: 'TRANSACTION', label: 'Transaction' },
    { value: 'ENROLLMENT', label: 'Enrollment' },
    { value: 'GUEST_ACCESS', label: 'Guest Access' },
    { value: 'EXAM_PROCTORING', label: 'Exam Proctoring' },
    { value: 'CUSTOM', label: 'Custom' },
]

export function isOperationType(value: string): value is OperationType {
    return OPERATION_TYPE_OPTIONS.some((option) => option.value === value)
}

export function getOperationTypeLabel(value: string): string {
    const option = OPERATION_TYPE_OPTIONS.find((item) => item.value === value)
    return option?.label ?? value
}

export function normalizeOperationType(value: string): OperationType {
    return isOperationType(value) ? value : 'APP_LOGIN'
}

/**
 * Default authentication methods available in the system.
 * NOTE: These are fallback defaults. Auth methods should ideally be fetched
 * from the backend via GET /api/v1/auth-methods when available.
 *
 * `supportsUsernameless` is derived from the method type (see
 * {@link isUsernamelessCapable}) so the catalog stays single-sourced.
 */
const DEFAULT_AUTH_METHODS_BASE: Omit<AuthMethod, 'supportsUsernameless'>[] = [
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
    // NOTE: GESTURE_LIVENESS is intentionally NOT seeded here. It is a FACE
    // active-liveness anti-spoofing sub-component (no auth handler), not a
    // standalone login factor, so it must never be offered as a selectable
    // login method (tenant Auth-Methods toggles / auth-flow builder). The enum
    // value is retained for backward compatibility but is excluded from the
    // login catalog via isLoginMethodType().
    {
        id: 'PASSKEY',
        name: 'Passkey',
        type: AuthMethodType.PASSKEY,
        description: 'Discoverable WebAuthn passkey (usernameless sign-in)',
        icon: 'Key',
        platforms: ['web', 'mobile', 'desktop'],
        isActive: true,
        category: 'ENTERPRISE',
    },
    {
        id: 'APPROVE_LOGIN',
        name: 'Approve on another device',
        type: AuthMethodType.APPROVE_LOGIN,
        description: 'Number-matching cross-device approval',
        icon: 'PhonelinkLock',
        platforms: ['web', 'mobile', 'desktop'],
        isActive: true,
        category: 'STANDARD',
    },
]

export const DEFAULT_AUTH_METHODS: AuthMethod[] = DEFAULT_AUTH_METHODS_BASE.map((m) => ({
    ...m,
    supportsUsernameless: isUsernamelessCapable(m.type),
}))

const DEFAULT_METHOD_BY_TYPE = new Map<AuthMethodType, AuthMethod>(
    DEFAULT_AUTH_METHODS.map((method) => [method.type, method])
)

export interface AuthMethodApiResponse {
    id: string
    type: string
    name: string
    description: string
    category: string
    platforms: string[]
    requiresEnrollment: boolean
    isActive: boolean
    /** Optional backend flag; when absent it is derived from the method type. */
    supportsUsernameless?: boolean
}

function normalizeCategory(value: string, fallback: AuthMethodCategory): AuthMethodCategory {
    return AUTH_METHOD_CATEGORIES.includes(value as AuthMethodCategory)
        ? value as AuthMethodCategory
        : fallback
}

function normalizePlatforms(values: string[] | undefined, fallback: Platform[]): Platform[] {
    if (!Array.isArray(values)) {
        return fallback
    }

    const normalized = values.filter(isPlatform)
    return normalized.length > 0 ? normalized : fallback
}

export function mapAuthMethodResponseToModel(response: AuthMethodApiResponse): AuthMethod | null {
    if (!isAuthMethodType(response.type)) {
        return null
    }

    // Defense-in-depth: drop anything that isn't a real login factor (e.g. a
    // verification-pipeline step type or GESTURE_LIVENESS) even if the backend
    // ever returns it. The auth-methods surface is login-only. The backend
    // already filters (api 2026-06-01); this guards a regression.
    if (!isLoginMethodType(response.type)) {
        return null
    }

    const fallback = DEFAULT_METHOD_BY_TYPE.get(response.type)
    if (!fallback) {
        return null
    }

    return {
        id: response.type,
        type: response.type,
        name: response.name?.trim() || fallback.name,
        description: response.description?.trim() || fallback.description,
        icon: fallback.icon,
        platforms: normalizePlatforms(response.platforms, fallback.platforms),
        isActive: typeof response.isActive === 'boolean' ? response.isActive : fallback.isActive,
        category: normalizeCategory(response.category, fallback.category),
        supportsUsernameless: typeof response.supportsUsernameless === 'boolean'
            ? response.supportsUsernameless
            : isUsernamelessCapable(response.type),
    }
}

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
