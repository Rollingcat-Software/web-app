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
 * Map a backend domain `errorCode` (carried as `data.errorCode` or, for the
 * Spring `ErrorResponse` envelope, `data.error`) to a localized i18n key.
 * Returning `null` means the caller should keep falling through to the
 * status-based default.
 *
 * Centralised here so route-aware branches and shape-driven branches stay in
 * sync. Keep keys present in BOTH `en.json` and `tr.json`.
 */
function errorCodeToI18nKey(code: string | undefined): string | null {
    switch (code) {
        case 'INVALID_CREDENTIALS':
            return 'errors.invalidCredentials'
        case 'NEEDS_ENROLLMENT':
            return 'errors.needsEnrollment'
        case 'MFA_REQUIRED':
            return 'errors.mfaRequired'
        default:
            return null
    }
}

/**
 * Format an API/runtime error into a localized human message.
 *
 * Order of resolution:
 *   1. Backend `errorCode` (preferred — stable across i18n locales).
 *   2. Route-aware status mapping (e.g. 401 from `/auth/login` → invalid creds,
 *      not "session expired").
 *   3. Backend-supplied `message` IFF it looks user-safe (no stack/Exception
 *      tokens, no leaked HTTP-status template, < 200 chars).
 *   4. Generic per-status fallback.
 *   5. Zod / Network / unknown.
 *
 * NEVER show raw `err.message` to the user — that's how stack traces and
 * English defaults leaked into the UI before this helper existed.
 */
export function formatApiError(err: unknown, t: TFunction): string {
    const axiosErr = err as {
        response?: {
            status?: number
            data?: { message?: string; errorCode?: string; error?: string }
        }
        config?: { url?: string }
    }

    if (axiosErr?.response?.status) {
        const status = axiosErr.response.status
        const data = axiosErr.response.data
        const url = axiosErr.config?.url ?? ''

        // 1. Stable backend errorCode wins. Spring's ErrorResponse puts the
        // code in `error`; some endpoints use `errorCode`. Prefer either.
        const codeKey = errorCodeToI18nKey(data?.errorCode ?? data?.error)
        if (codeKey) {
            return t(codeKey)
        }

        // 2. Route-aware: a 401 on `/auth/login` is "wrong password", not
        // "session expired". `errors.unauthorized` ("Oturumunuz sona erdi")
        // is misleading here because the user never had a session yet.
        if (status === 401 && url.includes('/auth/login')) {
            return t('errors.invalidCredentials')
        }

        // 3. Use backend message if it looks safe.
        const backendMsg = data?.message
        if (backendMsg && !backendMsg.includes('Exception') && !backendMsg.includes('status code') && backendMsg.length < 200) {
            return backendMsg
        }

        // 4. Per-status fallback.
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
