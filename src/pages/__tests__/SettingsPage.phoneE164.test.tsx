/**
 * RTL test — SettingsPage phone E.164 wiring (USER-BUG-4 follow-up part 2).
 *
 * Locks in two contracts:
 *   1. Typing `5551234567` immediately renders as `+905551234567` (the
 *      user sees the prefix appear, no surprise round-trip).
 *   2. The Save Profile button stays disabled when the phone field is
 *      not E.164 — server-side `@Pattern("^\\+[1-9]\\d{7,14}$")` (api PR
 *      #48 / V54 CHECK) cannot be tripped from the UI.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/i18n'

const { updateProfileMock } = vi.hoisted(() => ({
    updateProfileMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@features/auth/hooks/useAuth', () => {
    const stableAuth = {
        user: {
            id: '1',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@fivucsas.com',
            phoneNumber: '',
            tenantId: 'system',
            role: 'USER',
            status: 'ACTIVE',
            isAdmin: () => false,
            isActive: () => true,
        },
        loading: false,
        isAuthenticated: true,
        error: null,
    }
    return { useAuth: () => stableAuth }
})

// Stable references — SettingsPage has a `useEffect([settings, user], …)`
// that resets local form state, so re-creating the object on every render
// would clobber whatever the user just typed.
vi.mock('@features/settings/hooks/useSettings', () => {
    const stable = {
        settings: {
            firstName: 'Test',
            lastName: 'User',
            phoneNumber: '',
            sessionTimeoutMinutes: 30,
        },
        loading: false,
        error: null,
        updateProfile: updateProfileMock,
        updateSecurity: vi.fn(),
        changePassword: vi.fn(),
        validatePassword: () => ({ valid: true, errors: [] }),
    }
    return { useSettings: () => stable }
})

// Stub useService — SettingsPage pulls IHttpClient for the 2FA-status
// fetch and AuthFlowRepository as a fallback. Both must return promises.
vi.mock('@app/providers', () => ({
    useService: () => ({
        get: vi.fn().mockResolvedValue({ data: { twoFactorRequired: false, flowName: '', stepCount: 0 } }),
        post: vi.fn().mockResolvedValue({ data: {} }),
    }),
}))

vi.mock('@core/di/container', () => ({
    container: {
        get: () => ({
            listFlows: vi.fn().mockResolvedValue([]),
        }),
    },
}))

// Sub-components that render their own dialogs / WebAuthn calls — stub so
// we only test the profile section.
vi.mock('@features/auth/components/TotpEnrollment', () => ({
    default: () => null,
}))
vi.mock('@features/auth/components/WebAuthnEnrollment', () => ({
    default: () => null,
}))
vi.mock('@features/settings/components/SessionsSection', () => ({
    default: () => null,
}))

import SettingsPage from '@/pages/SettingsPage'

function renderPage() {
    return render(
        <MemoryRouter>
            <SettingsPage />
        </MemoryRouter>
    )
}

describe('SettingsPage — phone E.164 wiring', () => {
    /**
     * MUI v5 TextField pairs the visible <label> with the underlying
     * <input> via id+for, but `findByLabelText` can be brittle for it.
     * The phone field has a unique placeholder, so use that.
     */
    const phonePlaceholder = '+90 5XX XXX XX XX'

    it('auto-prepends +90 as the user types a plain Turkish number', async () => {
        renderPage()

        const phoneInput = (await screen.findByPlaceholderText(phonePlaceholder)) as HTMLInputElement

        fireEvent.change(phoneInput, { target: { value: '5551234567' } })

        await waitFor(() => {
            expect(phoneInput.value).toBe('+905551234567')
        })
    })

    it('enables Save when phone is valid E.164 and disables when invalid', async () => {
        renderPage()

        const saveButton = (await screen.findByRole('button', { name: /save profile/i })) as HTMLButtonElement
        const phoneInput = (await screen.findByPlaceholderText(phonePlaceholder)) as HTMLInputElement

        // Empty is allowed (phone optional) — Save starts enabled.
        expect(saveButton).not.toBeDisabled()

        // Valid E.164 → Save still enabled.
        fireEvent.change(phoneInput, { target: { value: '5551234567' } })
        await waitFor(() => expect(phoneInput.value).toBe('+905551234567'))
        expect(saveButton).not.toBeDisabled()

        // Now make it invalid: paste a too-short value (`+12` normalizes
        // to `+12`, which fails E.164's 8-digit minimum).
        fireEvent.change(phoneInput, { target: { value: '+12' } })
        await waitFor(() => {
            expect(phoneInput.value).toBe('+12')
            expect(saveButton).toBeDisabled()
        })
    })
})
