/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string
    readonly VITE_API_TIMEOUT: string
    readonly VITE_ENABLE_MOCK_API: string
    readonly VITE_APP_NAME: string
    readonly VITE_APP_VERSION: string
    readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production' | 'test'
    readonly VITE_ENABLE_ANALYTICS: string
    readonly VITE_ENABLE_ERROR_REPORTING: string
    readonly VITE_ENABLE_DARK_MODE: string
    readonly VITE_TOKEN_STORAGE: 'localStorage' | 'cookie'
    readonly VITE_SESSION_TIMEOUT: string
    readonly VITE_DEV_SERVER_PORT: string
    readonly VITE_ENABLE_NOTIFICATIONS: string
    readonly VITE_ENABLE_WEBSOCKET: string
    readonly VITE_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
