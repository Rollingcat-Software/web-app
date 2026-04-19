/**
 * Smoke test — TenantsListPage (FE-H1)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/i18n'

vi.mock('@features/tenants', () => ({
    useTenants: () => ({
        tenants: [],
        total: 0,
        loading: false,
        error: null,
        refetch: vi.fn(),
        createTenant: vi.fn(),
        updateTenant: vi.fn(),
        deleteTenant: vi.fn(),
        activateTenant: vi.fn(),
        suspendTenant: vi.fn(),
    }),
}))

import TenantsListPage from '@/pages/TenantsListPage'

describe('TenantsListPage — smoke', () => {
    it('renders primary heading', async () => {
        render(
            <MemoryRouter>
                <TenantsListPage />
            </MemoryRouter>
        )

        await waitFor(() => {
            const headings = screen.getAllByRole('heading')
            expect(headings.some((h) => /tenant/i.test(h.textContent ?? ''))).toBe(true)
        }, { timeout: 3000 })
    })
})
