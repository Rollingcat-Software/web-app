import type { TFunction } from 'i18next'

/**
 * Shape-test for ZodError without importing the runtime dep here.
 * Zod errors expose `name === 'ZodError'` and an `issues` array.
 */
function isZodError(err: unknown): err is { name: string; issues: unknown[] } {
    if (!err || typeof err !== 'object') return false
    const e = err as { name?: unknown; issues?: unknown }
    return e.name === 'ZodError' && Array.isArray(e.issues)
}

/**
 * Map a backend domain `errorCode` (Spring `ErrorResponse` envelope, where
 * the code is carried in `data.errorCode` or `data.error`) to a localized
 * i18n key. Returning `null` means the caller should keep falling through
 * to the next branch.
 *
 * NOTE: `TENANT_MISMATCH` is handled inline in `formatApiError` (not here)
 * because it requires interpolating the `requiredTenant` value carried in
 * the response body alongside the errorCode.
 */
function errorCodeToI18nKey(code: string | undefined): string | null {
    switch (code) {
        case 'INVALID_CREDENTIALS':
            return 'errors.invalidCredentials'
        case 'NEEDS_ENROLLMENT':
            return 'errors.needsEnrollment'
        case 'MFA_REQUIRED':
            return 'errors.mfaRequired'
        // V62 — tenant email-domain management + enforcement.
        case 'EMAIL_DOMAIN_ALREADY_CLAIMED':
            return 'errors.emailDomainAlreadyClaimed'
        case 'CANNOT_REMOVE_LAST_DOMAIN':
            return 'errors.cannotRemoveLastDomain'
        case 'EMAIL_DOMAIN_NOT_ALLOWED':
            return 'errors.emailDomainNotAllowed'
        // Self-service onboarding — admin used a personal/free email provider (422).
        case 'PERSONAL_EMAIL_NOT_ALLOWED':
            return 'errors.personalEmailNotAllowed'
        // Tenant Auth-Methods true-gate (2026-06-01). AUTH_METHOD_DISABLED is the
        // login-time rejection (403) for a method explicitly disabled for the
        // tenant; the other two carry interpolated lists and are handled inline
        // in formatApiError (so they are NOT mapped here).
        case 'AUTH_METHOD_DISABLED':
            return 'errors.authMethodDisabled'
        default:
            return null
    }
}

/**
 * Render a backend `PASSWORD_POLICY_VIOLATION` error envelope into a
 * localized multi-line string, one line per failed rule.
 *
 * Backend (Team A, audit 2026-05-07) returns:
 *   { errorCode: 'PASSWORD_POLICY_VIOLATION',
 *     message: '...',
 *     details: { rules: [{ code: 'TOO_SHORT', params: { min: 12 } }, ...] } }
 *
 * `code` is mapped to a key under `errors.passwordPolicy.*`. Unknown codes
 * fall back to the rule's own message string when present, otherwise to
 * `errors.passwordPolicy.unknownRule` with the raw code interpolated.
 */
interface PasswordPolicyRuleViolation {
    code?: string
    message?: string
    params?: Record<string, unknown>
}
function passwordPolicyRuleToI18nKey(code: string | undefined): string | null {
    switch (code) {
        case 'TOO_SHORT':
        case 'MIN_LENGTH':
            return 'errors.passwordPolicy.tooShort'
        case 'TOO_LONG':
        case 'MAX_LENGTH':
            return 'errors.passwordPolicy.tooLong'
        case 'MISSING_UPPERCASE':
        case 'NO_UPPERCASE':
            return 'errors.passwordPolicy.missingUppercase'
        case 'MISSING_LOWERCASE':
        case 'NO_LOWERCASE':
            return 'errors.passwordPolicy.missingLowercase'
        case 'MISSING_DIGIT':
        case 'NO_DIGIT':
            return 'errors.passwordPolicy.missingDigit'
        case 'MISSING_SPECIAL':
        case 'NO_SPECIAL':
            return 'errors.passwordPolicy.missingSpecial'
        case 'CONTAINS_WHITESPACE':
            return 'errors.passwordPolicy.containsWhitespace'
        case 'CONTAINS_USER_INFO':
            return 'errors.passwordPolicy.containsUserInfo'
        case 'PREVIOUSLY_USED':
        case 'PASSWORD_REUSED':
            return 'errors.passwordPolicy.previouslyUsed'
        case 'COMMON_PASSWORD':
            return 'errors.passwordPolicy.commonPassword'
        default:
            return null
    }
}
function formatPasswordPolicyViolation(
    data: { details?: { rules?: PasswordPolicyRuleViolation[] } } | undefined,
    t: TFunction
): string {
    const rules = data?.details?.rules ?? []
    const lines: string[] = [t('errors.PASSWORD_POLICY_VIOLATION')]
    for (const rule of rules) {
        const key = passwordPolicyRuleToI18nKey(rule.code)
        if (key) {
            lines.push('• ' + t(key, (rule.params ?? {}) as Record<string, unknown>))
        } else if (typeof rule.message === 'string' && rule.message.trim().length > 0) {
            lines.push('• ' + rule.message)
        } else if (rule.code) {
            lines.push('• ' + t('errors.passwordPolicy.unknownRule', { rule: rule.code }))
        }
    }
    return lines.join('\n')
}

/**
 * Map an OAuth2 RFC-6749 §5.2 error code (lowercase_snake) to an i18n key.
 * Codes are sourced from the OAuth2Controller error contract — keep in sync
 * when new codes are added on the backend.
 */
function oauthErrorToI18nKey(code: string | undefined): string | null {
    switch (code) {
        case 'invalid_grant':
            return 'errors.oauth.invalidGrant'
        case 'invalid_request':
            return 'errors.oauth.invalidRequest'
        case 'invalid_client':
            return 'errors.oauth.invalidClient'
        case 'unauthorized_client':
            return 'errors.oauth.unauthorizedClient'
        case 'unsupported_grant_type':
            return 'errors.oauth.unsupportedGrantType'
        case 'invalid_scope':
            return 'errors.oauth.invalidScope'
        case 'access_denied':
            return 'errors.oauth.accessDenied'
        case 'server_error':
            return 'errors.oauth.serverError'
        case 'temporarily_unavailable':
            return 'errors.oauth.temporarilyUnavailable'
        default:
            return null
    }
}

/**
 * Distinguish Spring `ErrorResponse` codes from OAuth2 codes by casing.
 *
 * Backend conventions:
 *  - Spring ErrorResponse: SCREAMING_SNAKE_CASE (e.g. `INVALID_CREDENTIALS`,
 *    `TENANT_MISMATCH`, `NEEDS_ENROLLMENT`).
 *  - OAuth2 RFC-6749 §5.2: lowercase_snake_case (e.g. `invalid_grant`,
 *    `unauthorized_client`).
 *
 * The two namespaces never collide because the casing differs, so we can
 * drive the switch chain off the shape of the code alone.
 */
function isSpringErrorCode(code: string | undefined): boolean {
    return typeof code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(code)
}

function isOAuth2ErrorCode(code: string | undefined): boolean {
    return typeof code === 'string' && /^[a-z][a-z0-9_]*$/.test(code)
}

/**
 * Heuristic for "this backend message is safe to render to the user as-is".
 *
 * Rejects:
 *  - Java/Python stacktrace tokens (`Exception`).
 *  - The axios default template (`Request failed with status code 401`),
 *    which leaks the HTTP status into otherwise-localized UI.
 *  - Anything pathologically long.
 */
function isSafeBackendMessage(msg: unknown): msg is string {
    return (
        typeof msg === 'string' &&
        msg.length > 0 &&
        msg.length < 200 &&
        !msg.includes('Exception') &&
        !msg.includes('status code')
    )
}

/**
 * Format an API/runtime error into a localized human message.
 *
 * The frontend has to reconcile three distinct backend envelopes:
 *
 *   1. Spring `ErrorResponse` — `{ errorCode | error: "SCREAMING_SNAKE", message: "…" }`.
 *      Used by every `@RestControllerAdvice`-handled exception. Stable across
 *      i18n locales because the code (not the message) is the contract.
 *
 *   2. OAuth2 RFC-6749 §5.2 — `{ error: "lowercase_snake", error_description: "…" }`.
 *      Used by `OAuth2Controller` for token / authorize endpoints. Codes are
 *      defined by the spec; descriptions are English-only.
 *
 *   3. MFA-step inline failure — `{ status: "FAILED", message: "…" }`.
 *      `POST /auth/mfa/step` returns HTTP 200 with this body when a single
 *      step (e.g. wrong OTP) fails inside an otherwise-valid MFA session.
 *
 * Order of resolution:
 *   1. Spring ErrorResponse `errorCode` / SCREAMING_SNAKE `error` (most cases
 *      including `TENANT_MISMATCH`).
 *   2. OAuth2 RFC-6749 lowercase `error`.
 *   3. MFA-step `status === "FAILED"` (HTTP 200 carrying a logical failure).
 *   4. Route-aware HTTP status (e.g. 401 from `/auth/login` → invalid creds).
 *   5. Backend `message` IFF it looks user-safe.
 *   6. Generic per-status fallback.
 *   7. Zod / Network / unknown.
 *
 * NEVER show raw `err.message` to the user — that's how stack traces and
 * English defaults leaked into the UI before this helper existed.
 */
export function formatApiError(err: unknown, t: TFunction): string {
    const axiosErr = err as {
        response?: {
            status?: number
            data?: {
                message?: string
                errorCode?: string
                error?: string
                error_description?: string
                /** MFA-step inline failure (HTTP 200 with status=FAILED). */
                status?: string
                /** T-TENANT-GATE 2026-05-07 — present on TENANT_MISMATCH 403. */
                requiredTenant?: string
                /** Device-cap 409 (Team A, audit 2026-05-07) — `app.security.max-devices-per-user`. */
                maxDevices?: number
                max?: number
                /**
                 * Account-lockout 423 (P0-#5, INVESTIGATION_MASTER_2026-05-07) —
                 * GlobalExceptionHandler.handleAccountLocked carries the remaining
                 * lock duration (seconds) at the root of the error envelope.
                 */
                remainingLockTimeSeconds?: number
                /** PASSWORD_POLICY_VIOLATION structured details (Team A, audit 2026-05-07). */
                details?: { rules?: PasswordPolicyRuleViolation[] }
                /** Tenant Auth-Methods true-gate (2026-06-01). */
                method?: string
                activeFlows?: string[]
                disabledMethods?: string[]
            }
        }
        config?: { url?: string }
    }

    if (axiosErr?.response?.status) {
        const status = axiosErr.response.status
        const data = axiosErr.response.data
        const url = axiosErr.config?.url ?? ''

        // Pick the right "code" depending on the envelope shape. We MUST NOT
        // mix Spring + OAuth2 codes into one bucket — `invalid_request` and
        // `INVALID_CREDENTIALS` mean different things in different namespaces.
        const errorCode = data?.errorCode
        const errorField = data?.error
        const springCode = isSpringErrorCode(errorCode)
            ? errorCode
            : isSpringErrorCode(errorField)
                ? errorField
                : undefined
        const oauthCode = isOAuth2ErrorCode(errorField) ? errorField : undefined

        // ─── 1. Spring ErrorResponse ────────────────────────────────────
        if (springCode) {
            // T-TENANT-GATE 2026-05-07: tenant-lock on hosted/widget login.
            // Backend returns HTTP 403 + `errorCode: TENANT_MISMATCH` + a
            // `requiredTenant` field with the tenant display name.
            if (springCode === 'TENANT_MISMATCH') {
                const tenant = data?.requiredTenant?.trim()
                return tenant
                    ? t('errors.TENANT_MISMATCH_INLINE', { tenant })
                    : t('errors.TENANT_MISMATCH_INLINE_NOTENANT')
            }
            // Account-lockout 423 (P0-#5) — GlobalExceptionHandler returns
            // HTTP 423 + `errorCode: ACCOUNT_LOCKED` + `remainingLockTimeSeconds`.
            // Without this branch the user only saw the English-only backend
            // `message` (no minutes, no Turkish). Interpolate the remaining
            // minutes (ceil so "0:30 left" reads "1 minute", never "0 minutes").
            if (springCode === 'ACCOUNT_LOCKED') {
                const seconds = data?.remainingLockTimeSeconds
                const minutes = typeof seconds === 'number' && seconds > 0
                    ? Math.ceil(seconds / 60)
                    : 1
                return t('reasonCodes.ACCOUNT_LOCKED', { minutes })
            }
            // Device-cap 409 — Team A is shipping `app.security.max-devices-per-user`.
            // Backend may surface the cap as `maxDevices` or `max`; tolerate
            // either spelling. Until the backend lands, this branch is dead
            // code at runtime but the wire is in place.
            if (springCode === 'USER_DEVICE_LIMIT_REACHED' || springCode === 'DEVICE_LIMIT_REACHED') {
                const max = data?.maxDevices ?? data?.max
                return t('errors.USER_DEVICE_LIMIT_REACHED', { max: max ?? '' })
            }
            // Password-policy structured rendering — see `formatPasswordPolicyViolation`.
            if (springCode === 'PASSWORD_POLICY_VIOLATION') {
                return formatPasswordPolicyViolation(data, t)
            }
            // Tenant Auth-Methods true-gate (2026-06-01): write-side no-lock-out
            // guards. AUTH_METHOD_IN_USE (409) carries the dependent active flow
            // names; AUTH_FLOW_METHOD_DISABLED (422) carries the disabled methods.
            // Both interpolate a comma-joined list, so they're handled inline.
            if (springCode === 'AUTH_METHOD_IN_USE') {
                const method = data?.method?.trim()
                const flows = Array.isArray(data?.activeFlows) ? data.activeFlows.join(', ') : ''
                return flows
                    ? t('errors.authMethodInUse', { method: method ?? '', flows })
                    : t('errors.authMethodInUseNoFlows', { method: method ?? '' })
            }
            if (springCode === 'AUTH_FLOW_METHOD_DISABLED') {
                const methods = Array.isArray(data?.disabledMethods)
                    ? data.disabledMethods.join(', ')
                    : ''
                return t('errors.authFlowMethodDisabled', { methods })
            }
            const codeKey = errorCodeToI18nKey(springCode)
            if (codeKey) return t(codeKey)
            // Unmapped SCREAMING_SNAKE code → fall through to message /
            // status fallback rather than rendering the raw code.
        }

        // ─── 2. OAuth2 RFC-6749 §5.2 ────────────────────────────────────
        if (oauthCode) {
            const oauthKey = oauthErrorToI18nKey(oauthCode)
            if (oauthKey) return t(oauthKey)
            // Unmapped lowercase code → also fall through.
        }

        // ─── 3. MFA-step inline failure (HTTP 200, status=FAILED) ───────
        // This branch only fires if a caller explicitly threw on a 200
        // response carrying `{ status: "FAILED", message }`. Most call
        // sites currently inspect `status` directly and never reach here,
        // but the contract is documented for future call sites that wrap
        // step failures as exceptions.
        if (data?.status === 'FAILED') {
            if (isSafeBackendMessage(data?.message)) {
                return data.message as string
            }
            return t('errors.mfaStepFailed')
        }

        // ─── 4. Route-aware HTTP status ─────────────────────────────────
        // A 401 on `/auth/login` is "wrong password", not "session expired".
        if (status === 401 && url.includes('/auth/login')) {
            return t('errors.invalidCredentials')
        }

        // ─── 5. Backend message passthrough (when safe) ─────────────────
        // Prefer OAuth2 `error_description` over the generic `message` when
        // both are present; OAuth2 errors carry their detail in
        // `error_description` per RFC 6749 §5.2.
        const backendMsg = data?.error_description ?? data?.message
        if (isSafeBackendMessage(backendMsg)) {
            return backendMsg
        }

        // ─── 6. Per-status fallback ─────────────────────────────────────
        switch (status) {
            case 400: return t('errors.badRequest')
            case 401: return t('errors.unauthorized')
            case 403: return t('errors.forbidden')
            case 404: return t('errors.notFound')
            case 409: return t('errors.conflict')
            case 413: return t('errors.tooLarge')
            case 422: return t('errors.validation')
            case 429: return t('errors.tooManyRequests')
            default:
                if (status >= 500) return t('errors.serverError')
                return t('errors.unknown')
        }
    }

    // ZodError — services re-throw the raw Zod result so we can decide how
    // to render. We surface a generic "validation failed" message; the
    // calling form is responsible for showing per-field hints from its own
    // resolver-produced FieldErrors when those exist.
    if (isZodError(err)) {
        return t('errors.validation')
    }

    if (err instanceof TypeError || (err instanceof Error && err.message.includes('Network'))) {
        return t('errors.networkError')
    }

    return t('errors.unknown')
}
