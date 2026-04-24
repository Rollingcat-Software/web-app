import { describe, expect, it } from 'vitest'
import { PUZZLE_REGISTRY, listPuzzles } from '../puzzleRegistry'
import en from '@/i18n/locales/en.json'

type NestedRecord = Record<string, unknown>

/**
 * Resolve a dotted `a.b.c` key against a nested object — returns `null` if
 * any segment is missing. Mirrors i18next lookup.
 */
function resolveKey(obj: NestedRecord, key: string): unknown {
    return key
        .split('.')
        .reduce<unknown>((acc, seg) => {
            if (acc && typeof acc === 'object' && seg in (acc as NestedRecord)) {
                return (acc as NestedRecord)[seg]
            }
            return null
        }, obj)
}

describe('puzzleRegistry', () => {
    const puzzles = listPuzzles()

    it('registers at least the nine existing step components', () => {
        // Sanity check — if this drops below 9 we've accidentally dropped a puzzle.
        expect(puzzles.length).toBeGreaterThanOrEqual(9)
    })

    it('registry keys match puzzle ids', () => {
        for (const [key, puzzle] of Object.entries(PUZZLE_REGISTRY)) {
            if (!puzzle) continue
            expect(puzzle.id).toBe(key)
        }
    })

    describe.each(puzzles)('$id', (puzzle) => {
        it('has a non-null component', () => {
            expect(puzzle.component).toBeTruthy()
            expect(typeof puzzle.component).toBe('function')
        })

        it('declares at least one platform', () => {
            expect(puzzle.platforms.length).toBeGreaterThan(0)
        })

        it('has title and description translations in en.json', () => {
            const title = resolveKey(en as NestedRecord, `${puzzle.i18nKey}.title`)
            const description = resolveKey(
                en as NestedRecord,
                `${puzzle.i18nKey}.description`,
            )
            expect(title, `${puzzle.i18nKey}.title missing in en.json`).toBeTruthy()
            expect(typeof title).toBe('string')
            expect(
                description,
                `${puzzle.i18nKey}.description missing in en.json`,
            ).toBeTruthy()
            expect(typeof description).toBe('string')
        })
    })

    it('all shared namespace keys resolve in en.json', () => {
        const requiredKeys = [
            'biometricPuzzle.pageTitle',
            'biometricPuzzle.pageSubtitle',
            'biometricPuzzle.tryButton',
            'biometricPuzzle.closeButton',
            'biometricPuzzle.tryAgainButton',
            'biometricPuzzle.previewLabel',
            'biometricPuzzle.platformLabel',
            'biometricPuzzle.requiresEnrollment',
            'biometricPuzzle.stubbedOnly',
            'biometricPuzzle.successMessage',
            'biometricPuzzle.errorMessage',
            'biometricPuzzle.difficulty.beginner',
            'biometricPuzzle.difficulty.intermediate',
            'biometricPuzzle.difficulty.advanced',
            'biometricPuzzle.platforms.web',
            'biometricPuzzle.platforms.android',
            'biometricPuzzle.platforms.ios',
            'biometricPuzzle.platforms.desktop',
        ]

        for (const key of requiredKeys) {
            const value = resolveKey(en as NestedRecord, key)
            expect(value, `${key} missing in en.json`).toBeTruthy()
            expect(typeof value).toBe('string')
        }
    })
})
