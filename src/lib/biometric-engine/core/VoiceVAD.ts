/**
 * VoiceVAD — Client-side Voice Activity Detection via Silero VAD ONNX.
 *
 * Runs the Silero VAD ONNX model in the browser (WASM) to classify a 16kHz
 * mono PCM WAV buffer as speech vs. silence before it is uploaded to the
 * server for biometric verification. Blocking silent captures on the client
 * saves a network round-trip and gives users a faster, clearer error.
 *
 * Silero VAD signature:
 *   inputs:
 *     input: float32 [1, N]   — 512 samples per frame at 16kHz (32 ms)
 *     sr:    int64  scalar    — sample rate (16000)
 *     h:     float32 [2,1,64] — LSTM hidden state (persisted across frames)
 *     c:     float32 [2,1,64] — LSTM cell state (persisted across frames)
 *   outputs:
 *     output: float32 [1,1]   — speech probability ∈ [0,1]
 *     hn:     float32 [2,1,64]
 *     cn:     float32 [2,1,64]
 *
 * Model: silero-vad.onnx (~1.8 MB)
 *
 * Graceful fallback: if initialize() fails (model missing, OOM, etc.) the
 * detector stays in a "not available" state and classify() still returns
 * a neutral result — callers should check isAvailable() and skip the check
 * to avoid breaking voice auth.
 *
 * @see CardDetector.ts — reference pattern for ONNX lazy-loading.
 */

import type { IVoiceVAD } from '../interfaces';

const DEFAULT_MODEL_URL = '/models/silero-vad.onnx';
const FRAME_SIZE = 512; // 32 ms at 16 kHz — Silero VAD's required chunk size
const SAMPLE_RATE = 16000;
const SPEECH_THRESHOLD = 0.5; // per-frame speech probability cutoff
const SPEECH_RATIO_THRESHOLD = 0.2; // fraction of speech frames to call it speech
const HIDDEN_STATE_SHAPE = [2, 1, 64] as const;
const HIDDEN_STATE_SIZE = 2 * 1 * 64;
const WAV_HEADER_SIZE = 44;

/**
 * Classification result returned by VoiceVAD.classify().
 */
export interface VoiceVADResult {
  /** True when at least SPEECH_RATIO_THRESHOLD of frames exceeded SPEECH_THRESHOLD. */
  isSpeech: boolean;
  /** Fraction of frames classified as speech (speechFrames / totalFrames). */
  speechRatio: number;
  /** Mean speech probability across all frames ∈ [0,1]. */
  confidence: number;
}

/**
 * Client-side Silero VAD wrapper.
 *
 * Lifecycle:
 * 1. `new VoiceVAD()`
 * 2. `await vad.initialize()` — lazy ONNX session load
 * 3. `await vad.classify(wavArrayBuffer)` — per capture
 *
 * When the model file is missing, initialize() catches the error and marks the
 * detector unavailable. classify() then returns `{ isSpeech: false, ... }` and
 * callers should check `isAvailable()` to decide whether to act on the result.
 */
export class VoiceVAD implements IVoiceVAD {
  /** ONNX InferenceSession — typed as `any` to avoid bundling ort types at build time. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private session: any = null;

  /** Whether the ONNX model was successfully loaded and is ready for inference. */
  private _available = false;

  /** Initialization error message, if any. */
  private initError: string | null = null;

  /** URL of the Silero VAD ONNX model file. */
  private readonly modelUrl: string;

  constructor(modelUrl: string = DEFAULT_MODEL_URL) {
    this.modelUrl = modelUrl;
  }

  /**
   * Lazy-load the Silero VAD ONNX model and prepare the WASM backend.
   * Non-blocking on failure: logs a warning and leaves isAvailable() = false.
   */
  async initialize(): Promise<void> {
    try {
      // Dynamic import avoids bundling the ~5MB WASM runtime at build time.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — onnxruntime-web is loaded at runtime
      const ort = await import('onnxruntime-web');

      // onnxruntime-web ships its runtime WASM (ort-wasm-*.wasm) separately
      // from the JS. Without `wasmPaths`, ort resolves it against the current
      // origin — and Apache's SPA rewrite returns index.html for any path
      // that doesn't exist, so the browser sees HTML instead of WASM and
      // dies with "expected magic word 00 61 73 6d, found 3c 21 64 6f".
      // Point ort at the pinned jsdelivr copy (CSP already allows
      // https://cdn.jsdelivr.net in script-src + connect-src).
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
      ort.env.wasm.numThreads = 2;

      this.session = await ort.InferenceSession.create(this.modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      this._available = true;
      this.initError = null;
    } catch (err) {
      this._available = false;
      this.initError = err instanceof Error ? err.message : String(err);
      console.warn('[VoiceVAD] ONNX model not available, VAD disabled:', err);
    }
  }

  /** Whether the Silero VAD model is loaded and ready for inference. */
  isAvailable(): boolean {
    return this._available;
  }

  /** Initialization error message, if any. */
  getError(): string | null {
    return this.initError;
  }

  /**
   * Classify a 16 kHz mono PCM WAV buffer as speech or silence.
   *
   * The WAV is parsed by skipping the canonical 44-byte RIFF/WAVE header and
   * reinterpreting the payload as Int16 samples. Samples are then normalized
   * to Float32 in [-1, 1] and fed through Silero VAD in 512-sample frames,
   * persisting h/c LSTM state across frames within a single call.
   *
   * @param wav16k - ArrayBuffer containing a 16 kHz mono PCM WAV file.
   * @returns Speech/silence classification. Safe (non-throwing) on any failure.
   */
  async classify(wav16k: ArrayBuffer): Promise<VoiceVADResult> {
    const neutral: VoiceVADResult = { isSpeech: false, speechRatio: 0, confidence: 0 };

    if (!this._available || !this.session) {
      return neutral;
    }

    // --- Step 1: Parse WAV → Float32 samples ---
    const samples = this.parseWav16kMono(wav16k);
    if (!samples || samples.length < FRAME_SIZE) {
      return neutral;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — onnxruntime-web is loaded at runtime
      const ort = await import('onnxruntime-web');

      // --- Step 2: Persistent state across frames (reset each classify call) ---
      let h = new Float32Array(HIDDEN_STATE_SIZE);
      let c = new Float32Array(HIDDEN_STATE_SIZE);

      const srTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(SAMPLE_RATE)]), []);

      const probabilities: number[] = [];
      const totalFrames = Math.floor(samples.length / FRAME_SIZE);

      // --- Step 3: Slide 512-sample window, accumulate per-frame probabilities ---
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = this.session as any;

      for (let f = 0; f < totalFrames; f++) {
        const frame = samples.subarray(f * FRAME_SIZE, (f + 1) * FRAME_SIZE);
        // Copy to own-buffer Float32Array (ort tensors require standalone buffers)
        const frameCopy = new Float32Array(frame);

        const inputTensor = new ort.Tensor('float32', frameCopy, [1, FRAME_SIZE]);
        const hTensor = new ort.Tensor('float32', h, [...HIDDEN_STATE_SHAPE]);
        const cTensor = new ort.Tensor('float32', c, [...HIDDEN_STATE_SHAPE]);

        const feeds: Record<string, unknown> = {
          input: inputTensor,
          sr: srTensor,
          h: hTensor,
          c: cTensor,
        };

        const outputs = await session.run(feeds);

        const prob = (outputs.output.data as Float32Array)[0] ?? 0;
        probabilities.push(prob);

        // Persist LSTM state for the next frame
        h = new Float32Array(outputs.hn.data as Float32Array);
        c = new Float32Array(outputs.cn.data as Float32Array);
      }

      if (probabilities.length === 0) {
        return neutral;
      }

      // --- Step 4: Aggregate ---
      let speechFrames = 0;
      let sum = 0;
      for (const p of probabilities) {
        if (p > SPEECH_THRESHOLD) speechFrames++;
        sum += p;
      }

      const speechRatio = speechFrames / probabilities.length;
      const confidence = sum / probabilities.length;
      const isSpeech = speechRatio >= SPEECH_RATIO_THRESHOLD;

      return { isSpeech, speechRatio, confidence };
    } catch (err) {
      console.error('[VoiceVAD] Inference error:', err);
      return neutral;
    }
  }

  // ===== Private Helpers =====

  /**
   * Parse a 16 kHz mono PCM WAV ArrayBuffer into normalized Float32 samples.
   *
   * Uses the canonical 44-byte RIFF/WAVE header layout — sufficient for WAVs
   * produced by our encoder pipeline. Returns null if the buffer is too small
   * or does not look like a WAV file (graceful bypass).
   *
   * @param buffer - The WAV file bytes.
   * @returns Float32Array of samples in [-1, 1], or null if parsing fails.
   */
  private parseWav16kMono(buffer: ArrayBuffer): Float32Array | null {
    if (buffer.byteLength <= WAV_HEADER_SIZE) return null;

    // Quick sanity check: "RIFF" magic at offset 0, "WAVE" at offset 8.
    try {
      const view = new DataView(buffer);
      const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
      if (riff !== 'RIFF' || wave !== 'WAVE') {
        return null;
      }
    } catch {
      return null;
    }

    // Reinterpret payload as Int16, then normalize to Float32 in [-1, 1].
    const pcmBytes = buffer.byteLength - WAV_HEADER_SIZE;
    const sampleCount = Math.floor(pcmBytes / 2);
    if (sampleCount <= 0) return null;

    const int16 = new Int16Array(buffer, WAV_HEADER_SIZE, sampleCount);
    const float32 = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      float32[i] = int16[i] / 32768;
    }
    return float32;
  }
}
