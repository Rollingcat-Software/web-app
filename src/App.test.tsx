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
import App from './App'

// Mock react-i18next so PageTitle does not throw
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            language: 'en',
            on: vi.fn(),
            off: vi.fn(),
        },
    }),
}))

// Variable to control the mock per test
let mockAuthReturn = {
    user: null as any,
    loading: false,
    isAuthenticated: false,
    error: null as Error | null,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
}

// Mock useAuth hook
vi.mock('./features/auth/hooks/useAuth', () => ({
    useAuth: () => mockAuthReturn,
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('App', () => {
    let container: Container

    beforeEach(() => {
        container = createTestContainer()
        vi.clearAllMocks()
        // Reset to default unauthenticated state
        mockAuthReturn = {
            user: null,
            loading: false,
            isAuthenticated: false,
            error: null,
            login: vi.fn(),
            logout: vi.fn(),
            refreshUser: vi.fn(),
        }
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
            renderApp('/')

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
            }, { timeout: 3000 })
        })

        it('should render login page at /login route', async () => {
            renderApp('/login')

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
            }, { timeout: 3000 })
        })

        it('should show loading state while checking authentication', () => {
            mockAuthReturn = {
                ...mockAuthReturn,
                loading: true,
            }

            renderApp('/')

            expect(screen.getByRole('progressbar')).toBeInTheDocument()
        })

        it('should render dashboard when authenticated', async () => {
            mockAuthReturn = {
                ...mockAuthReturn,
                user: { id: '1', firstName: 'Admin', isAdmin: () => true },
                isAuthenticated: true,
            }

            renderApp('/')

            await waitFor(() => {
                // Multiple elements may match "dashboard" (sidebar title + menu item)
                const matches = screen.getAllByText(/dashboard/i)
                expect(matches.length).toBeGreaterThan(0)
            }, { timeout: 3000 })
        })

        it('should redirect unknown routes to dashboard when authenticated', async () => {
            mockAuthReturn = {
                ...mockAuthReturn,
                user: { id: '1', firstName: 'Admin', isAdmin: () => true },
                isAuthenticated: true,
            }

            renderApp('/unknown-route')

            await waitFor(() => {
                const matches = screen.getAllByText(/dashboard/i)
                expect(matches.length).toBeGreaterThan(0)
            }, { timeout: 3000 })
        })

        it('should redirect unknown routes to login when not authenticated', async () => {
            renderApp('/unknown-route')

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
            }, { timeout: 3000 })
        })
    })

    describe('protected routes', () => {
        it('should allow access to users page when authenticated', async () => {
            mockAuthReturn = {
                ...mockAuthReturn,
                user: { id: '1', firstName: 'Admin', isAdmin: () => true },
                isAuthenticated: true,
            }

            renderApp('/users')

            await waitFor(() => {
                const matches = screen.getAllByText(/users/i)
                expect(matches.length).toBeGreaterThan(0)
            }, { timeout: 3000 })
        })

        it('should redirect to login when accessing protected route without auth', async () => {
            renderApp('/users')

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
            }, { timeout: 3000 })
        })
    })
})
