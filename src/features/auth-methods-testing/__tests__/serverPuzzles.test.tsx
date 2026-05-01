/**
 * Server-mediated puzzle tests (USER-BUG-5 regression coverage).
 *
 * Each test mocks the underlying step component down to a single
 * "submit-with-code" button and asserts that:
 *   - the puzzle invokes the real verification endpoint
 *   - a `success: false` server response surfaces a real error string
 *     (it does NOT silently call `onSuccess`)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const verifyMethodMock = vi.fn()
const sendEmailOtpMock = vi.fn()
const sendSmsOtpMock = vi.fn()
const generateQrTokenMock = vi.fn()
const invalidateQrTokenMock = vi.fn()

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}))

vi.mock('../hooks/useTestVerifyApi', () => ({
    useTestVerifyApi: () => ({
        sendEmailOtp: sendEmailOtpMock,
        sendSmsOtp: sendSmsOtpMock,
        generateQrToken: generateQrTokenMock,
        invalidateQrToken: invalidateQrTokenMock,
        verifyMethod: verifyMethodMock,
    }),
}))

// Replace heavy step components with thin shims that expose a "submit with
// code" button. This keeps the test focused on the puzzle's verification
// logic rather than the step's UX details.
vi.mock('@features/auth/components/steps/TotpStep', () => ({
    default: ({
        onSubmit,
        error,
    }: {
        onSubmit: (code: string) => void
        error?: string
    }) => (
        <div>
            <button data-testid="submit" onClick={() => onSubmit('000000')}>
                submit
            </button>
            {error && <div data-testid="error">{error}</div>}
        </div>
    ),
}))
vi.mock('@features/auth/components/steps/EmailOtpStep', () => ({
    default: ({
        onSubmit,
        onSendOtp,
        error,
    }: {
        onSubmit: (code: string) => void
        onSendOtp: () => void
        error?: string
    }) => (
        <div>
            <button data-testid="send" onClick={onSendOtp}>
                send
            </button>
            <button data-testid="submit" onClick={() => onSubmit('000000')}>
                submit
            </button>
            {error && <div data-testid="error">{error}</div>}
        </div>
    ),
}))
vi.mock('@features/auth/components/steps/SmsOtpStep', () => ({
    default: ({
        onSubmit,
        onSendOtp,
        error,
    }: {
        onSubmit: (code: string) => void
        onSendOtp: () => void
        error?: string
    }) => (
        <div>
            <button data-testid="send" onClick={onSendOtp}>
                send
            </button>
            <button data-testid="submit" onClick={() => onSubmit('000000')}>
                submit
            </button>
            {error && <div data-testid="error">{error}</div>}
        </div>
    ),
}))
vi.mock('@features/auth/components/steps/QrCodeStep', () => ({
    default: ({
        onSubmit,
        userId,
        error,
    }: {
        onSubmit: (token: string) => void
        userId?: string
        error?: string
    }) => (
        <div>
            <span data-testid="user-id">{userId}</span>
            <button
                data-testid="submit"
                onClick={() => onSubmit('wrong-token')}
            >
                submit
            </button>
            {error && <div data-testid="error">{error}</div>}
        </div>
    ),
}))

vi.mock('@features/auth/hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'admin-uuid-1' },
        isAuthenticated: true,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
    }),
}))

import EmailOtpPuzzle from '../puzzles/EmailOtpPuzzle'
import SmsPuzzle from '../puzzles/SmsPuzzle'
import TotpPuzzle from '../puzzles/TotpPuzzle'
import QrCodePuzzle from '../puzzles/QrCodePuzzle'

describe('Server-mediated auth method puzzles (USER-BUG-5)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('TotpPuzzle', () => {
        it('calls verifyMethod with TOTP and surfaces a real error on wrong code', async () => {
            verifyMethodMock.mockResolvedValueOnce({
                success: false,
                message: 'Verification failed for TOTP',
            })
            const onSuccess = vi.fn()
            render(
                <TotpPuzzle
                    onSuccess={onSuccess}
                    onError={vi.fn()}
                    onClose={vi.fn()}
                />,
            )
            fireEvent.click(screen.getByTestId('submit'))
            await waitFor(() => {
                expect(verifyMethodMock).toHaveBeenCalledWith('TOTP', {
                    code: '000000',
                })
            })
            expect(onSuccess).not.toHaveBeenCalled()
            expect(await screen.findByTestId('error')).toHaveTextContent(
                'Verification failed for TOTP',
            )
        })

        it('reports onSuccess when the server confirms the code', async () => {
            verifyMethodMock.mockResolvedValueOnce({ success: true })
            const onSuccess = vi.fn()
            render(
                <TotpPuzzle
                    onSuccess={onSuccess}
                    onError={vi.fn()}
                    onClose={vi.fn()}
                />,
            )
            fireEvent.click(screen.getByTestId('submit'))
            await waitFor(() => expect(onSuccess).toHaveBeenCalled())
        })
    })

    describe('EmailOtpPuzzle', () => {
        it('calls sendEmailOtp when the user requests a code', async () => {
            sendEmailOtpMock.mockResolvedValueOnce({ masked: 'abc***@x.com' })
            render(
                <EmailOtpPuzzle
                    onSuccess={vi.fn()}
                    onError={vi.fn()}
                    onClose={vi.fn()}
                />,
            )
            fireEvent.click(screen.getByTestId('send'))
            await waitFor(() => expect(sendEmailOtpMock).toHaveBeenCalled())
        })

        it('surfaces a real error on wrong code', async () => {
            verifyMethodMock.mockResolvedValueOnce({
                success: false,
                message: 'Invalid or expired verification code',
            })
            const onSuccess = vi.fn()
            render(
                <EmailOtpPuzzle
                    onSuccess={onSuccess}
                    onError={vi.fn()}
                    onClose={vi.fn()}
                />,
            )
            fireEvent.click(screen.getByTestId('submit'))
            await waitFor(() =>
                expect(verifyMethodMock).toHaveBeenCalledWith('EMAIL_OTP', {
                    code: '000000',
                }),
            )
            expect(onSuccess).not.toHaveBeenCalled()
            expect(await screen.findByTestId('error')).toHaveTextContent(
                'Invalid or expired verification code',
            )
        })
    })

    describe('SmsPuzzle', () => {
        it('calls sendSmsOtp when the user requests a code', async () => {
            sendSmsOtpMock.mockResolvedValueOnce({ masked: '***1234' })
            render(
                <SmsPuzzle
                    onSuccess={vi.fn()}
                    onError={vi.fn()}
                    onClose={vi.fn()}
                />,
            )
            fireEvent.click(screen.getByTestId('send'))
            await waitFor(() => expect(sendSmsOtpMock).toHaveBeenCalled())
        })

        it('surfaces a real error on wrong code', async () => {
            verifyMethodMock.mockResolvedValueOnce({
                success: false,
                message: 'Verification failed for SMS_OTP',
            })
            const onSuccess = vi.fn()
            render(
                <SmsPuzzle
                    onSuccess={onSuccess}
                    onError={vi.fn()}
                    onClose={vi.fn()}
                />,
            )
            fireEvent.click(screen.getByTestId('submit'))
            await waitFor(() =>
                expect(verifyMethodMock).toHaveBeenCalledWith('SMS_OTP', {
                    code: '000000',
                }),
            )
            expect(onSuccess).not.toHaveBeenCalled()
            expect(await screen.findByTestId('error')).toBeInTheDocument()
        })
    })

    describe('QrCodePuzzle', () => {
        it('passes the logged-in admin id to the QR step', () => {
            generateQrTokenMock.mockResolvedValue({
                token: 'qr-token-1',
                expiresInSeconds: 300,
            })
            render(
                <QrCodePuzzle
                    onSuccess={vi.fn()}
                    onError={vi.fn()}
                    onClose={vi.fn()}
                />,
            )
            expect(screen.getByTestId('user-id')).toHaveTextContent(
                'admin-uuid-1',
            )
        })

        it('surfaces a real error when the server rejects the token', async () => {
            generateQrTokenMock.mockResolvedValue({
                token: 'qr-token-1',
                expiresInSeconds: 300,
            })
            verifyMethodMock.mockResolvedValueOnce({
                success: false,
                message: 'Verification failed for QR_CODE',
            })
            const onSuccess = vi.fn()
            render(
                <QrCodePuzzle
                    onSuccess={onSuccess}
                    onError={vi.fn()}
                    onClose={vi.fn()}
                />,
            )
            fireEvent.click(screen.getByTestId('submit'))
            await waitFor(() =>
                expect(verifyMethodMock).toHaveBeenCalledWith('QR_CODE', {
                    token: 'wrong-token',
                }),
            )
            expect(onSuccess).not.toHaveBeenCalled()
            expect(await screen.findByTestId('error')).toBeInTheDocument()
        })
    })
})
