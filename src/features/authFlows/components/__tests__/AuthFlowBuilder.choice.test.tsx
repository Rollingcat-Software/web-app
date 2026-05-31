import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuthFlowBuilder } from '../AuthFlowBuilder'
import { AuthMethodType, type AuthFlowStep } from '@domain/models/AuthMethod'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            opts && typeof opts.count === 'number' ? `${key}:${opts.count}` : key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Trans: ({ children }: { children: React.ReactNode }) => children,
}))

// framer-motion Reorder.* requires layout APIs jsdom lacks; stub the bits we use.
vi.mock('framer-motion', () => {
    const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
    return {
        motion: new Proxy({}, { get: () => (p: { children?: React.ReactNode }) => <div>{p.children}</div> }),
        AnimatePresence: passthrough,
        Reorder: {
            Group: ({ children }: { children?: React.ReactNode }) => <ul>{children}</ul>,
            Item: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
        },
    }
})

const threeStrictSteps: AuthFlowStep[] = [
    { id: 's1', order: 1, methodId: 'PASSWORD', methodType: AuthMethodType.PASSWORD, isRequired: true, timeout: 120, maxAttempts: 3 },
    { id: 's2', order: 2, methodId: 'TOTP', methodType: AuthMethodType.TOTP, isRequired: true, timeout: 120, maxAttempts: 3 },
    { id: 's3', order: 3, methodId: 'EMAIL_OTP', methodType: AuthMethodType.EMAIL_OTP, isRequired: true, timeout: 120, maxAttempts: 3 },
]

describe('AuthFlowBuilder — CHOICE on any layer (3FA)', () => {
    it('lets the 3rd layer become a CHOICE with multiple alternatives and saves them', () => {
        const onSave = vi.fn()
        render(<AuthFlowBuilder initialSteps={threeStrictSteps} onSave={onSave} />)

        // The CHOICE-editor toggle is present on every step, including the 3rd.
        const editChoiceButtons = screen.getAllByLabelText('authFlowBuilder.editChoices')
        expect(editChoiceButtons).toHaveLength(3)

        // Open the 3rd step's CHOICE editor.
        fireEvent.click(editChoiceButtons[2])

        // Add SMS_OTP + FACE as alternatives to the 3rd step (primary = EMAIL_OTP).
        // Re-query after each click (React replaces nodes on re-render).
        fireEvent.click(screen.getByText('SMS OTP'))
        fireEvent.click(screen.getByText('Face Recognition'))

        fireEvent.click(screen.getByText('authFlowBuilder.saveFlow'))

        expect(onSave).toHaveBeenCalledTimes(1)
        const saved = onSave.mock.calls[0][0]
        const thirdStep = saved.steps.find((s: AuthFlowStep) => s.id === 's3')
        expect(thirdStep.alternativeMethodTypes).toEqual(
            expect.arrayContaining([AuthMethodType.SMS_OTP, AuthMethodType.FACE]),
        )
        expect(thirdStep.alternativeMethodTypes).toHaveLength(2)
    })
})
