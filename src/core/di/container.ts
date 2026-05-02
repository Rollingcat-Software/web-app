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
import type { ISettingsRepository } from '@domain/interfaces/ISettingsRepository'
import type { ISettingsService } from '@domain/interfaces/ISettingsService'
import type { IRoleRepository } from '@domain/interfaces/IRoleRepository'
import type { IRoleService } from '@domain/interfaces/IRoleService'
import { LoggerService } from '@core/services/LoggerService'
import { NotifierService } from '@core/services/NotifierService'
import { SecureStorageService } from '@core/services/SecureStorageService'
import { AxiosClient } from '@core/api/AxiosClient'
import { TokenService } from '@core/services/TokenService'
import { ErrorHandler } from '@core/errors/ErrorHandler'
import { AuthRepository } from '@core/repositories/AuthRepository'
import { UserRepository } from '@core/repositories/UserRepository'
import { TenantRepository } from '@core/repositories/TenantRepository'
import { DashboardRepository } from '@core/repositories/DashboardRepository'
import { AuditLogRepository } from '@core/repositories/AuditLogRepository'
import { EnrollmentRepository } from '@core/repositories/EnrollmentRepository'
import { SettingsRepository } from '@core/repositories/SettingsRepository'
import { RoleRepository } from '@core/repositories/RoleRepository'
import { AuthMethodRepository } from '@core/repositories/AuthMethodRepository'
import { AuthFlowRepository } from '@core/repositories/AuthFlowRepository'
import { AuthSessionRepository } from '@core/repositories/AuthSessionRepository'
import { DeviceRepository } from '@core/repositories/DeviceRepository'
import { UserEnrollmentRepository } from '@core/repositories/UserEnrollmentRepository'
import { VerificationRepository } from '@core/repositories/VerificationRepository'
import { AuthService } from '@features/auth/services/AuthService'
import { UserService } from '@features/users/services/UserService'
import { TenantService } from '@features/tenants/services/TenantService'
import { DashboardService } from '@features/dashboard/services/DashboardService'
import { AuditLogService } from '@features/auditLogs/services/AuditLogService'
import { EnrollmentService } from '@features/enrollments/services/EnrollmentService'
import { SettingsService } from '@features/settings/services/SettingsService'
import { RoleService } from '@features/roles/services/RoleService'
import { AuthFlowService } from '@features/authFlows/services/AuthFlowService'
import { AuthSessionService } from '@features/auth/services/AuthSessionService'
import { DeviceService } from '@features/devices/services/DeviceService'
import type { IUserEnrollmentRepository } from '@domain/interfaces/IUserEnrollmentRepository'
import type { IUserEnrollmentService } from '@domain/interfaces/IUserEnrollmentService'
import { UserEnrollmentService } from '@features/userEnrollment/services/UserEnrollmentService'
import type { IPasswordService } from '@domain/interfaces/IPasswordService'
import { PasswordService } from '@features/auth/services/PasswordService'
import { config as envConfig } from '@config/env'

/**
 * Create and configure the IoC container
 */
const container = new Container()

/**
 * Load configuration from environment variables.
 * `apiBaseUrl` is sourced from the centralized `@config/env` module — see
 * QUALITY_REVIEW_2026-05-01.md §P0-Q1 for why every other call-site that used
 * to read `import.meta.env.VITE_API_BASE_URL` directly now goes through here.
 */
const config: IConfig = {
    apiBaseUrl: envConfig.apiBaseUrl,
    apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT as string) || 30000,
    useMockAPI: false, // Mock API permanently disabled
    environment: (['development', 'staging', 'production', 'test'].includes(import.meta.env.VITE_ENVIRONMENT)
        ? import.meta.env.VITE_ENVIRONMENT
        : 'development') as IConfig['environment'],
    logLevel: (['debug', 'info', 'warn', 'error'].includes(import.meta.env.VITE_LOG_LEVEL)
        ? import.meta.env.VITE_LOG_LEVEL
        : 'info') as IConfig['logLevel'],
    features: {
        enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
        enableNotifications: import.meta.env.VITE_ENABLE_NOTIFICATIONS !== 'false',
        enableWebSocket: import.meta.env.VITE_ENABLE_WEBSOCKET === 'true',
    },
}

// Bind configuration
container.bind<IConfig>(TYPES.Config).toConstantValue(config)

// Bind infrastructure services
container.bind<ILogger>(TYPES.Logger).to(LoggerService).inSingletonScope()
container.bind<INotifier>(TYPES.Notifier).to(NotifierService).inSingletonScope()
container.bind<ISecureStorage>(TYPES.SecureStorage).to(SecureStorageService).inSingletonScope()
container.bind<IHttpClient>(TYPES.HttpClient).to(AxiosClient).inSingletonScope()
container.bind<ITokenService>(TYPES.TokenService).to(TokenService).inSingletonScope()
container.bind<ErrorHandler>(TYPES.ErrorHandler).to(ErrorHandler).inSingletonScope()

// Bind repositories - Always use real API repositories
container.bind<IAuthRepository>(TYPES.AuthRepository).to(AuthRepository).inSingletonScope()
container.bind<IUserRepository>(TYPES.UserRepository).to(UserRepository).inSingletonScope()
container.bind<ITenantRepository>(TYPES.TenantRepository).to(TenantRepository).inSingletonScope()
container.bind<IDashboardRepository>(TYPES.DashboardRepository).to(DashboardRepository).inSingletonScope()
container.bind<IAuditLogRepository>(TYPES.AuditLogRepository).to(AuditLogRepository).inSingletonScope()
container.bind<IEnrollmentRepository>(TYPES.EnrollmentRepository).to(EnrollmentRepository).inSingletonScope()
container.bind<ISettingsRepository>(TYPES.SettingsRepository).to(SettingsRepository).inSingletonScope()
container.bind<IRoleRepository>(TYPES.RoleRepository).to(RoleRepository).inSingletonScope()
container.bind<AuthMethodRepository>(TYPES.AuthMethodRepository).to(AuthMethodRepository).inSingletonScope()
container.bind<AuthFlowRepository>(TYPES.AuthFlowRepository).to(AuthFlowRepository).inSingletonScope()
container.bind<AuthSessionRepository>(TYPES.AuthSessionRepository).to(AuthSessionRepository).inSingletonScope()
container.bind<DeviceRepository>(TYPES.DeviceRepository).to(DeviceRepository).inSingletonScope()
container.bind<IUserEnrollmentRepository>(TYPES.UserEnrollmentRepository).to(UserEnrollmentRepository).inSingletonScope()
container.bind<VerificationRepository>(TYPES.VerificationRepository).to(VerificationRepository).inSingletonScope()

// Bind services
container.bind<IAuthService>(TYPES.AuthService).to(AuthService).inSingletonScope()
container.bind<IUserService>(TYPES.UserService).to(UserService).inSingletonScope()
container.bind<ITenantService>(TYPES.TenantService).to(TenantService).inSingletonScope()
container.bind<IDashboardService>(TYPES.DashboardService).to(DashboardService).inSingletonScope()
container.bind<IAuditLogService>(TYPES.AuditLogService).to(AuditLogService).inSingletonScope()
container.bind<IEnrollmentService>(TYPES.EnrollmentService).to(EnrollmentService).inSingletonScope()
container.bind<ISettingsService>(TYPES.SettingsService).to(SettingsService).inSingletonScope()
container.bind<IRoleService>(TYPES.RoleService).to(RoleService).inSingletonScope()
container.bind<AuthFlowService>(TYPES.AuthFlowService).to(AuthFlowService).inSingletonScope()
container.bind<AuthSessionService>(TYPES.AuthSessionService).to(AuthSessionService).inSingletonScope()
container.bind<DeviceService>(TYPES.DeviceService).to(DeviceService).inSingletonScope()
container.bind<IUserEnrollmentService>(TYPES.UserEnrollmentService).to(UserEnrollmentService).inSingletonScope()
container.bind<IPasswordService>(TYPES.PasswordService).to(PasswordService).inSingletonScope()

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
