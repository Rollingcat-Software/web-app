/**
 * QrCodeStep — Fix #2 (2026-06-03): the QR_CODE MFA factor must NOT auto-fill +
 * instant-submit the token it generates.
 *
 * Before the fix, the step called `onGenerateToken` on mount, displayed the
 * token as a QR, AND auto-filled the SAME token into the verification input.
 * Clicking Verify then submitted the server's own freshly-issued token — no
 * separate-device possession proof, so the step always self-passed.
 *
 * This locks the safer behaviour: after generation the verification input stays
 * EMPTY (so Verify is disabled) until the user enters a token read from another
 * device. A manually-entered token still submits normally.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '../../../../../i18n'
import QrCodeStep from '../QrCodeStep'

const onGenerateToken = vi.fn()
const onSubmit = vi.fn()

beforeEach(() => {
    onGenerateToken.mockReset()
    onSubmit.mockReset()
    onGenerateToken.mockResolvedValue({ token: 'SERVER-ISSUED-TOKEN', expiresInSeconds: 120 })
})

function renderStep() {
    return render(
        <QrCodeStep
            userId="mfa-session"
            onGenerateToken={onGenerateToken}
            onSubmit={onSubmit}
            loading={false}
        />,
    )
}

describe('QrCodeStep — no self-verification (Fix #2)', () => {
    it('generates a token on mount but does NOT auto-fill it into the verification input', async () => {
        renderStep()
        await waitFor(() => expect(onGenerateToken).toHaveBeenCalledTimes(1))

        // The input must stay empty — the generated token is not pre-filled.
        const input = screen.getByLabelText(/authentication token/i) as HTMLInputElement
        await waitFor(() => expect(input.value).toBe(''))
        expect(input.value).not.toContain('SERVER-ISSUED-TOKEN')
    })

    it('keeps the Verify button disabled until a token is entered (cannot self-complete)', async () => {
        renderStep()
        await waitFor(() => expect(onGenerateToken).toHaveBeenCalled())

        const verifyBtn = screen.getByRole('button', { name: /verify|doğrula/i })
        expect(verifyBtn).toBeDisabled()

        // The user reads the code off a SEPARATE device and types it in.
        const input = screen.getByLabelText(/authentication token/i)
        fireEvent.change(input, { target: { value: 'CODE-FROM-OTHER-DEVICE' } })
        await waitFor(() => expect(verifyBtn).not.toBeDisabled())

        fireEvent.click(verifyBtn)
        expect(onSubmit).toHaveBeenCalledWith('CODE-FROM-OTHER-DEVICE')
    })
})
