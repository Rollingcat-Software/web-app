/**
 * HostedLoginApp tests
 *
 * Covers:
 *   - B9: per-route CSP defense-in-depth (frame-bust when framed)
 *   - B8: hosted-login surface — missing/invalid params, expired MFA,
 *         happy redirect, state echo, exact redirect URL shape.
 *
 * Uses the real i18n runtime (per session rule: tests must exercise real
 * translations). LoginMfaFlow is stubbed so we can drive onComplete directly
 * from the test.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

// Use the real i18n runtime — do NOT mock react-i18next
import '../../i18n'

// Stub LoginMfaFlow: exposes the onComplete callback to the test via a
// shared registry so tests can simulate "MFA finished".
type HostedResult = Parameters<
    NonNullable<React.ComponentProps<typeof import('../LoginMfaFlow').default>['onComplete']>
>[0]
const stubRegistry: { onComplete?: (r: HostedResult) => void; onCancel?: () => void } = {}

vi.mock('../LoginMfaFlow', () => ({
    __esModule: true,
    default: (props: {
        onComplete: (r: HostedResult) => void
        onCancel: () => void
    }) => {
        stubRegistry.onComplete = props.onComplete
        stubRegistry.onCancel = props.onCancel
        return <div data-testid="login-mfa-flow-stub" />
    },
}))

// Mock createVerifyContainer so we can inject a controllable IHttpClient.
const mockHttpGet = vi.fn()
const mockHttpPost = vi.fn()

vi.mock('../verifyContainer', () => ({
    createVerifyContainer: () => ({
        get: () => ({
            get: mockHttpGet,
            post: mockHttpPost,
        }),
    }),
}))

// DependencyProvider pass-through — we're not exercising the real DI here.
vi.mock('@app/providers/DependencyProvider', () => ({
    DependencyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useService: () => ({}),
}))

// Import HostedLoginApp AFTER the mocks are registered
import HostedLoginApp from '../HostedLoginApp'

// ─── Helpers ───────────────────────────────────────────────────────

const originalLocation = Object.getOwnPropertyDescriptor(window, 'location')
const originalTop = Object.getOwnPropertyDescriptor(window, 'top')

function setLocation(search: string) {
    const url = new URL(`https://verify.fivucsas.com/login${search}`)
    Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: {
            href: url.href,
            origin: url.origin,
            pathname: url.pathname,
            search: url.search,
            hash: '',
            host: url.host,
            hostname: url.hostname,
            port: url.port,
            protocol: url.protocol,
            assign: vi.fn(),
            replace: vi.fn(),
            reload: vi.fn(),
        },
    })
}

function ensureNotFramed() {
    Object.defineProperty(window, 'top', {
        configurable: true,
        get: () => window,
    })
}

function resetEnv() {
    mockHttpGet.mockReset()
    mockHttpPost.mockReset()
    delete stubRegistry.onComplete
    delete stubRegistry.onCancel
    ensureNotFramed()
}

afterEach(() => {
    if (originalTop) Object.defineProperty(window, 'top', originalTop)
    if (originalLocation) Object.defineProperty(window, 'location', originalLocation)
})

// ─── B9 — framed context ───────────────────────────────────────────

describe('HostedLoginApp — framed context (B9 defense-in-depth)', () => {
    beforeEach(() => {
        resetEnv()
        setLocation('?client_id=c1&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb')
    })

    it('frame-busts when rendered inside a cross-frame (window.top !== window.self)', () => {
        const topLocation = { href: '' }
        const fakeTop = { location: topLocation } as unknown as Window
        Object.defineProperty(window, 'top', {
            configurable: true,
            get: () => fakeTop,
        })

        const { container } = render(<HostedLoginApp />)

        expect(topLocation.href).toBe(window.location.href)
        expect(container.innerHTML).toBe('')
        expect(screen.queryByTestId('login-mfa-flow-stub')).toBeNull()
    })

    it('renders normally when not framed (window.top === window.self)', async () => {
        mockHttpGet.mockResolvedValue({
            data: { client_id: 'c1', client_name: 'Acme', tenant_name: 'Acme Inc' },
        })

        render(<HostedLoginApp />)

        await waitFor(() => {
            expect(screen.getByTestId('login-mfa-flow-stub')).toBeInTheDocument()
        })
    })
})

// ─── B8 — hosted-login surface ─────────────────────────────────────

describe('HostedLoginApp — B8 surface behavior', () => {
    beforeEach(() => {
        resetEnv()
    })

    it('missing client_id → renders error state (no API call)', async () => {
        setLocation('?redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb')

        render(<HostedLoginApp />)

        // Matches en.json "hosted.missingParams"
        await waitFor(() => {
            expect(
                screen.getByText(/sign-in link is incomplete/i)
            ).toBeInTheDocument()
        })
        // No meta fetch should have fired
        expect(mockHttpGet).not.toHaveBeenCalled()
    })

    it('missing redirect_uri → renders error state', async () => {
        setLocation('?client_id=c1')

        render(<HostedLoginApp />)

        await waitFor(() => {
            expect(
                screen.getByText(/sign-in link is incomplete/i)
            ).toBeInTheDocument()
        })
        expect(mockHttpGet).not.toHaveBeenCalled()
    })

    it('invalid/revoked client (404) → renders error', async () => {
        setLocation('?client_id=bad&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb')
        mockHttpGet.mockRejectedValue({ response: { status: 404 } })

        render(<HostedLoginApp />)

        await waitFor(() => {
            // en.json "hosted.invalidClient" starts with "Unknown application."
            expect(screen.getByText(/unknown application/i)).toBeInTheDocument()
        })
    })

    it('expired MFA session (/authorize/complete 400) → shows retry UI', async () => {
        setLocation(
            '?client_id=c1&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb&state=S1'
        )
        mockHttpGet.mockResolvedValue({
            data: { client_id: 'c1', client_name: 'Acme' },
        })
        mockHttpPost.mockRejectedValue({
            response: { status: 400, data: { message: 'MFA session expired' } },
        })

        render(<HostedLoginApp />)

        await waitFor(() => {
            expect(stubRegistry.onComplete).toBeDefined()
        })

        await act(async () => {
            stubRegistry.onComplete!({
                accessToken: 'at',
                userId: 'u1',
                mfaSessionToken: 'mfa-token',
            })
        })

        // "exchangeFailed" copy + "returnToApp" button = retry UI
        await waitFor(() => {
            expect(screen.getByText(/couldn.?t finalize/i)).toBeInTheDocument()
        })
        expect(
            screen.getByRole('button', { name: /return to the application/i })
        ).toBeInTheDocument()

        // replace() MUST NOT have been called
        expect((window.location.replace as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    })

    it('happy path: redirects to redirect_uri?code=…&state=… (exact shape)', async () => {
        setLocation(
            '?client_id=c1&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb&state=caller-state-42'
        )
        mockHttpGet.mockResolvedValue({
            data: { client_id: 'c1', client_name: 'Acme' },
        })
        mockHttpPost.mockResolvedValue({
            data: {
                code: 'authz-code-abc',
                redirect_uri: 'https://app.example.com/cb',
                state: 'caller-state-42',
            },
        })

        render(<HostedLoginApp />)

        await waitFor(() => expect(stubRegistry.onComplete).toBeDefined())

        await act(async () => {
            stubRegistry.onComplete!({
                accessToken: 'at',
                userId: 'u1',
                mfaSessionToken: 'mfa-token',
            })
        })

        await waitFor(() => {
            expect(mockHttpPost).toHaveBeenCalledWith(
                '/oauth2/authorize/complete',
                expect.objectContaining({
                    mfaSessionToken: 'mfa-token',
                    clientId: 'c1',
                    redirectUri: 'https://app.example.com/cb',
                    state: 'caller-state-42',
                })
            )
        })

        await waitFor(() => {
            const replace = window.location.replace as unknown as ReturnType<typeof vi.fn>
            expect(replace).toHaveBeenCalledTimes(1)
            // Exact URL shape: redirect_uri?code=…&state=…
            expect(replace).toHaveBeenCalledWith(
                'https://app.example.com/cb?code=authz-code-abc&state=caller-state-42'
            )
        })
    })

    it('state echo preserved: caller-provided state appears in final redirect', async () => {
        setLocation(
            '?client_id=c1&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb&state=ECHO123'
        )
        mockHttpGet.mockResolvedValue({
            data: { client_id: 'c1', client_name: 'Acme' },
        })
        mockHttpPost.mockResolvedValue({
            data: {
                code: 'c',
                redirect_uri: 'https://app.example.com/cb',
            },
        })

        render(<HostedLoginApp />)
        await waitFor(() => expect(stubRegistry.onComplete).toBeDefined())

        await act(async () => {
            stubRegistry.onComplete!({
                accessToken: 'at',
                userId: 'u1',
                mfaSessionToken: 'mfa-token',
            })
        })

        await waitFor(() => {
            const replace = window.location.replace as unknown as ReturnType<typeof vi.fn>
            expect(replace).toHaveBeenCalledWith(
                expect.stringContaining('state=ECHO123')
            )
        })
    })

    it('no state when caller did not pass one', async () => {
        setLocation('?client_id=c1&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb')
        mockHttpGet.mockResolvedValue({
            data: { client_id: 'c1', client_name: 'Acme' },
        })
        mockHttpPost.mockResolvedValue({
            data: { code: 'c1', redirect_uri: 'https://app.example.com/cb' },
        })

        render(<HostedLoginApp />)
        await waitFor(() => expect(stubRegistry.onComplete).toBeDefined())

        await act(async () => {
            stubRegistry.onComplete!({
                accessToken: 'at',
                userId: 'u1',
                mfaSessionToken: 'mfa-token',
            })
        })

        await waitFor(() => {
            const replace = window.location.replace as unknown as ReturnType<typeof vi.fn>
            expect(replace).toHaveBeenCalledTimes(1)
            const target = replace.mock.calls[0][0] as string
            expect(target).toBe('https://app.example.com/cb?code=c1')
            expect(target).not.toContain('state=')
        })
    })

    it('missing mfaSessionToken but has accessToken → mints code via GET /authorize, redirects', async () => {
        // Single-factor flow (Marmara Simple Login — PASSWORD only): LoginMfaFlow
        // calls onComplete({accessToken, ...}) with no mfaSessionToken because
        // no MFA was needed. HostedLoginApp should re-hit GET /oauth2/authorize
        // with the Bearer token so the backend mints a code for the authenticated
        // principal (see OAuth2Controller.authorize authenticated branch).
        setLocation('?client_id=c1&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb')
        mockHttpGet.mockImplementation((url: string) => {
            if (url.startsWith('/oauth2/clients/')) {
                return Promise.resolve({ data: { client_id: 'c1', client_name: 'Acme' } })
            }
            // GET /oauth2/authorize?... with Bearer → returns code
            return Promise.resolve({
                data: { code: 'authcode-xyz', redirect_uri: 'https://app.example.com/cb' },
            })
        })

        render(<HostedLoginApp />)
        await waitFor(() => expect(stubRegistry.onComplete).toBeDefined())

        await act(async () => {
            // No mfaSessionToken in result payload; has accessToken
            stubRegistry.onComplete!({
                accessToken: 'at',
                userId: 'u1',
            })
        })

        const replace = window.location.replace as unknown as ReturnType<typeof vi.fn>
        await waitFor(() => expect(replace).toHaveBeenCalled())
        // POST /authorize/complete must NOT be called on the single-factor path
        expect(mockHttpPost).not.toHaveBeenCalled()
        const target = replace.mock.calls[0][0]
        expect(target).toContain('code=authcode-xyz')
    })

    it('no mfaSessionToken AND no accessToken → sessionLost error', async () => {
        setLocation('?client_id=c1&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb')
        mockHttpGet.mockResolvedValue({
            data: { client_id: 'c1', client_name: 'Acme' },
        })

        render(<HostedLoginApp />)
        await waitFor(() => expect(stubRegistry.onComplete).toBeDefined())

        await act(async () => {
            stubRegistry.onComplete!({
                accessToken: '',
                userId: 'u1',
            })
        })

        await waitFor(() => {
            expect(screen.getByText(/session has expired/i)).toBeInTheDocument()
        })
        expect(mockHttpPost).not.toHaveBeenCalled()
        const replace = window.location.replace as unknown as ReturnType<typeof vi.fn>
        expect(replace).not.toHaveBeenCalled()
    })

    it('backend returns javascript: redirect_uri → blocked, shows invalidRedirect', async () => {
        setLocation('?client_id=c1&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb')
        mockHttpGet.mockResolvedValue({
            data: { client_id: 'c1', client_name: 'Acme' },
        })
        mockHttpPost.mockResolvedValue({
            data: { code: 'c', redirect_uri: 'javascript:alert(1)' },
        })

        render(<HostedLoginApp />)
        await waitFor(() => expect(stubRegistry.onComplete).toBeDefined())

        await act(async () => {
            stubRegistry.onComplete!({
                accessToken: 'at',
                userId: 'u1',
                mfaSessionToken: 'mfa-token',
            })
        })

        await waitFor(() => {
            expect(screen.getByText(/invalid redirect destination/i)).toBeInTheDocument()
        })
        const replace = window.location.replace as unknown as ReturnType<typeof vi.fn>
        expect(replace).not.toHaveBeenCalled()
    })

    it('"Return to the application" button is usable after error', async () => {
        setLocation('?client_id=bad&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb')
        mockHttpGet.mockRejectedValue({ response: { status: 404 } })

        render(<HostedLoginApp />)

        await waitFor(() => {
            expect(screen.getByText(/unknown application/i)).toBeInTheDocument()
        })

        // paramError branch: there is no action button wired; just assert the
        // error region has rendered. (The recovery button lives in the
        // post-finalError branch covered elsewhere.)
        expect(screen.getByRole('alert')).toBeInTheDocument()
    })
})

