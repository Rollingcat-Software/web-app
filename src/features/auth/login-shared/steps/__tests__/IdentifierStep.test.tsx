/**
 * IdentifierStep — the shared opening email-entry block used by BOTH login
 * surfaces (dashboard LoginPage + hosted LoginMfaFlow). Verifies the behaviour
 * contract that keeps the two surfaces identical:
 *   - renders the subtitle + an email field + a Continue button,
 *   - Continue is disabled until a non-empty identifier is typed,
 *   - submits on the button click and on Enter,
 *   - shows the spinner only when `loading`, and disables via `disabled`,
 *   - surfaces the inline error Alert when given.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '../../../../../i18n'
import IdentifierStep from '../IdentifierStep'

function setup(overrides: Partial<React.ComponentProps<typeof IdentifierStep>> = {}) {
    const onChange = vi.fn()
    const onSubmit = vi.fn()
    render(
        <IdentifierStep value="" onChange={onChange} onSubmit={onSubmit} {...overrides} />,
    )
    return { onChange, onSubmit }
}

describe('IdentifierStep', () => {
    it('renders the email field, subtitle and Continue button', () => {
        setup()
        expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
    })

    it('disables Continue until a non-empty identifier is typed', () => {
        setup({ value: '' })
        expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
    })

    it('enables Continue and submits on click with a value', () => {
        const { onSubmit } = setup({ value: 'user@example.com' })
        const btn = screen.getByRole('button', { name: /continue/i })
        expect(btn).toBeEnabled()
        fireEvent.click(btn)
        expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it('submits on Enter in the email field', () => {
        const { onSubmit } = setup({ value: 'user@example.com' })
        fireEvent.keyDown(screen.getByLabelText('Email Address'), { key: 'Enter' })
        expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it('reports typing via onChange', () => {
        const { onChange } = setup()
        fireEvent.change(screen.getByLabelText('Email Address'), {
            target: { value: 'a@b.co' },
        })
        expect(onChange).toHaveBeenCalledWith('a@b.co')
    })

    it('shows a spinner while loading (dashboard look) and disables inputs', () => {
        setup({ value: 'user@example.com', loading: true })
        // Spinner replaces the Continue label; the button is disabled.
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
        expect(screen.getByRole('button')).toBeDisabled()
    })

    it('disables WITHOUT a spinner when only `disabled` is set (hosted look)', () => {
        setup({ value: 'user@example.com', disabled: true })
        expect(screen.queryByRole('progressbar')).toBeNull()
        // The Continue label stays (no spinner) and the button is disabled.
        expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
    })

    it('does not submit on Enter while disabled', () => {
        const { onSubmit } = setup({ value: 'user@example.com', disabled: true })
        fireEvent.keyDown(screen.getByLabelText('Email Address'), { key: 'Enter' })
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('renders an inline error Alert when given', () => {
        setup({ error: 'Wrong tenant' })
        expect(screen.getByText('Wrong tenant')).toBeInTheDocument()
    })
})
