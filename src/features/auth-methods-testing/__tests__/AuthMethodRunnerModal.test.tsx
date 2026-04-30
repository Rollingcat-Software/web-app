import { Component, useEffect, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import AuthMethodRunnerModal from '../AuthMethodRunnerModal'
import { AUTH_METHOD_REGISTRY } from '../authMethodRegistry'
import { AuthMethodType } from '@domain/models/AuthMethod'

/**
 * Test-only error boundary used to assert the modal forwards a renderer crash
 * to its handleError callback. The runner itself doesn't catch (lazy-load
 * means a Suspense boundary is the only React-supplied wrapper) — wrapping
 * the modal lets us drive the `error` UI path deterministically.
 */
class TestErrorBoundary extends Component<
    { onError: (err: Error) => void; children: ReactNode },
    { hasError: boolean }
> {
    state = { hasError: false }
    static getDerivedStateFromError() {
        return { hasError: true }
    }
    componentDidCatch(err: Error) {
        this.props.onError(err)
    }
    render() {
        if (this.state.hasError) return <div data-testid="boundary-fallback" />
        return this.props.children
    }
}

// i18n — return the key as-is so assertions are deterministic.
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}))

// Replace heavy step components with lightweight stand-ins that expose a
// "succeed" button we can click. This keeps the test focused on the modal's
// orchestration, not on camera / ML / WebAuthn plumbing.
vi.mock('@features/auth/components/steps/FaceCaptureStep', () => ({
    default: ({ onSubmit }: { onSubmit: (img: string) => void }) => (
        <button
            type="button"
            data-testid="mock-face-submit"
            onClick={() => onSubmit('face-mock-image')}
        >
            face-step
        </button>
    ),
}))
vi.mock('@features/auth/components/steps/VoiceStep', () => ({
    default: () => <div>voice-step</div>,
}))
vi.mock('@features/auth/components/steps/FingerprintStep', () => ({
    default: () => <div>fingerprint-step</div>,
}))
vi.mock('@features/auth/components/steps/NfcStep', () => ({
    default: () => <div>nfc-step</div>,
}))
vi.mock('@features/auth/components/steps/TotpStep', () => ({
    default: () => <div>totp-step</div>,
}))
vi.mock('@features/auth/components/steps/SmsOtpStep', () => ({
    default: () => <div>sms-step</div>,
}))
vi.mock('@features/auth/components/steps/EmailOtpStep', () => ({
    default: () => <div>email-step</div>,
}))
vi.mock('@features/auth/components/steps/QrCodeStep', () => ({
    default: () => <div>qr-step</div>,
}))
vi.mock('@features/auth/components/steps/HardwareKeyStep', () => ({
    default: () => <div>hardware-step</div>,
}))

describe('AuthMethodRunnerModal', () => {
    it('renders nothing when method is null', () => {
        const onClose = vi.fn()
        const { container } = render(
            <AuthMethodRunnerModal method={null} open={false} onClose={onClose} />,
        )
        expect(container.firstChild).toBeNull()
    })

    it('mounts FaceCaptureStep when the face method is opened', async () => {
        const onClose = vi.fn()
        const method = AUTH_METHOD_REGISTRY[AuthMethodType.FACE]
        expect(method).toBeDefined()

        render(
            <AuthMethodRunnerModal method={method!} open={true} onClose={onClose} />,
        )

        // Lazy-loaded chunk — wait for Suspense to resolve.
        expect(await screen.findByText('face-step')).toBeInTheDocument()
        expect(
            screen.getByText('authMethodsTesting.methods.face.title'),
        ).toBeInTheDocument()
    })

    it('transitions to success when the stubbed step resolves', async () => {
        const onClose = vi.fn()
        const method = AUTH_METHOD_REGISTRY[AuthMethodType.FACE]
        render(
            <AuthMethodRunnerModal
                method={method!}
                open={true}
                onClose={onClose}
            />,
        )

        // Lazy chunk must resolve before we can drive the stubbed submit.
        const submitButton = await screen.findByTestId('mock-face-submit')

        // FacePuzzle wrapper waits ~500ms before reporting success — let
        // real timers run so we don't race with the lazy import resolution.
        fireEvent.click(submitButton)

        await act(async () => {
            await new Promise((r) => setTimeout(r, 750))
        })

        expect(
            screen.getByText('authMethodsTesting.successMessage'),
        ).toBeInTheDocument()
        // Retry button appears in the success state.
        expect(
            screen.getByText('authMethodsTesting.tryAgainButton'),
        ).toBeInTheDocument()
    })

    it('invokes onClose when the close button is clicked', () => {
        const onClose = vi.fn()
        const method = AUTH_METHOD_REGISTRY[AuthMethodType.TOTP]
        render(
            <AuthMethodRunnerModal method={method!} open={true} onClose={onClose} />,
        )

        // There are two "close"-labelled buttons (header icon + footer button).
        // Clicking either should call onClose; we pick the footer button.
        const closeButtons = screen.getAllByRole('button', {
            name: 'authMethodsTesting.closeButton',
        })
        expect(closeButtons.length).toBeGreaterThan(0)
        fireEvent.click(closeButtons[closeButtons.length - 1])

        expect(onClose).toHaveBeenCalled()
    })

    /**
     * handleError path — addresses TODO_POST_AUDIT_2026-04-24 web-app #29
     * "Error-path test missing for handleError".
     *
     * Two scenarios are covered:
     *   1. A puzzle wrapper invokes `props.onError(message)` (the normal way
     *      a stub or real component reports failure). The modal must
     *      transition to the `error` state and surface the supplied message.
     *   2. A puzzle component throws synchronously during render. Because
     *      the modal does not embed its own error boundary (lazy-loaded
     *      chunks rely on the route's `<ErrorBoundary>` ancestor in
     *      App.tsx), an outer test boundary verifies the throw bubbles up
     *      with the expected error.
     */
    describe('handleError', () => {
        it('switches to the error state when the puzzle calls onError', async () => {
            // Stub puzzle that calls props.onError once on mount — mirrors a
            // real puzzle reporting failure via the onError contract.
            const FailingPuzzle = ({
                onError,
            }: {
                onError: (msg: string) => void
            }) => {
                useEffect(() => {
                    onError('boom')
                }, [onError])
                return <div data-testid="failing-puzzle">failing</div>
            }

            const onClose = vi.fn()
            // Inject the failing component directly — bypasses the registry's
            // lazy() wrapper so we can drive the error path synchronously.
            const method = {
                ...AUTH_METHOD_REGISTRY[AuthMethodType.EMAIL_OTP]!,
                component: FailingPuzzle,
            }

            render(
                <AuthMethodRunnerModal
                    method={method}
                    open={true}
                    onClose={onClose}
                />,
            )

            // Error message was passed through handleError → error UI.
            expect(await screen.findByText('boom')).toBeInTheDocument()
            // Retry button is only rendered in the error / success states.
            expect(
                screen.getByText('authMethodsTesting.tryAgainButton'),
            ).toBeInTheDocument()
        })

        it('lets a renderer crash bubble to an outer error boundary', () => {
            const onBoundaryError = vi.fn()
            const ThrowingPuzzle = () => {
                throw new Error('puzzle render failed')
            }

            const onClose = vi.fn()
            const method = {
                ...AUTH_METHOD_REGISTRY[AuthMethodType.TOTP]!,
                component: ThrowingPuzzle,
            }

            // Silence the expected React error log noise.
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {})
            try {
                render(
                    <TestErrorBoundary onError={onBoundaryError}>
                        <AuthMethodRunnerModal
                            method={method}
                            open={true}
                            onClose={onClose}
                        />
                    </TestErrorBoundary>,
                )

                expect(onBoundaryError).toHaveBeenCalledTimes(1)
                const reported = onBoundaryError.mock.calls[0][0] as Error
                expect(reported.message).toBe('puzzle render failed')
            } finally {
                errorSpy.mockRestore()
            }
        })
    })
})
