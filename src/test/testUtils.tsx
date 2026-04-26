/**
 * Test utilities
 * Provides helpers for testing with dependency injection
 */
import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { Container } from 'inversify'
import { vi } from 'vitest'
import { DependencyProvider } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IConfig } from '@domain/interfaces/IConfig'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { INotifier } from '@domain/interfaces/INotifier'
import type { ISecureStorage } from '@domain/interfaces/IStorage'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import type { IAuthRepository } from '@domain/interfaces/IAuthRepository'
import type { IUserRepository } from '@domain/interfaces/IUserRepository'
import type { IDashboardRepository } from '@domain/interfaces/IDashboardRepository'
import type { ITenantRepository } from '@domain/interfaces/ITenantRepository'
import type { IEnrollmentRepository } from '@domain/interfaces/IEnrollmentRepository'
import type { IAuditLogRepository } from '@domain/interfaces/IAuditLogRepository'
import type { IAuthService } from '@domain/interfaces/IAuthService'
import type { IUserService } from '@domain/interfaces/IUserService'
import type { IDashboardService } from '@domain/interfaces/IDashboardService'
import type { ITenantService } from '@domain/interfaces/ITenantService'
import type { IEnrollmentService } from '@domain/interfaces/IEnrollmentService'
import type { IAuditLogService } from '@domain/interfaces/IAuditLogService'
import { ErrorHandler } from '@core/errors/ErrorHandler'
import { LoggerService } from '@core/services/LoggerService'
import { SecureStorageService } from '@core/services/SecureStorageService'
import { TokenService } from '@core/services/TokenService'
import { AxiosClient } from '@core/api/AxiosClient'
import { MockAuthRepository } from '@core/repositories/__mocks__/MockAuthRepository'
import { MockUserRepository } from '@core/repositories/__mocks__/MockUserRepository'
import { MockDashboardRepository } from '@core/repositories/__mocks__/MockDashboardRepository'
import { MockTenantRepository } from '@core/repositories/__mocks__/MockTenantRepository'
import { MockEnrollmentRepository } from '@core/repositories/__mocks__/MockEnrollmentRepository'
import { MockAuditLogRepository } from '@core/repositories/__mocks__/MockAuditLogRepository'
import { AuthService } from '@features/auth/services/AuthService'
import { UserService } from '@features/users/services/UserService'
import { DashboardService } from '@features/dashboard/services/DashboardService'
import { TenantService } from '@features/tenants/services/TenantService'
import { EnrollmentService } from '@features/enrollments/services/EnrollmentService'
import { AuditLogService } from '@features/auditLogs/services/AuditLogService'

/**
 * Create a test container with all dependencies
 */
export function createTestContainer(): Container {
    const container = new Container()

    // Test configuration
    const config: IConfig = {
        apiBaseUrl: 'http://localhost:8080/api/v1',
        apiTimeout: 30000,
        useMockAPI: true,
        environment: 'test',
        logLevel: 'debug',
    }

    // Bind configuration
    container.bind<IConfig>(TYPES.Config).toConstantValue(config)

    // Bind infrastructure services
    container.bind<ILogger>(TYPES.Logger).to(LoggerService).inSingletonScope()
    container.bind<INotifier>(TYPES.Notifier).toConstantValue(createMockNotifier())
    container.bind<ISecureStorage>(TYPES.SecureStorage).to(SecureStorageService).inSingletonScope()
    container.bind<IHttpClient>(TYPES.HttpClient).to(AxiosClient).inSingletonScope()
    container.bind<ITokenService>(TYPES.TokenService).to(TokenService).inSingletonScope()
    container.bind<ErrorHandler>(TYPES.ErrorHandler).to(ErrorHandler).inSingletonScope()

    // Bind mock repositories
    container.bind<IAuthRepository>(TYPES.AuthRepository).to(MockAuthRepository).inSingletonScope()
    container.bind<IUserRepository>(TYPES.UserRepository).to(MockUserRepository).inSingletonScope()
    container
        .bind<IDashboardRepository>(TYPES.DashboardRepository)
        .to(MockDashboardRepository)
        .inSingletonScope()
    container.bind<ITenantRepository>(TYPES.TenantRepository).to(MockTenantRepository).inSingletonScope()
    container
        .bind<IEnrollmentRepository>(TYPES.EnrollmentRepository)
        .to(MockEnrollmentRepository)
        .inSingletonScope()
    container
        .bind<IAuditLogRepository>(TYPES.AuditLogRepository)
        .to(MockAuditLogRepository)
        .inSingletonScope()

    // Bind services
    container.bind<IAuthService>(TYPES.AuthService).to(AuthService).inSingletonScope()
    container.bind<IUserService>(TYPES.UserService).to(UserService).inSingletonScope()
    container.bind<IDashboardService>(TYPES.DashboardService).to(DashboardService).inSingletonScope()
    container.bind<ITenantService>(TYPES.TenantService).to(TenantService).inSingletonScope()
    container
        .bind<IEnrollmentService>(TYPES.EnrollmentService)
        .to(EnrollmentService)
        .inSingletonScope()
    container.bind<IAuditLogService>(TYPES.AuditLogService).to(AuditLogService).inSingletonScope()

    return container
}

/**
 * Custom render function with DI provider
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    diContainer?: Container
}

export function renderWithProviders(
    ui: ReactElement,
    { diContainer = createTestContainer(), ...renderOptions }: CustomRenderOptions = {}
) {
    function Wrapper({ children }: { children: ReactNode }) {
        return <DependencyProvider container={diContainer}>{children}</DependencyProvider>
    }

    return {
        diContainer,
        ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    }
}

/**
 * Create a mock logger for testing
 */
export function createMockLogger(): ILogger {
    return {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }
}

/**
 * Create a mock notifier for testing
 */
export function createMockNotifier(): INotifier {
    return {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    }
}

/**
 * Wait for async operations to complete
 */
export function waitForAsync(ms = 0): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

// Re-export everything from testing library
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
