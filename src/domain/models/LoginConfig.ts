/**
 * LoginConfig — the tenant's Layer-1 login surface, as described by the backend.
 *
 * The hosted login page (and the dashboard login) render their first
 * authentication layer STRICTLY from this config instead of hardcoding an
 * email+password form. Subsequent layers (2..N) are still driven by the
 * existing MFA step machinery via the `/auth/mfa/step` session.
 *
 * Backend contract (provisional — agent-api3, task #16):
 *   GET /api/v1/auth/login-config?clientId=<oauthClientId>   (unauthenticated)
 *   {
 *     tenantId, tenantName,
 *     layer1: {
 *       identifierRequired: bool,
 *       methods: [{ type, usernameless: bool, requiresEnrollment: bool }]
 *     },
 *     totalSteps,
 *     laterSteps: [{ order, methods: [{ type }] }]
 *   }
 *
 * Everything here is normalized through {@link normalizeLoginConfig} so the UI
 * is resilient to field-name / casing deltas while the contract settles.
 */

import { AuthMethodType, isAuthMethodType } from './AuthMethod'

/** A single method offered at Layer 1. */
export interface LoginConfigLayer1Method {
    type: AuthMethodType
    /**
     * True when this method can authenticate WITHOUT the user first typing an
     * identifier (email). Drives whether a one-tap shortcut (passkey / QR /
     * approve-on-another-device) is shown for it.
     */
    usernameless: boolean
    /** True when the method only works for users who have enrolled it. */
    requiresEnrollment: boolean
}

/** A later (Layer 2..N) step descriptor — `methods.length > 1` ⇒ CHOICE step. */
export interface LoginConfigLaterStep {
    order: number
    methods: AuthMethodType[]
}

export interface LoginConfig {
    tenantId: string | null
    tenantName: string | null
    layer1: {
        identifierRequired: boolean
        methods: LoginConfigLayer1Method[]
    }
    totalSteps: number
    laterSteps: LoginConfigLaterStep[]
}

// ─── Raw API shape (tolerant) ──────────────────────────────────────

interface RawMethod {
    type?: string
    methodType?: string
    usernameless?: boolean
    supportsUsernameless?: boolean
    requiresEnrollment?: boolean
}

interface RawLaterStep {
    order?: number
    stepOrder?: number
    methods?: RawMethod[]
}

export interface RawLoginConfig {
    tenantId?: string | null
    tenantName?: string | null
    layer1?: {
        identifierRequired?: boolean
        methods?: RawMethod[]
    }
    totalSteps?: number
    laterSteps?: RawLaterStep[]
}

function methodType(raw: RawMethod): AuthMethodType | null {
    const value = (raw.type ?? raw.methodType ?? '').toUpperCase()
    return isAuthMethodType(value) ? (value as AuthMethodType) : null
}

/**
 * Coerce a raw backend response into a strict {@link LoginConfig}.
 *
 * Tolerant of camelCase / snake-ish deltas (`type` | `methodType`,
 * `usernameless` | `supportsUsernameless`, `order` | `stepOrder`) and drops
 * any method whose `type` is not a known {@link AuthMethodType}.
 */
export function normalizeLoginConfig(raw: RawLoginConfig | null | undefined): LoginConfig | null {
    if (!raw || !raw.layer1) return null

    const layer1Methods: LoginConfigLayer1Method[] = (raw.layer1.methods ?? [])
        .map((m): LoginConfigLayer1Method | null => {
            const type = methodType(m)
            if (!type) return null
            return {
                type,
                usernameless: Boolean(m.usernameless ?? m.supportsUsernameless ?? false),
                requiresEnrollment: Boolean(m.requiresEnrollment ?? false),
            }
        })
        .filter((m): m is LoginConfigLayer1Method => m !== null)

    // A login-config with no usable Layer-1 method is unusable — treat as null
    // so the caller falls back to the legacy email+password surface.
    if (layer1Methods.length === 0) return null

    const laterSteps: LoginConfigLaterStep[] = (raw.laterSteps ?? [])
        .map((s, idx): LoginConfigLaterStep => ({
            order: s.order ?? s.stepOrder ?? idx + 2,
            methods: (s.methods ?? [])
                .map(methodType)
                .filter((m): m is AuthMethodType => m !== null),
        }))
        .filter((s) => s.methods.length > 0)
        .sort((a, b) => a.order - b.order)

    return {
        tenantId: raw.tenantId ?? null,
        tenantName: raw.tenantName ?? null,
        layer1: {
            identifierRequired: Boolean(raw.layer1.identifierRequired ?? false),
            methods: layer1Methods,
        },
        totalSteps: typeof raw.totalSteps === 'number' && raw.totalSteps > 0
            ? raw.totalSteps
            : 1 + laterSteps.length,
        laterSteps,
    }
}

// ─── Layer-1 method classification helpers ─────────────────────────

/** Layer-1 methods that, when usernameless, surface a passkey one-tap button. */
const PASSKEY_TYPES: ReadonlySet<AuthMethodType> = new Set([
    AuthMethodType.HARDWARE_KEY,
    AuthMethodType.FINGERPRINT,
])

export function hasPasswordLayer1(config: LoginConfig): boolean {
    return config.layer1.methods.some((m) => m.type === AuthMethodType.PASSWORD)
}

/** Does Layer 1 offer a usernameless passkey (platform/cross-platform) method? */
export function hasUsernamelessPasskey(config: LoginConfig): boolean {
    return config.layer1.methods.some((m) => m.usernameless && PASSKEY_TYPES.has(m.type))
}

/** Does Layer 1 offer a usernameless QR shortcut? */
export function hasUsernamelessQr(config: LoginConfig): boolean {
    return config.layer1.methods.some(
        (m) => m.usernameless && m.type === AuthMethodType.QR_CODE,
    )
}

/**
 * Does Layer 1 offer a usernameless cross-device approval?
 *
 * The backend does not (yet) emit a dedicated AuthMethodType for
 * "approve-on-another-device" — it is a QR/push hybrid. Until agent-api3
 * confirms a concrete enum value, we treat a usernameless QR_CODE method as
 * also enabling the approve shortcut (both are device-to-device, no identifier
 * needed). This is intentionally permissive; once the API emits a distinct
 * type we will narrow it.
 */
export function hasUsernamelessApprove(config: LoginConfig): boolean {
    return hasUsernamelessQr(config)
}

/** Identifier (email) box needed for any identifier-first Layer-1 method? */
export function needsIdentifier(config: LoginConfig): boolean {
    if (config.layer1.identifierRequired) return true
    // Defensive: if PASSWORD is offered we always need an identifier even if the
    // backend forgot to set the flag.
    return hasPasswordLayer1(config)
}
