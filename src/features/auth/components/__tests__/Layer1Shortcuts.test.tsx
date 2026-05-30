/**
 * Layer1Shortcuts tests — the no-email ("usernameless") shortcut cluster.
 *
 * Layer1Shortcuts now renders ONLY the passkey shortcut. "Approve on another
 * device" is identifier-first (needs email) and is no longer a no-email peer of
 * passkey, so it must NEVER appear here. Gating uses the config's `engineActive`
 * flag: engine ON → render strictly per config; engine OFF / null → fallbackAll.
 *
 * PasskeyLoginButton is stubbed to a marker so we assert presence without WebAuthn.
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
        />,
    )
}

describe('Layer1Shortcuts', () => {
    it('engine ON + usernameless passkey → passkey shown, NO approve button', () => {
        const config = normalizeLoginConfig({
            engineActive: true,
            layer1: {
                methods: [
                    { type: 'PASSKEY', usernameless: true },
                    { type: 'QR_CODE', usernameless: true },
                ],
            },
        })
        renderShortcuts(config)
        expect(screen.getByTestId('passkey-button')).toBeInTheDocument()
        // Approve-on-another-device is identifier-first — must never render here.
        expect(screen.queryByRole('button', { name: /approve on another device/i })).toBeNull()
    })

    it('engine ON but NO usernameless passkey → passkey hidden (renders nothing)', () => {
        const config = normalizeLoginConfig({
            engineActive: true,
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
        })
        const { container } = renderShortcuts(config, true) // fallbackAll ignored when engine ON
        expect(screen.queryByTestId('passkey-button')).toBeNull()
        expect(container).toBeEmptyDOMElement()
    })

    it('fallbackAll shows the passkey shortcut when config is null (fetch failed)', () => {
        renderShortcuts(null, true)
        expect(screen.getByTestId('passkey-button')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /approve on another device/i })).toBeNull()
    })

    it('flag-OFF legacy config (engineActive false) with fallbackAll keeps the passkey shortcut', () => {
        const config = normalizeLoginConfig({
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
        })
        renderShortcuts(config, true)
        expect(screen.getByTestId('passkey-button')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /approve on another device/i })).toBeNull()
    })

    it('renders nothing when config is null and fallbackAll is false', () => {
        const { container } = renderShortcuts(null, false)
        expect(container).toBeEmptyDOMElement()
    })
})
