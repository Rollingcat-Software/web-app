import { describe, expect, it } from 'vitest'
import { PUZZLE_REGISTRY, listPuzzles, BiometricPuzzleId } from '../puzzleRegistry'
import en from '@/i18n/locales/en.json'
import tr from '@/i18n/locales/tr.json'

type NestedRecord = Record<string, unknown>

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

    it('registers 14 face + 9 hand micro-challenges (23 total)', () => {
        expect(puzzles.length).toBe(23)
        expect(puzzles.filter((p) => p.modality === 'face').length).toBe(14)
        expect(puzzles.filter((p) => p.modality === 'hand').length).toBe(9)
    })

    it('registry keys match puzzle ids', () => {
        for (const [key, puzzle] of Object.entries(PUZZLE_REGISTRY)) {
            expect(puzzle.id).toBe(key)
        }
    })

    it('covers every BiometricPuzzleId enum value', () => {
        const ids = new Set(Object.values(BiometricPuzzleId))
        for (const id of ids) {
            expect(PUZZLE_REGISTRY[id]).toBeDefined()
        }
    })

    describe.each(puzzles)('$id', (puzzle) => {
        it('has a non-null component', () => {
            expect(puzzle.component).toBeTruthy()
            expect(typeof puzzle.component).toBe('function')
        })

        it(`resolves ${puzzle.i18nKey}.title + .description in en + tr`, () => {
            expect(resolveKey(en as NestedRecord, `${puzzle.i18nKey}.title`)).toEqual(
                expect.any(String),
            )
            expect(resolveKey(en as NestedRecord, `${puzzle.i18nKey}.description`)).toEqual(
                expect.any(String),
            )
            expect(resolveKey(tr as NestedRecord, `${puzzle.i18nKey}.title`)).toEqual(
                expect.any(String),
            )
            expect(resolveKey(tr as NestedRecord, `${puzzle.i18nKey}.description`)).toEqual(
                expect.any(String),
            )
        })

        it('has non-empty platforms', () => {
            expect(puzzle.platforms.length).toBeGreaterThan(0)
        })
    })
})
