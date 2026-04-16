/**
 * audioToWav16k — Convert a captured audio Blob (typically WebM/Opus from
 * MediaRecorder) into a 16kHz 16-bit mono PCM WAV Blob suitable for
 * Silero VAD gating and the voice-biometrics backend.
 *
 * Why this exists:
 *   MediaRecorder emits WebM/Opus by default which our client-side
 *   Silero VAD cannot decode. VoiceVAD expects a canonical 44-byte
 *   RIFF/WAVE header followed by Int16 PCM samples at 16 kHz, mono.
 *   Sending WebM silently bypasses the VAD gate (non-WAV input =>
 *   neutral result), so silent recordings were reaching the server.
 *
 * Pipeline (Option A, pure Web Audio APIs — no new deps):
 *   1. Decode the input blob with `AudioContext.decodeAudioData`.
 *   2. Downmix to mono by averaging all channels.
 *   3. Resample to 16kHz using linear interpolation (fidelity is fine
 *      for VAD and speaker embedding extraction; we are not doing music).
 *   4. Encode a canonical 44-byte WAV header + Int16 little-endian samples.
 *
 * The pure-function `encodeAudioBufferViewToWav16kMono` is exported so it
 * can be unit-tested without a real `AudioContext` (jsdom has none).
 *
 * @see src/lib/biometric-engine/core/VoiceVAD.ts — consumer (parses the same
 *      44-byte header).
 */

/** Target sample rate for all voice pipelines (Silero VAD + Resemblyzer). */
export const WAV16K_SAMPLE_RATE = 16000;

/** Canonical RIFF/WAVE PCM header size in bytes. */
export const WAV16K_HEADER_SIZE = 44;

/**
 * Minimal subset of `AudioBuffer` we actually use. Lets the pure encoder be
 * tested in jsdom by passing a hand-crafted stub.
 */
export interface AudioBufferView {
  readonly numberOfChannels: number;
  readonly sampleRate: number;
  readonly length: number;
  getChannelData(channel: number): Float32Array;
}

/**
 * Downmix an `AudioBufferView` to a single `Float32Array` (mono) by averaging
 * all channels. Returns a view into the buffer when it is already mono.
 */
function downmixToMono(buffer: AudioBufferView): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }
  const length = buffer.length;
  const mono = new Float32Array(length);
  const channels = buffer.numberOfChannels;
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / channels;
    }
  }
  return mono;
}

/**
 * Resample a mono Float32 buffer to `targetRate` using linear interpolation.
 * No-op when input sample rate already matches the target.
 */
function resampleLinear(
  samples: Float32Array,
  sourceRate: number,
  targetRate: number,
): Float32Array {
  if (sourceRate === targetRate) {
    return samples;
  }
  const ratio = targetRate / sourceRate;
  const outputLength = Math.max(1, Math.floor(samples.length * ratio));
  const out = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i / ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, samples.length - 1);
    const frac = srcIdx - lo;
    out[i] = samples[lo] * (1 - frac) + samples[hi] * frac;
  }
  return out;
}

/**
 * Write an ASCII string into a `DataView` starting at `offset`.
 */
function writeAscii(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Build a canonical 44-byte RIFF/WAVE PCM header followed by 16-bit
 * little-endian samples for the given mono Float32 array.
 *
 * @param samples - Mono Float32 samples in [-1, 1] at `sampleRate`.
 * @param sampleRate - Samples per second (16 kHz for our pipeline).
 * @returns ArrayBuffer of (44 + 2 * samples.length) bytes.
 */
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataLength = samples.length * 2; // 16-bit PCM
  const wavBuffer = new ArrayBuffer(WAV16K_HEADER_SIZE + dataLength);
  const view = new DataView(wavBuffer);

  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, 'WAVE');

  // fmt chunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (mono, 16-bit)
  view.setUint16(32, 2, true); // block align (mono, 16-bit)
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = WAV16K_HEADER_SIZE;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return wavBuffer;
}

/**
 * Pure encoder: take an `AudioBufferView`, downmix to mono, resample to
 * 16kHz, and emit a WAV ArrayBuffer. Exposed for unit testing.
 */
export function encodeAudioBufferViewToWav16kMono(buffer: AudioBufferView): ArrayBuffer {
  const mono = downmixToMono(buffer);
  const resampled = resampleLinear(mono, buffer.sampleRate, WAV16K_SAMPLE_RATE);
  return encodeWav(resampled, WAV16K_SAMPLE_RATE);
}

/**
 * Convert an arbitrary audio blob (typically `audio/webm;codecs=opus`) to a
 * 16 kHz 16-bit mono PCM WAV blob.
 *
 * Uses `AudioContext.decodeAudioData` which transparently handles WebM,
 * Ogg, MP3, and WAV inputs on modern browsers. Failures propagate so
 * callers can fall back to the raw blob.
 *
 * @param blob - Captured audio blob.
 * @returns Promise resolving to a `audio/wav` blob, 16 kHz mono 16-bit PCM.
 */
export async function encodeToWav16kMono(blob: Blob): Promise<Blob> {
  // Prefer a context that already runs at the target rate — browsers that
  // support it will skip our manual resample altogether. Fall back to a
  // default context when the constructor rejects the `sampleRate` option
  // (older Safari before 14.1).
  let audioCtx: AudioContext;
  try {
    audioCtx = new AudioContext({ sampleRate: WAV16K_SAMPLE_RATE });
  } catch {
    audioCtx = new AudioContext();
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const wavBuffer = encodeAudioBufferViewToWav16kMono(audioBuffer);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  } finally {
    // decodeAudioData does not mutate the context, but closing it frees the
    // underlying audio graph so we do not leak one per capture.
    try {
      await audioCtx.close();
    } catch {
      // ignore — some browsers throw if the context is already closed
    }
  }
}
