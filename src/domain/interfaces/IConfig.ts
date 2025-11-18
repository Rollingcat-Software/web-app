/**
 * Application configuration interface
 * Defines all configuration properties needed by the application
 */
export interface IConfig {
    // API Configuration
    apiBaseUrl: string
    apiTimeout: number
    useMockAPI: boolean

    // Environment
    environment: 'development' | 'staging' | 'production' | 'test'

    // Logging
    logLevel: 'debug' | 'info' | 'warn' | 'error'

    // Feature flags (optional)
    features?: {
        enableAnalytics?: boolean
        enableNotifications?: boolean
        enableWebSocket?: boolean
    }

    // Security (optional)
    encryptionKey?: string
}
