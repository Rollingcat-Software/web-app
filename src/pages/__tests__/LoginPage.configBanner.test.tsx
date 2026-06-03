/**
 * LoginPage — config-unavailable banner (2026-06-03)
 *
 * When the login-config fetch settles with no usable config (network /
 * unreachable API), the dashboard login must surface a "couldn't load — retry"
 * banner above the legacy email+password fallback, instead of silently rendering
 * the basic form (which read as a stale / old-looking login page). Tapping Retry
 * re-fetches; on success the banner clears.
 *
 * Harness mirrors LoginPage.smoke.test.tsx (real i18n + mocked useAuth /
 * BiometricService), and additionally mocks `fetchLoginConfig` to drive the
 * failure → retry → success path deterministically.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { DependencyProvider } from '@app/providers'
import { createTestContainer } from '@test/testUtils'
import type { LoginConfig } from '@domain/models/LoginConfig'
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

vi.mock('@core/services/BiometricService', () => ({
    getBiometricService: () => ({ isAvailable: () => false, verify: vi.fn() }),
}))

vi.mock('@features/auth/login-config', () => ({
    fetchLoginConfig: vi.fn(),
    LOGIN_CONFIG_ENDPOINT: '/auth/login-config',
}))

import LoginPage from '@features/auth/components/LoginPage'
import { fetchLoginConfig } from '@features/auth/login-config'

const PASSWORD_CONFIG = {
    tenantId: '00000000-0000-0000-0000-000000000000',
    tenantName: 'platform',
    layer1: {
        methods: [{ type: 'PASSWORD', usernameless: false, requiresEnrollment: true }],
        identifierRequired: true,
    },
    totalSteps: 1,
    laterSteps: [],
    engineActive: false,
} as unknown as LoginConfig

const renderLogin = () =>
    render(
        <MemoryRouter>
            <DependencyProvider container={createTestContainer()}>
                <LoginPage />
            </DependencyProvider>
        </MemoryRouter>
    )

describe('LoginPage — config-unavailable banner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows the banner + retry when the login-config fetch returns null (failure)', async () => {
        (fetchLoginConfig as Mock).mockResolvedValue(null)

        renderLogin()

        // Banner is rendered with role="status" and explains the basic fallback.
        const banner = await screen.findByRole('status')
        expect(within(banner).getByText(/sign-in options/i)).toBeInTheDocument()
        expect(within(banner).getByRole('button', { name: /retry/i })).toBeInTheDocument()
        // The legacy fallback (Welcome Back heading + form) still renders underneath.
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    })

    it('re-fetches on Retry and clears the banner when the config loads', async () => {
        (fetchLoginConfig as Mock)
            .mockResolvedValueOnce(null) // initial mount: fails
            .mockResolvedValueOnce(PASSWORD_CONFIG) // retry: succeeds

        renderLogin()

        const banner = await screen.findByRole('status')
        await userEvent.click(within(banner).getByRole('button', { name: /retry/i }))

        await waitFor(() => {
            expect(screen.queryByRole('status')).not.toBeInTheDocument()
        })
        expect(fetchLoginConfig).toHaveBeenCalledTimes(2)
    })
})
