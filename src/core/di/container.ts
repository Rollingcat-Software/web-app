import { Container } from 'inversify'
import 'reflect-metadata'
import { TYPES } from './types'
import type { IConfig } from '@domain/interfaces/IConfig'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { INotifier } from '@domain/interfaces/INotifier'
import type { ISecureStorage } from '@domain/interfaces/IStorage'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import type { IAuthRepository } from '@domain/interfaces/IAuthRepository'
import type { IAuthService } from '@domain/interfaces/IAuthService'
import type { IUserRepository } from '@domain/interfaces/IUserRepository'
import type { IUserService } from '@domain/interfaces/IUserService'
import type { ITenantRepository } from '@domain/interfaces/ITenantRepository'
import type { ITenantService } from '@domain/interfaces/ITenantService'
import type { IDashboardRepository } from '@domain/interfaces/IDashboardRepository'
import type { IDashboardService } from '@domain/interfaces/IDashboardService'
import type { IAuditLogRepository } from '@domain/interfaces/IAuditLogRepository'
import type { IAuditLogService } from '@domain/interfaces/IAuditLogService'
import type { IEnrollmentRepository } from '@domain/interfaces/IEnrollmentRepository'
import type { IEnrollmentService } from '@domain/interfaces/IEnrollmentService'
import { LoggerService } from '@core/services/LoggerService'
import { NotifierService } from '@core/services/NotifierService'
import { SecureStorageService } from '@core/services/SecureStorageService'
import { AxiosClient } from '@core/api/AxiosClient'
import { TokenService } from '@core/services/TokenService'
import { ErrorHandler } from '@core/errors/ErrorHandler'
import { AuthRepository } from '@core/repositories/AuthRepository'
import { MockAuthRepository } from '@core/repositories/__mocks__/MockAuthRepository'
import { UserRepository } from '@core/repositories/UserRepository'
import { MockUserRepository } from '@core/repositories/__mocks__/MockUserRepository'
import { TenantRepository } from '@core/repositories/TenantRepository'
import { MockTenantRepository } from '@core/repositories/__mocks__/MockTenantRepository'
import { DashboardRepository } from '@core/repositories/DashboardRepository'
import { MockDashboardRepository } from '@core/repositories/__mocks__/MockDashboardRepository'
import { AuditLogRepository } from '@core/repositories/AuditLogRepository'
import { MockAuditLogRepository } from '@core/repositories/__mocks__/MockAuditLogRepository'
import { EnrollmentRepository } from '@core/repositories/EnrollmentRepository'
import { MockEnrollmentRepository } from '@core/repositories/__mocks__/MockEnrollmentRepository'
import { AuthService } from '@features/auth/services/AuthService'
import { UserService } from '@features/users/services/UserService'
import { TenantService } from '@features/tenants/services/TenantService'
import { DashboardService } from '@features/dashboard/services/DashboardService'
import { AuditLogService } from '@features/auditLogs/services/AuditLogService'
import { EnrollmentService } from '@features/enrollments/services/EnrollmentService'

/**
 * Create and configure the IoC container
 */
const container = new Container()

/**
 * Load configuration from environment variables
 */
const config: IConfig = {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
    apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT as string) || 30000,
    useMockAPI: import.meta.env.VITE_ENABLE_MOCK_API !== 'false',
    environment: (import.meta.env.VITE_ENV as any) || 'development',
    logLevel: (import.meta.env.VITE_LOG_LEVEL as any) || 'info',
    features: {
        enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
        enableNotifications: import.meta.env.VITE_ENABLE_NOTIFICATIONS !== 'false',
        enableWebSocket: import.meta.env.VITE_ENABLE_WEBSOCKET === 'true',
    },
}

// Bind configuration
container.bind<IConfig>(TYPES.Config).toConstantValue(config)

// Bind infrastructure services (Phase 2)
container.bind<ILogger>(TYPES.Logger).to(LoggerService).inSingletonScope()
container.bind<INotifier>(TYPES.Notifier).to(NotifierService).inSingletonScope()
container.bind<ISecureStorage>(TYPES.SecureStorage).to(SecureStorageService).inSingletonScope()
container.bind<IHttpClient>(TYPES.HttpClient).to(AxiosClient).inSingletonScope()
container.bind<ITokenService>(TYPES.TokenService).to(TokenService).inSingletonScope()
container.bind<ErrorHandler>(TYPES.ErrorHandler).to(ErrorHandler).inSingletonScope()

// Bind repositories (Phase 3) - Choose between mock and real based on config
if (config.useMockAPI) {
    container.bind<IAuthRepository>(TYPES.AuthRepository).to(MockAuthRepository).inSingletonScope()
    container.bind<IUserRepository>(TYPES.UserRepository).to(MockUserRepository).inSingletonScope()
    container.bind<ITenantRepository>(TYPES.TenantRepository).to(MockTenantRepository).inSingletonScope()
    container
        .bind<IDashboardRepository>(TYPES.DashboardRepository)
        .to(MockDashboardRepository)
        .inSingletonScope()
    container
        .bind<IAuditLogRepository>(TYPES.AuditLogRepository)
        .to(MockAuditLogRepository)
        .inSingletonScope()
    container
        .bind<IEnrollmentRepository>(TYPES.EnrollmentRepository)
        .to(MockEnrollmentRepository)
        .inSingletonScope()
} else {
    container.bind<IAuthRepository>(TYPES.AuthRepository).to(AuthRepository).inSingletonScope()
    container.bind<IUserRepository>(TYPES.UserRepository).to(UserRepository).inSingletonScope()
    container.bind<ITenantRepository>(TYPES.TenantRepository).to(TenantRepository).inSingletonScope()
    container
        .bind<IDashboardRepository>(TYPES.DashboardRepository)
        .to(DashboardRepository)
        .inSingletonScope()
    container
        .bind<IAuditLogRepository>(TYPES.AuditLogRepository)
        .to(AuditLogRepository)
        .inSingletonScope()
    container
        .bind<IEnrollmentRepository>(TYPES.EnrollmentRepository)
        .to(EnrollmentRepository)
        .inSingletonScope()
}

// Bind services (Phase 3)
container.bind<IAuthService>(TYPES.AuthService).to(AuthService).inSingletonScope()
container.bind<IUserService>(TYPES.UserService).to(UserService).inSingletonScope()
container.bind<ITenantService>(TYPES.TenantService).to(TenantService).inSingletonScope()
container.bind<IDashboardService>(TYPES.DashboardService).to(DashboardService).inSingletonScope()
container.bind<IAuditLogService>(TYPES.AuditLogService).to(AuditLogService).inSingletonScope()
container.bind<IEnrollmentService>(TYPES.EnrollmentService).to(EnrollmentService).inSingletonScope()

export { container }
export type { Container }

/**
 * Helper function to get service from container
 * Useful for non-React code
 */
export function getService<T>(serviceIdentifier: symbol): T {
    return container.get<T>(serviceIdentifier)
}

/**
 * Helper function to check if service is bound
 */
export function hasService(serviceIdentifier: symbol): boolean {
    return container.isBound(serviceIdentifier)
}
