/**
 * ConfigUnavailableBanner — the shared "couldn't load your sign-in options"
 * warning used by BOTH the dashboard and hosted login surfaces. Verifies:
 *   - it is a role="status" warning carrying the configUnavailable copy,
 *   - the Retry button calls onRetry,
 *   - while retrying it shows "Retrying…" and is disabled.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '../../../../i18n'
import ConfigUnavailableBanner from '../ConfigUnavailableBanner'

describe('ConfigUnavailableBanner', () => {
    it('renders a role="status" warning with the explainer + Retry', () => {
        render(<ConfigUnavailableBanner onRetry={vi.fn()} retrying={false} />)
        const banner = screen.getByRole('status')
        expect(banner).toHaveTextContent(/sign-in options/i)
        expect(screen.getByRole('button', { name: /retry/i })).toBeEnabled()
    })

    it('calls onRetry when Retry is clicked', () => {
        const onRetry = vi.fn()
        render(<ConfigUnavailableBanner onRetry={onRetry} retrying={false} />)
        fireEvent.click(screen.getByRole('button', { name: /retry/i }))
        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('shows "Retrying…" and disables the button while retrying', () => {
        render(<ConfigUnavailableBanner onRetry={vi.fn()} retrying />)
        const btn = screen.getByRole('button')
        expect(btn).toBeDisabled()
        expect(btn).toHaveTextContent(/retrying/i)
    })
})
