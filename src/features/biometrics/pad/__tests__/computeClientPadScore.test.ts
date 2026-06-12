/**
 * computeClientPadScore — advisory client-side PAD score helper (SP-D).
 *
 * Verifies the helper runs the in-repo passive-liveness analyzer on a captured
 * frame and returns a NORMALISED 0..1 live-confidence + per-component breakdown,
 * and that it is RESILIENT (returns null, never throws) when the analyzer is
 * unavailable / fails / the image can't be decoded — so a FACE capture is never
 * blocked by a PAD-score failure.
 *
 * The analyzer (`PassiveLivenessDetector`, reached via `BiometricEngine`) and the
 * data-URL decode are mocked so the test is deterministic in jsdom (no canvas).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const CAPTURED_IMAGE = 'data:image/jpeg;base64,AAAA'

// Injectable mock for the passive-liveness analyzer behind BiometricEngine.
const livenessState: {
    detector: {
        isAvailable: () => boolean
        check: (img: ImageData) => unknown
    } | null
} = { detector: null }

vi.mock('@/lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: {
        getInstance: () => ({ livenessDetector: livenessState.detector }),
    },
}))

// Injectable mock for the data-URL → ImageData decode (no canvas in jsdom).
const decodeState: { result: ImageData | null } = { result: null }
vi.mock('@features/auth/utils/faceCropper', () => ({
    dataURLToImageData: vi.fn(async () => decodeState.result),
}))

import { computeClientPadScore } from '../computeClientPadScore'

// A non-degenerate fake ImageData (width/height > 2 so the size guard passes).
function fakeImageData(width = 64, height = 64): ImageData {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) } as ImageData
}

describe('computeClientPadScore (SP-D advisory)', () => {
    beforeEach(() => {
        livenessState.detector = null
        decodeState.result = null
    })

    it('returns a normalised 0..1 score + breakdown when the analyzer succeeds', async () => {
        decodeState.result = fakeImageData()
        livenessState.detector = {
            isAvailable: () => true,
            check: () => ({
                isLive: true,
                score: 82,
                breakdown: { texture: 90, color: 100, skinTone: 70, moire: 80, localVariance: 60 },
            }),
        }

        const pad = await computeClientPadScore(CAPTURED_IMAGE)

        expect(pad).not.toBeNull()
        // 82/100 → 0.82, on a 0..1 scale.
        expect(pad!.score).toBeCloseTo(0.82, 4)
        expect(pad!.score).toBeGreaterThanOrEqual(0)
        expect(pad!.score).toBeLessThanOrEqual(1)
        expect(pad!.breakdown).toEqual({
            texture: 0.9,
            color: 1,
            skinTone: 0.7,
            moire: 0.8,
            localVariance: 0.6,
        })
    })

    it('clamps out-of-range detector values into [0, 1]', async () => {
        decodeState.result = fakeImageData()
        livenessState.detector = {
            isAvailable: () => true,
            check: () => ({
                isLive: false,
                score: 140,
                breakdown: { texture: -20, color: 200, skinTone: 50, moire: 50, localVariance: 50 },
            }),
        }

        const pad = await computeClientPadScore(CAPTURED_IMAGE)

        expect(pad!.score).toBe(1)
        expect(pad!.breakdown.texture).toBe(0)
        expect(pad!.breakdown.color).toBe(1)
    })

    it('returns null (does NOT throw) when the analyzer is unavailable', async () => {
        decodeState.result = fakeImageData()
        livenessState.detector = { isAvailable: () => false, check: () => ({}) }

        await expect(computeClientPadScore(CAPTURED_IMAGE)).resolves.toBeNull()
    })

    it('returns null when there is no analyzer at all', async () => {
        decodeState.result = fakeImageData()
        livenessState.detector = null

        await expect(computeClientPadScore(CAPTURED_IMAGE)).resolves.toBeNull()
    })

    it('returns null when the image cannot be decoded', async () => {
        decodeState.result = null
        livenessState.detector = { isAvailable: () => true, check: () => ({ score: 50 }) }

        await expect(computeClientPadScore(CAPTURED_IMAGE)).resolves.toBeNull()
    })

    it('returns null on a degenerate (too-small) frame', async () => {
        decodeState.result = fakeImageData(1, 1)
        livenessState.detector = { isAvailable: () => true, check: () => ({ score: 50 }) }

        await expect(computeClientPadScore(CAPTURED_IMAGE)).resolves.toBeNull()
    })

    it('returns null (never throws) when the analyzer throws', async () => {
        decodeState.result = fakeImageData()
        livenessState.detector = {
            isAvailable: () => true,
            check: () => {
                throw new Error('analyzer boom')
            },
        }

        await expect(computeClientPadScore(CAPTURED_IMAGE)).resolves.toBeNull()
    })
})
