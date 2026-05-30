/**
 * LoginMfaFlow — config-driven Layer-1 rendering (D).
 *
 * Verifies:
 *  - PASSWORD in layer1 → the password step (password field) renders.
 *  - PASSWORD absent + identifierRequired → an identifier-first entry renders
 *    instead of the password field, and submitting calls beginIdentifierLogin.
 *
 * Uses the real i18n runtime. The biometric-engine warm-up import is mocked so
 * the idle prefetch is a no-op in jsdom.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '../../i18n'

vi.mock('@/lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: { getInstance: () => ({ initialize: () => Promise.resolve() }) },
}))

const mockLogin = vi.fn()
const mockBegin = vi.fn()
const mockVerifyMfaStep = vi.fn()
const authRepoStub = {
    login: mockLogin,
    beginIdentifierLogin: mockBegin,
    verifyMfaStep: mockVerifyMfaStep,
}
const httpStub = { post: vi.fn(), get: vi.fn() }

vi.mock('@app/providers', () => ({
    useService: (type: symbol) => {
        // TYPES.AuthRepository vs TYPES.HttpClient — disambiguate by description.
        return String(type).includes('AuthRepository') ? authRepoStub : httpStub
    },
}))

import LoginMfaFlow from '../LoginMfaFlow'
import { normalizeLoginConfig } from '@domain/models/LoginConfig'

const baseProps = {
    clientId: 'c1',
    onComplete: vi.fn(),
    onCancel: vi.fn(),
}

beforeEach(() => {
    mockLogin.mockReset()
    mockBegin.mockReset()
    mockVerifyMfaStep.mockReset()
})

describe('LoginMfaFlow — config-driven Layer 1', () => {
    it('renders the password field when PASSWORD is a Layer-1 method', () => {
        const config = normalizeLoginConfig({
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
        })
        render(<LoginMfaFlow {...baseProps} loginConfig={config} />)
        // PasswordStep renders a "Password" field.
        expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('renders the password field by default when no config is supplied (legacy)', () => {
        render(<LoginMfaFlow {...baseProps} />)
        expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('renders identifier-first entry (no password field) when PASSWORD is absent', async () => {
        const config = normalizeLoginConfig({
            layer1: { identifierRequired: true, methods: [{ type: 'EMAIL_OTP' }] },
        })
        mockBegin.mockResolvedValue({
            mfaSessionToken: 'sess-1',
            twoFactorRequired: true,
            availableMethods: [
                { methodType: 'EMAIL_OTP', name: 'Email OTP', category: 'BASIC', enrolled: true, preferred: true, requiresEnrollment: false },
            ],
        })
        render(<LoginMfaFlow {...baseProps} loginConfig={config} />)

        // No password field — strictly config-driven.
        expect(screen.queryByLabelText('Password')).toBeNull()
        // The identifier (email) box is present.
        const emailInput = screen.getByLabelText('Email Address')
        expect(emailInput).toBeInTheDocument()

        fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
        fireEvent.click(screen.getByRole('button', { name: /continue/i }))

        await waitFor(() => {
            expect(mockBegin).toHaveBeenCalledWith('user@example.com', 'c1')
        })
        // Password login MUST NOT be used on the identifier-first path.
        expect(mockLogin).not.toHaveBeenCalled()
    })

    it('opens IDENTIFIER-FIRST (email only, no password yet) when engineActive + PASSWORD Layer-1', () => {
        const config = normalizeLoginConfig({
            engineActive: true,
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
        })
        render(<LoginMfaFlow {...baseProps} loginConfig={config} />)
        // Engine ON ⇒ screen 1 collects identity only; the password comes after.
        expect(screen.queryByLabelText('Password')).toBeNull()
        expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    })

    it('re-syncs to identifier-first when the engineActive config arrives AFTER mount (async fetch)', async () => {
        // Parent (HostedLoginApp) mounts us with a null config while login-config
        // is still being fetched → legacy combined password screen.
        const { rerender } = render(<LoginMfaFlow {...baseProps} loginConfig={null} />)
        expect(screen.getByLabelText('Password')).toBeInTheDocument()

        // The fetch resolves: an engineActive, PASSWORD-Layer-1 config lands.
        const config = normalizeLoginConfig({
            engineActive: true,
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
        })
        rerender(<LoginMfaFlow {...baseProps} loginConfig={config} />)

        // The opening screen must flip to identifier-first (regression: the
        // useState-frozen phase used to stay on the null-config password screen).
        await waitFor(() => {
            expect(screen.queryByLabelText('Password')).toBeNull()
            expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
        })
    })
})
