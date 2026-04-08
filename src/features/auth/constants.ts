/**
 * Auth Feature Constants
 *
 * Centralized constants, enums, and types for the authentication feature.
 * Eliminates magic strings/numbers scattered across components.
 */

// Re-export the canonical enum from domain
export { AuthMethodType } from '@domain/models/AuthMethod'

// ─── MFA Step Status ────────────────────────────────────────────

export enum MfaStepStatus {
    AUTHENTICATED = 'AUTHENTICATED',
    STEP_COMPLETED = 'STEP_COMPLETED',
    CHALLENGE = 'CHALLENGE',
    FAILED = 'FAILED',
    ERROR = 'ERROR',
}

// ─── Auth Session Step Status ───────────────────────────────────

export enum StepStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    SKIPPED = 'SKIPPED',
}

// ─── WebAuthn Constants ─────────────────────────────────────────

export const WEBAUTHN = {
    /** Timeout for WebAuthn operations in milliseconds */
    TIMEOUT_MS: 60_000,
    /** COSE algorithm identifiers */
    ALG_ES256: -7,
    ALG_RS256: -257,
    /** Attestation type */
    ATTESTATION_DIRECT: 'direct' as const,
    /** Attestation format */
    FORMAT_PACKED: 'packed' as const,
    /** Authenticator attachment types */
    ATTACHMENT_PLATFORM: 'platform' as const,
    ATTACHMENT_CROSS_PLATFORM: 'cross-platform' as const,
    /** User verification levels */
    UV_REQUIRED: 'required' as const,
    UV_PREFERRED: 'preferred' as const,
    /** Credential type */
    CREDENTIAL_TYPE: 'public-key' as const,
    /** Transport types */
    TRANSPORT_INTERNAL: 'internal',
    TRANSPORT_USB: 'usb',
    TRANSPORT_BLE: 'ble',
    TRANSPORT_NFC: 'nfc',
    TRANSPORT_HYBRID: 'hybrid',
    /** Default device names (i18n keys) */
    DEVICE_NAME_PLATFORM: 'webauthn.defaultDevicePlatform',
    DEVICE_NAME_KEY: 'webauthn.defaultDeviceKey',
} as const

/** DOMException names thrown by WebAuthn API */
export enum WebAuthnErrorName {
    NOT_ALLOWED = 'NotAllowedError',
    INVALID_STATE = 'InvalidStateError',
    SECURITY = 'SecurityError',
    ABORT = 'AbortError',
}

// ─── API Endpoints ──────────────────────────────────────────────

export const AUTH_API = {
    MFA_STEP: '/auth/mfa/step',
    MFA_SEND_OTP: '/auth/mfa/send-otp',
    MFA_QR_GENERATE: '/auth/mfa/qr-generate',
    WEBAUTHN_REGISTER_OPTIONS: (userId: string) => `/webauthn/register/options/${userId}`,
    WEBAUTHN_REGISTER_VERIFY: '/webauthn/register/verify',
    WEBAUTHN_REGISTER_SELF_OPTIONS: '/webauthn/register-options',
    WEBAUTHN_REGISTER_SELF: '/webauthn/register',
    WEBAUTHN_CREDENTIALS: (userId: string) => `/webauthn/credentials/${userId}`,
    WEBAUTHN_CREDENTIAL_BY_ID: (id: string) => `/webauthn/credentials/by-id/${id}`,
} as const

// ─── MFA Step Action ────────────────────────────────────────────

export enum MfaStepAction {
    CHALLENGE = 'challenge',
    VERIFY = 'verify',
}

// ─── Animation Constants ────────────────────────────────────────

/** Shared cubic-bezier easing used across all auth components */
export const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

/** Standard animation durations in seconds */
export const ANIMATION = {
    STEP_TRANSITION: 0.3,
    CONTAINER_ENTER: 0.5,
    STAGGER_CHILDREN: 0.1,
    ITEM_ENTER: 0.4,
} as const
