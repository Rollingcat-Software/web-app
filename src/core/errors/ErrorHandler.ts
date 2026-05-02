import { injectable, inject } from 'inversify'
import { AxiosError } from 'axios'
import { TYPES } from '@core/di/types'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { INotifier } from '@domain/interfaces/INotifier'
import i18n from '@/i18n/index'
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
@injectable()
export class ErrorHandler {
    constructor(
        @inject(TYPES.Logger) private readonly logger: ILogger,
        @inject(TYPES.Notifier) private readonly notifier: INotifier
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
            // Operational errors are expected and should be shown to user.
            // The message originates from domain code, which is responsible
            // for localizing it (or passing a localized message in). We
            // don't t() here because that would re-translate already-
            // translated strings.
            this.notifier.error(error.message)
            this.logger.warn(error.message, {
                statusCode: error.statusCode,
                metadata: error.metadata,
            })
        } else {
            // Non-operational errors are unexpected and should be logged
            this.logger.error('Non-operational error occurred', error)
            this.notifier.error(i18n.t('errors.unexpectedRetry'))
        }
    }

    /**
     * Handle Axios/HTTP errors
     */
    private handleApiError(error: AxiosError): void {
        const status = error.response?.status
        const data = error.response?.data as { message?: string } | undefined
        const message = data?.message || error.message

        this.logger.error('API Error', {
            status,
            message,
            url: error.config?.url,
            method: error.config?.method,
        })

        if (!error.response) {
            // Network error - no response received
            this.notifier.error(i18n.t('errors.networkError'))
            return
        }

        switch (status) {
            case 400:
                this.notifier.error(message || i18n.t('errors.badRequest'))
                break
            case 401:
                // 401 is handled by AxiosClient interceptor (token refresh)
                // Only show notification if refresh also failed
                if (error.config?.url?.includes('/auth/refresh')) {
                    this.notifier.error(i18n.t('errors.sessionExpired'))
                }
                break
            case 403:
                this.notifier.error(i18n.t('errors.forbidden'))
                break
            case 404:
                this.notifier.error(i18n.t('errors.notFound'))
                break
            case 409:
                this.notifier.error(message || i18n.t('errors.conflict'))
                break
            case 422:
                this.notifier.error(message || i18n.t('errors.validation'))
                break
            case 429: {
                const responseData = error.response?.data as { retryAfterSeconds?: number } | undefined
                const retrySeconds = responseData?.retryAfterSeconds
                const rateLimitMsg = retrySeconds
                    ? i18n.t('mfa.errors.rateLimited', { seconds: retrySeconds })
                    : i18n.t('mfa.errors.rateLimitedNoTime')
                this.notifier.warning(rateLimitMsg)
                break
            }
            case 500:
            case 502:
            case 503:
            case 504:
                this.notifier.error(i18n.t('errors.serverError'))
                break
            default:
                this.notifier.error(message || i18n.t('errors.unexpectedRetry'))
        }
    }

    /**
     * Handle generic JavaScript errors
     */
    private handleGenericError(error: Error): void {
        this.logger.error('Generic error', error)
        this.notifier.error(i18n.t('errors.unexpected'))
    }

    /**
     * Handle unknown error types
     */
    private handleUnknownError(error: unknown): void {
        this.logger.error('Unknown error', error)
        this.notifier.error(i18n.t('errors.unexpected'))
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
                this.logger.error(options.errorMessage, error)
            } else {
                this.handle(error)
            }
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
    const message = (error.response?.data as { message?: string } | undefined)?.message || error.message

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
