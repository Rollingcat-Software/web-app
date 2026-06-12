/**
 * voicePreprocess — turn 16 kHz mono PCM into the mel-spectrogram partials the
 * Resemblyzer VoiceEncoder ONNX model expects.
 *
 * ⚠️ SCAFFOLD — NOT PARITY-VALIDATED. The Resemblyzer reference preprocessing is
 * `preprocess_wav` (dBFS normalize + WebRTC-VAD silence trim) →
 * `wav_to_mel_spectrogram` (librosa power-mel, n_fft 400 / hop 160 / 40 mels) →
 * partial slicing. This module reproduces the dBFS normalize, the mel
 * spectrogram, and the partial slicing, but DOES NOT reproduce the WebRTC VAD
 * silence trim (webrtcvad is a C extension with no bit-exact JS port). Skipping
 * the VAD shifts the embedding ≈0.11 cosine on clean audio vs the server, which
 * is risky near the 0.65 accept threshold. The mel here is a straightforward
 * Hann-window STFT + Slaney mel filterbank that APPROXIMATES librosa but has not
 * been validated frame-for-frame against the Python reference.
 *
 * Therefore the whole client voice-embedding path ships behind a default-OFF
 * flag and is documented as scaffold-only. Full load-bearing contract + the
 * exact steps to make this parity-correct + the canary plan are in
 * biometric-processor `docs/design/VOICE_CLIENT_EMBEDDING_SPEC.md`.
 *
 * Constants below are the Resemblyzer hparams.py values (load-bearing).
 */

export const TARGET_SAMPLE_RATE = 16_000
/** Mel-filterbank channels (model input feature dim). */
export const MEL_N_CHANNELS = 40
/** 25 ms window @ 16 kHz. */
export const N_FFT = 400
/** 10 ms hop @ 16 kHz. */
export const HOP_LENGTH = 160
/** A partial utterance is 160 frames (1.6 s). */
export const PARTIAL_N_FRAMES = 160
/** Resemblyzer embed_utterance defaults. */
export const PARTIAL_RATE = 1.3
export const MIN_COVERAGE = 0.75
/** Resemblyzer normalize_volume target. */
const TARGET_DBFS = -30
const INT16_MAX = 32767

/**
 * Decode a base64 data-URL of a 16 kHz mono PCM WAV (as produced by
 * `audioToWav16k.encodeToWav16kMono`) into a Float32 sample array in [-1, 1].
 *
 * Returns null on any parse failure (non-WAV, truncated, unsupported bit depth)
 * so callers can fall back to uploading the audio.
 */
export function decodeWav16kDataUrl(dataUrl: string): Float32Array | null {
    try {
        const commaIdx = dataUrl.indexOf(',')
        if (commaIdx < 0 || !dataUrl.startsWith('data:')) return null
        const binary = atob(dataUrl.slice(commaIdx + 1))
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        return decodeWavBytes(bytes.buffer)
    } catch {
        return null
    }
}

/**
 * Decode a canonical 44-byte-header PCM WAV ArrayBuffer (16-bit mono, 16 kHz)
 * into a Float32 sample array in [-1, 1]. Only the 16-bit PCM mono shape the
 * web-app's `encodeToWav16kMono` produces is supported; anything else → null.
 */
export function decodeWavBytes(buffer: ArrayBuffer): Float32Array | null {
    const view = new DataView(buffer)
    if (buffer.byteLength < 44) return null
    // 'RIFF' .... 'WAVE'
    if (view.getUint32(0, false) !== 0x52494646) return null // "RIFF"
    if (view.getUint32(8, false) !== 0x57415645) return null // "WAVE"

    const bitsPerSample = view.getUint16(34, true)
    const numChannels = view.getUint16(22, true)
    if (bitsPerSample !== 16) return null

    // Find the 'data' chunk (it is usually at offset 36, but scan to be safe).
    let offset = 12
    let dataOffset = -1
    let dataLen = 0
    while (offset + 8 <= buffer.byteLength) {
        const chunkId = view.getUint32(offset, false)
        const chunkSize = view.getUint32(offset + 4, true)
        if (chunkId === 0x64617461) {
            // "data"
            dataOffset = offset + 8
            dataLen = chunkSize
            break
        }
        offset += 8 + chunkSize + (chunkSize & 1)
    }
    if (dataOffset < 0) return null

    const available = Math.min(dataLen, buffer.byteLength - dataOffset)
    const totalSamples = Math.floor(available / 2)
    const frames = Math.floor(totalSamples / Math.max(1, numChannels))
    const out = new Float32Array(frames)
    for (let i = 0; i < frames; i++) {
        // Downmix to mono by averaging channels (the encoder writes mono, so
        // numChannels is 1, but this stays correct if that ever changes).
        let acc = 0
        for (let c = 0; c < numChannels; c++) {
            acc += view.getInt16(dataOffset + (i * numChannels + c) * 2, true)
        }
        out[i] = acc / numChannels / 32768
    }
    return out
}

/**
 * Resemblyzer `normalize_volume(wav, -30, increase_only=True)`: scale the
 * waveform up to -30 dBFS, never attenuating (a clip already louder is left
 * unchanged). Pure + exact — validate to ~1e-6 against the Python reference.
 */
export function normalizeVolumeIncreaseOnly(wav: Float32Array): Float32Array {
    let sumSq = 0
    for (let i = 0; i < wav.length; i++) {
        const s = wav[i] * INT16_MAX
        sumSq += s * s
    }
    if (wav.length === 0) return wav
    const rms = Math.sqrt(sumSq / wav.length)
    if (rms === 0) return wav
    const waveDbfs = 20 * Math.log10(rms / INT16_MAX)
    const dbfsChange = TARGET_DBFS - waveDbfs
    if (dbfsChange < 0) return wav // increase-only
    const gain = Math.pow(10, dbfsChange / 20)
    const out = new Float32Array(wav.length)
    for (let i = 0; i < wav.length; i++) out[i] = wav[i] * gain
    return out
}

// ── Mel spectrogram (librosa-approximate, SCAFFOLD) ──────────────────────────

let melCache: Float32Array[] | null = null

/** Periodic Hann window of length `n` (librosa default for melspectrogram). */
function hannWindow(n: number): Float32Array {
    const w = new Float32Array(n)
    for (let i = 0; i < n; i++) {
        w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / n))
    }
    return w
}

/** Hz → Slaney mel (librosa default, htk=False). */
function hzToMel(hz: number): number {
    const fMin = 0
    const fSp = 200 / 3
    let mel = (hz - fMin) / fSp
    const minLogHz = 1000
    const minLogMel = (minLogHz - fMin) / fSp
    const logstep = Math.log(6.4) / 27
    if (hz >= minLogHz) mel = minLogMel + Math.log(hz / minLogHz) / logstep
    return mel
}

/** Slaney mel → Hz (inverse of {@link hzToMel}). */
function melToHz(mel: number): number {
    const fMin = 0
    const fSp = 200 / 3
    let hz = fMin + fSp * mel
    const minLogHz = 1000
    const minLogMel = (minLogHz - fMin) / fSp
    const logstep = Math.log(6.4) / 27
    if (mel >= minLogMel) hz = minLogHz * Math.exp(logstep * (mel - minLogMel))
    return hz
}

/**
 * Slaney-normalized mel filterbank, shape (MEL_N_CHANNELS, N_FFT/2 + 1).
 * Approximates `librosa.filters.mel(sr, n_fft, n_mels, htk=False, norm='slaney')`.
 */
function melFilterbank(): Float32Array[] {
    if (melCache) return melCache
    const nFreqs = N_FFT / 2 + 1
    const fMax = TARGET_SAMPLE_RATE / 2
    const fftFreqs = new Float32Array(nFreqs)
    for (let i = 0; i < nFreqs; i++) fftFreqs[i] = (i * TARGET_SAMPLE_RATE) / N_FFT

    const melMin = hzToMel(0)
    const melMax = hzToMel(fMax)
    const melPoints = new Float32Array(MEL_N_CHANNELS + 2)
    for (let i = 0; i < melPoints.length; i++) {
        melPoints[i] = melToHz(melMin + ((melMax - melMin) * i) / (MEL_N_CHANNELS + 1))
    }

    const bank: Float32Array[] = []
    for (let m = 0; m < MEL_N_CHANNELS; m++) {
        const fLeft = melPoints[m]
        const fCenter = melPoints[m + 1]
        const fRight = melPoints[m + 2]
        const row = new Float32Array(nFreqs)
        // Slaney area normalization: 2 / (f[m+2] - f[m]).
        const enorm = 2 / (fRight - fLeft)
        for (let k = 0; k < nFreqs; k++) {
            const f = fftFreqs[k]
            const lower = (f - fLeft) / (fCenter - fLeft)
            const upper = (fRight - f) / (fRight - fCenter)
            const weight = Math.max(0, Math.min(lower, upper))
            row[k] = weight * enorm
        }
        bank.push(row)
    }
    melCache = bank
    return bank
}

/** Naive DFT power spectrum for one Hann-windowed frame (length N_FFT). */
function framePowerSpectrum(frame: Float32Array, window: Float32Array): Float32Array {
    const nFreqs = N_FFT / 2 + 1
    const power = new Float32Array(nFreqs)
    for (let k = 0; k < nFreqs; k++) {
        let re = 0
        let im = 0
        for (let n = 0; n < N_FFT; n++) {
            const angle = (-2 * Math.PI * k * n) / N_FFT
            const x = frame[n] * window[n]
            re += x * Math.cos(angle)
            im += x * Math.sin(angle)
        }
        power[k] = re * re + im * im
    }
    return power
}

/**
 * Power mel spectrogram, shape (n_frames, MEL_N_CHANNELS). Reproduces
 * `librosa.feature.melspectrogram(power=2.0)` with center=True (reflect pad by
 * N_FFT/2) + Hann window. NOT log-mel.
 *
 * SCAFFOLD: this is an O(n·N_FFT^2) naive DFT — correct in shape but slow and
 * not validated frame-for-frame against librosa's FFT. A production port should
 * use an FFT and validate the matrix to a tight tolerance (see the spec).
 */
export function wavToMelSpectrogram(wav: Float32Array): Float32Array[] {
    const window = hannWindow(N_FFT)
    const bank = melFilterbank()
    const pad = Math.floor(N_FFT / 2)

    // center=True → reflect-pad by N_FFT/2 on both ends.
    const padded = new Float32Array(wav.length + 2 * pad)
    for (let i = 0; i < pad; i++) padded[i] = wav[Math.min(pad - i, wav.length - 1)] ?? 0
    padded.set(wav, pad)
    for (let i = 0; i < pad; i++) {
        padded[pad + wav.length + i] = wav[wav.length - 2 - i] ?? 0
    }

    const nFrames = 1 + Math.floor((padded.length - N_FFT) / HOP_LENGTH)
    const mels: Float32Array[] = []
    const frame = new Float32Array(N_FFT)
    for (let t = 0; t < nFrames; t++) {
        const start = t * HOP_LENGTH
        frame.set(padded.subarray(start, start + N_FFT))
        const power = framePowerSpectrum(frame, window)
        const mel = new Float32Array(MEL_N_CHANNELS)
        for (let m = 0; m < MEL_N_CHANNELS; m++) {
            const row = bank[m]
            let acc = 0
            for (let k = 0; k < row.length; k++) acc += row[k] * power[k]
            mel[m] = acc
        }
        mels.push(mel)
    }
    return mels
}

/**
 * Resemblyzer `compute_partial_slices`: the frame-index ranges [start, end) of
 * each 160-frame partial. Pure index arithmetic ported directly from
 * voice_encoder.py.
 */
export function computePartialSlices(nSamples: number): Array<[number, number]> {
    const samplesPerFrame = Math.floor((TARGET_SAMPLE_RATE * 10) / 1000) // = HOP_LENGTH
    const nFrames = Math.floor((nSamples - 1) / samplesPerFrame + 1)
    const frameStep = Math.max(
        1,
        Math.floor(Math.round((TARGET_SAMPLE_RATE / PARTIAL_RATE) / samplesPerFrame)),
    )

    const slices: Array<[number, number]> = []
    for (let i = 0; ; i += frameStep) {
        const melRangeStart = i
        const melRangeEnd = i + PARTIAL_N_FRAMES
        if (melRangeEnd > nFrames) {
            // Last partial: keep it only if coverage >= MIN_COVERAGE (else drop),
            // but always keep at least one slice.
            const coverage = (nFrames - melRangeStart) / PARTIAL_N_FRAMES
            if (coverage < MIN_COVERAGE && slices.length > 0) break
            slices.push([melRangeStart, melRangeEnd])
            break
        }
        slices.push([melRangeStart, melRangeEnd])
    }
    return slices
}

/**
 * Build the (n_partials, 160, 40) mel partials Resemblyzer feeds to the model.
 * Each partial is exactly PARTIAL_N_FRAMES frames; the mel is zero-padded at the
 * end when the last partial runs past the available frames.
 */
export function buildMelPartials(wav: Float32Array): Float32Array[][] {
    const mel = wavToMelSpectrogram(wav)
    const slices = computePartialSlices(wav.length)
    const partials: Float32Array[][] = []
    for (const [start, end] of slices) {
        const frames: Float32Array[] = []
        for (let f = start; f < end; f++) {
            frames.push(mel[f] ?? new Float32Array(MEL_N_CHANNELS))
        }
        partials.push(frames)
    }
    return partials
}
