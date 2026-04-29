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

export function formatApiError(err: unknown, t: TFunction): string {
    const axiosErr = err as { response?: { status?: number; data?: { message?: string } } }

    if (axiosErr?.response?.status) {
        const status = axiosErr.response.status
        const backendMsg = axiosErr.response.data?.message
        if (backendMsg && !backendMsg.includes('Exception') && !backendMsg.includes('status code') && backendMsg.length < 200) {
            return backendMsg
        }

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
