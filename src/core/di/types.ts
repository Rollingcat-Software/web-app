/**
 * Dependency Injection types/symbols
 * Define unique symbols for each injectable service
 */

export const TYPES = {
    // Configuration
    Config: Symbol.for('Config'),

    // Infrastructure Services
    Logger: Symbol.for('Logger'),
    HttpClient: Symbol.for('HttpClient'),
    Storage: Symbol.for('Storage'),
    SecureStorage: Symbol.for('SecureStorage'),
    Notifier: Symbol.for('Notifier'),
    ErrorHandler: Symbol.for('ErrorHandler'),

    // Repositories
    UserRepository: Symbol.for('UserRepository'),
    TenantRepository: Symbol.for('TenantRepository'),
    EnrollmentRepository: Symbol.for('EnrollmentRepository'),
    AuditLogRepository: Symbol.for('AuditLogRepository'),
    AuthRepository: Symbol.for('AuthRepository'),
    DashboardRepository: Symbol.for('DashboardRepository'),

    // Services
    AuthService: Symbol.for('AuthService'),
    UserService: Symbol.for('UserService'),
    TenantService: Symbol.for('TenantService'),
    EnrollmentService: Symbol.for('EnrollmentService'),
    AuditLogService: Symbol.for('AuditLogService'),
    DashboardService: Symbol.for('DashboardService'),
    TokenService: Symbol.for('TokenService'),

    // Validators
    UserValidator: Symbol.for('UserValidator'),
    AuthValidator: Symbol.for('AuthValidator'),
    TenantValidator: Symbol.for('TenantValidator'),
}
