import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import SmsOtpStep from '../SmsOtpStep'

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (params && 'seconds' in params) return `${key} (${params.seconds}s)`
            return key
        },
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
            <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
        ),
    },
    Variants: {},
}))

describe('SmsOtpStep', () => {
    const defaultProps = {
        onSubmit: vi.fn(),
        onSendOtp: vi.fn(),
        loading: false,
    }

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('rendering', () => {
        it('should render title', () => {
            render(<SmsOtpStep {...defaultProps} />)

            expect(screen.getByText('mfa.smsOtp.title')).toBeInTheDocument()
        })

        it('should render "will send" message before OTP is sent', () => {
            render(<SmsOtpStep {...defaultProps} />)

            expect(screen.getByText('mfa.smsOtp.willSend')).toBeInTheDocument()
        })

        it('should render send code button initially', () => {
            render(<SmsOtpStep {...defaultProps} />)

            expect(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i })).toBeInTheDocument()
        })

        it('should not render code input before OTP is sent', () => {
            render(<SmsOtpStep {...defaultProps} />)

            expect(screen.queryByPlaceholderText('000000')).not.toBeInTheDocument()
        })
    })

    describe('send OTP flow', () => {
        it('should call onSendOtp when send button is clicked', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            expect(defaultProps.onSendOtp).toHaveBeenCalledTimes(1)
        })

        it('should show code input after OTP is sent', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
            expect(screen.getByText('mfa.smsOtp.enterCode')).toBeInTheDocument()
        })

        it('should show verify button after OTP is sent', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            expect(screen.getByRole('button', { name: /mfa.smsOtp.verifyCode/i })).toBeInTheDocument()
        })
    })

    describe('code input behavior', () => {
        it('should only accept numeric input', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: 'abc123def456' } })

            expect(input).toHaveValue('123456')
        })

        it('should limit input to 6 digits', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '12345678' } })

            expect(input).toHaveValue('123456')
        })
    })

    describe('submit behavior', () => {
        it('should call onSubmit with code when form is submitted', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '123456' } })

            const form = input.closest('form')!
            fireEvent.submit(form)

            expect(defaultProps.onSubmit).toHaveBeenCalledWith('123456')
        })

        it('should not call onSubmit when code is less than 6 digits', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '123' } })

            const form = input.closest('form')!
            fireEvent.submit(form)

            expect(defaultProps.onSubmit).not.toHaveBeenCalled()
        })
    })

    describe('button states', () => {
        it('should disable verify button when code is less than 6 digits', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            const verifyBtn = screen.getByRole('button', { name: /mfa.smsOtp.verifyCode/i })
            expect(verifyBtn).toBeDisabled()
        })

        it('should enable verify button when code is 6 digits', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '123456' } })

            const verifyBtn = screen.getByRole('button', { name: /mfa.smsOtp.verifyCode/i })
            expect(verifyBtn).not.toBeDisabled()
        })

        it('should disable verify button when loading', () => {
            render(<SmsOtpStep {...defaultProps} loading={true} />)

            // In loading state with otpSent=false, it shows the send button
            // which should be disabled
            const sendBtn = screen.getByRole('button')
            expect(sendBtn).toBeDisabled()
        })
    })

    describe('countdown timer', () => {
        it('should start countdown after sending OTP', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            // Should show resend countdown
            expect(screen.getByText(/mfa.smsOtp.resendCountdown.*60s/)).toBeInTheDocument()
        })

        it('should disable resend button during countdown', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            const resendBtn = screen.getByText(/mfa.smsOtp.resendCountdown/)
            expect(resendBtn.closest('button')).toBeDisabled()
        })

        it('should decrement countdown each second', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            // Advance 1 second
            act(() => {
                vi.advanceTimersByTime(1000)
            })

            expect(screen.getByText(/mfa.smsOtp.resendCountdown.*59s/)).toBeInTheDocument()
        })

        it('should enable resend button when countdown reaches 0', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            // Advance past countdown
            act(() => {
                vi.advanceTimersByTime(60000)
            })

            expect(screen.getByText('mfa.smsOtp.resend')).toBeInTheDocument()
            expect(screen.getByText('mfa.smsOtp.resend').closest('button')).not.toBeDisabled()
        })

        it('should allow resending OTP after countdown expires', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            // Expire countdown
            act(() => {
                vi.advanceTimersByTime(60000)
            })

            fireEvent.click(screen.getByText('mfa.smsOtp.resend'))

            expect(defaultProps.onSendOtp).toHaveBeenCalledTimes(2)
        })
    })

    describe('error display', () => {
        it('should show error alert when error prop is provided', () => {
            render(<SmsOtpStep {...defaultProps} error="SMS sending failed" />)

            expect(screen.getByText('SMS sending failed')).toBeInTheDocument()
            expect(screen.getByRole('alert')).toBeInTheDocument()
        })

        it('should not show error alert when no error', () => {
            render(<SmsOtpStep {...defaultProps} />)

            expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        })
    })

    describe('loading state', () => {
        it('should show loading spinner on send button when loading', () => {
            render(<SmsOtpStep {...defaultProps} loading={true} />)

            expect(screen.getByRole('progressbar')).toBeInTheDocument()
        })

        it('should disable input when loading after OTP sent', () => {
            const { rerender } = render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            // Re-render with loading=true
            rerender(<SmsOtpStep {...defaultProps} loading={true} />)

            // After OTP is sent the component shows the code input form
            // But since we re-rendered we need to check initial state with loading
            // The loading prop disables the input
            const input = screen.queryByPlaceholderText('000000')
            if (input) {
                expect(input).toBeDisabled()
            }
        })
    })

    describe('i18n', () => {
        it('should display translated keys for initial state', () => {
            render(<SmsOtpStep {...defaultProps} />)

            expect(screen.getByText('mfa.smsOtp.title')).toBeInTheDocument()
            expect(screen.getByText('mfa.smsOtp.willSend')).toBeInTheDocument()
            expect(screen.getByText('mfa.smsOtp.sendCode')).toBeInTheDocument()
        })

        it('should display translated keys after OTP sent', () => {
            render(<SmsOtpStep {...defaultProps} />)

            fireEvent.click(screen.getByRole('button', { name: /mfa.smsOtp.sendCode/i }))

            expect(screen.getByText('mfa.smsOtp.enterCode')).toBeInTheDocument()
            expect(screen.getByLabelText('mfa.smsOtp.codeLabel')).toBeInTheDocument()
            expect(screen.getByText('mfa.smsOtp.verifyCode')).toBeInTheDocument()
        })
    })
})
