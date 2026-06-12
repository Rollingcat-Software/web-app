/**
 * MethodPickerStep — F7 (2026-06-12): the generic picker must NOT offer methods
 * that have no `MfaStepRenderer` case (PASSKEY / APPROVE_LOGIN). Selecting one
 * previously routed into the renderer's "Unknown authentication method" dead-end
 * with a blank icon. They are device-implicit Layer-1 factors with dedicated
 * first-factor entry points (PasskeyLoginButton / ApproveLoginPanel), so we
 * FILTER them out of the picker list entirely.
 *
 * (Supersedes the earlier Fix #3 behaviour, which only re-worded their copy and
 * left an unusable card in the list.)
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '../../../../../i18n'
import MethodPickerStep from '../MethodPickerStep'

const baseMethod = (over: Record<string, unknown>) => ({
    name: 'X',
    category: 'BASIC',
    enrolled: false,
    preferred: false,
    requiresEnrollment: true,
    ...over,
})

describe('MethodPickerStep — non-renderable methods filtered (F7)', () => {
    it('does NOT render an APPROVE_LOGIN card (no renderer case → would be a dead-end)', () => {
        render(
            <MethodPickerStep
                availableMethods={[
                    baseMethod({ methodType: 'APPROVE_LOGIN' }),
                    baseMethod({ methodType: 'TOTP', enrolled: true }),
                ]}
                onMethodSelected={() => {}}
            />,
        )
        // APPROVE_LOGIN must be filtered out: its label must not appear.
        expect(screen.queryByText('Approve on another device')).toBeNull()
        // A renderable method still shows.
        expect(screen.getByText('Authenticator App')).toBeInTheDocument()
    })

    it('does NOT render a PASSKEY card in the generic picker', () => {
        render(
            <MethodPickerStep
                availableMethods={[baseMethod({ methodType: 'PASSKEY' })]}
                onMethodSelected={() => {}}
            />,
        )
        expect(screen.queryByText('Passkey')).toBeNull()
        // No "unknown method" / device-implicit copy strands the user.
        expect(screen.queryByText('On your device')).toBeNull()
    })

    it('still shows "Not enrolled" + Settings hint for a regular (renderable) method', () => {
        render(
            <MethodPickerStep
                availableMethods={[baseMethod({ methodType: 'TOTP' })]}
                onMethodSelected={() => {}}
            />,
        )
        expect(screen.getByText('Not enrolled')).toBeInTheDocument()
        expect(screen.getByText('Set up in Settings')).toBeInTheDocument()
    })
})
