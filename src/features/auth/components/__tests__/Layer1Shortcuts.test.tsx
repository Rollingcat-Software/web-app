/**
 * Layer1Shortcuts tests — config-driven usernameless shortcut gating (G-web).
 *
 * Uses the real i18n runtime. PasskeyLoginButton is stubbed to a simple marker
 * so we assert presence/absence without exercising WebAuthn.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '../../../../i18n'

vi.mock('../PasskeyLoginButton', () => ({
    __esModule: true,
    default: () => <div data-testid="passkey-button" />,
}))

import Layer1Shortcuts from '../Layer1Shortcuts'
import { normalizeLoginConfig } from '@domain/models/LoginConfig'

const noop = () => {}

function renderShortcuts(config: Parameters<typeof Layer1Shortcuts>[0]['config'], fallbackAll = false) {
    return render(
        <Layer1Shortcuts
            config={config}
            fallbackAll={fallbackAll}
            onPasskeySuccess={noop}
            onPasskeyError={noop}
            onApproveClick={noop}
        />,
    )
}

describe('Layer1Shortcuts', () => {
    it('shows passkey + approve when config marks them usernameless', () => {
        const config = normalizeLoginConfig({
            layer1: {
                methods: [
                    { type: 'HARDWARE_KEY', usernameless: true },
                    { type: 'QR_CODE', usernameless: true },
                ],
            },
        })
        renderShortcuts(config)
        expect(screen.getByTestId('passkey-button')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /approve on another device/i })).toBeInTheDocument()
    })

    it('hides passkey when no usernameless passkey method is offered', () => {
        const config = normalizeLoginConfig({
            layer1: { methods: [{ type: 'PASSWORD' }] },
        })
        const { container } = renderShortcuts(config)
        expect(screen.queryByTestId('passkey-button')).toBeNull()
        // No usernameless QR/approve either → component renders nothing.
        expect(container).toBeEmptyDOMElement()
    })

    it('hides passkey shortcut when the hardware key is NOT usernameless', () => {
        const config = normalizeLoginConfig({
            layer1: { methods: [{ type: 'HARDWARE_KEY', usernameless: false }] },
        })
        renderShortcuts(config)
        expect(screen.queryByTestId('passkey-button')).toBeNull()
    })

    it('fallbackAll shows every shortcut when config is null (fetch failed)', () => {
        renderShortcuts(null, true)
        expect(screen.getByTestId('passkey-button')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /approve on another device/i })).toBeInTheDocument()
    })

    it('flag-OFF: a legacy password-first config with fallbackAll keeps today\'s shortcuts', () => {
        // When app.auth.config-driven-login is OFF the API returns the current
        // password-first shape (no usernameless semantics). With fallbackAll the
        // existing passkey + approve buttons must NOT be dropped.
        const config = normalizeLoginConfig({
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
        })
        renderShortcuts(config, true)
        expect(screen.getByTestId('passkey-button')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /approve on another device/i })).toBeInTheDocument()
    })

    it('flag-ON config that declares usernameless methods renders strictly (ignores fallbackAll)', () => {
        // PASSWORD-first BUT with a usernameless QR explicitly declared → only the
        // approve/QR shortcut shows; the passkey one stays hidden even with
        // fallbackAll true, because the config positively declares the surface.
        const config = normalizeLoginConfig({
            layer1: {
                methods: [
                    { type: 'PASSWORD' },
                    { type: 'QR_CODE', usernameless: true },
                ],
            },
        })
        renderShortcuts(config, true)
        expect(screen.queryByTestId('passkey-button')).toBeNull()
        expect(screen.getByRole('button', { name: /approve on another device/i })).toBeInTheDocument()
    })

    it('renders nothing when config is null and fallbackAll is false', () => {
        const { container } = renderShortcuts(null, false)
        expect(container).toBeEmptyDOMElement()
    })
})
