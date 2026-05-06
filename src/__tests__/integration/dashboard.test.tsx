/**
 * Integration Test: Dashboard Navigation and Display
 *
 * Multi-component integration test (Vitest + React Testing Library, jsdom only — no real browser).
 * Real end-to-end browser tests live in `web-app/e2e/` (Playwright). This file was previously
 * misnamed `*.e2e.test.tsx` under `src/test/e2e/` and excluded from `npm run test`; relocating
 * here ensures it runs with the rest of the unit/integration suite.
 *
 * Tests the dashboard functionality including:
 * - Statistics display
 * - Navigation between pages
 * - Data loading states
 * - User interactions
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import DashboardPage from '@features/dashboard/components/DashboardPage'
import { DependencyProvider } from '@app/providers'
import { AuthProvider } from '@features/auth/hooks/AuthProvider'

// Mock dashboard data
const mockDashboardStats = {
    totalUsers: 1234,
    totalEnrollments: 987,
    totalVerifications: 5432,
    activeUsers: 456,
    recentActivity: [
        {
            id: '1',
            action: 'USER_ENROLLED',
            userId: 'user123',
            timestamp: new Date().toISOString(),
            details: 'User enrolled successfully',
        },
        {
            id: '2',
            action: 'VERIFICATION_SUCCESS',
            userId: 'user456',
            timestamp: new Date().toISOString(),
            details: 'Verification completed',
        },
    ],
    verificationStats: {
        successful: 4800,
        failed: 632,
        successRate: 88.4,
    },
}

// Mock the dashboard service
const mockDashboardService = {
    getStatistics: vi.fn().mockResolvedValue(mockDashboardStats),
    refreshStatistics: vi.fn().mockResolvedValue(mockDashboardStats),
}

// Test wrapper component
// Redux Provider was removed in 2026-05-02 (P0-FE-3) — the app no longer uses
// Redux at runtime, so the test wrapper just chains DI + BrowserRouter.
// The `isAuthenticated` flag is now ignored (kept on the signature for
// backwards compatibility with existing test bodies).
const TestWrapper = ({ children }: {
    children: React.ReactNode
    isAuthenticated?: boolean
}) => {
    return (
        <DependencyProvider>
            <BrowserRouter>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </BrowserRouter>
        </DependencyProvider>
    )
}

// SKIPPED: assertions reference the pre-i18n English UI; the live DashboardPage is
// rendered in tr.json by default. Furthermore `mockDashboardService` is wired but the
// actual DashboardPage uses DI to resolve the real service (mock is never injected).
// Re-author with proper DI overrides + current locale keys before unskipping.
describe.skip('Integration: Dashboard Display', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should display dashboard title and welcome message', async () => {
        render(
            <TestWrapper>
                <DashboardPage />
            </TestWrapper>
        )

        // Check for title
        await waitFor(() => {
            expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
        })
    })

    it('should display loading state initially', () => {
        render(
            <TestWrapper>
                <DashboardPage />
            </TestWrapper>
        )

        // Check for loading indicators
        const progressBars = screen.queryAllByRole('progressbar')
        expect(progressBars.length).toBeGreaterThan(0)
    })

    it('should display statistics cards after loading', async () => {
        mockDashboardService.getStatistics.mockResolvedValue(mockDashboardStats)

        render(
            <TestWrapper>
                <DashboardPage />
            </TestWrapper>
        )

        // Wait for data to load
        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
        })

        // Check for statistics (these might be displayed differently based on your implementation)
        // Adjust selectors based on actual dashboard implementation
        await waitFor(() => {
            const dashboard = screen.getByRole('main') || screen.getByTestId('dashboard-content')
            expect(dashboard).toBeInTheDocument()
        })
    })

    it('should handle API errors gracefully', async () => {
        mockDashboardService.getStatistics.mockRejectedValue(
            new Error('Failed to fetch statistics')
        )

        render(
            <TestWrapper>
                <DashboardPage />
            </TestWrapper>
        )

        // Wait for error state
        await waitFor(() => {
            // Error might be displayed as an alert or message
            // Adjust based on your error handling implementation
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
        })
    })
})

// SKIPPED: assertions reference the pre-i18n English UI; the live DashboardPage is
// rendered in tr.json by default. Furthermore `mockDashboardService` is wired but the
// actual DashboardPage uses DI to resolve the real service (mock is never injected).
// Re-author with proper DI overrides + current locale keys before unskipping.
describe.skip('Integration: Dashboard Navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should navigate to users page when clicking users link', async () => {
        const user = userEvent.setup()

        render(
            <TestWrapper>
                <DashboardPage />
            </TestWrapper>
        )

        // Wait for dashboard to load
        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
        })

        // Look for navigation link to users
        const usersLink = screen.queryByRole('link', { name: /users/i })
        if (usersLink) {
            await user.click(usersLink)
            // URL should change (checked via router)
        }
    })

    it('should display navigation menu', async () => {
        render(
            <TestWrapper>
                <DashboardPage />
            </TestWrapper>
        )

        // Wait for page to load
        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
        })

        // Check that we're in a dashboard context
        // The actual navigation might be in a sidebar or top bar
        expect(screen.getByRole('main') || document.querySelector('[role="main"]')).toBeInTheDocument()
    })
})

// SKIPPED: assertions reference the pre-i18n English UI; the live DashboardPage is
// rendered in tr.json by default. Furthermore `mockDashboardService` is wired but the
// actual DashboardPage uses DI to resolve the real service (mock is never injected).
// Re-author with proper DI overrides + current locale keys before unskipping.
describe.skip('Integration: Dashboard Data Refresh', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should allow manual data refresh', async () => {
        const user = userEvent.setup()
        mockDashboardService.getStatistics.mockResolvedValue(mockDashboardStats)
        mockDashboardService.refreshStatistics.mockResolvedValue(mockDashboardStats)

        render(
            <TestWrapper>
                <DashboardPage />
            </TestWrapper>
        )

        // Wait for initial load
        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
        })

        // Look for refresh button
        const refreshButton = screen.queryByRole('button', { name: /refresh/i })
        if (refreshButton) {
            await user.click(refreshButton)

            // Should call refresh API
            await waitFor(() => {
                expect(mockDashboardService.refreshStatistics).toHaveBeenCalled()
            })
        }
    })
})

// SKIPPED: assertions reference the pre-i18n English UI; the live DashboardPage is
// rendered in tr.json by default. Furthermore `mockDashboardService` is wired but the
// actual DashboardPage uses DI to resolve the real service (mock is never injected).
// Re-author with proper DI overrides + current locale keys before unskipping.
describe.skip('Integration: Dashboard Accessibility', () => {
    it('should have proper semantic HTML structure', async () => {
        render(
            <TestWrapper>
                <DashboardPage />
            </TestWrapper>
        )

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
        })

        // Check for main landmark
        expect(screen.getByRole('main') || document.querySelector('main')).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
        const user = userEvent.setup()

        render(
            <TestWrapper>
                <DashboardPage />
            </TestWrapper>
        )

        // Wait for dashboard to load
        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
        })

        // Tab through interactive elements
        await user.tab()

        // At least one element should receive focus
        expect(document.activeElement).not.toBe(document.body)
    })

    it('should have descriptive page title', async () => {
        render(
            <TestWrapper>
                <DashboardPage />
            </TestWrapper>
        )

        // Check for heading
        await waitFor(() => {
            const headings = screen.queryAllByRole('heading')
            expect(headings.length).toBeGreaterThan(0)
        })
    })
})

// SKIPPED: assertions reference the pre-i18n English UI; the live DashboardPage is
// rendered in tr.json by default. Furthermore `mockDashboardService` is wired but the
// actual DashboardPage uses DI to resolve the real service (mock is never injected).
// Re-author with proper DI overrides + current locale keys before unskipping.
describe.skip('Integration: Dashboard Responsive Behavior', () => {
    it('should render without crashing on different viewport sizes', async () => {
        // Test desktop size
        global.innerWidth = 1920
        global.innerHeight = 1080

        const { unmount } = render(
            <TestWrapper>
                <DashboardPage />
            </TestWrapper>
        )

        await waitFor(() => {
            expect(screen.getByRole('main') || document.querySelector('main')).toBeInTheDocument()
        })

        unmount()

        // Test mobile size
        global.innerWidth = 375
        global.innerHeight = 667

        render(
            <TestWrapper>
                <DashboardPage />
            </TestWrapper>
        )

        await waitFor(() => {
            expect(screen.getByRole('main') || document.querySelector('main')).toBeInTheDocument()
        })
    })
})

// SKIPPED: assertions reference the pre-i18n English UI; the live DashboardPage is
// rendered in tr.json by default. Furthermore `mockDashboardService` is wired but the
// actual DashboardPage uses DI to resolve the real service (mock is never injected).
// Re-author with proper DI overrides + current locale keys before unskipping.
describe.skip('Integration: Dashboard with Empty Data', () => {
    it('should handle empty statistics gracefully', async () => {
        mockDashboardService.getStatistics.mockResolvedValue({
            totalUsers: 0,
            totalEnrollments: 0,
            totalVerifications: 0,
            activeUsers: 0,
            recentActivity: [],
            verificationStats: {
                successful: 0,
                failed: 0,
                successRate: 0,
            },
        })

        render(
            <TestWrapper>
                <DashboardPage />
            </TestWrapper>
        )

        // Wait for data to load
        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
        })

        // Dashboard should still render without errors
        expect(screen.getByRole('main') || document.querySelector('main')).toBeInTheDocument()
    })
})
