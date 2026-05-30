/**
 * BiometricConsentSection — Phase-3 per-tenant biometric consent UI (edge cases).
 *
 * Verifies the section renders the current-tenant toggle + granted list, shows
 * a loading spinner, and — the important edge case — surfaces a toggle FAILURE
 * (e.g. a 403 for a tenant the person has no membership in) via `formatApiError`
 * in an Alert, gracefully, without crashing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@/i18n'

const setConsent = vi.fn().mockResolvedValue(undefined)
const refetch = vi.fn().mockResolvedValue(undefined)

let mockState: {
    consents: Array<{
        id: string
        tenantId: string
        method: string | null
        granted: boolean
    }>
    loading: boolean
    saving: boolean
    error: unknown
}

vi.mock('../useBiometricConsents', () => ({
    useBiometricConsents: () => ({
        ...mockState,
        setConsent,
        refetch,
    }),
}))

import BiometricConsentSection from '../BiometricConsentSection'

describe('BiometricConsentSection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockState = { consents: [], loading: false, saving: false, error: null }
    })

    it('shows a spinner while loading', () => {
        mockState.loading = true
        render(<BiometricConsentSection currentTenantId="t-1" currentTenantName="Marmara" />)
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('renders the current-tenant toggle unchecked when no grant exists', () => {
        render(<BiometricConsentSection currentTenantId="t-1" currentTenantName="Marmara" />)
        const toggle = screen.getByRole('checkbox')
        expect(toggle).not.toBeChecked()
    })

    it('reflects an existing grant for the current tenant as CHECKED', () => {
        mockState.consents = [{ id: 'c1', tenantId: 't-1', method: null, granted: true }]
        render(<BiometricConsentSection currentTenantId="t-1" currentTenantName="Marmara" />)
        // First checkbox is the current-tenant toggle.
        const toggles = screen.getAllByRole('checkbox')
        expect(toggles[0]).toBeChecked()
    })

    it('renders the granted-tenants list when grants exist', () => {
        mockState.consents = [{ id: 'c1', tenantId: 't-other-uuid', method: null, granted: true }]
        render(<BiometricConsentSection currentTenantId="t-1" />)
        expect(screen.getByText(/t-other-uuid/)).toBeInTheDocument()
    })

    it('shows the empty-state copy when there are no consents and no current tenant', () => {
        render(<BiometricConsentSection />)
        // none-state string from biometricConsent.none
        expect(screen.getByText(/not granted biometric consent/i)).toBeInTheDocument()
    })

    it('toggling on calls setConsent(tenantId, true, null)', async () => {
        render(<BiometricConsentSection currentTenantId="t-1" currentTenantName="Marmara" />)
        fireEvent.click(screen.getByRole('checkbox'))
        await waitFor(() => expect(setConsent).toHaveBeenCalledWith('t-1', true, null))
    })

    it('surfaces a toggle 403 (no membership) via formatApiError in an Alert — no crash', async () => {
        setConsent.mockRejectedValueOnce({ response: { status: 403, data: { errorCode: 'FORBIDDEN' } } })
        render(<BiometricConsentSection currentTenantId="t-1" currentTenantName="Marmara" />)
        fireEvent.click(screen.getByRole('checkbox'))
        // formatApiError(403) → errors.forbidden copy rendered in the alert.
        await waitFor(() => {
            expect(screen.getByText(/permission|izniniz|forbidden/i)).toBeInTheDocument()
        })
    })

    it('surfaces a toggle 500 via formatApiError in an Alert', async () => {
        setConsent.mockRejectedValueOnce({ response: { status: 500 } })
        render(<BiometricConsentSection currentTenantId="t-1" currentTenantName="Marmara" />)
        fireEvent.click(screen.getByRole('checkbox'))
        await waitFor(() => {
            expect(screen.getByText(/server error|sunucu|unexpected/i)).toBeInTheDocument()
        })
    })
})
