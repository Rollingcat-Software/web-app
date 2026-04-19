/**
 * Smoke test — LoginPage (FE-H1)
 * Renders LoginPage under MemoryRouter and asserts the primary heading
 * ("Welcome Back") is in the document. Follows the App.test.tsx pattern
 * (real i18n runtime + mocked useAuth hook).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DependencyProvider } from '@app/providers'
import { createTestContainer } from '@test/testUtils'
import '@/i18n'

vi.mock('@features/auth/hooks/useAuth', () => ({
    useAuth: () => ({
        user: null,
        loading: false,
        isAuthenticated: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Avoid pulling BiometricService (tfjs/ort) during unit test
vi.mock('@core/services/BiometricService', () => ({
    getBiometricService: () => ({
        isAvailable: () => false,
        verify: vi.fn(),
    }),
}))

import LoginPage from '@features/auth/components/LoginPage'

describe('LoginPage — smoke', () => {
    it('renders primary heading', async () => {
        render(
            <MemoryRouter>
                <DependencyProvider container={createTestContainer()}>
                    <LoginPage />
                </DependencyProvider>
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(
                screen.getByRole('heading', { name: /welcome back/i })
            ).toBeInTheDocument()
        }, { timeout: 3000 })
    })
})
