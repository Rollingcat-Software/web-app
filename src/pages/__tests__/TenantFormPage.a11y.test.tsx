/**
 * Accessibility test — TenantFormPage (FE-H4)
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/i18n'

vi.mock('@features/tenants', () => ({
    useTenants: () => ({
        createTenant: vi.fn(),
        updateTenant: vi.fn(),
    }),
    useTenant: () => ({ tenant: null, loading: false }),
}))

vi.mock('@features/tenants/components/TenantAuthMethods', () => ({
    default: () => null,
}))

import TenantFormPage from '@/pages/TenantFormPage'

describe('TenantFormPage — a11y aria-describedby wiring', () => {
    it('declares aria-describedby on each Zod field pointing at its helperText id', () => {
        const { container } = render(
            <MemoryRouter>
                <TenantFormPage />
            </MemoryRouter>
        )

        const fieldIds = [
            'tenant-form-name',
            'tenant-form-slug',
            'tenant-form-description',
            'tenant-form-contactEmail',
            'tenant-form-contactPhone',
            'tenant-form-maxUsers',
        ]

        for (const fieldId of fieldIds) {
            const helperId = `${fieldId}-helper`
            const described = container.querySelector(`[aria-describedby~="${helperId}"]`)
            expect(described, `field ${fieldId} should declare aria-describedby=${helperId}`).not.toBeNull()
        }

        // slug + maxUsers have static helperText fallbacks — their helpers should render
        expect(container.querySelector('#tenant-form-slug-helper')).not.toBeNull()
        expect(container.querySelector('#tenant-form-maxUsers-helper')).not.toBeNull()
    })
})
