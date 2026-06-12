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

import { AuthMethodType, isAuthMethodType, type PuzzleConfig } from './AuthMethod'

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
    /**
     * Tenant-authored PUZZLE layer config (Phase-5 identity binding). Present
     * only when `type === PUZZLE`. The login surfaces thread this down to
     * `MfaStepRenderer` → `PuzzleStep` so `alsoMatchFaceIdentity` can engage when
     * the client-embedding flag is on. Absent for non-PUZZLE methods. The backend
     * may emit it under `puzzleConfig` or `stepConfig.puzzleConfig`.
     */
    puzzleConfig?: PuzzleConfig
}

/** A later (Layer 2..N) step descriptor — `methods.length > 1` ⇒ CHOICE step. */
export interface LoginConfigLaterStep {
    order: number
    methods: AuthMethodType[]
    /**
     * Tenant-authored PUZZLE layer config (Phase-5 identity binding). Present
     * only when this step includes the PUZZLE method. Threaded down to
     * `PuzzleStep` so the `alsoMatchFaceIdentity` binding engages. The backend
     * may emit it under `puzzleConfig` or `stepConfig.puzzleConfig`.
     */
    puzzleConfig?: PuzzleConfig
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
    /**
     * True when the config-driven login engine is ON for this tenant (global flag
     * or per-tenant canary). Switches on the IDENTIFIER-FIRST experience: screen 1
     * collects only identity (email / passkey) and every factor — including
     * password — is presented afterwards. When false the UI keeps the legacy
     * single-screen email+password form, so the redesign reverts with the engine
     * flag and no web redeploy.
     */
    engineActive: boolean
}

// ─── Raw API shape (tolerant) ──────────────────────────────────────

/** Per-step config envelope (Phase 2.4): the backend may nest method-specific
 *  config (e.g. PUZZLE's puzzleConfig) under a `stepConfig` object, or inline it
 *  directly on the method / step. The normalizer accepts both shapes. */
interface RawStepConfig {
    puzzleConfig?: RawPuzzleConfig
}

interface RawPuzzleConfig {
    allowedChallengeTypes?: string[]
    count?: number
    difficulty?: string
    alsoMatchFaceIdentity?: boolean
}

interface RawMethod {
    type?: string
    methodType?: string
    usernameless?: boolean
    supportsUsernameless?: boolean
    requiresEnrollment?: boolean
    puzzleConfig?: RawPuzzleConfig
    stepConfig?: RawStepConfig
}

interface RawLaterStep {
    order?: number
    stepOrder?: number
    methods?: RawMethod[]
    puzzleConfig?: RawPuzzleConfig
    stepConfig?: RawStepConfig
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
    engineActive?: boolean
}

function methodType(raw: RawMethod): AuthMethodType | null {
    const value = (raw.type ?? raw.methodType ?? '').toUpperCase()
    return isAuthMethodType(value) ? (value as AuthMethodType) : null
}

/**
 * Coerce a raw PUZZLE config (inline `puzzleConfig` or nested
 * `stepConfig.puzzleConfig`) into a strict {@link PuzzleConfig}. Returns null
 * when no usable config is present so a non-PUZZLE method stays undefined.
 *
 * `alsoMatchFaceIdentity` DEFAULTS TO TRUE (matching the builder default in
 * {@link AuthMethod}) so a tenant that omits it still gets identity binding —
 * the higher-assurance, safer default.
 */
function puzzleConfigFrom(
    inline: RawPuzzleConfig | undefined,
    step: RawStepConfig | undefined,
): PuzzleConfig | undefined {
    const raw = inline ?? step?.puzzleConfig
    if (!raw) return undefined
    const difficulty: PuzzleConfig['difficulty'] =
        raw.difficulty === 'easy' || raw.difficulty === 'hard' ? raw.difficulty : 'medium'
    return {
        allowedChallengeTypes: Array.isArray(raw.allowedChallengeTypes)
            ? raw.allowedChallengeTypes.filter((c): c is string => typeof c === 'string')
            : [],
        count: typeof raw.count === 'number' && raw.count >= 1 ? raw.count : 1,
        difficulty,
        alsoMatchFaceIdentity: raw.alsoMatchFaceIdentity ?? true,
    }
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
                ...(type === AuthMethodType.PUZZLE
                    ? { puzzleConfig: puzzleConfigFrom(m.puzzleConfig, m.stepConfig) }
                    : {}),
            }
        })
        .filter((m): m is LoginConfigLayer1Method => m !== null)

    // A login-config with no usable Layer-1 method is unusable — treat as null
    // so the caller falls back to the legacy email+password surface.
    if (layer1Methods.length === 0) return null

    const laterSteps: LoginConfigLaterStep[] = (raw.laterSteps ?? [])
        .map((s, idx): LoginConfigLaterStep => {
            const methods = (s.methods ?? [])
                .map(methodType)
                .filter((m): m is AuthMethodType => m !== null)
            // PUZZLE config can live on the step itself or on the PUZZLE method
            // entry within the step — prefer the step-level value, fall back to
            // the per-method one.
            const puzzleMethod = (s.methods ?? []).find((m) => methodType(m) === AuthMethodType.PUZZLE)
            const puzzleConfig = methods.includes(AuthMethodType.PUZZLE)
                ? puzzleConfigFrom(
                      s.puzzleConfig ?? puzzleMethod?.puzzleConfig,
                      s.stepConfig ?? puzzleMethod?.stepConfig,
                  )
                : undefined
            return {
                order: s.order ?? s.stepOrder ?? idx + 2,
                methods,
                ...(puzzleConfig ? { puzzleConfig } : {}),
            }
        })
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
        engineActive: Boolean(raw.engineActive ?? false),
    }
}

// ─── Layer-1 method classification helpers ─────────────────────────

/**
 * Layer-1 methods that, when usernameless, surface the passkey one-tap button.
 * The frozen contract (api task #16) emits a dedicated PASSKEY type for
 * discoverable WebAuthn; HARDWARE_KEY / FINGERPRINT are kept so a tenant whose
 * config marks one of those usernameless still gets the passkey affordance.
 */
const PASSKEY_TYPES: ReadonlySet<AuthMethodType> = new Set([
    AuthMethodType.PASSKEY,
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
 * Does Layer 1 offer the usernameless cross-device approval (number-matching)?
 *
 * The frozen contract (api task #16) emits a dedicated APPROVE_LOGIN type for
 * this. A usernameless QR_CODE also surfaces the approve affordance since both
 * are device-to-device with no identifier typed.
 */
export function hasUsernamelessApprove(config: LoginConfig): boolean {
    return config.layer1.methods.some(
        (m) => m.usernameless &&
            (m.type === AuthMethodType.APPROVE_LOGIN || m.type === AuthMethodType.QR_CODE),
    )
}

/** Identifier (email) box needed for any identifier-first Layer-1 method? */
export function needsIdentifier(config: LoginConfig): boolean {
    if (config.layer1.identifierRequired) return true
    // Defensive: if PASSWORD is offered we always need an identifier even if the
    // backend forgot to set the flag.
    return hasPasswordLayer1(config)
}

/**
 * Resolve the tenant-authored {@link PuzzleConfig} for a PUZZLE auth step, so a
 * login surface can thread it to `MfaStepRenderer` → `PuzzleStep` and let the
 * `alsoMatchFaceIdentity` identity-binding engage (Phase-5). The PUZZLE method
 * can appear on Layer 1 or on a later step; we search both and return the first
 * config found. Returns undefined when the config is null, when PUZZLE isn't the
 * method being rendered, or when the tenant authored no puzzleConfig (then
 * `PuzzleStep` is liveness-only — its existing default).
 *
 * `method` lets the caller scope the lookup to the step actually rendering
 * (the renderer only consumes the config on a PUZZLE step), but the function is
 * safe to call unconditionally — it no-ops for non-PUZZLE methods.
 */
export function selectPuzzleConfig(
    config: LoginConfig | null | undefined,
    method: string | null | undefined,
): PuzzleConfig | undefined {
    if (!config || method !== AuthMethodType.PUZZLE) return undefined
    const layer1 = config.layer1.methods.find((m) => m.type === AuthMethodType.PUZZLE)
    if (layer1?.puzzleConfig) return layer1.puzzleConfig
    const later = config.laterSteps.find(
        (s) => s.methods.includes(AuthMethodType.PUZZLE) && s.puzzleConfig,
    )
    return later?.puzzleConfig
}
