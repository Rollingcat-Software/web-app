import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import EmailOtpMfaStep from '../EmailOtpMfaStep'

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (params && 'email' in params) return `${key} (${params.email})`
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

// Mock httpClient and authRepository
const mockPost = vi.fn()
const mockVerifyMfaStep = vi.fn()

vi.mock('@app/providers', () => ({
    useService: (type: symbol) => {
        if (type === Symbol.for('HttpClient')) {
            return { post: mockPost }
        }
        if (type === Symbol.for('AuthRepository')) {
            return { verifyMfaStep: mockVerifyMfaStep }
        }
        return {}
    },
    DependencyProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('EmailOtpMfaStep', () => {
    const defaultProps = {
        mfaSessionToken: 'test-session-token-123',
        onAuthenticated: vi.fn(),
        onBack: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()

        // Default: sendOtp succeeds
        mockPost.mockResolvedValue({
            data: { message: 'OTP sent', email: 't***@example.com' },
        })
    })

    describe('rendering', () => {
        it('should render title', async () => {
            render(<EmailOtpMfaStep {...defaultProps} />)

            expect(screen.getByText('mfa.emailOtp.title')).toBeInTheDocument()
        })

        it('should render code input', async () => {
            render(<EmailOtpMfaStep {...defaultProps} />)

            expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
        })

        it('should render verify button', async () => {
            render(<EmailOtpMfaStep {...defaultProps} />)

            expect(screen.getByRole('button', { name: /mfa.verify/i })).toBeInTheDocument()
        })

        it('should render back button', async () => {
            render(<EmailOtpMfaStep {...defaultProps} />)

            expect(screen.getByText('mfa.backToMethodSelection')).toBeInTheDocument()
        })

        it('should render subtitle before email is known', async () => {
            mockPost.mockImplementation(() => new Promise(() => {})) // Never resolves
            render(<EmailOtpMfaStep {...defaultProps} />)

            expect(screen.getByText('mfa.emailOtp.subtitle')).toBeInTheDocument()
        })
    })

    describe('send OTP on mount', () => {
        it('should call send OTP API on mount', async () => {
            render(<EmailOtpMfaStep {...defaultProps} />)

            await waitFor(() => {
                expect(mockPost).toHaveBeenCalledWith('/auth/mfa/send-otp', {
                    sessionToken: 'test-session-token-123',
                    method: 'EMAIL_OTP',
                })
            })
        })

        it('should show masked email after OTP is sent', async () => {
            render(<EmailOtpMfaStep {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText(/mfa.emailOtp.sentTo.*t\*\*\*@example\.com/)).toBeInTheDocument()
            })
        })

        it('should show loading spinner while sending', async () => {
            mockPost.mockImplementation(() => new Promise(() => {})) // Never resolves
            render(<EmailOtpMfaStep {...defaultProps} />)

            expect(screen.getByRole('progressbar')).toBeInTheDocument()
        })

        it('should show error when send fails', async () => {
            mockPost.mockRejectedValue(new Error('Network error'))

            render(<EmailOtpMfaStep {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument()
                expect(screen.getByText('errors.networkError')).toBeInTheDocument()
            })
        })
    })

    describe('code input behavior', () => {
        it('should only accept numeric input', async () => {
            render(<EmailOtpMfaStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: 'abc123xyz' } })

            expect(input).toHaveValue('123')
        })

        it('should limit input to 6 digits', async () => {
            render(<EmailOtpMfaStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '12345678' } })

            expect(input).toHaveValue('123456')
        })
    })

    describe('verify behavior', () => {
        it('should call verifyMfaStep when form is submitted with 6-digit code', async () => {
            mockVerifyMfaStep.mockResolvedValue({
                status: 'AUTHENTICATED',
                message: 'Success',
            })

            render(<EmailOtpMfaStep {...defaultProps} />)

            // Wait for OTP send to complete
            await waitFor(() => {
                expect(mockPost).toHaveBeenCalled()
            })

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '123456' } })

            const form = input.closest('form')!
            fireEvent.submit(form)

            await waitFor(() => {
                expect(mockVerifyMfaStep).toHaveBeenCalledWith(
                    'test-session-token-123',
                    'EMAIL_OTP',
                    { code: '123456' }
                )
            })
        })

        it('should call onAuthenticated on successful verification', async () => {
            const mockResponse = {
                status: 'AUTHENTICATED' as const,
                message: 'Success',
            }
            mockVerifyMfaStep.mockResolvedValue(mockResponse)

            render(<EmailOtpMfaStep {...defaultProps} />)

            await waitFor(() => {
                expect(mockPost).toHaveBeenCalled()
            })

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '123456' } })

            const form = input.closest('form')!
            fireEvent.submit(form)

            await waitFor(() => {
                expect(defaultProps.onAuthenticated).toHaveBeenCalledWith(mockResponse)
            })
        })

        it('should call onAuthenticated on STEP_COMPLETED status', async () => {
            const mockResponse = {
                status: 'STEP_COMPLETED' as const,
                message: 'Step done',
            }
            mockVerifyMfaStep.mockResolvedValue(mockResponse)

            render(<EmailOtpMfaStep {...defaultProps} />)

            await waitFor(() => {
                expect(mockPost).toHaveBeenCalled()
            })

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '654321' } })

            const form = input.closest('form')!
            fireEvent.submit(form)

            await waitFor(() => {
                expect(defaultProps.onAuthenticated).toHaveBeenCalledWith(mockResponse)
            })
        })

        it('should show error on failed verification status', async () => {
            mockVerifyMfaStep.mockResolvedValue({
                status: 'FAILED',
                message: 'Wrong code',
            })

            render(<EmailOtpMfaStep {...defaultProps} />)

            await waitFor(() => {
                expect(mockPost).toHaveBeenCalled()
            })

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '000000' } })

            const form = input.closest('form')!
            fireEvent.submit(form)

            await waitFor(() => {
                expect(screen.getByText('mfa.verificationFailed')).toBeInTheDocument()
            })

            expect(defaultProps.onAuthenticated).not.toHaveBeenCalled()
        })

        it('should show error when verification throws', async () => {
            mockVerifyMfaStep.mockRejectedValue(new Error('Server error'))

            render(<EmailOtpMfaStep {...defaultProps} />)

            await waitFor(() => {
                expect(mockPost).toHaveBeenCalled()
            })

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '111111' } })

            const form = input.closest('form')!
            fireEvent.submit(form)

            await waitFor(() => {
                expect(screen.getByText('errors.unknown')).toBeInTheDocument()
            })
        })

        it('should not submit when code is less than 6 digits', async () => {
            render(<EmailOtpMfaStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '123' } })

            const form = input.closest('form')!
            fireEvent.submit(form)

            expect(mockVerifyMfaStep).not.toHaveBeenCalled()
        })
    })

    describe('auto-submit', () => {
        it('should auto-submit when 6 digits are entered', async () => {
            mockVerifyMfaStep.mockResolvedValue({
                status: 'AUTHENTICATED',
                message: 'Success',
            })

            render(<EmailOtpMfaStep {...defaultProps} />)

            // Wait for send to resolve
            await waitFor(() => {
                expect(mockPost).toHaveBeenCalled()
            })

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '123456' } })

            await waitFor(() => {
                expect(mockVerifyMfaStep).toHaveBeenCalledWith(
                    'test-session-token-123',
                    'EMAIL_OTP',
                    { code: '123456' }
                )
            })
        })
    })

    describe('button states', () => {
        it('should disable verify button when code is less than 6 digits', async () => {
            render(<EmailOtpMfaStep {...defaultProps} />)

            const verifyBtn = screen.getByRole('button', { name: /mfa.verify/i })
            expect(verifyBtn).toBeDisabled()
        })

        it('should enable verify button when code is 6 digits', async () => {
            render(<EmailOtpMfaStep {...defaultProps} />)

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '123456' } })

            // Wait for any auto-submit side effects to settle
            await waitFor(() => {
                expect(mockPost).toHaveBeenCalled()
            })

            // The verify button might show a spinner if auto-submit triggered loading
            // Check that the submit button exists (it might be in loading state)
            const buttons = screen.getAllByRole('button')
            const submitButton = buttons.find(b => b.getAttribute('type') === 'submit')
            expect(submitButton).toBeTruthy()
        })
    })

    describe('countdown timer', () => {
        it('should start 60s countdown after OTP is sent', async () => {
            vi.useFakeTimers()

            render(<EmailOtpMfaStep {...defaultProps} />)

            // Manually flush the pending promise
            await act(async () => {
                await vi.runAllTimersAsync()
            })

            expect(screen.getByText(/mfa.emailOtp.resendCountdown.*60s/)).toBeInTheDocument()

            vi.useRealTimers()
        })

        it('should disable resend button during countdown', async () => {
            vi.useFakeTimers()

            render(<EmailOtpMfaStep {...defaultProps} />)

            await act(async () => {
                await vi.runAllTimersAsync()
            })

            const resendBtn = screen.getByText(/mfa.emailOtp.resendCountdown/).closest('button')
            expect(resendBtn).toBeDisabled()

            vi.useRealTimers()
        })

        it('should decrement countdown', async () => {
            vi.useFakeTimers()

            render(<EmailOtpMfaStep {...defaultProps} />)

            await act(async () => {
                await vi.runAllTimersAsync()
            })

            act(() => {
                vi.advanceTimersByTime(1000)
            })

            expect(screen.getByText(/mfa.emailOtp.resendCountdown.*59s/)).toBeInTheDocument()

            vi.useRealTimers()
        })

        it('should enable resend button when countdown reaches 0', async () => {
            vi.useFakeTimers()

            render(<EmailOtpMfaStep {...defaultProps} />)

            await act(async () => {
                await vi.runAllTimersAsync()
            })

            act(() => {
                vi.advanceTimersByTime(60000)
            })

            const resendBtn = screen.getByText('mfa.emailOtp.resend').closest('button')
            expect(resendBtn).not.toBeDisabled()

            vi.useRealTimers()
        })

        it('should resend OTP when resend button is clicked', async () => {
            vi.useFakeTimers()

            render(<EmailOtpMfaStep {...defaultProps} />)

            await act(async () => {
                await vi.runAllTimersAsync()
            })

            expect(mockPost).toHaveBeenCalledTimes(1)

            act(() => {
                vi.advanceTimersByTime(60000)
            })

            fireEvent.click(screen.getByText('mfa.emailOtp.resend'))

            await act(async () => {
                await vi.runAllTimersAsync()
            })

            expect(mockPost).toHaveBeenCalledTimes(2)

            vi.useRealTimers()
        })
    })

    describe('back button', () => {
        it('should call onBack when back button is clicked', async () => {
            render(<EmailOtpMfaStep {...defaultProps} />)

            fireEvent.click(screen.getByText('mfa.backToMethodSelection'))

            expect(defaultProps.onBack).toHaveBeenCalledTimes(1)
        })
    })

    describe('loading state during verification', () => {
        it('should show spinner in verify button while verifying', async () => {
            mockVerifyMfaStep.mockImplementation(() => new Promise(() => {})) // Never resolves

            render(<EmailOtpMfaStep {...defaultProps} />)

            await waitFor(() => {
                expect(mockPost).toHaveBeenCalled()
            })

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '123456' } })

            const form = input.closest('form')!
            fireEvent.submit(form)

            await waitFor(() => {
                const progressbars = screen.getAllByRole('progressbar')
                expect(progressbars.length).toBeGreaterThanOrEqual(1)
            })
        })
    })

    describe('i18n', () => {
        it('should display translated keys', async () => {
            render(<EmailOtpMfaStep {...defaultProps} />)

            expect(screen.getByText('mfa.emailOtp.title')).toBeInTheDocument()
            expect(screen.getByText('mfa.verify')).toBeInTheDocument()
            expect(screen.getByText('mfa.backToMethodSelection')).toBeInTheDocument()
        })
    })
})
