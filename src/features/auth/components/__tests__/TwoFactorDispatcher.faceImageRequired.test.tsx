/**
 * TwoFactorDispatcher — FACE_IMAGE_REQUIRED is NON-terminal (gap Ü2).
 *
 * identity in ENFORCE answers an unpaired face embedding with
 * `{ status: 'FACE_IMAGE_REQUIRED' }`. The dashboard surface must treat it as
 * "retry pending": no `mfa.verificationFailed` error, no onAuthenticated, and the
 * response is handed back to the shared MfaStepRenderer (which re-sends the
 * captured frame). MfaStepRenderer is mocked to expose the verifyStep prop.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import '../../../../i18n'
import type { MfaStepResponse } from '@domain/interfaces/IAuthRepository'

vi.mock('@/lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: { getInstance: () => ({ initialize: () => Promise.resolve() }) },
}))

const mockVerifyMfaStep = vi.fn()
vi.mock('@app/providers', () => ({
    useService: (type: symbol) =>
        String(type).includes('AuthRepository')
            ? { verifyMfaStep: mockVerifyMfaStep }
            : { post: vi.fn(), get: vi.fn() },
}))

type VerifyStep = (method: string, data: Record<string, unknown>) => Promise<MfaStepResponse | undefined>
const captured: { verifyStep?: VerifyStep } = {}
vi.mock('@features/auth/login-shared/MfaStepRenderer', () => ({
    __esModule: true,
    default: (props: { verifyStep: VerifyStep; error?: string }) => {
        captured.verifyStep = props.verifyStep
        return <div data-testid="step-error">{props.error ?? ''}</div>
    },
}))

import TwoFactorDispatcher from '../TwoFactorDispatcher'

function renderDispatcher() {
    const onAuthenticated = vi.fn()
    render(
        <TwoFactorDispatcher
            method="FACE"
            mfaSessionToken="sess-1"
            onAuthenticated={onAuthenticated}
            onBackToMethodSelection={vi.fn()}
            onCancel={vi.fn()}
        />,
    )
    return { onAuthenticated }
}

describe('TwoFactorDispatcher — FACE_IMAGE_REQUIRED (gap Ü2)', () => {
    beforeEach(() => {
        mockVerifyMfaStep.mockReset()
        captured.verifyStep = undefined
    })

    it('is non-terminal: no error, no onAuthenticated, response returned to the renderer', async () => {
        mockVerifyMfaStep.mockResolvedValue({ status: 'FACE_IMAGE_REQUIRED', requiredInput: 'image' })
        const { onAuthenticated } = renderDispatcher()

        let res: MfaStepResponse | undefined
        await act(async () => {
            res = await captured.verifyStep!('FACE', { embedding: [0.1] })
        })

        expect(res?.status).toBe('FACE_IMAGE_REQUIRED')
        expect(onAuthenticated).not.toHaveBeenCalled()
        expect(screen.getByTestId('step-error')).toHaveTextContent('')
    })

    it('contrast: FAILED still shows the verification-failed error', async () => {
        mockVerifyMfaStep.mockResolvedValue({ status: 'FAILED' })
        renderDispatcher()

        await act(async () => {
            await captured.verifyStep!('FACE', { image: 'x' })
        })

        expect(screen.getByTestId('step-error').textContent).not.toBe('')
    })
})
