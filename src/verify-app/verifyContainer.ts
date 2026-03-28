/**
 * Minimal DI container for the verify-app.
 *
 * Only binds the services required by MultiStepAuthFlow:
 *   - Logger, HttpClient, AuthSessionRepository
 *
 * This keeps the verify-app bundle small by avoiding the full
 * admin dashboard DI graph.
 */

import { Container } from 'inversify'
import 'reflect-metadata'
import { TYPES } from '@core/di/types'
import type { IConfig } from '@domain/interfaces/IConfig'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import type { ISecureStorage } from '@domain/interfaces/IStorage'
import { LoggerService } from '@core/services/LoggerService'
import { AxiosClient } from '@core/api/AxiosClient'
import { TokenService } from '@core/services/TokenService'
import { SecureStorageService } from '@core/services/SecureStorageService'
import { AuthSessionRepository } from '@core/repositories/AuthSessionRepository'

/**
 * Create a minimal container for the verify widget.
 * @param apiBaseUrl - The API base URL, overridable via URL param or parent config
 */
export function createVerifyContainer(apiBaseUrl: string): Container {
    const container = new Container()

    const config: IConfig = {
        apiBaseUrl,
        apiTimeout: 30000,
        useMockAPI: false,
        environment: 'production',
        logLevel: 'warn',
        features: {
            enableAnalytics: false,
            enableNotifications: false,
            enableWebSocket: false,
        },
    }

    container.bind<IConfig>(TYPES.Config).toConstantValue(config)
    container.bind<ILogger>(TYPES.Logger).to(LoggerService).inSingletonScope()
    container.bind<ISecureStorage>(TYPES.SecureStorage).to(SecureStorageService).inSingletonScope()
    container.bind<IHttpClient>(TYPES.HttpClient).to(AxiosClient).inSingletonScope()
    container.bind<ITokenService>(TYPES.TokenService).to(TokenService).inSingletonScope()
    container.bind<AuthSessionRepository>(TYPES.AuthSessionRepository).to(AuthSessionRepository).inSingletonScope()

    return container
}
