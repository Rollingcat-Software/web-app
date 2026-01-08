/**
 * App component tests
 * Tests routing and authentication flow
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Container } from 'inversify'
import { DependencyProvider } from '@app/providers'
import { createTestContainer } from '@test/testUtils'
import { TYPES } from '@core/di/types'
import App from './App'
import type { IAuthService } from '@domain/interfaces/IAuthService'
import { User, UserRole, UserStatus } from '@domain/models/User'

describe('App', () => {
    let container: Container
    let mockAuthService: IAuthService

    const testUser = new User(
        1,
        'admin@fivucsas.com',
        'Admin',
        'User',
        UserRole.ADMIN,
        UserStatus.ACTIVE,
        1,
        new Date(),
        new Date()
    )

    beforeEach(() => {
        container = createTestContainer()
        mockAuthService = container.get<IAuthService>(TYPES.AuthService)
        vi.clearAllMocks()
    })

    const renderApp = (initialRoute = '/') => {
        return render(
            <MemoryRouter initialEntries={[initialRoute]}>
                <DependencyProvider container={container}>
                    <App />
                </DependencyProvider>
            </MemoryRouter>
        )
    }

    describe('routing', () => {
        it('should redirect to login when not authenticated', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(null)

            renderApp('/')

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
            })
        })

        it('should render login page at /login route', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(null)

            renderApp('/login')

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
            })
        })

        it('should show loading state while checking authentication', () => {
            mockAuthService.getCurrentUser = vi.fn().mockImplementation(
                () => new Promise(() => {}) // Never resolves
            )

            renderApp('/')

            expect(screen.getByRole('progressbar')).toBeInTheDocument()
        })

        it('should render dashboard when authenticated', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(testUser)

            renderApp('/')

            await waitFor(() => {
                expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
            })
        })

        it('should redirect unknown routes to dashboard when authenticated', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(testUser)

            renderApp('/unknown-route')

            await waitFor(() => {
                expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
            })
        })

        it('should redirect unknown routes to login when not authenticated', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(null)

            renderApp('/unknown-route')

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
            })
        })
    })

    describe('protected routes', () => {
        it('should allow access to users page when authenticated', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(testUser)

            renderApp('/users')

            await waitFor(() => {
                expect(screen.getByText(/users/i)).toBeInTheDocument()
            })
        })

        it('should redirect to login when accessing protected route without auth', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(null)

            renderApp('/users')

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
            })
        })
    })
})
