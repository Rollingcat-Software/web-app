import { describe, it, expect } from 'vitest'
import {
    decodeWavBytes,
    normalizeVolumeIncreaseOnly,
    wavToMelSpectrogram,
    computePartialSlices,
    buildMelPartials,
    MEL_N_CHANNELS,
    PARTIAL_N_FRAMES,
    TARGET_SAMPLE_RATE,
} from '../voicePreprocess'

/** Build a canonical 16 kHz mono 16-bit PCM WAV ArrayBuffer from Float32 samples. */
function makeWav(samples: Float32Array): ArrayBuffer {
    const headerSize = 44
    const dataSize = samples.length * 2
    const buf = new ArrayBuffer(headerSize + dataSize)
    const view = new DataView(buf)
    const writeStr = (off: number, s: string) => {
        for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
    }
    writeStr(0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    writeStr(8, 'WAVE')
    writeStr(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true) // PCM
    view.setUint16(22, 1, true) // mono
    view.setUint32(24, TARGET_SAMPLE_RATE, true)
    view.setUint32(28, TARGET_SAMPLE_RATE * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeStr(36, 'data')
    view.setUint32(40, dataSize, true)
    for (let i = 0; i < samples.length; i++) {
        const v = Math.max(-1, Math.min(1, samples[i]))
        view.setInt16(headerSize + i * 2, Math.round(v * 32767), true)
    }
    return buf
}

describe('decodeWavBytes', () => {
    it('round-trips 16-bit PCM samples to Float32 in [-1, 1]', () => {
        const input = new Float32Array([0, 0.5, -0.5, 1, -1])
        const decoded = decodeWavBytes(makeWav(input))
        expect(decoded).not.toBeNull()
        expect(decoded!.length).toBe(input.length)
        // 16-bit quantization tolerance.
        for (let i = 0; i < input.length; i++) {
            expect(decoded![i]).toBeCloseTo(input[i], 2)
        }
    })

    it('returns null for non-WAV bytes', () => {
        const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer
        expect(decodeWavBytes(junk)).toBeNull()
    })

    it('returns null for too-short input', () => {
        expect(decodeWavBytes(new ArrayBuffer(10))).toBeNull()
    })
})

describe('normalizeVolumeIncreaseOnly', () => {
    it('amplifies a quiet clip toward -30 dBFS', () => {
        const quiet = new Float32Array(1000).fill(0.001)
        const out = normalizeVolumeIncreaseOnly(quiet)
        // The gain must be > 1 (quiet clip boosted).
        expect(out[0]).toBeGreaterThan(quiet[0])
    })

    it('never attenuates an already-loud clip (increase_only)', () => {
        const loud = new Float32Array(1000).fill(0.9)
        const out = normalizeVolumeIncreaseOnly(loud)
        // Already louder than -30 dBFS → returned unchanged (same reference).
        expect(out).toBe(loud)
    })

    it('leaves a silent clip unchanged (no divide-by-zero)', () => {
        const silent = new Float32Array(500)
        const out = normalizeVolumeIncreaseOnly(silent)
        expect(out).toBe(silent)
    })
})

describe('wavToMelSpectrogram', () => {
    it('produces 40-channel mel frames at ~10ms hop', () => {
        // 1 second of a 440 Hz tone.
        const n = TARGET_SAMPLE_RATE
        const wav = new Float32Array(n)
        for (let i = 0; i < n; i++) wav[i] = 0.3 * Math.sin((2 * Math.PI * 440 * i) / TARGET_SAMPLE_RATE)
        const mel = wavToMelSpectrogram(wav)
        // center=True → ~ n/hop + 1 frames.
        expect(mel.length).toBeGreaterThan(95)
        expect(mel[0].length).toBe(MEL_N_CHANNELS)
        // All non-negative (power mel).
        for (const frame of mel) for (const v of frame) expect(v).toBeGreaterThanOrEqual(0)
    })
})

describe('computePartialSlices', () => {
    it('returns at least one 160-frame slice for a short clip', () => {
        const slices = computePartialSlices(TARGET_SAMPLE_RATE) // 1s
        expect(slices.length).toBeGreaterThanOrEqual(1)
        for (const [start, end] of slices) {
            expect(end - start).toBe(PARTIAL_N_FRAMES)
        }
    })

    it('produces multiple partials for a longer clip', () => {
        const slices = computePartialSlices(TARGET_SAMPLE_RATE * 5) // 5s
        expect(slices.length).toBeGreaterThan(1)
    })
})

describe('buildMelPartials', () => {
    it('builds (n_partials, 160, 40) mel partials', () => {
        const wav = new Float32Array(TARGET_SAMPLE_RATE * 2)
        for (let i = 0; i < wav.length; i++) wav[i] = 0.2 * Math.sin(i / 20)
        const partials = buildMelPartials(wav)
        expect(partials.length).toBeGreaterThanOrEqual(1)
        for (const p of partials) {
            expect(p.length).toBe(PARTIAL_N_FRAMES)
            expect(p[0].length).toBe(MEL_N_CHANNELS)
        }
    })
})
