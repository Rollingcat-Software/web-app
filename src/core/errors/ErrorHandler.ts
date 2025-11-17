import { AxiosError } from 'axios'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { INotifier } from '@domain/interfaces/INotifier'
import {
    AppError,
    NetworkError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    InternalError,
} from './AppError'

/**
 * Centralized error handler
 * Handles all types of errors and provides consistent error messages to users
 */
export class ErrorHandler {
    constructor(
        private readonly logger: ILogger,
        private readonly notifier: INotifier
    ) {}

    /**
     * Main error handling method
     * Routes errors to appropriate handler based on type
     */
    handle(error: unknown): void {
        if (error instanceof AppError) {
            this.handleAppError(error)
        } else if (error instanceof AxiosError) {
            this.handleApiError(error)
        } else if (error instanceof Error) {
            this.handleGenericError(error)
        } else {
            this.handleUnknownError(error)
        }
    }

    /**
     * Handle application-specific errors
     */
    private handleAppError(error: AppError): void {
        if (error.isOperational) {
            // Operational errors are expected and should be shown to user
            this.notifier.error(error.message)
            this.logger.warn(error.message, {
                statusCode: error.statusCode,
                metadata: error.metadata,
            })
        } else {
            // Non-operational errors are unexpected and should be logged
            this.logger.error('Non-operational error occurred', error)
            this.notifier.error('An unexpected error occurred. Please try again.')
        }
    }

    /**
     * Handle Axios/HTTP errors
     */
    private handleApiError(error: AxiosError): void {
        const status = error.response?.status
        const data = error.response?.data as any
        const message = data?.message || error.message

        this.logger.error('API Error', {
            status,
            message,
            url: error.config?.url,
            method: error.config?.method,
        })

        if (!error.response) {
            // Network error - no response received
            this.notifier.error('Network error. Please check your connection.')
            return
        }

        switch (status) {
            case 400:
                this.notifier.error(message || 'Invalid request. Please check your input.')
                break
            case 401:
                this.notifier.error('Session expired. Please login again.')
                break
            case 403:
                this.notifier.error('You do not have permission for this action.')
                break
            case 404:
                this.notifier.error('Resource not found.')
                break
            case 409:
                this.notifier.error(message || 'This resource already exists.')
                break
            case 422:
                this.notifier.error(message || 'Unable to process your request.')
                break
            case 429:
                this.notifier.error('Too many requests. Please try again later.')
                break
            case 500:
            case 502:
            case 503:
            case 504:
                this.notifier.error('Server error. Please try again later.')
                break
            default:
                this.notifier.error(message || 'An error occurred. Please try again.')
        }
    }

    /**
     * Handle generic JavaScript errors
     */
    private handleGenericError(error: Error): void {
        this.logger.error('Generic error', error)
        this.notifier.error('An unexpected error occurred.')
    }

    /**
     * Handle unknown error types
     */
    private handleUnknownError(error: unknown): void {
        this.logger.error('Unknown error', error)
        this.notifier.error('An unexpected error occurred.')
    }

    /**
     * Handle async errors with automatic error handling
     */
    async handleAsync<T>(
        operation: () => Promise<T>,
        options?: {
            errorMessage?: string
            onError?: (error: unknown) => void
        }
    ): Promise<T | null> {
        try {
            return await operation()
        } catch (error) {
            if (options?.errorMessage) {
                this.notifier.error(options.errorMessage)
            }
            this.handle(error)
            options?.onError?.(error)
            return null
        }
    }
}

/**
 * Convert Axios error to AppError
 */
export function axiosErrorToAppError(error: AxiosError): AppError {
    const status = error.response?.status
    const message = (error.response?.data as any)?.message || error.message

    if (!error.response) {
        return new NetworkError('Network error occurred')
    }

    switch (status) {
        case 401:
            return new UnauthorizedError(message)
        case 403:
            return new ForbiddenError(message)
        case 404:
            return new NotFoundError(message)
        case 500:
        case 502:
        case 503:
        case 504:
            return new InternalError(message)
        default:
            return new InternalError('An unexpected error occurred')
    }
}
