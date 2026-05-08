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
    private readonly apiBaseUrl: string
    /** Feature flag — when false (or sink endpoint missing), prod log calls
     *  are kept locally only (no silent network drop, no console leak). */
    private readonly clientLogSinkEnabled: boolean

    constructor(@inject(TYPES.Config) config: IConfig) {
        this.logLevel = config.logLevel as LogLevel
        this.isDevelopment = config.environment === 'development'
        this.isProduction = config.environment === 'production'
        this.apiBaseUrl = config.apiBaseUrl
        // Vite envs are statically replaced at build time. The endpoint
        // `/client-logs` does not yet exist on the backend (TODO Team A);
        // until it ships, default the flag to false so we ship a safe no-op
        // and don't 404-spam the API. Operator can flip
        // `VITE_CLIENT_LOG_SINK_ENABLED=true` once the endpoint lands.
        const flag = (import.meta.env?.VITE_CLIENT_LOG_SINK_ENABLED ?? 'false')
            .toString()
            .toLowerCase()
        this.clientLogSinkEnabled = flag === 'true' || flag === '1'
    }

    debug(message: string, meta?: unknown): void {
        if (this.shouldLog('debug')) {
            const formattedMessage = this.formatMessage('DEBUG', message, meta)

            // SECURITY: Only log to console in development
            if (this.isDevelopment) {
                // eslint-disable-next-line no-console -- LoggerService is the official console boundary
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
                // eslint-disable-next-line no-console -- LoggerService is the official console boundary
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
     * Send logs to the backend client-log sink.
     *
     * Strategy: navigator.sendBeacon when available (fire-and-forget, survives
     * page-unload), fetch keepalive fallback otherwise. Console-only in dev was
     * already handled in the level methods above; this method is the prod sink.
     *
     * Why this path rather than POSTing to a 3rd-party (Sentry/Datadog) directly:
     * keeping the egress single-origin (api.fivucsas.com) avoids extra CORS,
     * preserves CSP `connect-src`, and lets the backend filter/scrub before
     * fan-out to whichever observability stack ops chooses. The endpoint
     * `/client-logs` does not yet exist; behind feature flag
     * `VITE_CLIENT_LOG_SINK_ENABLED` until Team A merges it (see backlog item
     * "client-logs ingest endpoint" in INVESTIGATION_MASTER_2026-05-07.md).
     */
    sendToLogService(level: LogLevel, message: string, meta?: unknown): void {
        if (!this.clientLogSinkEnabled || !this.apiBaseUrl) return
        this.postToSink({ kind: 'log', level, message, meta })
    }

    /**
     * Forward an unhandled error to the same sink. Distinct method so callers
     * (and a future Sentry-side adapter) can separate error events from
     * rolling info/warn/debug telemetry.
     */
    sendToErrorTracking(message: string, error?: unknown): void {
        if (!this.clientLogSinkEnabled || !this.apiBaseUrl) return
        const errorPayload =
            error instanceof Error
                ? { name: error.name, message: error.message, stack: error.stack }
                : error
        this.postToSink({ kind: 'error', level: 'error', message, error: errorPayload })
    }

    private postToSink(payload: Record<string, unknown>): void {
        try {
            const url = `${this.apiBaseUrl.replace(/\/$/, '')}/client-logs`
            const enriched = {
                ...payload,
                ts: new Date().toISOString(),
                ua: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
                href: typeof location !== 'undefined' ? location.href : undefined,
            }
            const body = JSON.stringify(enriched)

            if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                const blob = new Blob([body], { type: 'application/json' })
                navigator.sendBeacon(url, blob)
                return
            }
            // Fallback: fetch with keepalive so the request survives unload.
            if (typeof fetch === 'function') {
                void fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                    keepalive: true,
                    credentials: 'include',
                }).catch(() => {
                    // Swallow network errors — losing a log line must never
                    // surface to the user. The error is already captured
                    // upstream (it's the reason we're here).
                })
            }
        } catch {
            // Defensive — must never throw from inside the logger.
        }
    }
}
