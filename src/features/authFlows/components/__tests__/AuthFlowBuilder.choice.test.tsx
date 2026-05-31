import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { AuthFlowBuilder } from '../AuthFlowBuilder'
import { AuthMethodType, type AuthFlowStep } from '@domain/models/AuthMethod'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            if (opts && typeof opts.count === 'number') return `${key}:${opts.count}`
            if (opts && typeof opts.number === 'number') return `${key}:${opts.number}`
            return key
        },
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Trans: ({ children }: { children: React.ReactNode }) => children,
}))

// framer-motion layout APIs jsdom lacks; stub the bits we use.
vi.mock('framer-motion', () => {
    const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
    return {
        motion: new Proxy({}, { get: () => (p: { children?: React.ReactNode }) => <div>{p.children}</div> }),
        AnimatePresence: passthrough,
    }
})

const singlePasswordLayer: AuthFlowStep[] = [
    { id: 's1', order: 1, methodId: 'PASSWORD', methodType: AuthMethodType.PASSWORD, isRequired: true, timeout: 120, maxAttempts: 3 },
]

describe('AuthFlowBuilder — layer-based UI', () => {
    it('adds a new (empty) layer via "Add Layer" and blocks save until it has a method', () => {
        const onSave = vi.fn()
        render(<AuthFlowBuilder initialSteps={[]} onSave={onSave} />)

        const saveBtn = () => screen.getByText('authFlowBuilder.saveFlow').closest('button')!

        // No layers yet → Save disabled.
        expect(saveBtn()).toBeDisabled()

        // Add a layer — still empty, still disabled.
        fireEvent.click(screen.getByText('authFlowBuilder.addLayer'))
        expect(saveBtn()).toBeDisabled()
        expect(screen.getByText('authFlowBuilder.layerSelectAtLeastOne')).toBeTruthy()

        // Check one method → save enabled, single-method helper shown.
        fireEvent.click(screen.getByRole('checkbox', { name: 'Password' }))
        expect(saveBtn()).not.toBeDisabled()
        expect(screen.getByText('authFlowBuilder.layerSingleMethod')).toBeTruthy()
    })

    it('checking 2 methods produces methodType=first + alternativeMethodTypes=[second]', () => {
        const onSave = vi.fn()
        render(<AuthFlowBuilder initialSteps={singlePasswordLayer} onSave={onSave} />)

        // Add TOTP as a second allowed method to the (single) layer.
        fireEvent.click(screen.getByLabelText('Authenticator App'))

        // Choice helper text appears once ≥2 selected.
        expect(screen.getByText('authFlowBuilder.layerAnyOneOf')).toBeTruthy()

        fireEvent.click(screen.getByText('authFlowBuilder.saveFlow'))

        expect(onSave).toHaveBeenCalledTimes(1)
        const saved = onSave.mock.calls[0][0]
        expect(saved.steps).toHaveLength(1)
        const layer = saved.steps[0]
        expect(layer.methodType).toBe(AuthMethodType.PASSWORD)
        expect(layer.alternativeMethodTypes).toEqual([AuthMethodType.TOTP])
    })

    it('unchecking back to 1 method drops alternativeMethodTypes', () => {
        const onSave = vi.fn()
        render(<AuthFlowBuilder initialSteps={singlePasswordLayer} onSave={onSave} />)

        // Add then remove TOTP — should leave a strict single-method layer.
        fireEvent.click(screen.getByLabelText('Authenticator App'))
        fireEvent.click(screen.getByLabelText('Authenticator App'))

        fireEvent.click(screen.getByText('authFlowBuilder.saveFlow'))

        const saved = onSave.mock.calls[0][0]
        const layer = saved.steps[0]
        expect(layer.methodType).toBe(AuthMethodType.PASSWORD)
        expect(layer.alternativeMethodTypes).toBeUndefined()
    })

    it('hydrates a CHOICE layer from methodType + alternativeMethodTypes', () => {
        const onSave = vi.fn()
        const choiceLayer: AuthFlowStep[] = [
            {
                id: 's1', order: 1, methodId: 'EMAIL_OTP', methodType: AuthMethodType.EMAIL_OTP,
                isRequired: true, timeout: 120, maxAttempts: 3,
                alternativeMethodTypes: [AuthMethodType.SMS_OTP],
            },
        ]
        render(<AuthFlowBuilder initialSteps={choiceLayer} onSave={onSave} />)

        // Both methods render pre-checked.
        expect((screen.getByLabelText('Email OTP') as HTMLInputElement).checked).toBe(true)
        expect((screen.getByLabelText('SMS OTP') as HTMLInputElement).checked).toBe(true)

        // Saving without edits preserves the choice set.
        fireEvent.click(screen.getByText('authFlowBuilder.saveFlow'))
        const saved = onSave.mock.calls[0][0]
        const layer = saved.steps[0]
        expect(layer.methodType).toBe(AuthMethodType.EMAIL_OTP)
        expect(layer.alternativeMethodTypes).toEqual([AuthMethodType.SMS_OTP])
    })

    it('a 0-method layer disables Save and is never sent', () => {
        const onSave = vi.fn()
        render(<AuthFlowBuilder initialSteps={singlePasswordLayer} onSave={onSave} />)

        // Add an empty second layer → save disabled.
        fireEvent.click(screen.getByText('authFlowBuilder.addLayer'))
        const saveBtn = screen.getByText('authFlowBuilder.saveFlow').closest('button')!
        expect(saveBtn).toBeDisabled()
        expect(screen.getByText('authFlowBuilder.saveDisabledEmptyLayer')).toBeTruthy()

        // onSave must not fire even if invoked while disabled.
        fireEvent.click(saveBtn)
        expect(onSave).not.toHaveBeenCalled()
    })

    it('supports 3 layers (3FA) each with its own method set', () => {
        const onSave = vi.fn()
        render(<AuthFlowBuilder initialSteps={singlePasswordLayer} onSave={onSave} />)

        // Layer 2.
        fireEvent.click(screen.getByText('authFlowBuilder.addLayer'))
        // Layer 3.
        fireEvent.click(screen.getByText('authFlowBuilder.addLayer'))

        // Re-query layer cards before EACH interaction: the AnimatePresence /
        // motion re-render replaces DOM nodes, so a card captured once goes stale.
        const cards = () =>
            screen.getAllByText(/^authFlowBuilder\.layerLabel:/).map(
                (el) => el.closest('.MuiPaper-root') as HTMLElement,
            )
        expect(cards()).toHaveLength(3)

        // Layer 2 → TOTP, Layer 3 → EMAIL_OTP + SMS_OTP (a choice).
        fireEvent.click(within(cards()[1]).getByRole('checkbox', { name: 'Authenticator App' }))
        fireEvent.click(within(cards()[2]).getByRole('checkbox', { name: 'Email OTP' }))
        fireEvent.click(within(cards()[2]).getByRole('checkbox', { name: 'SMS OTP' }))

        fireEvent.click(screen.getByText('authFlowBuilder.saveFlow'))
        const saved = onSave.mock.calls[0][0]
        expect(saved.steps).toHaveLength(3)
        expect(saved.steps[0].methodType).toBe(AuthMethodType.PASSWORD)
        expect(saved.steps[1].methodType).toBe(AuthMethodType.TOTP)
        expect(saved.steps[2].methodType).toBe(AuthMethodType.EMAIL_OTP)
        expect(saved.steps[2].alternativeMethodTypes).toEqual([AuthMethodType.SMS_OTP])
    })
})
