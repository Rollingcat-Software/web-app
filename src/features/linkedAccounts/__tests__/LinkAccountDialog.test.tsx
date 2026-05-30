/**
 * LinkAccountDialog — Phase-2 two-step link dialog (edge cases).
 *
 * Focuses on the FAILURE paths, which the section-level test does not exercise:
 *  - initiate failure (e.g. same-tenant link blocked, 422) → error Alert, stays
 *    on the email step (no advance to confirm)
 *  - confirm wrong-OTP (422) → error Alert, stays on the confirm step
 *  - confirm step-up wrong-password (401) → error Alert via formatApiError
 *  - the Back button returns to the email step
 *  - none of these crash the dialog.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@/i18n'

import LinkAccountDialog from '../LinkAccountDialog'

function setup(overrides: Partial<{
    initiateLink: ReturnType<typeof vi.fn>
    confirmLink: ReturnType<typeof vi.fn>
    onLinked: ReturnType<typeof vi.fn>
    onClose: ReturnType<typeof vi.fn>
}> = {}) {
    const initiateLink = overrides.initiateLink ?? vi.fn().mockResolvedValue(undefined)
    const confirmLink = overrides.confirmLink ?? vi.fn().mockResolvedValue(undefined)
    const onLinked = overrides.onLinked ?? vi.fn()
    const onClose = overrides.onClose ?? vi.fn()
    render(
        <LinkAccountDialog
            open
            onClose={onClose}
            onLinked={onLinked}
            initiateLink={initiateLink}
            confirmLink={confirmLink}
        />,
    )
    return { initiateLink, confirmLink, onLinked, onClose }
}

async function advanceToConfirm(initiateLink: ReturnType<typeof vi.fn>) {
    fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'new@acme.test' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Send code/i }))
    await waitFor(() => expect(initiateLink).toHaveBeenCalled())
    await screen.findByLabelText(/Verification code/i)
}

describe('LinkAccountDialog — edge cases', () => {
    beforeEach(() => vi.clearAllMocks())

    it('same-tenant / already-exists initiate 422 → error Alert, stays on email step', async () => {
        const initiateLink = vi
            .fn()
            .mockRejectedValue({ response: { status: 422, data: { message: 'Cannot link an account in the same tenant' } } })
        setup({ initiateLink })
        fireEvent.change(screen.getByLabelText(/Email address/i), {
            target: { value: 'same@tenant.test' },
        })
        fireEvent.click(screen.getByRole('button', { name: /Send code/i }))

        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
        // Did NOT advance: no OTP field present.
        expect(screen.queryByLabelText(/Verification code/i)).not.toBeInTheDocument()
    })

    it('409 account-already-exists on initiate surfaces a non-empty, non-raw message', async () => {
        const initiateLink = vi
            .fn()
            .mockRejectedValue({ response: { status: 409, data: {} } })
        setup({ initiateLink })
        fireEvent.change(screen.getByLabelText(/Email address/i), {
            target: { value: 'dupe@acme.test' },
        })
        fireEvent.click(screen.getByRole('button', { name: /Send code/i }))
        const alert = await screen.findByRole('alert')
        // formatApiError(409) → errors.conflict; never a leaked err.message.
        expect(alert.textContent).toMatch(/exists|conflict|zaten/i)
        expect(alert.textContent).not.toMatch(/status code/i)
    })

    it('wrong OTP (422) on confirm → error Alert, stays on confirm step', async () => {
        const confirmLink = vi
            .fn()
            .mockRejectedValue({ response: { status: 422, data: { errorCode: 'INVALID_OTP' } } })
        const { initiateLink } = setup({ confirmLink })
        await advanceToConfirm(initiateLink)

        fireEvent.change(screen.getByLabelText(/Verification code/i), { target: { value: '000000' } })
        fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'pw' } })
        fireEvent.click(screen.getByRole('button', { name: /Confirm link/i }))

        await waitFor(() => expect(confirmLink).toHaveBeenCalled())
        // 422 with an unmapped errorCode → errors.validation copy. (The confirm
        // step also shows an info "Code sent" alert, so assert on the error TEXT
        // rather than the ambiguous alert role.)
        await waitFor(() => expect(screen.getByText(/check the form for errors/i)).toBeInTheDocument())
        // Still on confirm step — OTP field remains.
        expect(screen.getByLabelText(/Verification code/i)).toBeInTheDocument()
    })

    it('step-up wrong password (401) on confirm → error Alert via formatApiError', async () => {
        const confirmLink = vi
            .fn()
            .mockRejectedValue({ response: { status: 401 }, config: { url: '/identity/link/confirm' } })
        const { initiateLink } = setup({ confirmLink })
        await advanceToConfirm(initiateLink)

        fireEvent.change(screen.getByLabelText(/Verification code/i), { target: { value: '123456' } })
        fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'wrong' } })
        fireEvent.click(screen.getByRole('button', { name: /Confirm link/i }))

        // 401 on a non-login path → errors.unauthorized (session expired) copy.
        const errorText = await screen.findByText(/session has expired/i)
        expect(errorText).toBeInTheDocument()
        expect(errorText.textContent).not.toMatch(/status code/i)
    })

    it('Back returns from confirm to the email step', async () => {
        const { initiateLink } = setup()
        await advanceToConfirm(initiateLink)
        fireEvent.click(screen.getByRole('button', { name: /Back/i }))
        // Email input is back.
        expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument()
        expect(screen.queryByLabelText(/Verification code/i)).not.toBeInTheDocument()
    })

    it('happy path calls onLinked after a successful confirm', async () => {
        const onLinked = vi.fn()
        const { initiateLink } = setup({ onLinked })
        await advanceToConfirm(initiateLink)
        fireEvent.change(screen.getByLabelText(/Verification code/i), { target: { value: '123456' } })
        fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'pw' } })
        fireEvent.click(screen.getByRole('button', { name: /Confirm link/i }))
        await waitFor(() => expect(onLinked).toHaveBeenCalled())
    })

    it('Send code is disabled until an email is entered', () => {
        setup()
        expect(screen.getByRole('button', { name: /Send code/i })).toBeDisabled()
    })
})
