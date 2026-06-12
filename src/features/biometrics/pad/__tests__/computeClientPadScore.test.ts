/**
 * computeClientPadScore — advisory client-side PAD score helper (SP-D, Phase-1B).
 *
 * Verifies the analyzer SWAP: the helper runs the **real MiniFASNet** single-frame
 * analyzer first and returns its 0..1 live-confidence when available; on ANY
 * MiniFASNet failure it FALLS BACK to the light `PassiveLivenessDetector` (the
 * 5-component passive scorer, with breakdown); and it is RESILIENT (returns null,
 * never throws) when both are unavailable / fail / the image can't be decoded —
 * so a FACE capture is never blocked by a PAD-score failure.
 *
 * The MiniFASNet analyzer (no real 1.7 MB ONNX load), the light analyzer (via
 * BiometricEngine) and the data-URL decode are all mocked so the test is
 * deterministic in jsdom (no canvas, no network).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const CAPTURED_IMAGE = 'data:image/jpeg;base64,AAAA'

// Injectable mock for the REAL MiniFASNet analyzer (primary path). `scoreFace`
// returns a 0..1 live-confidence, or null on failure (model not hosted, etc.).
const miniFasNetState: { score: number | null; throws: boolean } = {
    score: null,
    throws: false,
}
const scoreFaceMock = vi.fn(async () => {
    if (miniFasNetState.throws) throw new Error('minifasnet boom')
    return miniFasNetState.score
})
vi.mock('../MiniFasNetPadAnalyzer', () => ({
    MINIFASNET_MODEL_URL: '/models/minifasnet_v2.onnx',
    // A real (non-arrow) class so `new MiniFasNetPadAnalyzer()` constructs.
    MiniFasNetPadAnalyzer: class {
        scoreFace = scoreFaceMock
    },
}))

// Injectable mock for the light passive-liveness analyzer behind BiometricEngine.
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

const LIGHT_DETECTOR = {
    isAvailable: () => true,
    check: () => ({
        isLive: true,
        score: 82,
        breakdown: { texture: 90, color: 100, skinTone: 70, moire: 80, localVariance: 60 },
    }),
}

describe('computeClientPadScore (SP-D advisory, MiniFASNet swap)', () => {
    beforeEach(() => {
        miniFasNetState.score = null
        miniFasNetState.throws = false
        livenessState.detector = null
        decodeState.result = null
        scoreFaceMock.mockClear()
    })

    it('uses the MiniFASNet score (source=minifasnet) when the model is available', async () => {
        decodeState.result = fakeImageData()
        miniFasNetState.score = 0.93
        // Light detector is present but must NOT be used when MiniFASNet succeeds.
        livenessState.detector = LIGHT_DETECTOR

        const pad = await computeClientPadScore(CAPTURED_IMAGE)

        expect(pad).not.toBeNull()
        expect(pad!.score).toBeCloseTo(0.93, 4)
        expect(pad!.source).toBe('minifasnet')
        // MiniFASNet path carries no per-heuristic breakdown.
        expect(pad!.breakdown).toBeUndefined()
        expect(scoreFaceMock).toHaveBeenCalledTimes(1)
    })

    it('falls back to the light passive detector when MiniFASNet returns null', async () => {
        decodeState.result = fakeImageData()
        miniFasNetState.score = null // model not hosted / fetch failed
        livenessState.detector = LIGHT_DETECTOR

        const pad = await computeClientPadScore(CAPTURED_IMAGE)

        expect(pad).not.toBeNull()
        expect(pad!.source).toBe('passive')
        // 82/100 → 0.82 on a 0..1 scale, with the per-component breakdown.
        expect(pad!.score).toBeCloseTo(0.82, 4)
        expect(pad!.breakdown).toEqual({
            texture: 0.9,
            color: 1,
            skinTone: 0.7,
            moire: 0.8,
            localVariance: 0.6,
        })
    })

    it('falls back to the light detector even if MiniFASNet throws (never propagates)', async () => {
        decodeState.result = fakeImageData()
        miniFasNetState.throws = true
        livenessState.detector = LIGHT_DETECTOR

        // computeClientPadScore must NOT throw; the analyzer itself swallows, but
        // the helper is resilient regardless. Result is the light fallback.
        const pad = await computeClientPadScore(CAPTURED_IMAGE)
        // MiniFasNetPadAnalyzer.scoreFace swallows internally → null → fallback.
        // (Our mock throws to prove computeClientPadScore never propagates.)
        expect(pad).not.toBeNull()
        expect(pad!.source).toBe('passive')
    })

    it('clamps out-of-range light-detector values into [0, 1] on the fallback path', async () => {
        decodeState.result = fakeImageData()
        miniFasNetState.score = null
        livenessState.detector = {
            isAvailable: () => true,
            check: () => ({
                isLive: false,
                score: 140,
                breakdown: { texture: -20, color: 200, skinTone: 50, moire: 50, localVariance: 50 },
            }),
        }

        const pad = await computeClientPadScore(CAPTURED_IMAGE)

        expect(pad!.source).toBe('passive')
        expect(pad!.score).toBe(1)
        expect(pad!.breakdown!.texture).toBe(0)
        expect(pad!.breakdown!.color).toBe(1)
    })

    it('returns null when MiniFASNet fails AND the light detector is unavailable', async () => {
        decodeState.result = fakeImageData()
        miniFasNetState.score = null
        livenessState.detector = { isAvailable: () => false, check: () => ({}) }

        await expect(computeClientPadScore(CAPTURED_IMAGE)).resolves.toBeNull()
    })

    it('returns null when MiniFASNet fails AND there is no light detector at all', async () => {
        decodeState.result = fakeImageData()
        miniFasNetState.score = null
        livenessState.detector = null

        await expect(computeClientPadScore(CAPTURED_IMAGE)).resolves.toBeNull()
    })

    it('returns null when the image cannot be decoded (neither analyzer runs)', async () => {
        decodeState.result = null
        miniFasNetState.score = 0.9
        livenessState.detector = LIGHT_DETECTOR

        await expect(computeClientPadScore(CAPTURED_IMAGE)).resolves.toBeNull()
        expect(scoreFaceMock).not.toHaveBeenCalled()
    })

    it('returns null on a degenerate (too-small) frame', async () => {
        decodeState.result = fakeImageData(1, 1)
        miniFasNetState.score = 0.9
        livenessState.detector = LIGHT_DETECTOR

        await expect(computeClientPadScore(CAPTURED_IMAGE)).resolves.toBeNull()
        expect(scoreFaceMock).not.toHaveBeenCalled()
    })

    it('never throws even when the light fallback analyzer throws', async () => {
        decodeState.result = fakeImageData()
        miniFasNetState.score = null
        livenessState.detector = {
            isAvailable: () => true,
            check: () => {
                throw new Error('analyzer boom')
            },
        }

        await expect(computeClientPadScore(CAPTURED_IMAGE)).resolves.toBeNull()
    })
})
