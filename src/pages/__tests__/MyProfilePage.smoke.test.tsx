/**
 * Smoke test — MyProfilePage (FE-H1)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/i18n'

vi.mock('@features/auth/hooks/useAuth', () => ({
    useAuth: () => ({
        user: {
            id: '1',
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@fivucsas.com',
            createdAt: new Date('2024-01-01'),
            lastLoginAt: new Date('2024-02-01'),
            status: 'ACTIVE',
            isAdmin: () => true,
            isActive: () => true,
        },
        loading: false,
        isAuthenticated: true,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@features/enrollments/hooks/useEnrollments', () => ({
    useUserEnrollments: () => ({
        enrollments: [],
        loading: false,
        refetch: vi.fn(),
        revokeEnrollment: vi.fn(),
    }),
}))

// The page imports the DI container eagerly for HttpClient; provide a stub
vi.mock('@core/di/container', () => ({
    container: {
        get: () => ({
            get: vi.fn().mockResolvedValue({ data: { content: [] } }),
            post: vi.fn().mockResolvedValue({ data: {} }),
            delete: vi.fn().mockResolvedValue({ data: {} }),
        }),
    },
}))

import MyProfilePage from '@/pages/MyProfilePage'

describe('MyProfilePage — smoke', () => {
    it('renders primary heading', async () => {
        render(
            <MemoryRouter>
                <MyProfilePage />
            </MemoryRouter>
        )

        await waitFor(() => {
            const headings = screen.getAllByRole('heading')
            expect(headings.some((h) => /my profile/i.test(h.textContent ?? ''))).toBe(true)
        }, { timeout: 3000 })
    })
})
