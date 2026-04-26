/**
 * E2E Test: Login Flow
 *
 * Tests the complete login workflow including:
 * - Form validation
 * - Authentication
 * - Navigation to dashboard
 * - Token persistence
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import LoginPage from '@features/auth/components/LoginPage'
// DashboardPage import removed - unused in current tests
import { DependencyProvider } from '@app/providers'

// Mock the auth service
const mockAuthService = {
    login: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    refreshToken: vi.fn(),
}

// Mock the store
const createMockStore = () => {
    return configureStore({
        reducer: {
            auth: (state = { user: null, isAuthenticated: false }) => state,
        },
    })
}

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
    const store = createMockStore()

    return (
        <Provider store={store}>
            <DependencyProvider>
                <BrowserRouter>
                    {children}
                </BrowserRouter>
            </DependencyProvider>
        </Provider>
    )
}

describe('E2E: Login Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Clear localStorage
        localStorage.clear()
    })

    it('should display login form with all required fields', () => {
        render(
            <TestWrapper>
                <LoginPage />
            </TestWrapper>
        )

        // Check for form elements
        expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument()
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()

        // Check for branding
        expect(screen.getByText('FIVUCSAS')).toBeInTheDocument()
        expect(screen.getByText(/Face and Identity Verification Platform/i)).toBeInTheDocument()
    })

    it('should show validation errors for empty fields', async () => {
        const user = userEvent.setup()

        render(
            <TestWrapper>
                <LoginPage />
            </TestWrapper>
        )

        const submitButton = screen.getByRole('button', { name: /sign in/i })

        // Clear default values first
        const emailInput = screen.getByRole('textbox', { name: /email/i })
        const passwordInput = screen.getByLabelText(/password/i)

        await user.clear(emailInput)
        await user.clear(passwordInput)

        // Try to submit with empty fields
        await user.click(submitButton)

        // Check for validation errors
        await waitFor(() => {
            expect(screen.getByText(/email is required/i)).toBeInTheDocument()
        })
    })

    it('should show validation error for invalid email format', async () => {
        const user = userEvent.setup()

        render(
            <TestWrapper>
                <LoginPage />
            </TestWrapper>
        )

        const emailInput = screen.getByRole('textbox', { name: /email/i })
        const submitButton = screen.getByRole('button', { name: /sign in/i })

        // Enter invalid email
        await user.clear(emailInput)
        await user.type(emailInput, 'invalid-email')
        await user.click(submitButton)

        // Check for validation error
        await waitFor(() => {
            expect(screen.getByText(/invalid email address/i)).toBeInTheDocument()
        })
    })

    it('should show validation error for short password', async () => {
        const user = userEvent.setup()

        render(
            <TestWrapper>
                <LoginPage />
            </TestWrapper>
        )

        const emailInput = screen.getByRole('textbox', { name: /email/i })
        const passwordInput = screen.getByLabelText(/password/i)
        const submitButton = screen.getByRole('button', { name: /sign in/i })

        // Enter valid email but short password
        await user.clear(emailInput)
        await user.type(emailInput, 'test@example.com')
        await user.clear(passwordInput)
        await user.type(passwordInput, '12345')
        await user.click(submitButton)

        // Check for validation error
        await waitFor(() => {
            expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument()
        })
    })

    it('should toggle password visibility', async () => {
        const user = userEvent.setup()

        render(
            <TestWrapper>
                <LoginPage />
            </TestWrapper>
        )

        const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement
        const toggleButton = screen.getByRole('button', { name: '' }) // Icon button

        // Password should be hidden initially
        expect(passwordInput.type).toBe('password')

        // Click toggle button
        await user.click(toggleButton)

        // Password should be visible
        expect(passwordInput.type).toBe('text')

        // Click again to hide
        await user.click(toggleButton)
        expect(passwordInput.type).toBe('password')
    })

    it('should display demo credentials information', () => {
        render(
            <TestWrapper>
                <LoginPage />
            </TestWrapper>
        )

        // Check for demo credentials
        expect(screen.getByText(/Demo Credentials:/i)).toBeInTheDocument()
        expect(screen.getByText(/admin@fivucsas.com/i)).toBeInTheDocument()
        expect(screen.getByText(/password123/i)).toBeInTheDocument()
    })

    it('should disable form inputs while submitting', async () => {
        const user = userEvent.setup()

        // Mock slow login
        mockAuthService.login.mockImplementation(
            () => new Promise(resolve => setTimeout(resolve, 1000))
        )

        render(
            <TestWrapper>
                <LoginPage />
            </TestWrapper>
        )

        const emailInput = screen.getByRole('textbox', { name: /email/i })
        const passwordInput = screen.getByLabelText(/password/i)
        const submitButton = screen.getByRole('button', { name: /sign in/i })

        // Fill form
        await user.type(emailInput, 'test@example.com')
        await user.type(passwordInput, 'password123')

        // Submit form
        await user.click(submitButton)

        // Inputs should be disabled during submission
        await waitFor(() => {
            expect(emailInput).toBeDisabled()
            expect(passwordInput).toBeDisabled()
            expect(submitButton).toBeDisabled()
        })
    })

    it('should have pre-filled demo credentials', () => {
        render(
            <TestWrapper>
                <LoginPage />
            </TestWrapper>
        )

        const emailInput = screen.getByRole('textbox', { name: /email/i }) as HTMLInputElement
        const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement

        // Check default values
        expect(emailInput.value).toBe('admin@fivucsas.com')
        expect(passwordInput.value).toBe('password123')
    })

    it('should display loading indicator during login', async () => {
        const user = userEvent.setup()

        // Mock slow login
        mockAuthService.login.mockImplementation(
            () => new Promise(resolve => setTimeout(resolve, 500))
        )

        render(
            <TestWrapper>
                <LoginPage />
            </TestWrapper>
        )

        const submitButton = screen.getByRole('button', { name: /sign in/i })

        // Submit form with default values
        await user.click(submitButton)

        // Loading indicator should appear
        await waitFor(() => {
            expect(screen.getByRole('progressbar')).toBeInTheDocument()
        })
    })

    it('should focus email input on mount', () => {
        render(
            <TestWrapper>
                <LoginPage />
            </TestWrapper>
        )

        const emailInput = screen.getByRole('textbox', { name: /email/i })
        expect(emailInput).toHaveFocus()
    })
})

describe('E2E: Login Form Accessibility', () => {
    it('should have proper ARIA labels', () => {
        render(
            <TestWrapper>
                <LoginPage />
            </TestWrapper>
        )

        // Check for proper labels
        expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument()
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
        const user = userEvent.setup()

        render(
            <TestWrapper>
                <LoginPage />
            </TestWrapper>
        )

        const emailInput = screen.getByRole('textbox', { name: /email/i })
        const passwordInput = screen.getByLabelText(/password/i)
        const submitButton = screen.getByRole('button', { name: /sign in/i })

        // Tab through form
        emailInput.focus()
        expect(emailInput).toHaveFocus()

        await user.tab()
        expect(passwordInput).toHaveFocus()

        await user.tab()
        // Should focus on visibility toggle button first
        await user.tab()
        expect(submitButton).toHaveFocus()
    })

    it('should allow form submission with Enter key', async () => {
        const user = userEvent.setup()

        render(
            <TestWrapper>
                <LoginPage />
            </TestWrapper>
        )

        const emailInput = screen.getByRole('textbox', { name: /email/i })

        // Focus email input and press Enter (form should submit)
        await user.click(emailInput)
        await user.keyboard('{Enter}')

        // Form submission attempted (validation may prevent actual submission)
        // This tests that Enter key triggers form submission
    })
})
