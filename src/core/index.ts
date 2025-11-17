/**
 * Core infrastructure module
 * Exports all core services, errors, DI container, and API clients
 */

// Dependency Injection
export { container, getService, hasService, type Container } from './di/container'
export { TYPES } from './di/types'

// Error Handling
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
    ErrorHandler,
    axiosErrorToAppError,
    type ValidationErrorItem,
} from './errors'

// Services
export {
    LoggerService,
    NotifierService,
    SecureStorageService,
    TokenService,
} from './services'

// API
export { AxiosClient } from './api'
