# Developer Guide

Quick reference for common development tasks.

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd web-app

# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs at http://localhost:3000

### Environment Variables

Create a `.env.local` file:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_ENABLE_MOCK_API=true
```

## Development

### Mock Mode

The app works fully offline with mock data. Set `VITE_ENABLE_MOCK_API=true` to use mock repositories.

Mock users included:
- `admin@fivucsas.com` - Admin user
- `john.doe@example.com` - Regular user
- And 3 more test users

### Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run test      # Run tests in watch mode
npm run lint      # Run ESLint
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- UserService

# Run with coverage
npm test -- --coverage

# Run once (CI mode)
npm test -- --run
```

## Common Tasks

### Adding a New Page

1. Create component in `src/pages/` or `src/features/*/components/`
2. Add lazy import in `src/App.tsx`:
   ```typescript
   const NewPage = lazy(() => import('./pages/NewPage'))
   ```
3. Add route:
   ```typescript
   <Route path="new-page" element={<NewPage />} />
   ```

### Using a Service in a Component

```typescript
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IUserService } from '@domain/interfaces/IUserService'

function MyComponent() {
    const userService = useService<IUserService>(TYPES.UserService)

    const handleClick = async () => {
        const users = await userService.getUsers()
    }
}
```

### Using a Feature Hook

```typescript
import { useUsers } from '@features/users'

function UsersPage() {
    const { users, loading, error, createUser, deleteUser } = useUsers()

    if (loading) return <Spinner />
    if (error) return <Error message={error.message} />

    return <UserList users={users} onDelete={deleteUser} />
}
```

### Creating a New Service

1. Define interface:
   ```typescript
   // src/domain/interfaces/IMyService.ts
   export interface IMyService {
       doSomething(): Promise<Result>
   }
   ```

2. Implement service:
   ```typescript
   // src/features/myFeature/services/MyService.ts
   @injectable()
   export class MyService implements IMyService {
       constructor(
           @inject(TYPES.Logger) private logger: ILogger
       ) {}

       async doSomething(): Promise<Result> {
           this.logger.info('Doing something')
           // ...
       }
   }
   ```

3. Register in container:
   ```typescript
   // src/core/di/types.ts
   MyService: Symbol.for('MyService'),

   // src/core/di/container.ts
   container.bind<IMyService>(TYPES.MyService).to(MyService)
   ```

### Adding Validation

Use Zod for validation:

```typescript
// src/domain/validators/myValidator.ts
import { z } from 'zod'

export const MyDataSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    age: z.number().int().positive().optional(),
})

export type MyData = z.infer<typeof MyDataSchema>

export function validateMyData(data: unknown) {
    return MyDataSchema.safeParse(data)
}
```

Use in service:
```typescript
async createSomething(data: unknown) {
    const validation = validateMyData(data)
    if (!validation.success) {
        throw new ValidationError('Invalid data',
            validation.error.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message
            }))
        )
    }
    // Continue with valid data
    const validData = validation.data
}
```

### Handling Errors

Throw typed errors in services:

```typescript
import {
    ValidationError,
    NotFoundError,
    ConflictError,
    BusinessError
} from '@core/errors'

// In service
async deleteUser(id: number) {
    const user = await this.userRepository.findById(id)

    if (!user) {
        throw new NotFoundError(`User ${id} not found`)
    }

    if (user.isSuperAdmin()) {
        throw new BusinessError('Cannot delete super admin')
    }

    await this.userRepository.delete(id)
}
```

Errors are automatically handled by `ErrorHandler` in hooks.

### Writing Tests

#### Service Test

```typescript
// src/features/users/services/__tests__/UserService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('UserService', () => {
    let service: UserService
    let mockRepo: jest.Mocked<IUserRepository>

    beforeEach(() => {
        mockRepo = {
            findById: vi.fn(),
            create: vi.fn(),
        }
        service = new UserService(mockRepo, createMockLogger())
    })

    it('should create user with valid data', async () => {
        mockRepo.create.mockResolvedValue(mockUser)

        const result = await service.createUser(validData)

        expect(result).toEqual(mockUser)
        expect(mockRepo.create).toHaveBeenCalledWith(validData)
    })
})
```

#### Hook Test

```typescript
// src/features/users/hooks/__tests__/useUsers.test.tsx
import { renderHook, waitFor } from '@testing-library/react'

describe('useUsers', () => {
    it('should load users on mount', async () => {
        const { result } = renderHook(() => useUsers(), {
            wrapper: ({ children }) => (
                <DependencyProvider container={createTestContainer()}>
                    {children}
                </DependencyProvider>
            ),
        })

        expect(result.current.loading).toBe(true)

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.users).toHaveLength(5)
    })
})
```

## Path Aliases

Available aliases (configured in `tsconfig.json` and `vite.config.ts`):

| Alias | Path |
|-------|------|
| `@/*` | `src/*` |
| `@core/*` | `src/core/*` |
| `@domain/*` | `src/domain/*` |
| `@features/*` | `src/features/*` |
| `@app/*` | `src/app/*` |
| `@components/*` | `src/components/*` |
| `@pages/*` | `src/pages/*` |
| `@test/*` | `src/test/*` |

## Troubleshooting

### "Cannot find module" errors

Restart TypeScript server in VS Code: `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"

### Tests failing with DI errors

Make sure `reflect-metadata` is imported at the top of test files or in `src/test/setup.ts`

### Mock data not updating

Mock repositories use in-memory arrays. Restart the dev server to reset data.

## Code Style

- Use TypeScript strict mode
- Prefer interfaces over types for contracts
- Use `@injectable()` decorator on all DI classes
- Export interfaces with `export type` when possible
- Keep components small and focused
- Use custom hooks for state management
- No `any` types (use `unknown` and type guards)
