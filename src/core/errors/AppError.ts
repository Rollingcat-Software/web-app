/**
 * Base class for all application errors
 * Provides standardized error handling with status codes and operational flags
 */
export abstract class AppError extends Error {
    abstract readonly statusCode: number
    abstract readonly isOperational: boolean

    constructor(message: string, public readonly metadata?: unknown) {
        super(message)
        Object.setPrototypeOf(this, new.target.prototype)
        Error.captureStackTrace(this, this.constructor)
    }
}

/**
 * Validation error - 400 Bad Request
 * Used when user input fails validation
 */
export class ValidationError extends AppError {
    readonly statusCode = 400
    readonly isOperational = true

    constructor(
        message: string = 'Validation failed',
        public readonly errors?: ValidationErrorItem[]
    ) {
        super(message, { errors })
    }
}

export interface ValidationErrorItem {
    field: string
    message: string
    value?: unknown
}

/**
 * Unauthorized error - 401
 * Used when authentication is required but not provided or invalid
 */
export class UnauthorizedError extends AppError {
    readonly statusCode = 401
    readonly isOperational = true

    constructor(message: string = 'Unauthorized') {
        super(message)
    }
}

/**
 * Forbidden error - 403
 * Used when user lacks permission for the requested operation
 */
export class ForbiddenError extends AppError {
    readonly statusCode = 403
    readonly isOperational = true

    constructor(message: string = 'Forbidden') {
        super(message)
    }
}

/**
 * Not found error - 404
 * Used when requested resource doesn't exist
 */
export class NotFoundError extends AppError {
    readonly statusCode = 404
    readonly isOperational = true

    constructor(message: string = 'Resource not found') {
        super(message)
    }
}

/**
 * Conflict error - 409
 * Used when operation conflicts with current state (e.g., duplicate email)
 */
export class ConflictError extends AppError {
    readonly statusCode = 409
    readonly isOperational = true

    constructor(message: string = 'Resource conflict') {
        super(message)
    }
}

/**
 * Business logic error - 422 Unprocessable Entity
 * Used when request is valid but violates business rules
 */
export class BusinessError extends AppError {
    readonly statusCode = 422
    readonly isOperational = true

    constructor(message: string, metadata?: unknown) {
        super(message, metadata)
    }
}

/**
 * Internal server error - 500
 * Used for unexpected errors that should be logged and investigated
 */
export class InternalError extends AppError {
    readonly statusCode = 500
    readonly isOperational = false

    constructor(message: string = 'Internal server error', metadata?: unknown) {
        super(message, metadata)
    }
}

/**
 * Service unavailable error - 503
 * Used when external service is temporarily unavailable
 */
export class ServiceUnavailableError extends AppError {
    readonly statusCode = 503
    readonly isOperational = true

    constructor(message: string = 'Service temporarily unavailable') {
        super(message)
    }
}

/**
 * Network error
 * Used when network request fails
 */
export class NetworkError extends AppError {
    readonly statusCode = 0
    readonly isOperational = true

    constructor(message: string = 'Network error occurred') {
        super(message)
    }
}
