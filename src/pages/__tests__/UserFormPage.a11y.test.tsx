/**
 * Accessibility test — UserFormPage (FE-H4)
 * Asserts that every Zod-validated TextField declares aria-describedby
 * pointing at its helperText id (helper element renders when message present).
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/i18n'

vi.mock('@features/users', () => ({
    useUsers: () => ({
        createUser: vi.fn(),
        updateUser: vi.fn(),
    }),
    useUser: () => ({ user: null, loading: false }),
}))

vi.mock('@features/tenants', () => ({
    useTenants: () => ({ tenants: [], loading: false }),
}))

vi.mock('@features/roles', () => ({
    useRoles: () => ({ roles: [], loading: false }),
}))

import UserFormPage from '@/pages/UserFormPage'

describe('UserFormPage — a11y aria-describedby wiring', () => {
    it('declares aria-describedby on each Zod field pointing at its helperText id', () => {
        const { container } = render(
            <MemoryRouter>
                <UserFormPage />
            </MemoryRouter>
        )

        const fieldIds = [
            'user-form-email',
            'user-form-firstName',
            'user-form-lastName',
            'user-form-password',
            'user-form-role',
            'user-form-tenantId',
        ]

        for (const fieldId of fieldIds) {
            const helperId = `${fieldId}-helper`
            const described = container.querySelector(`[aria-describedby~="${helperId}"]`)
            expect(described, `field ${fieldId} should declare aria-describedby=${helperId}`).not.toBeNull()
        }

        // tenantId has a static helperText fallback — its helper node should render
        const tenantHelper = container.querySelector('#user-form-tenantId-helper')
        expect(tenantHelper).not.toBeNull()
    })
})
