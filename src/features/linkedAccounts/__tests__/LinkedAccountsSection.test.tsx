/**
 * LinkedAccountsSection — Phase-2 account linking UI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@/i18n'

const initiateLink = vi.fn().mockResolvedValue(undefined)
const confirmLink = vi.fn().mockResolvedValue(undefined)
const unlink = vi.fn().mockResolvedValue(undefined)
const refetch = vi.fn().mockResolvedValue(undefined)

let mockState: {
    data: unknown
    loading: boolean
    error: string | null
}

vi.mock('../useLinkedAccounts', () => ({
    useLinkedAccounts: () => ({
        ...mockState,
        refetch,
        initiateLink,
        confirmLink,
        unlink,
    }),
}))

import LinkedAccountsSection from '../LinkedAccountsSection'

describe('LinkedAccountsSection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockState = {
            loading: false,
            error: null,
            data: {
                identityId: 'id-1',
                emails: [
                    { email: 'caller@fivucsas.com', verified: true },
                    { email: 'me@marun.edu.tr', verified: true },
                ],
                memberships: [
                    { userId: 'u-self', tenantId: 't-1', tenantName: 'Fivucsas', role: 'TENANT_ADMIN', isActive: true },
                    { userId: 'u-other', tenantId: 't-2', tenantName: 'Marmara', role: 'TENANT_MEMBER', isActive: true },
                ],
            },
        }
    })

    it('renders the person view: emails and cross-tenant memberships', () => {
        render(<LinkedAccountsSection currentUserId="u-self" />)
        expect(screen.getByText('caller@fivucsas.com')).toBeInTheDocument()
        expect(screen.getByText('me@marun.edu.tr')).toBeInTheDocument()
        expect(screen.getByText('Fivucsas')).toBeInTheDocument()
        expect(screen.getByText('Marmara')).toBeInTheDocument()
    })

    it('does not offer Unlink on the caller\'s own membership', () => {
        render(<LinkedAccountsSection currentUserId="u-self" />)
        // Exactly one Unlink button — for the OTHER membership, not "This account".
        const unlinkButtons = screen.getAllByRole('button', { name: /Unlink/i })
        expect(unlinkButtons).toHaveLength(1)
    })

    it('runs the email → OTP → step-up link flow', async () => {
        render(<LinkedAccountsSection currentUserId="u-self" />)

        fireEvent.click(screen.getByRole('button', { name: /Link another account/i }))
        // Step 1: email
        const emailInput = screen.getByLabelText(/Email address/i)
        fireEvent.change(emailInput, { target: { value: 'new@acme.test' } })
        fireEvent.click(screen.getByRole('button', { name: /Send code/i }))
        await waitFor(() => expect(initiateLink).toHaveBeenCalledWith('new@acme.test'))

        // Step 2: OTP + password
        const otpInput = await screen.findByLabelText(/Verification code/i)
        fireEvent.change(otpInput, { target: { value: '123456' } })
        const pwInput = screen.getByLabelText(/Your current password/i)
        fireEvent.change(pwInput, { target: { value: 'caller-pass' } })
        fireEvent.click(screen.getByRole('button', { name: /Confirm link/i }))

        await waitFor(() =>
            expect(confirmLink).toHaveBeenCalledWith('new@acme.test', '123456', 'caller-pass')
        )
        await waitFor(() => expect(refetch).toHaveBeenCalled())
    })

    it('confirms and calls unlink for a foreign membership', async () => {
        render(<LinkedAccountsSection currentUserId="u-self" />)
        fireEvent.click(screen.getByRole('button', { name: /Unlink/i }))
        // Confirmation dialog → confirm
        const dialogButtons = await screen.findAllByRole('button', { name: /Unlink/i })
        fireEvent.click(dialogButtons[dialogButtons.length - 1])
        await waitFor(() => expect(unlink).toHaveBeenCalledWith('u-other'))
    })

    it('shows a load error when the hook reports one', () => {
        mockState = { loading: false, error: 'loadError', data: null }
        render(<LinkedAccountsSection />)
        expect(screen.getByRole('alert')).toBeInTheDocument()
    })
})
