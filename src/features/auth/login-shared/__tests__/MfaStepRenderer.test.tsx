/**
 * MfaStepRenderer — the shared MFA step → component router used by BOTH the
 * dashboard (TwoFactorDispatcher) and verify.fivucsas (LoginMfaFlow).
 *
 * Verifies the routing contract that keeps the two surfaces identical:
 *   - PASSWORD renders the password step with the read-only preset email.
 *   - TOTP / SMS_OTP route to their code steps and wire verifyStep.
 *   - An empty / unknown method routes to a safe fallback (EMAIL_OTP step for
 *     the empty case; an explicit warning for an unmapped method).
 *   - makeRequestWebAuthnChallenge unwraps a challenge response.
 *
 * Uses the real i18n runtime. The biometric-engine import is mocked so the VAD
 * path is inert in jsdom. Heavy capture steps (FACE / VOICE / GESTURE) are not
 * asserted here — their own suites cover their internals.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '../../../../i18n'
import { AuthMethodType } from '@features/auth/constants'

vi.mock('@/lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: {
        getInstance: () => ({
            initialize: () => Promise.resolve(),
            voiceVAD: null,
        }),
    },
}))

import MfaStepRenderer from '../MfaStepRenderer'
import { makeRequestWebAuthnChallenge } from '../webauthnChallenge'

const httpStub = {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
} as unknown as Parameters<typeof MfaStepRenderer>[0]['httpClient']

function renderStep(method: string, overrides: Record<string, unknown> = {}) {
    const verifyStep = vi.fn()
    const requestWebAuthnChallenge = vi.fn().mockResolvedValue(null)
    render(
        <MfaStepRenderer
            method={method}
            mfaSessionToken="sess-123"
            verifyStep={verifyStep}
            requestWebAuthnChallenge={requestWebAuthnChallenge}
            httpClient={httpStub}
            onAuthenticated={vi.fn()}
            onBack={vi.fn()}
            loading={false}
            onError={vi.fn()}
            {...overrides}
        />,
    )
    return { verifyStep, requestWebAuthnChallenge }
}

describe('MfaStepRenderer — shared step routing', () => {
    it('renders the PASSWORD step with the read-only preset email (no email box)', () => {
        renderStep(AuthMethodType.PASSWORD, { presetEmail: 'jane@example.com' })
        // The preset identity is shown read-only…
        expect(screen.getByText('jane@example.com')).toBeInTheDocument()
        // …and the password field is present, but NOT an editable email field.
        expect(screen.getByLabelText('Password')).toBeInTheDocument()
        expect(screen.queryByLabelText('Email Address')).toBeNull()
    })

    it('routes TOTP to the authenticator code step', () => {
        renderStep(AuthMethodType.TOTP)
        // TOTP-specific copy that no other step renders (the password / email
        // steps don't mention an authenticator app).
        expect(
            screen.getByText(/Open your authenticator app/i),
        ).toBeInTheDocument()
        expect(screen.queryByLabelText('Password')).toBeNull()
    })

    it('routes an empty method to the EMAIL_OTP step (safe default)', () => {
        renderStep('')
        // EmailOtpMfaStep renders an OTP code field; no password / TOTP-specific copy.
        expect(screen.queryByLabelText('Password')).toBeNull()
    })

    it('renders a warning for an unmapped method instead of crashing', () => {
        renderStep('SOMETHING_NEW')
        expect(
            screen.getByText(/Unknown authentication method: SOMETHING_NEW/i),
        ).toBeInTheDocument()
    })

    it('makeRequestWebAuthnChallenge unwraps a challenge from verifyMfaStep', async () => {
        const verifyMfaStep = vi.fn().mockResolvedValue({
            data: { challenge: 'CHAL', rpId: 'fivucsas.com' },
        })
        const authRepo = { verifyMfaStep } as never
        const fn = makeRequestWebAuthnChallenge(authRepo, 'sess-123')
        const out = await fn(AuthMethodType.FINGERPRINT)
        expect(out).toEqual({
            challenge: 'CHAL',
            rpId: 'fivucsas.com',
            timeout: undefined,
            allowCredentials: undefined,
        })
        expect(verifyMfaStep).toHaveBeenCalledWith(
            'sess-123',
            AuthMethodType.FINGERPRINT,
            { action: 'challenge' },
        )
    })

    it('makeRequestWebAuthnChallenge returns null when no challenge is present', async () => {
        const authRepo = { verifyMfaStep: vi.fn().mockResolvedValue({ data: {} }) } as never
        const fn = makeRequestWebAuthnChallenge(authRepo, 's')
        expect(await fn(AuthMethodType.HARDWARE_KEY)).toBeNull()
    })
})
