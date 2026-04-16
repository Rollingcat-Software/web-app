# FIVUCSAS Admin Dashboard

![React](https://img.shields.io/badge/React-18-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)
![Vite](https://img.shields.io/badge/Vite-8-purple.svg)
![MUI](https://img.shields.io/badge/MUI-6-0081cb.svg)
![Tests](https://img.shields.io/badge/Vitest-619-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Overview

Admin dashboard + hosted login + auth SDK for the **FIVUCSAS** biometric identity platform.

Built with React 18 + TypeScript 5 + Vite 8 on Clean Architecture (InversifyJS DI, repository pattern, Zod validation, i18next en+tr). Deploys two surfaces:

- **Admin dashboard** at `app.fivucsas.com` — user/tenant/role/flow/device/audit management across 17 pages
- **Hosted login + embeddable widget** at `verify.fivucsas.com` — hosted-first redirective OIDC login (primary) plus iframe widget for inline step-up MFA (secondary); ships `@fivucsas/auth-js` SDK (`loginRedirect({...})`), `@fivucsas/auth-react` components, and `@fivucsas/auth-elements` Web Components

## Architecture

This application follows enterprise-grade **Clean Architecture** principles:

- **Dependency Injection** with InversifyJS
- **Repository Pattern** for data access abstraction
- **Service Layer** for business logic
- **Custom Hooks** for state management (no Redux)
- **Zod** for runtime validation

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed architecture documentation.

## Features

### Core Features

- **Authentication System**
    - Secure login with JWT tokens
    - Auto token refresh on 401
    - Protected routes
    - Encrypted token storage
    - Mock mode for development

- **Professional UI/UX**
    - Material-UI components
    - Responsive design
    - Custom theme
    - Form validation with Zod
    - Loading states and error handling
    - Code splitting for performance

- **Complete Dashboard**
    - Dashboard layout with sidebar and top bar
    - Statistics cards with real-time data
    - System overview metrics
    - Responsive design (mobile + desktop)

- **User Management**
    - Users list with search, filter, and pagination
    - CRUD operations (create, view, edit, delete)
    - Status and role badges
    - Inline validation

- **Multi-tenancy Support**
    - Tenant management
    - Per-tenant configuration
    - Isolated data access

- **Audit Logging**
    - Activity tracking
    - Action history
    - Filterable logs

## Technology Stack

### Core

- **React 18**: Modern UI framework with concurrent features
- **TypeScript 5**: Strict type-safe development
- **Vite**: Fast build tool and dev server
- **React Router v6**: Client-side routing

### Architecture & DI

- **InversifyJS**: Dependency injection container
- **reflect-metadata**: Decorator metadata support
- **Clean Architecture**: Layered architecture pattern

### UI Framework

- **Material-UI (MUI) v5**: Component library
- **Emotion**: CSS-in-JS styling

### Validation & Forms

- **Zod**: TypeScript-first schema validation
- **React Hook Form**: Form management

### Testing

- **Vitest**: Fast unit test runner
- **React Testing Library**: Component and hook testing
- **230+ tests**: Comprehensive test coverage

### Authentication & HTTP

- **JWT**: Token-based authentication
- **Axios**: HTTP client with interceptors

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Clone repository
git clone https://github.com/Rollingcat-Software/web-app.git
cd web-app

# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs at http://localhost:3000

### Environment Configuration

Create a `.env.local` file:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_ENABLE_MOCK_API=true
```

### Mock Mode

The app works fully offline with mock data. Set `VITE_ENABLE_MOCK_API=true` to use mock repositories.

Mock users included:
- `admin@fivucsas.com` - Admin user
- `john.doe@example.com` - Regular user
- And 3 more test users

## Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run test      # Run tests in watch mode
npm run lint      # Run ESLint
```

## Project Structure

```
src/
├── app/                      # Application bootstrap
│   └── providers/            # React context providers
│
├── core/                     # Core infrastructure
│   ├── api/                  # HTTP client
│   ├── di/                   # Dependency injection container
│   ├── errors/               # Error handling
│   ├── repositories/         # Data access implementations
│   └── services/             # Infrastructure services
│
├── domain/                   # Domain layer (pure business)
│   ├── interfaces/           # Contracts (IUserService, etc.)
│   ├── models/               # Domain entities (User, Tenant)
│   └── validators/           # Zod validation schemas
│
├── features/                 # Feature modules
│   ├── auth/                 # Authentication feature
│   ├── users/                # User management
│   ├── dashboard/            # Dashboard feature
│   ├── tenants/              # Tenant management
│   ├── enrollments/          # Enrollment tracking
│   └── auditLogs/            # Audit logging
│
├── pages/                    # Page components
├── components/               # Shared UI components
└── test/                     # Test utilities
```

## Usage Examples

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

## Testing

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

## Auth Method UI Status

All 10 auth methods are implemented and connected (9 working, NFC requires mobile client).

| Auth Method | Step Component | Enrollment UI | Status |
|---|---|---|---|
| PASSWORD | PasswordStep | N/A | Working |
| EMAIL_OTP | EmailOtpStep | N/A | Working |
| SMS_OTP | SmsOtpStep | N/A | Working |
| TOTP | TotpStep | TotpEnrollment | Working |
| QR_CODE | QrCodeStep | N/A | Working |
| FACE | FaceCaptureStep | FaceEnrollmentFlow | Working |
| FINGERPRINT | FingerprintStep | WebAuthn enrollment | Working |
| VOICE | VoiceStep | VoiceEnrollmentFlow | Working |
| NFC_DOCUMENT | NfcStep | N/A (mobile only) | Stub |
| HARDWARE_KEY | HardwareKeyStep | WebAuthn enrollment | Working |

## Documentation

- [Architecture Guide](./docs/ARCHITECTURE.md) - Detailed architecture documentation
- [Developer Guide](./docs/DEVELOPER_GUIDE.md) - Quick reference for development tasks

## Building for Production

```bash
# Build
npm run build

# Preview
npm run preview
```

The build includes code splitting for optimal loading performance.

## CI/CD

This project includes GitHub Actions for automated testing and builds. See `.github/workflows/ci.yml`.

The pipeline runs:
- Linting
- Type checking
- Unit tests
- Production build

## License

Part of the FIVUCSAS platform developed at Marmara University.

Copyright 2025 FIVUCSAS Team. Licensed under MIT License.

---

**Built with React, TypeScript & Clean Architecture** | FIVUCSAS Team 2025-2026
