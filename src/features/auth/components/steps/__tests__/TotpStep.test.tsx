import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TotpStep from '../TotpStep'

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}))

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
            <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
        ),
    },
    Variants: {},
}))

describe('TotpStep', () => {
    const defaultProps = {
        onSubmit: vi.fn(),
        loading: false,
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('rendering', () => {
        it('should render title and subtitle', () => {
            render(<TotpStep {...defaultProps} />)

            expect(screen.getByText('mfa.totp.title')).toBeInTheDocument()
            expect(screen.getByText('mfa.totp.subtitle')).toBeInTheDocument()
        })

        it('should render 6-digit code input with correct attributes', () => {
            render(<TotpStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('mfa.placeholder.code')
            expect(input).toBeInTheDocument()
            expect(input).toHaveAttribute('maxLength', '6')
            expect(input).toHaveAttribute('inputMode', 'numeric')
        })

        it('should render code label from i18n', () => {
            render(<TotpStep {...defaultProps} />)

            expect(screen.getByLabelText('mfa.totp.codeLabel')).toBeInTheDocument()
        })

        it('should render verify button', () => {
            render(<TotpStep {...defaultProps} />)

            expect(screen.getByRole('button', { name: /mfa.verify/i })).toBeInTheDocument()
        })

        it('should render hint text', () => {
            render(<TotpStep {...defaultProps} />)

            expect(screen.getByText('mfa.totp.hint')).toBeInTheDocument()
        })
    })

    describe('input behavior', () => {
        it('should only accept numeric input', async () => {
            render(<TotpStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('mfa.placeholder.code')
            fireEvent.change(input, { target: { value: 'abc123def456' } })

            expect(input).toHaveValue('123456')
        })

        it('should limit input to 6 digits', async () => {
            render(<TotpStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('mfa.placeholder.code')
            fireEvent.change(input, { target: { value: '12345678' } })

            expect(input).toHaveValue('123456')
        })

        it('should support paste of 6-digit code', async () => {
            render(<TotpStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('mfa.placeholder.code')
            fireEvent.change(input, { target: { value: '654321' } })

            expect(input).toHaveValue('654321')
        })
    })

    describe('submit behavior', () => {
        it('should call onSubmit when form is submitted with 6 digits', async () => {
            render(<TotpStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('mfa.placeholder.code')
            fireEvent.change(input, { target: { value: '123456' } })

            const form = input.closest('form')!
            fireEvent.submit(form)

            expect(defaultProps.onSubmit).toHaveBeenCalledWith('123456')
        })

        it('should not call onSubmit when code is less than 6 digits', async () => {
            render(<TotpStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('mfa.placeholder.code')
            fireEvent.change(input, { target: { value: '123' } })

            const form = input.closest('form')!
            fireEvent.submit(form)

            expect(defaultProps.onSubmit).not.toHaveBeenCalled()
        })

        it('should auto-submit when 6 digits are entered', async () => {
            render(<TotpStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('mfa.placeholder.code')
            fireEvent.change(input, { target: { value: '123456' } })

            await waitFor(() => {
                expect(defaultProps.onSubmit).toHaveBeenCalledWith('123456')
            })
        })

        it('should not auto-submit the same code twice', async () => {
            render(<TotpStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('mfa.placeholder.code')
            fireEvent.change(input, { target: { value: '123456' } })

            await waitFor(() => {
                expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1)
            })

            // Re-trigger the same value shouldn't call again
            expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1)
        })

        it('should allow re-submit after clearing and re-entering code', async () => {
            render(<TotpStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('mfa.placeholder.code')

            // Enter first code
            fireEvent.change(input, { target: { value: '123456' } })
            await waitFor(() => {
                expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1)
            })

            // Clear and enter new code
            fireEvent.change(input, { target: { value: '12345' } })
            fireEvent.change(input, { target: { value: '654321' } })

            await waitFor(() => {
                expect(defaultProps.onSubmit).toHaveBeenCalledTimes(2)
                expect(defaultProps.onSubmit).toHaveBeenLastCalledWith('654321')
            })
        })
    })

    describe('button state', () => {
        it('should disable verify button when code is less than 6 digits', () => {
            render(<TotpStep {...defaultProps} />)

            const button = screen.getByRole('button', { name: /mfa.verify/i })
            expect(button).toBeDisabled()
        })

        it('should enable verify button when code is 6 digits', async () => {
            render(<TotpStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('mfa.placeholder.code')
            fireEvent.change(input, { target: { value: '123456' } })

            const button = screen.getByRole('button', { name: /mfa.verify/i })
            expect(button).not.toBeDisabled()
        })

        it('should disable verify button when loading', () => {
            render(<TotpStep {...defaultProps} loading={true} />)

            const button = screen.getByRole('button', { name: /mfa.verify/i })
            expect(button).toBeDisabled()
        })
    })

    describe('loading state', () => {
        it('should show CircularProgress when loading', () => {
            render(<TotpStep {...defaultProps} loading={true} />)

            expect(screen.getByRole('progressbar')).toBeInTheDocument()
        })

        it('should disable input when loading', () => {
            render(<TotpStep {...defaultProps} loading={true} />)

            const input = screen.getByPlaceholderText('mfa.placeholder.code')
            expect(input).toBeDisabled()
        })

        it('should not auto-submit when loading', async () => {
            render(<TotpStep {...defaultProps} loading={true} />)

            const input = screen.getByPlaceholderText('mfa.placeholder.code')
            fireEvent.change(input, { target: { value: '123456' } })

            // Wait a tick to ensure effect runs
            await waitFor(() => {
                expect(defaultProps.onSubmit).not.toHaveBeenCalled()
            })
        })
    })

    describe('error display', () => {
        it('should show error alert when error prop is provided', () => {
            render(<TotpStep {...defaultProps} error="Invalid code" />)

            expect(screen.getByText('Invalid code')).toBeInTheDocument()
            expect(screen.getByRole('alert')).toBeInTheDocument()
        })

        it('should not show error alert when no error', () => {
            render(<TotpStep {...defaultProps} />)

            expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        })
    })

    describe('i18n', () => {
        it('should display translated keys for all labels', () => {
            render(<TotpStep {...defaultProps} />)

            expect(screen.getByText('mfa.totp.title')).toBeInTheDocument()
            expect(screen.getByText('mfa.totp.subtitle')).toBeInTheDocument()
            expect(screen.getByText('mfa.totp.hint')).toBeInTheDocument()
            expect(screen.getByLabelText('mfa.totp.codeLabel')).toBeInTheDocument()
            expect(screen.getByText('mfa.verify')).toBeInTheDocument()
        })
    })
})
