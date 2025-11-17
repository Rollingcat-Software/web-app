# Implementation Plan - Professional Architecture Refactoring

**Version**: 1.0
**Date**: 2025-11-17
**Estimated Effort**: 40-60 hours
**Team Size**: 1-2 developers
**Timeline**: 2-3 weeks

---

## Table of Contents

1. [Migration Strategy](#migration-strategy)
2. [Phase 1: Foundation](#phase-1-foundation)
3. [Phase 2: Core Infrastructure](#phase-2-core-infrastructure)
4. [Phase 3: Feature Migration](#phase-3-feature-migration)
5. [Phase 4: Testing & Quality](#phase-4-testing--quality)
6. [Phase 5: Cleanup & Documentation](#phase-5-cleanup--documentation)
7. [Risk Mitigation](#risk-mitigation)
8. [Rollback Strategy](#rollback-strategy)

---

## Migration Strategy

### Approach: **Incremental Strangler Fig Pattern**

We will gradually replace the old implementation with the new one, maintaining full functionality throughout.

```
Current Codebase
    ├── Old Services (deprecated)
    └── New Architecture (growing)
         ↓
    Eventually replace old with new
         ↓
New Professional Codebase
```

### Principles

1. **No Big Bang**: Migrate feature by feature
2. **Always Working**: Main branch always deployable
3. **Parallel Systems**: Old and new coexist temporarily
4. **Feature Flags**: Toggle between old/new implementations
5. **Comprehensive Testing**: Test each migration step

---

## Phase 1: Foundation

**Duration**: 3-5 hours
**Priority**: 🔴 CRITICAL
**Goal**: Set up new directory structure and core infrastructure

### Tasks

#### 1.1 Create New Directory Structure (1 hour)

```bash
# Create new architecture directories
mkdir -p src/core/{api,repositories,services,di,errors}
mkdir -p src/core/repositories/__mocks__
mkdir -p src/domain/{models,interfaces,validators}
mkdir -p src/shared/{components,hooks,utils,types}
mkdir -p src/features/{auth,users,dashboard,tenants,enrollments,audit-logs}
mkdir -p src/app/providers
mkdir -p __tests__/{unit,integration,e2e}
```

**Files to create**:
- [ ] `src/core/api/client.ts`
- [ ] `src/core/di/container.ts`
- [ ] `src/core/di/types.ts`
- [ ] `src/core/errors/AppError.ts`
- [ ] `src/domain/interfaces/IRepository.ts`
- [ ] `src/shared/types/common.ts`

**Acceptance Criteria**:
- ✅ All directories created
- ✅ tsconfig.json updated with path mappings
- ✅ No build errors

---

#### 1.2 Install Additional Dependencies (30 min)

```bash
# Dependency Injection
npm install inversify reflect-metadata

# Validation (already have zod)
# Runtime type checking
npm install class-validator class-transformer

# Dev dependencies
npm install -D @types/node
```

**Update tsconfig.json**:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "paths": {
      "@core/*": ["./src/core/*"],
      "@domain/*": ["./src/domain/*"],
      "@features/*": ["./src/features/*"],
      "@shared/*": ["./src/shared/*"],
      "@app/*": ["./src/app/*"]
    }
  }
}
```

**Acceptance Criteria**:
- ✅ Dependencies installed
- ✅ TypeScript paths configured
- ✅ Build succeeds

---

#### 1.3 Set Up Error Handling Infrastructure (1.5 hours)

**Files to create**:

`src/core/errors/AppError.ts`:
```typescript
export abstract class AppError extends Error {
    abstract readonly statusCode: number
    abstract readonly isOperational: boolean

    constructor(message: string, public readonly metadata?: unknown) {
        super(message)
        Object.setPrototypeOf(this, new.target.prototype)
    }
}

export class ValidationError extends AppError {
    readonly statusCode = 400
    readonly isOperational = true
}

export class UnauthorizedError extends AppError {
    readonly statusCode = 401
    readonly isOperational = true
}

export class ForbiddenError extends AppError {
    readonly statusCode = 403
    readonly isOperational = true
}

export class NotFoundError extends AppError {
    readonly statusCode = 404
    readonly isOperational = true
}

export class BusinessError extends AppError {
    readonly statusCode = 422
    readonly isOperational = true
}

export class InternalError extends AppError {
    readonly statusCode = 500
    readonly isOperational = false
}
```

`src/core/errors/errorHandler.ts`:
```typescript
import { AxiosError } from 'axios'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { INotifier } from '@domain/interfaces/INotifier'
import { AppError } from './AppError'

export class ErrorHandler {
    constructor(
        private readonly logger: ILogger,
        private readonly notifier: INotifier
    ) {}

    handle(error: unknown): void {
        if (error instanceof AppError) {
            this.handleAppError(error)
        } else if (error instanceof AxiosError) {
            this.handleApiError(error)
        } else {
            this.handleUnknownError(error)
        }
    }

    private handleAppError(error: AppError): void {
        if (error.isOperational) {
            this.notifier.error(error.message)
            this.logger.warn(error.message, { metadata: error.metadata })
        } else {
            this.logger.error('Non-operational error', error)
            this.notifier.error('An unexpected error occurred. Please try again.')
        }
    }

    private handleApiError(error: AxiosError): void {
        const status = error.response?.status
        const message = (error.response?.data as any)?.message || error.message

        this.logger.error('API Error', { status, message, url: error.config?.url })

        if (status === 401) {
            this.notifier.error('Session expired. Please login again.')
        } else if (status === 403) {
            this.notifier.error('You do not have permission for this action.')
        } else if (status === 404) {
            this.notifier.error('Resource not found.')
        } else if (status && status >= 500) {
            this.notifier.error('Server error. Please try again later.')
        } else {
            this.notifier.error(message)
        }
    }

    private handleUnknownError(error: unknown): void {
        this.logger.error('Unknown error', error)
        this.notifier.error('An unexpected error occurred.')
    }
}
```

**Acceptance Criteria**:
- ✅ Error classes defined
- ✅ ErrorHandler implemented
- ✅ Unit tests pass (≥80% coverage)

---

#### 1.4 Create Core Interfaces (1.5 hours)

`src/domain/interfaces/ILogger.ts`:
```typescript
export interface ILogger {
    debug(message: string, meta?: unknown): void
    info(message: string, meta?: unknown): void
    warn(message: string, meta?: unknown): void
    error(message: string, error?: unknown): void
}
```

`src/domain/interfaces/INotifier.ts`:
```typescript
export interface INotifier {
    success(message: string): void
    error(message: string): void
    warning(message: string): void
    info(message: string): void
}
```

`src/domain/interfaces/IStorage.ts`:
```typescript
export interface IStorage {
    getItem(key: string): Promise<string | null>
    setItem(key: string, value: string): Promise<void>
    removeItem(key: string): Promise<void>
    clear(): Promise<void>
}

export interface ISecureStorage extends IStorage {
    // Additional security methods
}
```

`src/domain/interfaces/IHttpClient.ts`:
```typescript
export interface IHttpClient {
    get<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>
    post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>>
    put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>>
    delete<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>
    patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>>
}

export interface HttpResponse<T> {
    data: T
    status: number
    statusText: string
    headers: Record<string, string>
}

export interface RequestConfig {
    params?: Record<string, unknown>
    headers?: Record<string, string>
    timeout?: number
}
```

`src/domain/interfaces/IRepository.ts`:
```typescript
export interface IRepository<T, ID = number> {
    findAll(params?: QueryParams): Promise<PaginatedResult<T>>
    findById(id: ID): Promise<T | null>
    create(entity: Omit<T, 'id'>): Promise<T>
    update(id: ID, entity: Partial<T>): Promise<T>
    delete(id: ID): Promise<void>
}

export interface QueryParams {
    page?: number
    pageSize?: number
    sort?: string
    order?: 'asc' | 'desc'
    filters?: Record<string, unknown>
}

export interface PaginatedResult<T> {
    items: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}
```

**Acceptance Criteria**:
- ✅ All interfaces defined
- ✅ TypeScript compiles without errors
- ✅ Interfaces documented with JSDoc

---

#### 1.5 Set Up Dependency Injection Container (1.5 hours)

`src/core/di/types.ts`:
```typescript
export const TYPES = {
    // Config
    Config: Symbol.for('Config'),

    // Infrastructure
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
}
```

`src/core/di/container.ts`:
```typescript
import { Container } from 'inversify'
import 'reflect-metadata'
import { TYPES } from './types'
import type { IConfig } from '@domain/interfaces/IConfig'
import type { ILogger } from '@domain/interfaces/ILogger'
// ... other imports

const container = new Container()

// Configuration
const config: IConfig = {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
    apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT as string) || 30000,
    useMockAPI: import.meta.env.VITE_ENABLE_MOCK_API !== 'false',
    environment: import.meta.env.VITE_ENV || 'development',
    logLevel: import.meta.env.VITE_LOG_LEVEL || 'info',
}

container.bind<IConfig>(TYPES.Config).toConstantValue(config)

// Infrastructure services will be bound in Phase 2

export { container }
export type { Container }
```

`src/app/providers/DependencyProvider.tsx`:
```typescript
import React, { createContext, useContext } from 'react'
import type { Container } from 'inversify'
import { container as defaultContainer } from '@core/di/container'

const DependencyContext = createContext<Container>(defaultContainer)

export function DependencyProvider({
    children,
    container = defaultContainer
}: {
    children: React.ReactNode
    container?: Container
}) {
    return (
        <DependencyContext.Provider value={container}>
            {children}
        </DependencyContext.Provider>
    )
}

export function useService<T>(serviceIdentifier: symbol): T {
    const container = useContext(DependencyContext)
    return container.get<T>(serviceIdentifier)
}
```

**Acceptance Criteria**:
- ✅ DI container configured
- ✅ Provider component created
- ✅ useService hook working
- ✅ Can inject config in components

---

## Phase 2: Core Infrastructure

**Duration**: 8-10 hours
**Priority**: 🔴 CRITICAL
**Goal**: Implement core services and repositories

### Tasks

#### 2.1 Implement Logger Service (1 hour)

`src/core/services/LoggerService.ts`:
```typescript
import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IConfig } from '@domain/interfaces/IConfig'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

@injectable()
export class LoggerService implements ILogger {
    private readonly logLevel: LogLevel

    constructor(@inject(TYPES.Config) private readonly config: IConfig) {
        this.logLevel = config.logLevel as LogLevel
    }

    debug(message: string, meta?: unknown): void {
        if (this.shouldLog('debug')) {
            console.debug(`[DEBUG] ${message}`, meta)
        }
    }

    info(message: string, meta?: unknown): void {
        if (this.shouldLog('info')) {
            console.info(`[INFO] ${message}`, meta)
        }
    }

    warn(message: string, meta?: unknown): void {
        if (this.shouldLog('warn')) {
            console.warn(`[WARN] ${message}`, meta)
        }
    }

    error(message: string, error?: unknown): void {
        if (this.shouldLog('error')) {
            console.error(`[ERROR] ${message}`, error)
            // In production, send to error tracking service (Sentry, etc.)
        }
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: Record<LogLevel, number> = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        }
        return levels[level] >= levels[this.logLevel]
    }
}
```

**Bind in container**:
```typescript
container.bind<ILogger>(TYPES.Logger).to(LoggerService).inSingletonScope()
```

**Tests**: `__tests__/unit/core/services/LoggerService.test.ts`

**Acceptance Criteria**:
- ✅ Logger service implemented
- ✅ Log levels respected
- ✅ Unit tests pass (100% coverage)
- ✅ Bound in DI container

---

#### 2.2 Implement Notifier Service (1 hour)

`src/core/services/NotifierService.ts`:
```typescript
import { injectable } from 'inversify'
import { enqueueSnackbar } from 'notistack'
import type { INotifier } from '@domain/interfaces/INotifier'

@injectable()
export class NotifierService implements INotifier {
    success(message: string): void {
        enqueueSnackbar(message, { variant: 'success' })
    }

    error(message: string): void {
        enqueueSnackbar(message, { variant: 'error' })
    }

    warning(message: string): void {
        enqueueSnackbar(message, { variant: 'warning' })
    }

    info(message: string): void {
        enqueueSnackbar(message, { variant: 'info' })
    }
}
```

**Bind in container**:
```typescript
container.bind<INotifier>(TYPES.Notifier).to(NotifierService).inSingletonScope()
```

**Acceptance Criteria**:
- ✅ Notifier service implemented
- ✅ Integrated with notistack
- ✅ Bound in DI container

---

#### 2.3 Implement Secure Storage Service (2 hours)

`src/core/services/SecureStorageService.ts`:
```typescript
import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ISecureStorage } from '@domain/interfaces/IStorage'
import type { IConfig } from '@domain/interfaces/IConfig'
import type { ILogger } from '@domain/interfaces/ILogger'

@injectable()
export class SecureStorageService implements ISecureStorage {
    private readonly storage: Storage

    constructor(
        @inject(TYPES.Config) private readonly config: IConfig,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {
        // Use sessionStorage for security (cleared on tab close)
        // In production, consider using httpOnly cookies set by backend
        this.storage = sessionStorage
    }

    async getItem(key: string): Promise<string | null> {
        try {
            const value = this.storage.getItem(this.prefixKey(key))
            if (!value) return null

            // In production, decrypt here using Web Crypto API
            return value
        } catch (error) {
            this.logger.error('Failed to get item from storage', error)
            return null
        }
    }

    async setItem(key: string, value: string): Promise<void> {
        try {
            // In production, encrypt here using Web Crypto API
            this.storage.setItem(this.prefixKey(key), value)
        } catch (error) {
            this.logger.error('Failed to set item in storage', error)
            throw error
        }
    }

    async removeItem(key: string): Promise<void> {
        try {
            this.storage.removeItem(this.prefixKey(key))
        } catch (error) {
            this.logger.error('Failed to remove item from storage', error)
        }
    }

    async clear(): Promise<void> {
        try {
            // Only clear our prefixed keys
            const keys = Object.keys(this.storage).filter(k =>
                k.startsWith(this.getPrefix())
            )
            keys.forEach(k => this.storage.removeItem(k))
        } catch (error) {
            this.logger.error('Failed to clear storage', error)
        }
    }

    private prefixKey(key: string): string {
        return `${this.getPrefix()}_${key}`
    }

    private getPrefix(): string {
        return this.config.environment === 'production' ? 'fivucsas_prod' : 'fivucsas_dev'
    }
}
```

**Bind in container**:
```typescript
container.bind<ISecureStorage>(TYPES.SecureStorage).to(SecureStorageService).inSingletonScope()
```

**Acceptance Criteria**:
- ✅ Storage service implemented
- ✅ Uses sessionStorage (not localStorage)
- ✅ Keys prefixed for isolation
- ✅ Error handling implemented
- ✅ Unit tests pass

---

#### 2.4 Implement HTTP Client (2 hours)

`src/core/api/AxiosClient.ts`:
```typescript
import { injectable, inject } from 'inversify'
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { TYPES } from '@core/di/types'
import type { IHttpClient, HttpResponse, RequestConfig } from '@domain/interfaces/IHttpClient'
import type { IConfig } from '@domain/interfaces/IConfig'
import type { ILogger } from '@domain/interfaces/ILogger'

@injectable()
export class AxiosClient implements IHttpClient {
    private readonly client: AxiosInstance

    constructor(
        @inject(TYPES.Config) private readonly config: IConfig,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {
        this.client = axios.create({
            baseURL: config.apiBaseUrl,
            timeout: config.apiTimeout,
            headers: {
                'Content-Type': 'application/json',
            },
        })

        this.setupInterceptors()
    }

    async get<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>> {
        const response = await this.client.get<T>(url, this.toAxiosConfig(config))
        return this.mapResponse(response)
    }

    async post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>> {
        const response = await this.client.post<T>(url, data, this.toAxiosConfig(config))
        return this.mapResponse(response)
    }

    async put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>> {
        const response = await this.client.put<T>(url, data, this.toAxiosConfig(config))
        return this.mapResponse(response)
    }

    async delete<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>> {
        const response = await this.client.delete<T>(url, this.toAxiosConfig(config))
        return this.mapResponse(response)
    }

    async patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>> {
        const response = await this.client.patch<T>(url, data, this.toAxiosConfig(config))
        return this.mapResponse(response)
    }

    getAxiosInstance(): AxiosInstance {
        return this.client
    }

    private setupInterceptors(): void {
        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                this.logger.debug(`HTTP ${config.method?.toUpperCase()} ${config.url}`)
                return config
            },
            (error) => {
                this.logger.error('Request error', error)
                return Promise.reject(error)
            }
        )

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                this.logger.debug(`HTTP ${response.status} ${response.config.url}`)
                return response
            },
            (error) => {
                this.logger.error('Response error', {
                    status: error.response?.status,
                    url: error.config?.url,
                    message: error.message
                })
                return Promise.reject(error)
            }
        )
    }

    private toAxiosConfig(config?: RequestConfig): AxiosRequestConfig {
        return {
            params: config?.params,
            headers: config?.headers,
            timeout: config?.timeout,
        }
    }

    private mapResponse<T>(response: AxiosResponse<T>): HttpResponse<T> {
        return {
            data: response.data,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers as Record<string, string>,
        }
    }
}
```

**Bind in container**:
```typescript
container.bind<IHttpClient>(TYPES.HttpClient).to(AxiosClient).inSingletonScope()
```

**Acceptance Criteria**:
- ✅ HTTP client implemented
- ✅ Interceptors configured
- ✅ Logging integrated
- ✅ Error handling implemented
- ✅ Unit tests pass

---

#### 2.5 Implement Token Service (2 hours)

`src/domain/interfaces/ITokenService.ts`:
```typescript
export interface ITokenService {
    storeTokens(tokens: TokenPair): Promise<void>
    getAccessToken(): Promise<string | null>
    getRefreshToken(): Promise<string | null>
    clearTokens(): Promise<void>
    isAuthenticated(): Promise<boolean>
    getExpirationTime(token: string): Date
    isTokenExpired(token: string): boolean
    shouldRefresh(token: string): boolean
}

export interface TokenPair {
    accessToken: string
    refreshToken: string
}
```

`src/core/services/TokenService.ts`:
```typescript
import { injectable, inject } from 'inversify'
import { jwtDecode } from 'jwt-decode'
import { TYPES } from '@core/di/types'
import type { ITokenService, TokenPair } from '@domain/interfaces/ITokenService'
import type { ISecureStorage } from '@domain/interfaces/IStorage'
import type { ILogger } from '@domain/interfaces/ILogger'

interface JwtPayload {
    exp: number
    iat: number
    sub: string
}

@injectable()
export class TokenService implements ITokenService {
    private readonly ACCESS_TOKEN_KEY = 'access_token'
    private readonly REFRESH_TOKEN_KEY = 'refresh_token'
    private readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

    constructor(
        @inject(TYPES.SecureStorage) private readonly storage: ISecureStorage,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    async storeTokens(tokens: TokenPair): Promise<void> {
        try {
            await Promise.all([
                this.storage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken),
                this.storage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken)
            ])
            this.logger.info('Tokens stored successfully')
        } catch (error) {
            this.logger.error('Failed to store tokens', error)
            throw error
        }
    }

    async getAccessToken(): Promise<string | null> {
        return this.storage.getItem(this.ACCESS_TOKEN_KEY)
    }

    async getRefreshToken(): Promise<string | null> {
        return this.storage.getItem(this.REFRESH_TOKEN_KEY)
    }

    async clearTokens(): Promise<void> {
        try {
            await Promise.all([
                this.storage.removeItem(this.ACCESS_TOKEN_KEY),
                this.storage.removeItem(this.REFRESH_TOKEN_KEY)
            ])
            this.logger.info('Tokens cleared')
        } catch (error) {
            this.logger.error('Failed to clear tokens', error)
        }
    }

    async isAuthenticated(): Promise<boolean> {
        const token = await this.getAccessToken()
        if (!token) return false
        return !this.isTokenExpired(token)
    }

    getExpirationTime(token: string): Date {
        try {
            const decoded = jwtDecode<JwtPayload>(token)
            return new Date(decoded.exp * 1000)
        } catch (error) {
            this.logger.error('Failed to decode token', error)
            return new Date(0)
        }
    }

    isTokenExpired(token: string): boolean {
        try {
            const decoded = jwtDecode<JwtPayload>(token)
            return decoded.exp * 1000 < Date.now()
        } catch {
            return true
        }
    }

    shouldRefresh(token: string): boolean {
        try {
            const decoded = jwtDecode<JwtPayload>(token)
            const expirationTime = decoded.exp * 1000
            const now = Date.now()
            return expirationTime - now < this.REFRESH_THRESHOLD_MS
        } catch {
            return false
        }
    }
}
```

**Bind in container**:
```typescript
container.bind<ITokenService>(TYPES.TokenService).to(TokenService).inSingletonScope()
```

**Acceptance Criteria**:
- ✅ Token service implemented
- ✅ JWT decoding works
- ✅ Expiration checking works
- ✅ Refresh threshold logic correct
- ✅ Unit tests pass (100% coverage)

---

## Phase 3: Feature Migration

**Duration**: 20-30 hours
**Priority**: 🔴 CRITICAL
**Goal**: Migrate features to new architecture

### 3.1 Migrate Auth Feature (6-8 hours)

#### 3.1.1 Create Domain Models & Interfaces

`src/domain/models/User.ts`:
```typescript
export class User {
    constructor(
        public readonly id: number,
        public readonly email: string,
        public readonly firstName: string,
        public readonly lastName: string,
        public readonly role: UserRole,
        public readonly status: UserStatus,
        public readonly tenantId: number,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly lastLoginAt?: Date,
        public readonly lastLoginIp?: string
    ) {}

    get fullName(): string {
        return `${this.firstName} ${this.lastName}`
    }

    isActive(): boolean {
        return this.status === UserStatus.ACTIVE
    }

    isAdmin(): boolean {
        return this.role === UserRole.ADMIN || this.role === UserRole.SUPER_ADMIN
    }
}
```

`src/domain/interfaces/IAuthRepository.ts`:
```typescript
export interface IAuthRepository {
    login(credentials: LoginCredentials): Promise<AuthResponse>
    logout(): Promise<void>
    refresh(refreshToken: string): Promise<AuthResponse>
    getCurrentUser(): Promise<User>
}

export interface LoginCredentials {
    email: string
    password: string
    mfaCode?: string
}

export interface AuthResponse {
    accessToken: string
    refreshToken: string
    user: User
    expiresIn: number
}
```

`src/domain/interfaces/IAuthService.ts`:
```typescript
export interface IAuthService {
    login(credentials: LoginCredentials): Promise<AuthResult>
    logout(): Promise<void>
    refreshToken(): Promise<void>
    getCurrentUser(): Promise<User | null>
    isAuthenticated(): Promise<boolean>
}

export interface AuthResult {
    user: User
    expiresAt: Date
}
```

#### 3.1.2 Create Validators

`src/domain/validators/authValidator.ts`:
```typescript
import { z } from 'zod'

export const LoginCredentialsSchema = z.object({
    email: z.string().email('Invalid email format').max(255),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    mfaCode: z.string().length(6).optional()
})

export type LoginCredentialsInput = z.infer<typeof LoginCredentialsSchema>
```

#### 3.1.3 Implement Repository

**Real Implementation**:
`src/core/repositories/AuthRepository.ts`

**Mock Implementation**:
`src/core/repositories/__mocks__/MockAuthRepository.ts`

**Factory**:
```typescript
export class AuthRepositoryFactory {
    static create(config: IConfig, httpClient: IHttpClient, logger: ILogger): IAuthRepository {
        if (config.useMockAPI) {
            return new MockAuthRepository(logger)
        }
        return new AuthRepository(httpClient, logger)
    }
}
```

#### 3.1.4 Implement Service

`src/features/auth/services/AuthService.ts`

#### 3.1.5 Create Custom Hooks

`src/features/auth/hooks/useAuth.ts`:
```typescript
export function useAuth() {
    const authService = useService<IAuthService>(TYPES.AuthService)
    const [state, setState] = useState<AuthState>({
        user: null,
        loading: true,
        error: null
    })

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await authService.getCurrentUser()
                setState({ user, loading: false, error: null })
            } catch (error) {
                setState({ user: null, loading: false, error: error as Error })
            }
        }
        checkAuth()
    }, [authService])

    const login = useCallback(async (credentials: LoginCredentials) => {
        setState(prev => ({ ...prev, loading: true, error: null }))
        try {
            const result = await authService.login(credentials)
            setState({ user: result.user, loading: false, error: null })
        } catch (error) {
            setState(prev => ({ ...prev, loading: false, error: error as Error }))
            throw error
        }
    }, [authService])

    const logout = useCallback(async () => {
        await authService.logout()
        setState({ user: null, loading: false, error: null })
    }, [authService])

    return { ...state, login, logout }
}
```

#### 3.1.6 Migrate Components

- Migrate `LoginPage.tsx`
- Update `ProtectedRoute` component
- Update API interceptors to use new TokenService

#### 3.1.7 Write Tests

- Unit tests for AuthService
- Unit tests for AuthRepository
- Integration tests for auth flow
- Component tests for LoginPage

**Acceptance Criteria**:
- ✅ Auth feature migrated
- ✅ All tests pass (≥80% coverage)
- ✅ Login/logout works
- ✅ Token refresh works
- ✅ Old code can coexist

---

### 3.2 Migrate Users Feature (6-8 hours)

Follow same pattern as Auth:
1. Domain models & interfaces
2. Validators
3. Repository (real & mock)
4. Service
5. Custom hooks
6. Components
7. Tests

**Files to migrate**:
- UsersListPage
- UserDetailsPage
- UserFormPage

**Acceptance Criteria**:
- ✅ Users CRUD fully functional
- ✅ Search and filtering work
- ✅ All tests pass
- ✅ Performance is acceptable

---

### 3.3 Migrate Dashboard Feature (4-6 hours)

Simpler than users - mostly read-only

**Acceptance Criteria**:
- ✅ Dashboard loads correctly
- ✅ Statistics display properly
- ✅ Charts render correctly

---

### 3.4 Migrate Remaining Features (4-8 hours)

- Tenants
- Enrollments
- Audit Logs
- Settings

---

## Phase 4: Testing & Quality

**Duration**: 6-8 hours
**Priority**: 🟠 HIGH

### Tasks

#### 4.1 Write Comprehensive Tests (4 hours)

- [ ] Unit tests for all services (≥90% coverage)
- [ ] Unit tests for all repositories (≥90% coverage)
- [ ] Integration tests for major flows
- [ ] Component tests for all pages

#### 4.2 Set Up Test Infrastructure (2 hours)

```typescript
// __tests__/utils/testContainer.ts
export function createTestContainer(): Container {
    const container = new Container()
    // Bind all mocks
    return container
}
```

#### 4.3 End-to-End Testing (2 hours)

- [ ] Login → Dashboard → Logout
- [ ] User CRUD flow
- [ ] Token refresh flow

**Acceptance Criteria**:
- ✅ Test coverage ≥ 80%
- ✅ All critical paths tested
- ✅ CI/CD pipeline green

---

## Phase 5: Cleanup & Documentation

**Duration**: 3-5 hours
**Priority**: 🟡 MEDIUM

### Tasks

#### 5.1 Remove Old Code (2 hours)

- [ ] Delete old service files
- [ ] Delete old Redux slices (if not needed)
- [ ] Clean up unused imports
- [ ] Remove old types

#### 5.2 Update Documentation (2 hours)

- [ ] Update README.md
- [ ] Add architecture documentation
- [ ] Add developer guide
- [ ] Add API documentation
- [ ] Add testing guide

#### 5.3 Performance Optimization (1 hour)

- [ ] Code splitting
- [ ] Lazy loading
- [ ] Bundle analysis

**Acceptance Criteria**:
- ✅ No dead code
- ✅ Documentation complete
- ✅ Performance metrics acceptable

---

## Risk Mitigation

### High Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking existing functionality | High | Medium | Parallel implementation, feature flags |
| Integration issues | High | Low | Incremental testing |
| Timeline overrun | Medium | Medium | Phased approach, MVP first |
| Team resistance | Low | Low | Clear documentation, training |

### Testing Strategy

1. **Unit Tests**: Test each component in isolation
2. **Integration Tests**: Test feature workflows
3. **E2E Tests**: Test critical user journeys
4. **Manual QA**: Final verification before deployment

---

## Rollback Strategy

### If Issues Arise

1. **Feature Flags**: Toggle back to old implementation
2. **Git Revert**: Revert specific commits
3. **Branch Strategy**: Keep old code in separate branch
4. **Database**: No schema changes needed

### Rollback Triggers

- Critical bug in production
- Performance degradation > 50%
- User-facing errors > 5%
- Team consensus

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Test Coverage | ~0% | ≥80% | Jest/Vitest |
| Build Time | ~30s | <45s | CI/CD |
| Bundle Size | ~500KB | <600KB | webpack-bundle-analyzer |
| Type Errors | ~10 | 0 | tsc --noEmit |
| Code Duplication | High | Low | SonarQube |
| Maintainability Index | C | A | SonarQube |

---

## Timeline Summary

| Phase | Duration | Priority | Dependencies |
|-------|----------|----------|--------------|
| Phase 1: Foundation | 3-5 hours | CRITICAL | None |
| Phase 2: Core Infrastructure | 8-10 hours | CRITICAL | Phase 1 |
| Phase 3: Feature Migration | 20-30 hours | CRITICAL | Phase 2 |
| Phase 4: Testing & Quality | 6-8 hours | HIGH | Phase 3 |
| Phase 5: Cleanup & Documentation | 3-5 hours | MEDIUM | Phase 4 |
| **Total** | **40-58 hours** | | |

---

## Next Steps

1. **Review & Approve** this implementation plan
2. **Create Feature Branch**: `feature/professional-architecture`
3. **Start Phase 1**: Set up foundation
4. **Daily Standups**: Track progress
5. **Weekly Reviews**: Ensure quality

---

**Plan Status**: ✅ READY FOR EXECUTION
**Approval Required**: Yes
**Start Date**: TBD
**Expected Completion**: 2-3 weeks from start
