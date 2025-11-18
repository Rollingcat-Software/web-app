# Architecture Guide

This document describes the clean architecture implemented in this application.

## Overview

The application follows a layered clean architecture with dependency injection, providing:

- **Separation of Concerns**: Each layer has a single responsibility
- **Testability**: All dependencies are injectable and mockable
- **Maintainability**: Clear boundaries between layers
- **Scalability**: Easy to add new features following established patterns

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  (React Components, Pages, Hooks)                       │
├─────────────────────────────────────────────────────────┤
│                    Application Layer                     │
│  (Services - Business Logic)                            │
├─────────────────────────────────────────────────────────┤
│                    Domain Layer                          │
│  (Models, Interfaces, Validators)                       │
├─────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                  │
│  (Repositories, HTTP Client, Storage)                   │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── app/                      # Application bootstrap
│   └── providers/            # React context providers
│       └── DependencyProvider.tsx
│
├── core/                     # Core infrastructure
│   ├── api/                  # HTTP client implementation
│   │   └── AxiosClient.ts
│   ├── di/                   # Dependency injection
│   │   ├── container.ts      # IoC container configuration
│   │   └── types.ts          # DI symbols
│   ├── errors/               # Error handling
│   │   ├── AppError.ts       # Base error classes
│   │   └── ErrorHandler.ts   # Centralized error handler
│   ├── repositories/         # Data access implementations
│   │   ├── UserRepository.ts
│   │   ├── AuthRepository.ts
│   │   └── __mocks__/        # Mock implementations
│   └── services/             # Infrastructure services
│       ├── LoggerService.ts
│       ├── NotifierService.ts
│       ├── SecureStorageService.ts
│       └── TokenService.ts
│
├── domain/                   # Domain layer (pure business)
│   ├── interfaces/           # Contracts
│   │   ├── IUserRepository.ts
│   │   ├── IUserService.ts
│   │   └── ...
│   ├── models/               # Domain entities
│   │   ├── User.ts
│   │   ├── Tenant.ts
│   │   └── ...
│   └── validators/           # Validation schemas
│       ├── authValidator.ts
│       └── userValidator.ts
│
├── features/                 # Feature modules
│   ├── auth/
│   │   ├── components/       # Feature UI
│   │   ├── hooks/            # React hooks
│   │   ├── services/         # Business logic
│   │   └── index.ts          # Public exports
│   ├── users/
│   ├── dashboard/
│   ├── tenants/
│   ├── enrollments/
│   └── auditLogs/
│
├── pages/                    # Page components
├── components/               # Shared UI components
└── test/                     # Test utilities
```

## Layer Responsibilities

### Domain Layer (`src/domain/`)

The innermost layer containing pure business logic with no external dependencies.

**Models**: Rich domain entities with behavior
```typescript
export class User {
    constructor(
        public readonly id: number,
        public readonly email: string,
        // ...
    ) {}

    get fullName(): string {
        return `${this.firstName} ${this.lastName}`
    }

    isAdmin(): boolean {
        return this.role === UserRole.ADMIN
    }

    static fromJSON(data: any): User {
        return new User(/* ... */)
    }
}
```

**Interfaces**: Contracts for repositories and services
```typescript
export interface IUserRepository {
    findAll(params?: QueryParams): Promise<PaginatedResult<User>>
    findById(id: number): Promise<User | null>
    create(data: CreateUserData): Promise<User>
    update(id: number, data: UpdateUserData): Promise<User>
    delete(id: number): Promise<void>
}
```

**Validators**: Zod schemas for input validation
```typescript
export const CreateUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(12),
    // ...
})
```

### Infrastructure Layer (`src/core/`)

Implements interfaces defined in the domain layer.

**Repositories**: Data access implementations
```typescript
@injectable()
export class UserRepository implements IUserRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    async findById(id: number): Promise<User | null> {
        const response = await this.httpClient.get(`/users/${id}`)
        return User.fromJSON(response.data)
    }
}
```

**Mock Repositories**: For development and testing
```typescript
@injectable()
export class MockUserRepository implements IUserRepository {
    private users: User[] = [/* mock data */]

    async findById(id: number): Promise<User | null> {
        await this.delay(300) // Simulate network
        return this.users.find(u => u.id === id) || null
    }
}
```

### Application Layer (`src/features/*/services/`)

Contains business logic and orchestrates domain operations.

```typescript
@injectable()
export class UserService implements IUserService {
    constructor(
        @inject(TYPES.UserRepository) private readonly userRepository: IUserRepository,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    async createUser(data: CreateUserData): Promise<User> {
        // Validate
        const validation = validateCreateUser(data)
        if (!validation.success) {
            throw new ValidationError('Invalid data', validation.error)
        }

        // Check business rules
        const existing = await this.userRepository.findByEmail(data.email)
        if (existing) {
            throw new ConflictError('Email already exists')
        }

        // Create
        return this.userRepository.create(data)
    }
}
```

### Presentation Layer (`src/features/*/hooks/`, `src/features/*/components/`)

React components and hooks that use services.

```typescript
export function useUsers(): UseUsersReturn {
    const userService = useService<IUserService>(TYPES.UserService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<UsersState>({
        users: [],
        loading: true,
        error: null,
    })

    const createUser = useCallback(async (data: CreateUserData) => {
        const user = await userService.createUser(data)
        await refetch()
        return user
    }, [userService])

    return { ...state, createUser, updateUser, deleteUser }
}
```

## Dependency Injection

The application uses InversifyJS for dependency injection.

### Container Configuration

```typescript
// src/core/di/container.ts
const container = new Container()

// Bind configuration
container.bind<IConfig>(TYPES.Config).toConstantValue(config)

// Bind services
container.bind<ILogger>(TYPES.Logger).to(LoggerService).inSingletonScope()

// Bind repositories (mock or real based on config)
if (config.useMockAPI) {
    container.bind<IUserRepository>(TYPES.UserRepository).to(MockUserRepository)
} else {
    container.bind<IUserRepository>(TYPES.UserRepository).to(UserRepository)
}
```

### Using Services in Components

```typescript
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'

function MyComponent() {
    const userService = useService<IUserService>(TYPES.UserService)
    // ...
}
```

## Error Handling

Centralized error handling with typed errors.

### Error Types

```typescript
// Base error
export abstract class AppError extends Error {
    abstract readonly statusCode: number
    abstract readonly isOperational: boolean
}

// Specific errors
export class ValidationError extends AppError { statusCode = 400 }
export class UnauthorizedError extends AppError { statusCode = 401 }
export class NotFoundError extends AppError { statusCode = 404 }
export class ConflictError extends AppError { statusCode = 409 }
export class BusinessError extends AppError { statusCode = 422 }
```

### Error Handler

```typescript
@injectable()
export class ErrorHandler {
    constructor(
        private readonly logger: ILogger,
        private readonly notifier: INotifier
    ) {}

    handle(error: unknown): void {
        if (error instanceof ValidationError) {
            this.notifier.error(error.message)
        } else if (error instanceof UnauthorizedError) {
            // Redirect to login
        }
        // ...
    }
}
```

## Testing Strategy

### Unit Tests

Test services in isolation with mocked dependencies:

```typescript
describe('UserService', () => {
    let service: UserService
    let mockRepository: jest.Mocked<IUserRepository>

    beforeEach(() => {
        mockRepository = {
            findById: vi.fn(),
            create: vi.fn(),
            // ...
        }
        service = new UserService(mockRepository, mockLogger)
    })

    it('should create user', async () => {
        mockRepository.create.mockResolvedValue(mockUser)
        const result = await service.createUser(validData)
        expect(result).toEqual(mockUser)
    })
})
```

### Hook Tests

Test hooks with React Testing Library:

```typescript
describe('useUsers', () => {
    it('should fetch users on mount', async () => {
        const { result } = renderHook(() => useUsers(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.users).toHaveLength(5)
    })
})
```

### Integration Tests

Test repositories with the test container:

```typescript
describe('MockUserRepository', () => {
    let repository: IUserRepository

    beforeEach(() => {
        const container = createTestContainer()
        repository = container.get(TYPES.UserRepository)
    })

    it('should find user by id', async () => {
        const user = await repository.findById(1)
        expect(user).toBeDefined()
        expect(user?.email).toBe('admin@example.com')
    })
})
```

## Adding a New Feature

1. **Create domain models and interfaces**
   ```
   src/domain/models/NewFeature.ts
   src/domain/interfaces/INewFeatureRepository.ts
   src/domain/interfaces/INewFeatureService.ts
   ```

2. **Implement repositories**
   ```
   src/core/repositories/NewFeatureRepository.ts
   src/core/repositories/__mocks__/MockNewFeatureRepository.ts
   ```

3. **Create service with business logic**
   ```
   src/features/newFeature/services/NewFeatureService.ts
   ```

4. **Create React hook**
   ```
   src/features/newFeature/hooks/useNewFeature.ts
   ```

5. **Register in DI container**
   ```typescript
   // src/core/di/types.ts
   NewFeatureRepository: Symbol.for('NewFeatureRepository'),
   NewFeatureService: Symbol.for('NewFeatureService'),

   // src/core/di/container.ts
   container.bind<INewFeatureRepository>(TYPES.NewFeatureRepository)
       .to(MockNewFeatureRepository)
   container.bind<INewFeatureService>(TYPES.NewFeatureService)
       .to(NewFeatureService)
   ```

6. **Create components**
   ```
   src/features/newFeature/components/NewFeaturePage.tsx
   ```

7. **Add tests**
   ```
   src/features/newFeature/services/__tests__/NewFeatureService.test.ts
   src/features/newFeature/hooks/__tests__/useNewFeature.test.tsx
   ```

## Best Practices

1. **Keep domain models pure** - No framework dependencies
2. **Use interfaces everywhere** - Depend on abstractions
3. **Validate at service boundaries** - Use Zod schemas
4. **Handle errors explicitly** - Use typed error classes
5. **Test each layer independently** - Mock dependencies
6. **Use meaningful names** - Repository, Service, Handler
7. **Document public APIs** - JSDoc comments on interfaces
