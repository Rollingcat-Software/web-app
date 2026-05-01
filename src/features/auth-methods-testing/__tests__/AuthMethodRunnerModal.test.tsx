import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuthMethodRunnerModal from '../AuthMethodRunnerModal'
import { AUTH_METHOD_REGISTRY } from '../authMethodRegistry'
import { AuthMethodType } from '@domain/models/AuthMethod'

// i18n — return the key as-is so assertions are deterministic.
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Trans: ({ children }: { children: React.ReactNode }) => children,
}))

// The puzzles now talk to real backends through this hook. Replace it with a
// fake whose `submit*` methods always succeed so the modal's orchestration
// remains the focus of these tests.
vi.mock('../puzzles/useAuthMethodPuzzleApi', () => ({
    useAuthMethodPuzzleApi: () => ({
        submitFace: vi.fn().mockResolvedValue({ kind: 'success' }),
        submitVoice: vi.fn().mockResolvedValue({ kind: 'success' }),
        submitNfc: vi.fn().mockResolvedValue({ kind: 'success' }),
        requestWebAuthnChallenge: vi.fn().mockResolvedValue(null),
        submitWebAuthnAssertion: vi.fn().mockResolvedValue({ kind: 'success' }),
    }),
}))

// AuthMethodModeProvider now resolves the real IAuthRepository via DI.
// Tests don't exercise that path — return a stand-in object so the
// provider can render without a configured DI container.
vi.mock('@app/providers', () => ({
    useService: vi.fn(() => ({})),
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

    it('mounts FaceCaptureStep when the face method is opened', () => {
        const onClose = vi.fn()
        const method = AUTH_METHOD_REGISTRY[AuthMethodType.FACE]
        expect(method).toBeDefined()

        render(
            <AuthMethodRunnerModal method={method!} open={true} onClose={onClose} />,
        )

        expect(screen.getByText('face-step')).toBeInTheDocument()
        expect(
            screen.getByText('authMethodsTesting.methods.face.title'),
        ).toBeInTheDocument()
    })

    it('transitions to success when the puzzle reports a server-confirmed verdict', async () => {
        const onClose = vi.fn()
        const method = AUTH_METHOD_REGISTRY[AuthMethodType.FACE]
        render(
            <AuthMethodRunnerModal
                method={method!}
                open={true}
                onClose={onClose}
            />,
        )

        // Trigger the step's onSubmit. The mocked puzzle API resolves
        // synchronously with kind=success — no setTimeout is involved any
        // more (regression guard for USER-BUG-5).
        fireEvent.click(screen.getByTestId('mock-face-submit'))

        await waitFor(() => {
            expect(
                screen.getByText('authMethodsTesting.successMessage'),
            ).toBeInTheDocument()
        })
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
})
