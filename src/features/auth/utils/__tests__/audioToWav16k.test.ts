/**
 * Unit tests for audioToWav16k.
 *
 * We exercise the pure `encodeAudioBufferViewToWav16kMono` function with a
 * synthetic sine-wave AudioBuffer stub — jsdom has no real AudioContext, so
 * the blob-level `encodeToWav16kMono` path is not directly testable here
 * without browser-backed fixtures. The pure encoder covers all the logic
 * that actually matters: downmix, resample, WAV header, Int16 encoding.
 */

import { describe, it, expect } from 'vitest'
import {
    encodeAudioBufferViewToWav16kMono,
    WAV16K_HEADER_SIZE,
    WAV16K_SAMPLE_RATE,
    type AudioBufferView,
} from '../audioToWav16k'

/**
 * Build a synthetic mono sine-wave AudioBufferView at the requested rate.
 * Amplitude stays in [-0.5, 0.5] so we can round-trip samples without
 * running into clipping at ±1.0.
 */
function makeSineBuffer(
    sampleRate: number,
    durationSec: number,
    frequencyHz: number,
): AudioBufferView {
    const length = Math.floor(sampleRate * durationSec)
    const data = new Float32Array(length)
    const twoPiF = 2 * Math.PI * frequencyHz
    for (let i = 0; i < length; i++) {
        data[i] = 0.5 * Math.sin((twoPiF * i) / sampleRate)
    }
    return {
        numberOfChannels: 1,
        sampleRate,
        length,
        getChannelData: () => data,
    }
}

/**
 * Build a synthetic stereo AudioBufferView where the two channels are
 * opposite sign so downmix should produce near-silence.
 */
function makeOppositeStereoBuffer(
    sampleRate: number,
    durationSec: number,
): AudioBufferView {
    const length = Math.floor(sampleRate * durationSec)
    const left = new Float32Array(length)
    const right = new Float32Array(length)
    for (let i = 0; i < length; i++) {
        left[i] = 0.25
        right[i] = -0.25
    }
    return {
        numberOfChannels: 2,
        sampleRate,
        length,
        getChannelData: (ch: number) => (ch === 0 ? left : right),
    }
}

describe('encodeAudioBufferViewToWav16kMono', () => {
    it('emits a RIFF/WAVE header with the expected fmt chunk values', () => {
        const buffer = makeSineBuffer(16000, 0.25, 440)
        const wav = encodeAudioBufferViewToWav16kMono(buffer)
        const view = new DataView(wav)

        // RIFF magic
        expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)))
            .toBe('RIFF')
        // WAVE format
        expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)))
            .toBe('WAVE')
        // "fmt " chunk id
        expect(String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15)))
            .toBe('fmt ')
        // "data" chunk id
        expect(String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39)))
            .toBe('data')

        // fmt chunk size = 16 (PCM)
        expect(view.getUint32(16, true)).toBe(16)
        // PCM format
        expect(view.getUint16(20, true)).toBe(1)
        // mono
        expect(view.getUint16(22, true)).toBe(1)
        // 16 kHz
        expect(view.getUint32(24, true)).toBe(WAV16K_SAMPLE_RATE)
        // byte rate = sampleRate * 2 bytes/sample (mono 16-bit)
        expect(view.getUint32(28, true)).toBe(WAV16K_SAMPLE_RATE * 2)
        // block align = 2 (mono 16-bit)
        expect(view.getUint16(32, true)).toBe(2)
        // 16 bits per sample
        expect(view.getUint16(34, true)).toBe(16)
    })

    it('writes the correct sample count for a 16 kHz input', () => {
        const buffer = makeSineBuffer(16000, 0.5, 440)
        const wav = encodeAudioBufferViewToWav16kMono(buffer)
        const view = new DataView(wav)

        const dataChunkSize = view.getUint32(40, true)
        const expectedSamples = Math.floor(16000 * 0.5)
        expect(dataChunkSize).toBe(expectedSamples * 2)
        expect(wav.byteLength).toBe(WAV16K_HEADER_SIZE + expectedSamples * 2)
    })

    it('resamples a 48 kHz input down to 16 kHz', () => {
        const buffer = makeSineBuffer(48000, 1.0, 440)
        const wav = encodeAudioBufferViewToWav16kMono(buffer)
        const view = new DataView(wav)

        // 1.0s at 48 kHz => 48000 samples => resampled to ~16000 samples
        const sampleCount = view.getUint32(40, true) / 2
        expect(sampleCount).toBeGreaterThanOrEqual(15990)
        expect(sampleCount).toBeLessThanOrEqual(16010)
    })

    it('spot-checks a near-zero sample value near t=0 of a sine wave', () => {
        const buffer = makeSineBuffer(16000, 0.1, 100)
        const wav = encodeAudioBufferViewToWav16kMono(buffer)
        const view = new DataView(wav)

        // First PCM sample is sin(0) = 0 → Int16 encodes to 0.
        const firstSample = view.getInt16(WAV16K_HEADER_SIZE, true)
        expect(firstSample).toBe(0)

        // A couple of samples later should be non-zero for a non-trivial sine.
        const tenthSample = view.getInt16(WAV16K_HEADER_SIZE + 10 * 2, true)
        expect(tenthSample).not.toBe(0)
    })

    it('downmixes opposing stereo channels close to silence', () => {
        const buffer = makeOppositeStereoBuffer(16000, 0.1)
        const wav = encodeAudioBufferViewToWav16kMono(buffer)
        const view = new DataView(wav)

        // All PCM samples should be 0 after averaging +0.25 and -0.25.
        const totalSamples = view.getUint32(40, true) / 2
        for (let i = 0; i < totalSamples; i++) {
            expect(view.getInt16(WAV16K_HEADER_SIZE + i * 2, true)).toBe(0)
        }
    })
})
