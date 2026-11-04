/**
 * LoginMfaFlow (hosted verify app) — FACE_IMAGE_REQUIRED is NON-terminal (gap Ü2).
 *
 * identity in ENFORCE answers an unpaired face embedding with
 * `{ status: 'FACE_IMAGE_REQUIRED' }`. The hosted flow must treat it as "retry
 * pending": no `widget.verificationFailed` error, no onComplete, the FACE step
 * stays mounted, and the response is handed back to the shared MfaStepRenderer
 * (which re-sends the captured frame). The flow enters the FACE step through
 * `initialContinuation`; MfaStepRenderer is mocked to expose verifyStep.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import '../../i18n'
import type { MfaStepResponse } from '@domain/interfaces/IAuthRepository'

vi.mock('@/lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: { getInstance: () => ({ initialize: () => Promise.resolve() }) },
}))

const mockVerifyMfaStep = vi.fn()
const authRepoStub = {
    login: vi.fn(),
    beginIdentifierLogin: vi.fn(),
    verifyMfaStep: mockVerifyMfaStep,
    checkLoginEligibility: vi.fn().mockResolvedValue(undefined),
}
vi.mock('@app/providers', () => ({
    useService: (type: symbol) =>
        String(type).includes('AuthRepository') ? authRepoStub : { post: vi.fn(), get: vi.fn() },
}))

type VerifyStep = (method: string, data: Record<string, unknown>) => Promise<MfaStepResponse | undefined>
const captured: { verifyStep?: VerifyStep; method?: string } = {}
vi.mock('@features/auth/login-shared/MfaStepRenderer', () => ({
    __esModule: true,
    default: (props: { verifyStep: VerifyStep; method: string; error?: string }) => {
        captured.verifyStep = props.verifyStep
        captured.method = props.method
        return <div data-testid="step-error">{props.error ?? ''}</div>
    },
}))

import LoginMfaFlow from '../LoginMfaFlow'

const continuation = {
    mfaSessionToken: 'sess-1',
    currentStep: 2,
    totalSteps: 2,
    completedMethods: ['PASSWORD'],
    availableMethods: [
        { methodType: 'FACE', name: 'Face', category: 'BIOMETRIC', enrolled: true, preferred: true, requiresEnrollment: false },
    ],
}

function renderFlow() {
    const onComplete = vi.fn()
    render(
        <LoginMfaFlow
            clientId="c1"
            onComplete={onComplete}
            onCancel={vi.fn()}
            initialContinuation={continuation as unknown as Parameters<typeof LoginMfaFlow>[0]['initialContinuation']}
        />,
    )
    return { onComplete }
}

describe('LoginMfaFlow — FACE_IMAGE_REQUIRED (gap Ü2)', () => {
    beforeEach(() => {
        mockVerifyMfaStep.mockReset()
        captured.verifyStep = undefined
        captured.method = undefined
    })

    it('is non-terminal: no error, no onComplete, FACE step stays, response returned', async () => {
        mockVerifyMfaStep.mockResolvedValue({ status: 'FACE_IMAGE_REQUIRED', requiredInput: 'image' })
        const { onComplete } = renderFlow()
        await waitFor(() => expect(captured.verifyStep).toBeDefined())
        expect(captured.method).toBe('FACE')

        let res: MfaStepResponse | undefined
        await act(async () => {
            res = await captured.verifyStep!('FACE', { embedding: [0.1] })
        })

        expect(res?.status).toBe('FACE_IMAGE_REQUIRED')
        expect(onComplete).not.toHaveBeenCalled()
        expect(captured.method).toBe('FACE')
        expect(screen.getByTestId('step-error')).toHaveTextContent('')
    })

    it('contrast: FAILED still shows the verification-failed error', async () => {
        mockVerifyMfaStep.mockResolvedValue({ status: 'FAILED' })
        renderFlow()
        await waitFor(() => expect(captured.verifyStep).toBeDefined())

        await act(async () => {
            await captured.verifyStep!('FACE', { image: 'x' })
        })

        expect(screen.getByTestId('step-error').textContent).not.toBe('')
    })
})
