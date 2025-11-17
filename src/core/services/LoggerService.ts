import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IConfig } from '@domain/interfaces/IConfig'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Logger Service
 * Provides structured logging with configurable log levels
 * In production, this can be extended to send logs to external services (Sentry, LogRocket, etc.)
 */
@injectable()
export class LoggerService implements ILogger {
    private readonly logLevel: LogLevel
    private readonly isDevelopment: boolean

    constructor(@inject(TYPES.Config) config: IConfig) {
        this.logLevel = config.logLevel as LogLevel
        this.isDevelopment = config.environment === 'development'
    }

    debug(message: string, meta?: unknown): void {
        if (this.shouldLog('debug')) {
            const formattedMessage = this.formatMessage('DEBUG', message, meta)
            console.debug(formattedMessage, meta || '')
        }
    }

    info(message: string, meta?: unknown): void {
        if (this.shouldLog('info')) {
            const formattedMessage = this.formatMessage('INFO', message, meta)
            console.info(formattedMessage, meta || '')
        }
    }

    warn(message: string, meta?: unknown): void {
        if (this.shouldLog('warn')) {
            const formattedMessage = this.formatMessage('WARN', message, meta)
            console.warn(formattedMessage, meta || '')
        }
    }

    error(message: string, error?: unknown): void {
        if (this.shouldLog('error')) {
            const formattedMessage = this.formatMessage('ERROR', message, error)
            console.error(formattedMessage, error || '')

            // In production, send to error tracking service
            if (!this.isDevelopment) {
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
     * Send errors to external tracking service
     * TODO: Integrate with Sentry, LogRocket, or similar service
     */
    private sendToErrorTracking(message: string, error?: unknown): void {
        // Implementation would go here
        // Example: Sentry.captureException(error, { extra: { message } })
        console.log('Would send to error tracking:', message, error)
    }
}
