import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import TotpEnrollment from '../TotpEnrollment'

// Mock framer-motion (not used directly here but may be imported transitively)
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
            <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
        ),
    },
    Variants: {},
}))

// Mock httpClient
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockDelete = vi.fn()

vi.mock('@app/providers', () => ({
    useService: () => ({
        get: mockGet,
        post: mockPost,
        delete: mockDelete,
    }),
    DependencyProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('TotpEnrollment', () => {
    const defaultProps = {
        open: true,
        userId: 'user-123',
        onClose: vi.fn(),
        onSuccess: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()

        // Default: TOTP is not configured
        mockGet.mockResolvedValue({
            data: { userId: 'user-123', configured: false },
        })
    })

    describe('initial rendering', () => {
        it('should render dialog with title', async () => {
            render(<TotpEnrollment {...defaultProps} />)

            expect(screen.getByText(/Setup Two-Factor Authentication/)).toBeInTheDocument()
        })

        it('should render stepper with 3 steps', async () => {
            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(mockGet).toHaveBeenCalled()
            })

            expect(screen.getByText('Generate Secret')).toBeInTheDocument()
            expect(screen.getByText('Scan QR Code')).toBeInTheDocument()
            expect(screen.getByText('Verify Code')).toBeInTheDocument()
        })

        it('should render Generate Secret Key button on step 0', async () => {
            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(mockGet).toHaveBeenCalled()
            })

            expect(screen.getByRole('button', { name: /Generate Secret Key/i })).toBeInTheDocument()
        })

        it('should render Cancel button', async () => {
            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(mockGet).toHaveBeenCalled()
            })

            expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
        })

        it('should not render when open is false', () => {
            render(<TotpEnrollment {...defaultProps} open={false} />)

            expect(screen.queryByText(/Setup Two-Factor Authentication/)).not.toBeInTheDocument()
        })
    })

    describe('status check on mount', () => {
        it('should check TOTP status on mount', async () => {
            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(mockGet).toHaveBeenCalledWith('/totp/status/user-123')
            })
        })

        it('should show loading spinner during status check', () => {
            mockGet.mockImplementation(() => new Promise(() => {})) // Never resolves
            render(<TotpEnrollment {...defaultProps} />)

            expect(screen.getByRole('progressbar')).toBeInTheDocument()
        })

        it('should show already configured view when TOTP is enabled', async () => {
            mockGet.mockResolvedValue({
                data: { userId: 'user-123', configured: true },
            })

            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText(/TOTP is Already Configured/)).toBeInTheDocument()
            })

            expect(screen.getByRole('button', { name: /Disable TOTP/i })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /Re-setup TOTP/i })).toBeInTheDocument()
        })
    })

    describe('setup flow (step 0 -> step 1)', () => {
        it('should call setup API when Generate Secret Key is clicked', async () => {
            mockPost.mockResolvedValue({
                data: {
                    secret: 'JBSWY3DPEHPK3PXP',
                    otpAuthUri: 'otpauth://totp/FIVUCSAS:user@test.com?secret=JBSWY3DPEHPK3PXP',
                    message: 'TOTP setup initiated',
                },
            })

            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(mockGet).toHaveBeenCalled()
            })

            fireEvent.click(screen.getByRole('button', { name: /Generate Secret Key/i }))

            await waitFor(() => {
                expect(mockPost).toHaveBeenCalledWith('/totp/setup/user-123', {})
            })
        })

        it('should show QR code and secret after setup', async () => {
            mockPost.mockResolvedValue({
                data: {
                    secret: 'JBSWY3DPEHPK3PXP',
                    otpAuthUri: 'otpauth://totp/FIVUCSAS:user@test.com?secret=JBSWY3DPEHPK3PXP',
                    message: 'TOTP setup initiated',
                },
            })

            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(mockGet).toHaveBeenCalled()
            })

            fireEvent.click(screen.getByRole('button', { name: /Generate Secret Key/i }))

            await waitFor(() => {
                expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()
            })

            // QR code image
            expect(screen.getByAltText('TOTP QR Code')).toBeInTheDocument()
            // Copy button
            expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument()
            // Verification code input
            expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
        })

        it('should show error on setup failure', async () => {
            mockPost.mockRejectedValue(new Error('Setup failed'))

            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(mockGet).toHaveBeenCalled()
            })

            fireEvent.click(screen.getByRole('button', { name: /Generate Secret Key/i }))

            await waitFor(() => {
                expect(screen.getByText('Setup failed')).toBeInTheDocument()
            })
        })
    })

    describe('verification flow (step 1 -> step 2)', () => {
        const setupResponse = {
            data: {
                secret: 'JBSWY3DPEHPK3PXP',
                otpAuthUri: 'otpauth://totp/FIVUCSAS:user@test.com?secret=JBSWY3DPEHPK3PXP',
                message: 'TOTP setup initiated',
            },
        }

        async function advanceToStep1() {
            mockPost.mockResolvedValueOnce(setupResponse)

            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(mockGet).toHaveBeenCalled()
            })

            fireEvent.click(screen.getByRole('button', { name: /Generate Secret Key/i }))

            await waitFor(() => {
                expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
            })
        }

        it('should accept verification code input', async () => {
            await advanceToStep1()

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '123456' } })

            expect(input).toHaveValue('123456')
        })

        it('should only accept numeric characters in verification code', async () => {
            await advanceToStep1()

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: 'abc123' } })

            expect(input).toHaveValue('123')
        })

        it('should disable Verify button when code is less than 6 digits', async () => {
            await advanceToStep1()

            expect(screen.getByRole('button', { name: /Verify & Enable/i })).toBeDisabled()
        })

        it('should enable Verify button when code is 6 digits', async () => {
            await advanceToStep1()

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '123456' } })

            expect(screen.getByRole('button', { name: /Verify & Enable/i })).not.toBeDisabled()
        })

        it('should call verify API on Verify & Enable click', async () => {
            await advanceToStep1()

            mockPost.mockResolvedValueOnce({
                data: { success: true, message: 'TOTP enabled' },
            })

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '654321' } })

            fireEvent.click(screen.getByRole('button', { name: /Verify & Enable/i }))

            await waitFor(() => {
                expect(mockPost).toHaveBeenCalledWith('/totp/verify-setup/user-123', { code: '654321' })
            })
        })

        it('should show success view after valid verification', async () => {
            await advanceToStep1()

            mockPost.mockResolvedValueOnce({
                data: { success: true, message: 'TOTP enabled' },
            })

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '654321' } })
            fireEvent.click(screen.getByRole('button', { name: /Verify & Enable/i }))

            await waitFor(() => {
                expect(screen.getByText(/TOTP Setup Complete/)).toBeInTheDocument()
            })
        })

        it('should show error on invalid verification code', async () => {
            await advanceToStep1()

            mockPost.mockResolvedValueOnce({
                data: { success: false, message: 'Invalid code' },
            })

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '000000' } })
            fireEvent.click(screen.getByRole('button', { name: /Verify & Enable/i }))

            await waitFor(() => {
                expect(screen.getByText('Invalid code')).toBeInTheDocument()
            })
        })

        it('should show error when verify API throws', async () => {
            await advanceToStep1()

            mockPost.mockRejectedValueOnce(new Error('Server error'))

            const input = screen.getByPlaceholderText('000000')
            fireEvent.change(input, { target: { value: '111111' } })
            fireEvent.click(screen.getByRole('button', { name: /Verify & Enable/i }))

            await waitFor(() => {
                expect(screen.getByText('Server error')).toBeInTheDocument()
            })
        })
    })

    describe('disable TOTP', () => {
        it('should call delete API when disable is confirmed', async () => {
            mockGet.mockResolvedValue({
                data: { userId: 'user-123', configured: true },
            })
            mockDelete.mockResolvedValue({
                data: { success: true, message: 'TOTP disabled' },
            })

            // Mock window.confirm
            vi.spyOn(window, 'confirm').mockReturnValue(true)

            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText(/TOTP is Already Configured/)).toBeInTheDocument()
            })

            fireEvent.click(screen.getByRole('button', { name: /Disable TOTP/i }))

            await waitFor(() => {
                expect(mockDelete).toHaveBeenCalledWith('/totp/user-123')
            })
        })

        it('should not call delete API when disable is cancelled', async () => {
            mockGet.mockResolvedValue({
                data: { userId: 'user-123', configured: true },
            })

            vi.spyOn(window, 'confirm').mockReturnValue(false)

            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText(/TOTP is Already Configured/)).toBeInTheDocument()
            })

            fireEvent.click(screen.getByRole('button', { name: /Disable TOTP/i }))

            expect(mockDelete).not.toHaveBeenCalled()
        })

        it('should call delete API when disable is confirmed', async () => {
            mockGet.mockResolvedValue({
                data: { userId: 'user-123', configured: true },
            })
            mockDelete.mockResolvedValue({
                data: { success: true, message: 'TOTP disabled' },
            })

            vi.spyOn(window, 'confirm').mockReturnValue(true)

            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText(/TOTP is Already Configured/)).toBeInTheDocument()
            })

            fireEvent.click(screen.getByRole('button', { name: /Disable TOTP/i }))

            await waitFor(() => {
                expect(mockDelete).toHaveBeenCalledWith('/totp/user-123')
            })
        })
    })

    describe('close/cancel behavior', () => {
        it('should call onClose when Cancel is clicked', async () => {
            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(mockGet).toHaveBeenCalled()
            })

            fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))

            expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
        })

        it('should show Close button when TOTP is already configured', async () => {
            mockGet.mockResolvedValue({
                data: { userId: 'user-123', configured: true },
            })

            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument()
            })
        })
    })

    describe('copy secret', () => {
        it('should copy secret to clipboard', async () => {
            const writeTextMock = vi.fn().mockResolvedValue(undefined)
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: writeTextMock },
                writable: true,
                configurable: true,
            })

            mockPost.mockResolvedValueOnce({
                data: {
                    secret: 'JBSWY3DPEHPK3PXP',
                    otpAuthUri: 'otpauth://totp/test',
                    message: 'OK',
                },
            })

            render(<TotpEnrollment {...defaultProps} />)

            await waitFor(() => {
                expect(mockGet).toHaveBeenCalled()
            })

            fireEvent.click(screen.getByRole('button', { name: /Generate Secret Key/i }))

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument()
            })

            fireEvent.click(screen.getByRole('button', { name: /Copy/i }))

            await waitFor(() => {
                expect(writeTextMock).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP')
            })

            await waitFor(() => {
                expect(screen.getByText('Copied!')).toBeInTheDocument()
            })
        })
    })
})
