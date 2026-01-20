import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IConfig } from '@domain/interfaces/IConfig'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Logger Service (Secure Production Implementation)
 *
 * SECURITY UPGRADES:
 * - Conditionally disables console logs in production
 * - Prevents sensitive information leakage via browser console
 * - Redirects production logs to external monitoring services
 *
 * OWASP Security Best Practices:
 * - No sensitive data logging in production
 * - Console access disabled in production builds
 * - Structured logging for security monitoring
 * - Error tracking integration (Sentry, LogRocket, etc.)
 *
 * Features:
 * - Configurable log levels
 * - Environment-aware logging
 * - External service integration
 * - Structured log formatting
 */
@injectable()
export class LoggerService implements ILogger {
    private readonly logLevel: LogLevel
    private readonly isDevelopment: boolean
    private readonly isProduction: boolean

    constructor(@inject(TYPES.Config) config: IConfig) {
        this.logLevel = config.logLevel as LogLevel
        this.isDevelopment = config.environment === 'development'
        this.isProduction = config.environment === 'production'
    }

    debug(message: string, meta?: unknown): void {
        if (this.shouldLog('debug')) {
            const formattedMessage = this.formatMessage('DEBUG', message, meta)

            // SECURITY: Only log to console in development
            if (this.isDevelopment) {
                console.debug(formattedMessage, meta || '')
            }
            // In production, send to external service only
            else if (this.isProduction) {
                this.sendToLogService('debug', message, meta)
            }
        }
    }

    info(message: string, meta?: unknown): void {
        if (this.shouldLog('info')) {
            const formattedMessage = this.formatMessage('INFO', message, meta)

            // SECURITY: Only log to console in development
            if (this.isDevelopment) {
                console.info(formattedMessage, meta || '')
            }
            // In production, send to external service only
            else if (this.isProduction) {
                this.sendToLogService('info', message, meta)
            }
        }
    }

    warn(message: string, meta?: unknown): void {
        if (this.shouldLog('warn')) {
            const formattedMessage = this.formatMessage('WARN', message, meta)

            // SECURITY: Only log to console in development
            if (this.isDevelopment) {
                console.warn(formattedMessage, meta || '')
            }
            // In production, always send warnings to external service
            else if (this.isProduction) {
                this.sendToLogService('warn', message, meta)
            }
        }
    }

    error(message: string, error?: unknown): void {
        if (this.shouldLog('error')) {
            const formattedMessage = this.formatMessage('ERROR', message, error)

            // SECURITY: Only log to console in development
            if (this.isDevelopment) {
                console.error(formattedMessage, error || '')
            }

            // In production, always send errors to external tracking service
            if (this.isProduction) {
                this.sendToErrorTracking(message, error)
            }
        }
    }

    /**
     * Check if message should be logged based on current log level
     */
    private shouldLog(level: LogLevel): boolean {
        const levels: Record<LogLevel, number> = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
        }
        return levels[level] >= levels[this.logLevel]
    }

    /**
     * Format log message with timestamp and level
     */
    private formatMessage(level: string, message: string, meta?: unknown): string {
        const timestamp = new Date().toISOString()
        const metaInfo = meta ? ` ${JSON.stringify(meta)}` : ''
        return `[${timestamp}] [${level}] ${message}${metaInfo}`
    }

    /**
     * Send logs to external logging service
     * SECURITY: Production logs go to monitoring service, not console
     * TODO: Integrate with CloudWatch, Datadog, or similar service
     */
    private sendToLogService(_level: LogLevel, _message: string, _meta?: unknown): void {
        // Implementation would go here
        // Example: CloudWatch.putLogEvents({ level, message, meta })
        // For now, no console logging in production for security
    }

    /**
     * Send errors to external tracking service
     * SECURITY: Error tracking in production without exposing details in console
     * TODO: Integrate with Sentry, LogRocket, or similar service
     */
    private sendToErrorTracking(_message: string, _error?: unknown): void {
        // Implementation would go here
        // Example: Sentry.captureException(error, { extra: { message } })
        // Note: NO console.log in production for security
    }
}
