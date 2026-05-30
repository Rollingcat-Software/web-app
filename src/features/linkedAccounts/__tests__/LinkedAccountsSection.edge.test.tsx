/**
 * LinkedAccountsSection — additional EDGE cases not covered by the base spec:
 *  - ZERO memberships → "no memberships" empty-state (section renders, no table)
 *  - MANY memberships → all rows render, one Unlink per foreign membership
 *  - unlink CANCEL → unlink() never called, dialog closes
 *  - unlink ERROR → error snackbar via formatApiError, no crash, refetch NOT called
 *  - load error → soft-fail alert (section visible, not crashed)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@/i18n'

const initiateLink = vi.fn().mockResolvedValue(undefined)
const confirmLink = vi.fn().mockResolvedValue(undefined)
const unlink = vi.fn().mockResolvedValue(undefined)
const refetch = vi.fn().mockResolvedValue(undefined)

let mockState: { data: unknown; loading: boolean; error: string | null }

vi.mock('../useLinkedAccounts', () => ({
    useLinkedAccounts: () => ({ ...mockState, refetch, initiateLink, confirmLink, unlink }),
}))

import LinkedAccountsSection from '../LinkedAccountsSection'

function meWith(memberships: unknown[]) {
    return {
        identityId: 'id-1',
        emails: [{ email: 'me@fivucsas.com', verified: true }],
        memberships,
    }
}

describe('LinkedAccountsSection — edge cases', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockState = { loading: false, error: null, data: meWith([]) }
    })

    it('renders the empty-state when there are ZERO memberships (no table)', () => {
        render(<LinkedAccountsSection currentUserId="u-self" />)
        // No table rows / Unlink buttons; the "no memberships" copy is shown.
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Unlink/i })).not.toBeInTheDocument()
    })

    it('renders MANY memberships, one Unlink per FOREIGN membership only', () => {
        mockState.data = meWith([
            { userId: 'u-self', tenantId: 't1', tenantName: 'Home', role: 'TENANT_ADMIN', isActive: true },
            { userId: 'u-2', tenantId: 't2', tenantName: 'Marmara', role: 'TENANT_MEMBER', isActive: true },
            { userId: 'u-3', tenantId: 't3', tenantName: 'Acme', role: 'USER', isActive: false },
            { userId: 'u-4', tenantId: 't4', tenantName: 'Globex', role: 'USER', isActive: true },
        ])
        render(<LinkedAccountsSection currentUserId="u-self" />)
        expect(screen.getByText('Marmara')).toBeInTheDocument()
        expect(screen.getByText('Acme')).toBeInTheDocument()
        expect(screen.getByText('Globex')).toBeInTheDocument()
        // 3 foreign memberships → 3 Unlink buttons (self has none).
        expect(screen.getAllByRole('button', { name: /Unlink/i })).toHaveLength(3)
    })

    it('CANCEL on the unlink confirmation does not call unlink()', async () => {
        mockState.data = meWith([
            { userId: 'u-self', tenantId: 't1', tenantName: 'Home', role: 'TENANT_ADMIN', isActive: true },
            { userId: 'u-2', tenantId: 't2', tenantName: 'Marmara', role: 'TENANT_MEMBER', isActive: true },
        ])
        render(<LinkedAccountsSection currentUserId="u-self" />)
        fireEvent.click(screen.getByRole('button', { name: /Unlink/i }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: /Cancel/i }))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(unlink).not.toHaveBeenCalled()
    })

    it('unlink ERROR surfaces an error snackbar and does NOT refetch', async () => {
        unlink.mockRejectedValueOnce({ response: { status: 500 } })
        mockState.data = meWith([
            { userId: 'u-self', tenantId: 't1', tenantName: 'Home', role: 'TENANT_ADMIN', isActive: true },
            { userId: 'u-2', tenantId: 't2', tenantName: 'Marmara', role: 'TENANT_MEMBER', isActive: true },
        ])
        render(<LinkedAccountsSection currentUserId="u-self" />)
        fireEvent.click(screen.getByRole('button', { name: /Unlink/i }))
        const dialog = await screen.findByRole('dialog')
        const confirmBtns = within(dialog).getAllByRole('button', { name: /Unlink/i })
        fireEvent.click(confirmBtns[confirmBtns.length - 1])

        await waitFor(() => expect(unlink).toHaveBeenCalledWith('u-2'))
        // Error snackbar appears; on failure we do NOT refetch (no false success).
        await waitFor(() => expect(screen.getByText(/server error|unexpected/i)).toBeInTheDocument())
        expect(refetch).not.toHaveBeenCalled()
    })

    it('keeps the section usable (soft-fail alert) on a load error', () => {
        mockState = { loading: false, error: 'loadError', data: null }
        render(<LinkedAccountsSection />)
        // Section did not crash; the load-error alert is shown and the Link
        // button is still present.
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Link another account/i })).toBeInTheDocument()
    })
})
