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

// The real registry has 23 entries (14 face + 9 hand). The builder offers only
// the RENDERABLE ones — those a server action maps back to (`isRenderablePuzzleId`).
import {
    listBiometricPuzzles,
    getBiometricPuzzle,
} from '@features/biometric-puzzles/biometricPuzzleRegistry'
import {
    isRenderablePuzzleId,
    RENDERABLE_PUZZLE_IDS,
} from '@features/biometric-puzzles/puzzleServerAction'
import { BiometricPuzzleId } from '@features/biometric-puzzles/BiometricPuzzleId'

describe('PuzzleLayerConfig', () => {
    const defaultConfig: PuzzleConfig = {
        allowedChallengeTypes: [],
        count: 2,
        difficulty: 'medium',
        alsoMatchFaceIdentity: true,
    }

    it('renders one checkbox per RENDERABLE challenge type (21: 14 face + 7 hand)', () => {
        const renderable = listBiometricPuzzles().filter((p) =>
            isRenderablePuzzleId(p.id),
        )
        render(<PuzzleLayerConfig value={defaultConfig} onChange={vi.fn()} />)
        // 21 renderable puzzles are offered (HAND_TRACE_TEMPLATE + HAND_SHAPE_TRACE excluded).
        expect(renderable).toHaveLength(21)
        const checkboxes = screen.getAllByRole('checkbox')
        // 21 puzzle checkboxes + the identity-binding Switch (role=checkbox).
        expect(checkboxes).toHaveLength(renderable.length + 1)
    })

    it('OFFERS every renderable challenge type by its i18n title', () => {
        render(<PuzzleLayerConfig value={defaultConfig} onChange={vi.fn()} />)
        for (const id of RENDERABLE_PUZZLE_IDS) {
            const i18nKey = getBiometricPuzzle(id).i18nKey
            expect(screen.getByText(`${i18nKey}.title`)).toBeTruthy()
        }
    })

    it('does NOT offer the unrenderable HAND_TRACE_TEMPLATE (no server action)', () => {
        // light / hold_position have no BiometricPuzzleId at all, so the only
        // registry entry the filter must drop is the client-only template trace.
        expect(isRenderablePuzzleId(BiometricPuzzleId.HAND_TRACE_TEMPLATE)).toBe(false)
        render(<PuzzleLayerConfig value={defaultConfig} onChange={vi.fn()} />)
        const dropped = getBiometricPuzzle(BiometricPuzzleId.HAND_TRACE_TEMPLATE).i18nKey
        expect(screen.queryByText(`${dropped}.title`)).toBeNull()
    })

    it('does NOT offer HAND_SHAPE_TRACE (free-form trace has no dtw_cost — unmapped 2026-06-12)', () => {
        // The free-form shape trace can't produce bio's `dtw_cost` metric, so its
        // metric-REQUIRED auth path is unsatisfiable; the builder must never offer it.
        expect(isRenderablePuzzleId(BiometricPuzzleId.HAND_SHAPE_TRACE)).toBe(false)
        render(<PuzzleLayerConfig value={defaultConfig} onChange={vi.fn()} />)
        const dropped = getBiometricPuzzle(BiometricPuzzleId.HAND_SHAPE_TRACE).i18nKey
        expect(screen.queryByText(`${dropped}.title`)).toBeNull()
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
