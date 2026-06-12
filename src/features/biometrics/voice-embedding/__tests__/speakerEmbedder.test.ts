import { describe, it, expect, vi } from 'vitest'
import {
    SpeakerEmbedder,
    l2Normalize,
    VOICE_EMBEDDING_DIMENSION,
} from '../speakerEmbedder'
import { PARTIAL_N_FRAMES, MEL_N_CHANNELS, TARGET_SAMPLE_RATE } from '../voicePreprocess'

/**
 * A fake onnxruntime-web module. The fake model returns a FIXED unit-ish vector
 * per call so we can assert the embedder's orchestration: one inference per
 * partial, (1,160,40) input shape, mean-of-partials then final L2-norm.
 */
function makeFakeOrt(onRun: (dims: readonly number[]) => Float32Array) {
    const runs: Array<readonly number[]> = []
    const ort = {
        env: { wasm: {} as { wasmPaths?: string } },
        Tensor: class {
            type: string
            data: Float32Array
            dims: readonly number[]
            constructor(type: string, data: Float32Array, dims: readonly number[]) {
                this.type = type
                this.data = data
                this.dims = dims
            }
        },
        InferenceSession: {
            create: vi.fn(async () => ({
                inputNames: ['mels'],
                outputNames: ['embeds'],
                run: vi.fn(async (feeds: Record<string, { dims: readonly number[] }>) => {
                    const dims = feeds['mels'].dims
                    runs.push(dims)
                    return { embeds: { data: onRun(dims) } }
                }),
            })),
        },
    }
    return { ort, runs }
}

function oneSecondTone(): Float32Array {
    const wav = new Float32Array(TARGET_SAMPLE_RATE)
    for (let i = 0; i < wav.length; i++) wav[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / TARGET_SAMPLE_RATE)
    return wav
}

describe('l2Normalize', () => {
    it('returns a unit-norm vector', () => {
        const out = l2Normalize(new Float32Array([3, 4]))
        expect(Math.hypot(out[0], out[1])).toBeCloseTo(1, 6)
    })
    it('passes a zero vector through without NaN', () => {
        const out = l2Normalize(new Float32Array([0, 0]))
        expect(out.every((v) => Number.isFinite(v))).toBe(true)
    })
})

describe('SpeakerEmbedder.embed', () => {
    it('feeds (1,160,40) per partial and returns an L2-normalized 256-d vector', async () => {
        // Fixed per-call vector → mean == that vector → normalized.
        const fixed = new Float32Array(VOICE_EMBEDDING_DIMENSION)
        for (let i = 0; i < fixed.length; i++) fixed[i] = (i % 7) - 3
        const { ort, runs } = makeFakeOrt(() => fixed.slice())

        // sha256 null → skip model fetch; pass a dummy URL.
        const embedder = new SpeakerEmbedder(ort as never, 'dummy://model', undefined, null)
        const vec = await embedder.embed(oneSecondTone())

        expect(vec.length).toBe(VOICE_EMBEDDING_DIMENSION)
        // Result is L2-normalized.
        let sumSq = 0
        for (const v of vec) sumSq += v * v
        expect(Math.sqrt(sumSq)).toBeCloseTo(1, 5)

        // At least one inference, each with the (1,160,40) partial shape.
        expect(runs.length).toBeGreaterThanOrEqual(1)
        for (const dims of runs) {
            expect(dims).toEqual([1, PARTIAL_N_FRAMES, MEL_N_CHANNELS])
        }
    })

    it('reuses the ONNX session across calls (loads once)', async () => {
        const fixed = new Float32Array(VOICE_EMBEDDING_DIMENSION).fill(0.5)
        const { ort } = makeFakeOrt(() => fixed.slice())
        const embedder = new SpeakerEmbedder(ort as never, 'dummy://model', undefined, null)

        await embedder.embed(oneSecondTone())
        await embedder.embed(oneSecondTone())

        expect(ort.InferenceSession.create).toHaveBeenCalledTimes(1)
    })
})
