import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OtpManagement from '../OtpManagement'

// i18n passthrough — return the key (interpolating {{channel}} when present).
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params && 'channel' in params ? `${key} (${params.channel})` : key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}))

// httpClient stub — send always succeeds; verify is controlled per-test.
const mockPost = vi.fn()
vi.mock('@app/providers', () => ({
    useService: () => ({ post: mockPost }),
}))

async function sendThenEnterCode() {
    fireEvent.click(screen.getByRole('button', { name: /otp.sendCode/i }))
    await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '000000' } })
}

describe('OtpManagement', () => {
    const baseProps = {
        open: true,
        userId: 'user-123',
        onClose: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('surfaces a dedicated message when OTP_ATTEMPTS_EXHAUSTED is returned', async () => {
        mockPost
            // 1st call: /otp/.../send → success
            .mockResolvedValueOnce({ data: { message: 'sent' } })
            // 2nd call: /otp/.../verify → 200 with success:false + exhausted code
            .mockResolvedValueOnce({
                data: {
                    success: false,
                    errorCode: 'OTP_ATTEMPTS_EXHAUSTED',
                    remainingAttempts: 0,
                    message: 'Too many invalid attempts. Please request a new OTP code.',
                },
            })

        render(<OtpManagement {...baseProps} />)
        await sendThenEnterCode()

        fireEvent.click(screen.getByRole('button', { name: /otp.verifyCode/i }))

        await waitFor(() => {
            expect(screen.getByText('otp.attemptsExhausted')).toBeInTheDocument()
        })
        // Distinct from the generic failure copy.
        expect(screen.queryByText('otp.verifyFailed')).not.toBeInTheDocument()
        // Resets back to the "send a new code" state.
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /otp.sendCode/i })).toBeInTheDocument()
        })
    })

    it('shows the generic failure message for a non-exhausted invalid code', async () => {
        mockPost
            .mockResolvedValueOnce({ data: { message: 'sent' } })
            .mockResolvedValueOnce({
                data: { success: false, errorCode: 'OTP_INVALID', remainingAttempts: 3 },
            })

        render(<OtpManagement {...baseProps} />)
        await sendThenEnterCode()

        fireEvent.click(screen.getByRole('button', { name: /otp.verifyCode/i }))

        await waitFor(() => {
            expect(screen.getByText('otp.verifyFailed')).toBeInTheDocument()
        })
        expect(screen.queryByText('otp.attemptsExhausted')).not.toBeInTheDocument()
    })
})
