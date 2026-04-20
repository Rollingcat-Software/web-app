/**
 * Accessibility test — ForgotPasswordPage (FE-H4)
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

import ForgotPasswordPage from '@/pages/ForgotPasswordPage'

describe('ForgotPasswordPage — a11y aria-describedby wiring', () => {
    it('declares aria-describedby on email input pointing at its helperText id', () => {
        const { container } = render(
            <MemoryRouter>
                <ForgotPasswordPage />
            </MemoryRouter>
        )

        const helperId = 'forgot-password-email-helper'
        const described = container.querySelector(`[aria-describedby~="${helperId}"]`)
        expect(described).not.toBeNull()
    })
})
