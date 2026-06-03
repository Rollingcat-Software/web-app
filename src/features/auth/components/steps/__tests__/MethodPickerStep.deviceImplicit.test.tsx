/**
 * MethodPickerStep — Fix #3 (2026-06-03): device-implicit methods
 * (APPROVE_LOGIN / PASSKEY) must not present the misleading "Not enrolled →
 * Set up in Settings" dead-end (there is no Settings enrollment for them).
 * They show "On your device" + a device/mobile setup hint instead.
 *
 * They remain NON-selectable as a mid-flow MFA step (no renderer/handler yet),
 * but the copy no longer strands the user.
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

describe('MethodPickerStep — device-implicit copy (Fix #3)', () => {
    it('shows "On your device" (not "Not enrolled") for APPROVE_LOGIN when not enrolled', () => {
        render(
            <MethodPickerStep
                availableMethods={[baseMethod({ methodType: 'APPROVE_LOGIN' })]}
                onMethodSelected={() => {}}
            />,
        )
        expect(screen.getByText('On your device')).toBeInTheDocument()
        expect(screen.queryByText('Not enrolled')).toBeNull()
        // No misleading "Set up in Settings" dead-end.
        expect(screen.queryByText('Set up in Settings')).toBeNull()
    })

    it('still shows "Not enrolled" + Settings hint for a regular (non-device-implicit) method', () => {
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
