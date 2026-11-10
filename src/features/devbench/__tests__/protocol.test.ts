import { describe, it, expect } from 'vitest'
import { deviceKey, makeInput, newBatchId, percentile, summariseWarm, INPUT_DIMS } from '../protocol'

describe('devbench protocol', () => {
    it('percentile_WhenOddList_ShouldInterpolateLikeArtifact', () => {
        expect(percentile([5, 1, 3], 0.5)).toBe(3)
        expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5)
        expect(percentile([10, 20], 0.95)).toBeCloseTo(19.5)
    })

    it('summariseWarm_WhenSamples_ShouldRoundToTwoDecimals', () => {
        const s = summariseWarm([1.234, 2.345, 3.456])
        expect(s).toMatchObject({ n: 3, p50: 2.35, min: 1.23, max: 3.46, mean: 2.35 })
        expect(s.all).toEqual([1.23, 2.35, 3.46])
    })

    it('makeInput_ShouldBeDeterministicAndMatchArtifactLcg', () => {
        const a = makeInput(INPUT_DIMS)
        expect(a.length).toBe(1 * 160 * 160 * 3)
        expect(makeInput(INPUT_DIMS)).toEqual(a)
        // first value of the artifact's LCG: s = (12345 * 1103515245 + 12345) >>> 0
        let s = 12345
        s = (s * 1103515245 + 12345) >>> 0
        expect(a[0]).toBeCloseTo((s >>> 8) / 16777216, 7)
        expect(Math.max(...a.slice(0, 1000))).toBeLessThan(1)
    })

    it('deviceKey_ShouldStripBrowserNamesAndAlias', () => {
        expect(deviceKey('SM-A145F Chrome')).toBe('sm-a145f')
        expect(deviceKey('HP Victus Gaming')).toBe('hp-victus')
        expect(deviceKey('')).toBe('unknown')
    })

    it('newBatchId_ShouldBeDigitsPlusFourChars', () => {
        expect(newBatchId(new Date('2026-11-10T20:00:00.000Z'), () => 0.123456)).toMatch(/^20261110200000000[a-z0-9]{4}$/)
    })
})

describe('outcomeOf', () => {
    it('outcomeOf_ShouldPreferNotSentOverRunResults', async () => {
        const { outcomeOf } = await import('../useDevbench')
        expect(outcomeOf(3, 0)).toBe('saved')
        expect(outcomeOf(3, 2)).toBe('notSent')
        expect(outcomeOf(1, 0)).toBe('partial')
        expect(outcomeOf(0, 0)).toBe('failed')
    })
})
