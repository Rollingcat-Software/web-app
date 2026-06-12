/**
 * speakerEmbedder — run the Resemblyzer VoiceEncoder ONNX model in the browser
 * via onnxruntime-web (WASM execution provider) and return an L2-normalized 256-d
 * speaker embedding.
 *
 * Mirrors `facenetEmbedder.ts`: lazily loads the ONNX session, reuses it,
 * download-once SHA256-verified model bytes via `modelCache.getModel`, WASM EP.
 *
 * The model (`scripts/export_resemblyzer_onnx.py` in biometric-processor) maps a
 * batch of mel partials `(batch, n_frames, 40)` → `(batch, 256)` unit-norm
 * partial embeddings. The full utterance embedding is the L2-normed MEAN of the
 * partial embeddings (Resemblyzer `embed_utterance`), computed here in JS.
 *
 * ── Model format: ship FP32 ──────────────────────────────────────────────────
 * The model is tiny (~5.7 MB), so ship FP32. Do NOT INT8-quantize (onnxruntime-web
 * WASM lacks the dynamic-quant ops, same finding as facenet512). The model is
 * fetched + SHA256-verified at RUNTIME (NOT via the build-time manifest — adding
 * it to public/models/manifest.json before hosting FATALs the build).
 *
 * ⚠️ SCAFFOLD: the model export + this inference are exact, but the JS audio
 * preprocessing that feeds it (`voicePreprocess`) is not parity-validated against
 * the server — see `voicePreprocess.ts` + the spec. Keep the flag OFF.
 */

import { getModel } from '@features/biometrics/embedding/modelCache'
import { buildMelPartials, MEL_N_CHANNELS, PARTIAL_N_FRAMES } from './voicePreprocess'

/** Length of a Resemblyzer speaker embedding. */
export const VOICE_EMBEDDING_DIMENSION = 256

/**
 * Default model location (same-origin `/models/`, hosted at
 * app.fivucsas.com/models/ alongside facenet512). Override for tests.
 *
 * NOTE: the `<sha256>` filename + SHA constant below are placeholders for the
 * actually-hosted artifact — the real values come from running
 * `scripts/export_resemblyzer_onnx.py` (it prints the sha256). They are wired
 * here so the runtime path is complete; the model must be hosted before the flag
 * is enabled (see the spec). Until hosted, `embedCapturedVoice` returns null
 * (model fetch fails → swallowed) and the VOICE submit falls back to audio.
 */
export const DEFAULT_VOICE_MODEL_URL = '/models/resemblyzer-voice-encoder.onnx'

/** SHA256 of the FP32 model, verified at runtime by `getModel`. */
export const DEFAULT_VOICE_MODEL_SHA256 =
    '8538a560f1e7c03c5f8157f6771beba83b3f8ba52b7791eb372b31d75d86a29d'

/** Minimal structural type for the bits of onnxruntime-web we use. */
interface OrtLike {
    env: { wasm: { wasmPaths?: string; numThreads?: number } }
    Tensor: new (type: 'float32', data: Float32Array, dims: readonly number[]) => unknown
    InferenceSession: {
        create: (
            source: string | ArrayBuffer,
            options: { executionProviders: string[] },
        ) => Promise<OrtSession>
    }
}
interface OrtSession {
    inputNames: string[]
    outputNames: string[]
    run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>
    release?: () => Promise<void>
}

/** L2-normalize a vector. */
export function l2Normalize(vec: Float32Array): Float32Array {
    let sumSq = 0
    for (let i = 0; i < vec.length; i++) sumSq += vec[i] * vec[i]
    const norm = Math.sqrt(sumSq)
    if (norm === 0) return vec.slice()
    const out = new Float32Array(vec.length)
    for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm
    return out
}

/** Flatten one (160, 40) partial into the (1, 160, 40) row-major float buffer. */
function flattenPartial(partial: Float32Array[]): Float32Array {
    const out = new Float32Array(PARTIAL_N_FRAMES * MEL_N_CHANNELS)
    for (let f = 0; f < PARTIAL_N_FRAMES; f++) {
        const frame = partial[f]
        for (let c = 0; c < MEL_N_CHANNELS; c++) {
            out[f * MEL_N_CHANNELS + c] = frame ? frame[c] : 0
        }
    }
    return out
}

/**
 * Browser speaker embedder. Lazily loads the ONNX session on first use and reuses
 * it. Construct with an injected `ort` module (dynamic `import('onnxruntime-web')`)
 * so the heavy WASM runtime is code-split out of the main bundle and tests can
 * supply the module without a bundler. Mirrors `FacenetEmbedder`.
 */
export class SpeakerEmbedder {
    private session: OrtSession | null = null
    private loading: Promise<OrtSession> | null = null

    constructor(
        private readonly ort: OrtLike,
        private readonly modelUrl: string = DEFAULT_VOICE_MODEL_URL,
        private readonly wasmPaths: string | undefined = undefined,
        private readonly modelSha256: string | null = DEFAULT_VOICE_MODEL_SHA256,
    ) {}

    /** Load (or reuse) the ONNX session. */
    async load(): Promise<OrtSession> {
        if (this.session) return this.session
        if (this.loading) return this.loading

        this.loading = (async () => {
            if (this.wasmPaths) this.ort.env.wasm.wasmPaths = this.wasmPaths
            const source: string | ArrayBuffer =
                this.modelSha256 != null
                    ? await getModel(this.modelUrl, this.modelSha256)
                    : this.modelUrl
            const session = await this.ort.InferenceSession.create(source, {
                executionProviders: ['wasm'],
            })
            this.session = session
            return session
        })()
        return this.loading
    }

    /**
     * Embed a 16 kHz mono Float32 PCM waveform → L2-normalized 256-d Float32Array.
     * Reproduces Resemblyzer `embed_utterance`: build mel partials, run each
     * through the model (batch=1), average the partial embeddings, L2-normalize.
     */
    async embed(wav: Float32Array): Promise<Float32Array> {
        const session = await this.load()
        const inputName = session.inputNames[0]
        const outputName = session.outputNames[0]

        const partials = buildMelPartials(wav)
        if (partials.length === 0) {
            throw new Error('voice: no mel partials produced from waveform')
        }

        const sum = new Float32Array(VOICE_EMBEDDING_DIMENSION)
        for (const partial of partials) {
            const tensorData = flattenPartial(partial)
            const feeds: Record<string, unknown> = {
                [inputName]: new this.ort.Tensor('float32', tensorData, [
                    1,
                    PARTIAL_N_FRAMES,
                    MEL_N_CHANNELS,
                ]),
            }
            const outputs = await session.run(feeds)
            const raw = outputs[outputName].data
            for (let i = 0; i < VOICE_EMBEDDING_DIMENSION; i++) sum[i] += raw[i]
        }
        // Mean of partials, then final L2-norm (Resemblyzer embed_utterance).
        for (let i = 0; i < VOICE_EMBEDDING_DIMENSION; i++) sum[i] /= partials.length
        return l2Normalize(sum)
    }

    /** Release the ONNX session. */
    async dispose(): Promise<void> {
        await this.session?.release?.()
        this.session = null
        this.loading = null
    }
}
