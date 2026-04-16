/**
 * HostedLoginApp tests
 *
 * Covers:
 *   - B9 per-route CSP defense-in-depth: frame-bust runs when window.top !== window.self,
 *     and the component does not render leaky content inside a framed context.
 *
 * Uses the real i18n runtime (per session rule: tests must exercise real translations).
 * LoginMfaFlow is stubbed because its full dependency graph is unrelated to the
 * HostedLoginApp-level behavior under test.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Use the real i18n runtime — do NOT mock react-i18next
import '../../i18n'

// Stub LoginMfaFlow (and its transitive MUI/framer-motion deps via this import)
// with a minimal shell. We only need HostedLoginApp's own shell under test.
vi.mock('../LoginMfaFlow', () => ({
    __esModule: true,
    default: () => <div data-testid="login-mfa-flow-stub" />,
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

// Helpers
function setQuery(search: string) {
    // jsdom allows overwriting window.location via a plain object.
    const url = new URL(`https://verify.fivucsas.com/login${search}`)
    Object.defineProperty(window, 'location', {
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

describe('HostedLoginApp — framed context (B9 defense-in-depth)', () => {
    const originalTop = Object.getOwnPropertyDescriptor(window, 'top')

    beforeEach(() => {
        mockHttpGet.mockReset()
        mockHttpPost.mockReset()
        setQuery('?client_id=c1&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb')
    })

    afterEach(() => {
        if (originalTop) {
            Object.defineProperty(window, 'top', originalTop)
        }
    })

    it('frame-busts when rendered inside a cross-frame (window.top !== window.self)', () => {
        // Simulate being framed: override window.top to a *different* object
        // with a settable location.href (same-origin fake parent).
        const topLocation = { href: '' }
        const fakeTop = { location: topLocation } as unknown as Window
        Object.defineProperty(window, 'top', {
            configurable: true,
            get: () => fakeTop,
        })

        const { container } = render(<HostedLoginApp />)

        // Frame-bust: parent location should be navigated to the current href.
        expect(topLocation.href).toBe(window.location.href)
        // No OIDC content leaked into the framed render.
        expect(container.innerHTML).toBe('')
        expect(screen.queryByTestId('login-mfa-flow-stub')).toBeNull()
    })

    it('renders normally when not framed (window.top === window.self)', async () => {
        // Not framed
        Object.defineProperty(window, 'top', {
            configurable: true,
            get: () => window,
        })

        // Happy-path meta fetch so initial loading resolves
        mockHttpGet.mockResolvedValue({
            data: { client_id: 'c1', client_name: 'Acme', tenant_name: 'Acme Inc' },
        })

        render(<HostedLoginApp />)

        // The stubbed LoginMfaFlow should appear once meta has loaded.
        await waitFor(() => {
            expect(screen.getByTestId('login-mfa-flow-stub')).toBeInTheDocument()
        })
    })
})
