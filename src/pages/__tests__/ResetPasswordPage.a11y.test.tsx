/**
 * Accessibility test — ResetPasswordPage (FE-H4)
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/i18n'

vi.mock('@core/di/container', () => ({
    getService: () => ({
        post: vi.fn().mockResolvedValue({ data: {} }),
        get: vi.fn().mockResolvedValue({ data: {} }),
    }),
    container: {
        get: () => ({ post: vi.fn(), get: vi.fn() }),
    },
}))

import ResetPasswordPage from '@/pages/ResetPasswordPage'

describe('ResetPasswordPage — a11y aria-describedby wiring', () => {
    it('declares aria-describedby on password fields pointing at their helperText ids', () => {
        const { container } = render(
            <MemoryRouter initialEntries={['/reset-password?email=user%40example.com']}>
                <ResetPasswordPage />
            </MemoryRouter>
        )

        const helperIds = [
            'reset-password-newPassword-helper',
            'reset-password-confirmPassword-helper',
        ]

        for (const helperId of helperIds) {
            const described = container.querySelector(`[aria-describedby~="${helperId}"]`)
            expect(described, `field should declare aria-describedby=${helperId}`).not.toBeNull()
        }
    })
})
