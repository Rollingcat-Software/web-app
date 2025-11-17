/**
 * Core error handling module
 * Exports all error types and error handler
 */

export {
    AppError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    BusinessError,
    InternalError,
    ServiceUnavailableError,
    NetworkError,
    type ValidationErrorItem,
} from './AppError'

export {
    ErrorHandler,
    axiosErrorToAppError,
} from './ErrorHandler'
