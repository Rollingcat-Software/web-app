import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PuzzleLayerConfig } from '../PuzzleLayerConfig'
import type { PuzzleConfig } from '@domain/models/AuthMethod'

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

// framer-motion not used in this component but keep the mock pattern consistent
vi.mock('framer-motion', () => {
    const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
    return {
        motion: new Proxy({}, { get: () => (p: { children?: React.ReactNode }) => <div>{p.children}</div> }),
        AnimatePresence: passthrough,
    }
})

// The real registry has 23 entries (14 face + 9 hand). We verify the component
// renders all of them by checking against the registry's own count.
import { listBiometricPuzzles } from '@features/biometric-puzzles/biometricPuzzleRegistry'

describe('PuzzleLayerConfig', () => {
    const defaultConfig: PuzzleConfig = {
        allowedChallengeTypes: [],
        count: 2,
        difficulty: 'medium',
        alsoMatchFaceIdentity: true,
    }

    it('renders checkboxes for all 23 challenge types (14 face + 9 hand)', () => {
        const puzzles = listBiometricPuzzles()
        render(<PuzzleLayerConfig value={defaultConfig} onChange={vi.fn()} />)
        // Each puzzle entry should have a checkbox. The test keys on i18n keys
        // (which the test t() stub renders as the key string itself).
        expect(puzzles).toHaveLength(23)
        // The component renders one checkbox per puzzle — verify count via role
        const checkboxes = screen.getAllByRole('checkbox')
        // All 23 puzzle checkboxes + the identity-binding toggle (rendered as
        // a Switch, which is also role=checkbox in jsdom).
        expect(checkboxes.length).toBeGreaterThanOrEqual(23)
    })

    it('renders the count input', () => {
        render(<PuzzleLayerConfig value={defaultConfig} onChange={vi.fn()} />)
        const countInput = screen.getByRole('spinbutton')
        expect(countInput).toBeTruthy()
        expect((countInput as HTMLInputElement).value).toBe('2')
    })

    it('renders a difficulty select', () => {
        render(<PuzzleLayerConfig value={defaultConfig} onChange={vi.fn()} />)
        // MUI Select renders a combobox
        const select = screen.getByRole('combobox')
        expect(select).toBeTruthy()
    })

    it('identity-binding toggle defaults ON and does NOT show lower-assurance warning', () => {
        render(<PuzzleLayerConfig value={defaultConfig} onChange={vi.fn()} />)
        // The toggle label key
        expect(screen.getByText('biometricPuzzle.builder.identityBinding')).toBeTruthy()
        // Warning NOT shown when toggle is ON
        expect(screen.queryByText('biometricPuzzle.builder.lowerAssuranceWarning')).toBeNull()
    })

    it('toggling identity-binding OFF shows the lower-assurance warning', () => {
        const onChange = vi.fn()
        render(
            <PuzzleLayerConfig
                value={{ ...defaultConfig, alsoMatchFaceIdentity: false }}
                onChange={onChange}
            />,
        )
        expect(screen.getByText('biometricPuzzle.builder.lowerAssuranceWarning')).toBeTruthy()
    })

    it('toggling a checkbox calls onChange with updated allowedChallengeTypes', () => {
        const onChange = vi.fn()
        render(<PuzzleLayerConfig value={defaultConfig} onChange={onChange} />)
        // Click the first puzzle checkbox
        const checkboxes = screen.getAllByRole('checkbox')
        fireEvent.click(checkboxes[0])
        expect(onChange).toHaveBeenCalledTimes(1)
        const emitted: PuzzleConfig = onChange.mock.calls[0][0]
        expect(emitted.allowedChallengeTypes).toHaveLength(1)
    })

    it('toggling identity-binding switch calls onChange with updated alsoMatchFaceIdentity', () => {
        const onChange = vi.fn()
        render(<PuzzleLayerConfig value={defaultConfig} onChange={onChange} />)
        // Find the identity-binding switch (it has a specific label text via i18n key)
        const toggleLabel = screen.getByText('biometricPuzzle.builder.identityBinding')
        const switchEl = toggleLabel.closest('label')!.querySelector('input[type="checkbox"]')!
        fireEvent.click(switchEl)
        expect(onChange).toHaveBeenCalledTimes(1)
        const emitted: PuzzleConfig = onChange.mock.calls[0][0]
        expect(emitted.alsoMatchFaceIdentity).toBe(false)
    })
})
