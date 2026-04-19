/**
 * Smoke test — UsersListPage (FE-H1)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/i18n'

vi.mock('@features/users/hooks/useUsers', () => ({
    useUsers: () => ({
        users: [],
        total: 0,
        loading: false,
        error: null,
        refetch: vi.fn(),
        createUser: vi.fn(),
        updateUser: vi.fn(),
        deleteUser: vi.fn(),
        activateUser: vi.fn(),
        suspendUser: vi.fn(),
    }),
}))

import UsersListPage from '@features/users/components/UsersListPage'

describe('UsersListPage — smoke', () => {
    it('renders primary heading', async () => {
        render(
            <MemoryRouter>
                <UsersListPage />
            </MemoryRouter>
        )

        await waitFor(() => {
            const headings = screen.getAllByRole('heading')
            expect(headings.some((h) => /users/i.test(h.textContent ?? ''))).toBe(true)
        }, { timeout: 3000 })
    })
})
