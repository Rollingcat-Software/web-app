/**
 * AccountSwitcher — Identity & Account-Linking Phase 5 (in-session membership
 * switch). Verifies the switcher renders the memberships from /identity/me and
 * that selecting a DIFFERENT membership calls switch-membership (which swaps the
 * session tokens), refreshes the auth context, and reloads.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@/i18n'

const switchMembership = vi.fn().mockResolvedValue(undefined)
const refetch = vi.fn().mockResolvedValue(undefined)
const refreshUser = vi.fn().mockResolvedValue(undefined)
const notifierSuccess = vi.fn()
const notifierError = vi.fn()

let mockState: {
    memberships: Array<{
        userId: string
        tenantId: string | null
        tenantName: string | null
        role: string | null
        isActive: boolean
    }>
    canSwitch: boolean
    loading: boolean
    switching: boolean
}

vi.mock('../useAccountSwitcher', () => ({
    useAccountSwitcher: () => ({
        ...mockState,
        data: null,
        refetch,
        switchMembership,
    }),
}))

vi.mock('@features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u-self' }, refreshUser }),
}))

vi.mock('@app/providers', () => ({
    useService: () => ({
        success: notifierSuccess,
        error: notifierError,
        warning: vi.fn(),
        info: vi.fn(),
    }),
}))

import AccountSwitcher from '../AccountSwitcher'

const TWO_MEMBERSHIPS = [
    { userId: 'u-self', tenantId: 't-1', tenantName: 'Fivucsas', role: 'TENANT_ADMIN', isActive: true },
    { userId: 'u-other', tenantId: 't-2', tenantName: 'Marmara', role: 'TENANT_MEMBER', isActive: true },
]

describe('AccountSwitcher', () => {
    const originalLocation = window.location

    beforeEach(() => {
        vi.clearAllMocks()
        mockState = {
            memberships: TWO_MEMBERSHIPS,
            canSwitch: true,
            loading: false,
            switching: false,
        }
        // jsdom forbids assigning window.location directly; stub the method.
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, assign: vi.fn() },
        })
    })

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: originalLocation,
        })
    })

    it('renders nothing while loading', () => {
        mockState.loading = true
        const { container } = render(<AccountSwitcher />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing when the person has a single membership', () => {
        mockState.canSwitch = false
        mockState.memberships = [TWO_MEMBERSHIPS[0]]
        const { container } = render(<AccountSwitcher />)
        expect(container).toBeEmptyDOMElement()
    })

    it('lists the memberships from /identity/me when there is more than one', () => {
        render(<AccountSwitcher />)
        fireEvent.click(screen.getByRole('button', { name: /switch account/i }))
        // Trigger shows the current tenant; menu lists both memberships.
        expect(screen.getAllByText('Fivucsas').length).toBeGreaterThan(0)
        expect(screen.getByText('Marmara')).toBeInTheDocument()
    })

    it('switches membership, refreshes context, and reloads on selecting another account', async () => {
        render(<AccountSwitcher />)
        fireEvent.click(screen.getByRole('button', { name: /switch account/i }))
        fireEvent.click(screen.getByText('Marmara'))

        await waitFor(() => {
            expect(switchMembership).toHaveBeenCalledWith('u-other')
        })
        expect(refreshUser).toHaveBeenCalled()
        expect(notifierSuccess).toHaveBeenCalled()
        expect(window.location.assign).toHaveBeenCalledWith('/')
    })

    it('surfaces an error via the notifier when the switch fails', async () => {
        switchMembership.mockRejectedValueOnce(new Error('boom'))
        render(<AccountSwitcher />)
        fireEvent.click(screen.getByRole('button', { name: /switch account/i }))
        fireEvent.click(screen.getByText('Marmara'))

        await waitFor(() => {
            expect(notifierError).toHaveBeenCalled()
        })
        expect(window.location.assign).not.toHaveBeenCalled()
    })
})
