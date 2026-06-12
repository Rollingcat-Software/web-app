# FIVUCSAS — Face and Identity Verification Using Cloud-based SaaS

## Admin Dashboard

![React](https://img.shields.io/badge/React-18-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)
![Vite](https://img.shields.io/badge/Vite-8-purple.svg)
![MUI](https://img.shields.io/badge/MUI-6-0081cb.svg)
![Tests](https://img.shields.io/badge/Vitest-619-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Overview

Admin dashboard + hosted login + auth SDK for the **FIVUCSAS** biometric identity platform.

Built with React 18 + TypeScript 5 + Vite 8 on Clean Architecture (InversifyJS DI, repository pattern, Zod validation, i18next en+tr). Deploys two surfaces:

- **Admin dashboard** at `app.fivucsas.com` — user/tenant/role/flow/device/audit management across 30+ routes
- **Hosted login + embeddable widget** at `verify.fivucsas.com` — hosted-first redirective OIDC login (primary) plus iframe widget for inline step-up MFA (secondary); the SDK is delivered **via a CDN script tag** at `https://verify.fivucsas.com/fivucsas-auth.js` — load it and use the global `FivucsasAuth` (`loginRedirect({...})`, `verify()`) plus the auto-registered `<fivucsas-verify>` Web Component.

  The following npm packages are **packaged but NOT yet published** to the public npm registry (`npm install @fivucsas/...` returns a 404 today) — integration is CDN-only until an operator completes the one-time publish setup:
  - `@fivucsas/auth-js` — vanilla, zero-dependency core SDK (planned)
  - `@fivucsas/auth-elements` — the `<fivucsas-verify>` Web Component (planned)
  - `@fivucsas/auth-react` — thin React wrapper (planned)

  The package sources live under [`packages/`](packages) and are built from the canonical SDK source at `src/verify-app/sdk/`. See [SDK packaging & publishing](docs/SDK_PUBLISHING.md). (A token-gated GitHub Actions workflow will publish them on an `sdk-v*` tag once the operator setup in that doc is complete.)

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
    - Email-domain management (add / remove / set-primary) with an "Enforce domain matching" toggle on the tenant edit page

- **Audit Logging**
    - Activity tracking
    - Action history
    - Filterable logs

- **Biometric Surfaces**
    - Biometric puzzles (23 micro-challenges with face/hand/gesture overlays)
    - Puzzle-as-auth-flow-layer (server-issued single-use anti-replay session, optional face-identity binding; flag-gated `app.auth.puzzle-layer`, default OFF)
    - Client-side face embedding (browser computes the Facenet512 vector via onnxruntime-web and uploads only the 512-d vector; raw image never leaves the device; flag-gated `VITE_CLIENT_SIDE_EMBEDDING`, default OFF — see `docs/plans/CLIENT_SIDE_ML_PLAN.md` v3.0)
    - Auth methods testing page (all 10 methods exercisable in-dashboard)
    - Verification flows builder, dashboard, and session detail
    - Biometric enrollment and tools pages
    - Enrollment Details page (`/enrollments/:id`) with quality/liveness scores ("N/A" for non-biometric methods) and a set-default lockout guardrail

- **Hosted Login & Widget**
    - `widget-auth` hosted login page (OIDC code+PKCE redirect flow)
    - Embeddable iframe widget for inline step-up MFA
    - Developer portal and widget demo pages

- **Guests & Sessions**
    - Guest management (invite / extend / revoke / resend invitation)
    - Public guest invitation acceptance page (`/accept-invite` — set name + password)
    - Auth sessions listing and detail

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
- **619 tests**: Comprehensive test coverage

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
VITE_ENABLE_MOCK_API=false
```

### Mock Mode

The app works fully offline with mock data. Set `VITE_ENABLE_MOCK_API=true` to opt into mock repositories (default is `false`, which requires the backend to be running).

Mock users included:
- `admin@fivucsas.com` - Admin user
- `john.doe@example.com` - Regular user
- And 3 more test users

## Available Scripts

```bash
npm run dev            # Start development server
npm run build          # Build admin dashboard for production
npm run build:verify   # Build hosted-login / widget surface
npm run build:sdk      # Build the CDN script-tag SDK bundle (dist-sdk/)
npm run build:elements # Build the CDN Web Components bundle (dist-elements/)
npm run build:pkgs     # Build BOTH npm packages (ESM + CJS + .d.ts) under packages/*/dist
npm run build:pkg:auth-js        # Build only @fivucsas/auth-js
npm run build:pkg:auth-elements  # Build only @fivucsas/auth-elements
npm run build:adapter  # Build adapter bundle
npm run preview        # Preview production build
npm run test           # Run tests in watch mode
npm run lint           # Run ESLint
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

## Accessibility

The dashboard targets WCAG 2.1 AA. `DashboardLayout` renders a
visually-hidden-until-focused skip-to-main link as the first focusable
element, `NotificationPanel` carries `role="status" aria-live="polite"`
for live audit announcements, and every Zod-validated form field
(`UserFormPage`, `TenantFormPage`, `ForgotPasswordPage`,
`ResetPasswordPage`) explicitly wires its helper/error copy to the input
via `aria-describedby`. See `src/pages/__tests__/*.a11y.test.tsx` for
assertions.

## CI/CD

This project includes GitHub Actions for automated testing and builds. See `.github/workflows/ci.yml`.

The pipeline runs:
- Linting
- Type checking
- Unit tests
- Production build

## License

Part of the FIVUCSAS platform developed at Marmara University.

Copyright 2025–2026 FIVUCSAS Team. Licensed under MIT License.

---

**Built with React, TypeScript & Clean Architecture** | FIVUCSAS Team 2025-2026
