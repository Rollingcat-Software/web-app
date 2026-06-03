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
const mockCheckEligibility = vi.fn()
const authRepoStub = {
    login: mockLogin,
    beginIdentifierLogin: mockBegin,
    verifyMfaStep: mockVerifyMfaStep,
    checkLoginEligibility: mockCheckEligibility,
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
    mockCheckEligibility.mockReset()
    mockCheckEligibility.mockResolvedValue(undefined)
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

    it('shows a Layer-1 skeleton (no password flash) while configLoading, then the real form (Fix #1)', async () => {
        // While the parent is still fetching loginConfig, the opening screen must
        // be a skeleton — NOT the legacy password form (which would flash before
        // an identifier-first config resolves).
        const { rerender } = render(
            <LoginMfaFlow {...baseProps} loginConfig={null} configLoading />,
        )
        expect(screen.getByTestId('login-config-skeleton')).toBeInTheDocument()
        expect(screen.queryByLabelText('Password')).toBeNull()

        // Config settles to identifier-first → skeleton gone, email-only form.
        const config = normalizeLoginConfig({
            engineActive: true,
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
        })
        rerender(<LoginMfaFlow {...baseProps} loginConfig={config} configLoading={false} />)
        expect(screen.queryByTestId('login-config-skeleton')).toBeNull()
        // The opening phase re-derives to identifier-first in a post-render effect.
        await waitFor(() => {
            expect(screen.queryByLabelText('Password')).toBeNull()
        })
        expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    })

    it('falls back to the email+password form when configLoading settles with a null config (no lockout, Fix #1)', () => {
        // A GENUINE config failure = null + not-loading → must render the safe
        // legacy password form so an admin is never locked out.
        const { rerender } = render(
            <LoginMfaFlow {...baseProps} loginConfig={null} configLoading />,
        )
        expect(screen.getByTestId('login-config-skeleton')).toBeInTheDocument()

        rerender(<LoginMfaFlow {...baseProps} loginConfig={null} configLoading={false} />)
        expect(screen.queryByTestId('login-config-skeleton')).toBeNull()
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

    it('runs the tenant pre-flight on email submit, then reveals the password screen (eligible)', async () => {
        const config = normalizeLoginConfig({
            engineActive: true,
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
        })
        render(<LoginMfaFlow {...baseProps} loginConfig={config} />)
        fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'staff@marmara.edu.tr' } })
        fireEvent.click(screen.getByRole('button', { name: /continue/i }))

        await waitFor(() => {
            expect(mockCheckEligibility).toHaveBeenCalledWith('staff@marmara.edu.tr', 'c1')
        })
        // Eligible ⇒ the password screen is revealed; no password was submitted yet.
        await waitFor(() => {
            expect(screen.getByLabelText('Password')).toBeInTheDocument()
        })
        expect(mockLogin).not.toHaveBeenCalled()
    })

    it('uses the PREFLIGHT-resolved totalSteps for the password-screen counter (regression: no 1/2 → 2/3 jump)', async () => {
        // The mount-time config under-reports the flow (totalSteps: 2). The
        // preflight resolves the caller's REAL tenant flow (totalSteps: 3). The
        // password screen's step counter must read "1 of 3" (from the preflight,
        // stored in flowTotalSteps) — NOT "1 of 2" (the mount config) — otherwise
        // it jumps to 2/3 on the first MFA step (the reported bug, issue #13).
        const mountConfig = normalizeLoginConfig({
            engineActive: true,
            totalSteps: 2,
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
        })
        mockCheckEligibility.mockResolvedValue(
            normalizeLoginConfig({
                engineActive: true,
                totalSteps: 3,
                layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
            }),
        )
        render(<LoginMfaFlow {...baseProps} loginConfig={mountConfig} />)
        fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'staff@marmara.edu.tr' } })
        fireEvent.click(screen.getByRole('button', { name: /continue/i }))

        await waitFor(() => expect(screen.getByLabelText('Password')).toBeInTheDocument())
        // The counter's denominator comes from the preflight (3), not the mount config (2).
        const bar = screen.getByRole('progressbar', { name: /step 1 of 3/i })
        expect(bar).toHaveAttribute('aria-valuemax', '3')
        expect(bar).toHaveAttribute('aria-valuenow', '1')
        expect(screen.queryByRole('progressbar', { name: /step 1 of 2/i })).toBeNull()
    })

    it('shows the tenant-mismatch error on the EMAIL step and does NOT reveal the password screen', async () => {
        mockCheckEligibility.mockRejectedValue(
            Object.assign(new Error('tenant'), {
                isAxiosError: true,
                response: { status: 403, data: { errorCode: 'TENANT_MISMATCH', requiredTenant: 'Marmara University' } },
            }),
        )
        const config = normalizeLoginConfig({
            engineActive: true,
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
        })
        render(<LoginMfaFlow {...baseProps} loginConfig={config} />)
        fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'alice@gmail.com' } })
        fireEvent.click(screen.getByRole('button', { name: /continue/i }))

        await waitFor(() => {
            expect(mockCheckEligibility).toHaveBeenCalled()
        })
        // Wrong-tenant ⇒ user stays on the email step; the password field must NOT appear.
        await waitFor(() => {
            expect(screen.queryByLabelText('Password')).toBeNull()
        })
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
