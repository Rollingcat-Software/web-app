import { AxiosError } from 'axios'

/**
 * API Error response structure from backend
 */
export interface ApiErrorResponse {
    message: string
    code?: string
    errors?: Record<string, string[]>
    timestamp?: string
    path?: string
    status?: number
}

/**
 * Mapped application error
 */
export interface AppApiError {
    message: string
    code: string
    status: number
    fieldErrors?: Record<string, string[]>
    isNetworkError: boolean
    isAuthError: boolean
    isValidationError: boolean
    isServerError: boolean
    originalError: Error
}

/**
 * Error code constants
 */
export const ErrorCodes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    CONFLICT: 'CONFLICT',
    SERVER_ERROR: 'SERVER_ERROR',
    UNKNOWN: 'UNKNOWN',
} as const

/**
 * User-friendly error messages
 */
const ErrorMessages: Record<string, string> = {
    [ErrorCodes.NETWORK_ERROR]: 'Unable to connect to server. Please check your internet connection.',
    [ErrorCodes.TIMEOUT]: 'Request timed out. Please try again.',
    [ErrorCodes.UNAUTHORIZED]: 'Your session has expired. Please log in again.',
    [ErrorCodes.FORBIDDEN]: 'You do not have permission to perform this action.',
    [ErrorCodes.NOT_FOUND]: 'The requested resource was not found.',
    [ErrorCodes.VALIDATION_ERROR]: 'Please check your input and try again.',
    [ErrorCodes.CONFLICT]: 'This action conflicts with existing data.',
    [ErrorCodes.SERVER_ERROR]: 'An unexpected error occurred. Please try again later.',
    [ErrorCodes.UNKNOWN]: 'An unexpected error occurred.',
}

/**
 * Map HTTP status to error code
 */
function statusToErrorCode(status: number | undefined): string {
    if (!status) return ErrorCodes.NETWORK_ERROR

    switch (status) {
        case 401:
            return ErrorCodes.UNAUTHORIZED
        case 403:
            return ErrorCodes.FORBIDDEN
        case 404:
            return ErrorCodes.NOT_FOUND
        case 409:
            return ErrorCodes.CONFLICT
        case 422:
        case 400:
            return ErrorCodes.VALIDATION_ERROR
        default:
            if (status >= 500) return ErrorCodes.SERVER_ERROR
            return ErrorCodes.UNKNOWN
    }
}

/**
 * Map Axios error to application error
 *
 * @example
 * try {
 *   await api.post('/users', data)
 * } catch (error) {
 *   const appError = mapApiError(error)
 *   if (appError.isValidationError) {
 *     // Show field errors
 *     setFieldErrors(appError.fieldErrors)
 *   } else {
 *     // Show general error message
 *     showErrorToast(appError.message)
 *   }
 * }
 */
export function mapApiError(error: unknown): AppApiError {
    if (error instanceof AxiosError) {
        const status = error.response?.status
        const code = statusToErrorCode(status)
        const responseData = error.response?.data as ApiErrorResponse | undefined

        // Get message from response or use default
        let message = responseData?.message || ErrorMessages[code] || error.message

        // For network errors
        if (!error.response) {
            if (error.code === 'ECONNABORTED') {
                return {
                    message: ErrorMessages[ErrorCodes.TIMEOUT],
                    code: ErrorCodes.TIMEOUT,
                    status: 0,
                    isNetworkError: true,
                    isAuthError: false,
                    isValidationError: false,
                    isServerError: false,
                    originalError: error,
                }
            }

            return {
                message: ErrorMessages[ErrorCodes.NETWORK_ERROR],
                code: ErrorCodes.NETWORK_ERROR,
                status: 0,
                isNetworkError: true,
                isAuthError: false,
                isValidationError: false,
                isServerError: false,
                originalError: error,
            }
        }

        return {
            message,
            code: responseData?.code || code,
            status: status || 0,
            fieldErrors: responseData?.errors,
            isNetworkError: false,
            isAuthError: status === 401 || status === 403,
            isValidationError: status === 400 || status === 422,
            isServerError: (status || 0) >= 500,
            originalError: error,
        }
    }

    // Handle non-Axios errors
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
        message: errorMessage || ErrorMessages[ErrorCodes.UNKNOWN],
        code: ErrorCodes.UNKNOWN,
        status: 0,
        isNetworkError: false,
        isAuthError: false,
        isValidationError: false,
        isServerError: false,
        originalError: error instanceof Error ? error : new Error(String(error)),
    }
}

/**
 * Check if error is a specific error type
 */
export function isAuthError(error: unknown): boolean {
    return mapApiError(error).isAuthError
}

export function isValidationError(error: unknown): boolean {
    return mapApiError(error).isValidationError
}

export function isNetworkError(error: unknown): boolean {
    return mapApiError(error).isNetworkError
}

export function isServerError(error: unknown): boolean {
    return mapApiError(error).isServerError
}
