/**
 * facenetEmbedder — run the Facenet512 ONNX model in the browser via
 * onnxruntime-web (WASM execution provider) and return an L2-normalized 512-d
 * face embedding.
 *
 * Pairs with `facePreprocess.preprocessFace` (NHWC, BGR, [0,1] tensor) and the
 * browser MediaPipe aligner. See `facePreprocess.ts` and the spike report
 * `docs/THESIS_AUDIT_2026-06-11/16_facenet_browser_spike.md`.
 *
 * ── Execution provider ───────────────────────────────────────────────────────
 * Uses the **WASM** EP (same as `CardDetector`/`VoiceVAD` in this codebase).
 * WebGPU can be added later (`executionProviders: ['webgpu','wasm']`) for speed;
 * WASM is the safe, universally-available baseline and is what the
 * self-consistency gate is measured on.
 *
 * ── Model format: ship FP32 or FP16, NOT the INT8 dynamic-quant export ────────
 * ⚠️ The 24 MB INT8 dynamic-quantized export (`facenet512_int8.onnx`) does NOT
 * load on onnxruntime-web's WASM EP: its `ConvInteger` / `MatMulInteger` /
 * `DynamicQuantizeLinear` ops are unimplemented there (load fails with
 * "Could not find an implementation for ConvInteger(10)"). The 94 MB FP32 export
 * loads and runs cleanly on WASM. For shipping, prefer the ~47 MB **FP16** export
 * (size win without the INT8 op-support problem) and re-validate. The model is
 * fetched + SHA256-verified at build time (`scripts/fetch-models.mjs`) and
 * gitignored — it is NOT committed.
 */

import { preprocessFace, FACENET_INPUT_DIMS, type RgbaImage } from './facePreprocess';

/** Length of a Facenet512 embedding. */
export const EMBEDDING_DIMENSION = 512;

/**
 * Default model location served by Hostinger (`public/models/`, fetched at build
 * time). The browser uses the FP32 (or future FP16) model; the INT8 model is NOT
 * web-compatible (see file header). Override for tests / alternative hosting.
 */
export const DEFAULT_FACENET_MODEL_URL = '/models/facenet512.onnx';

/** Minimal structural type for the bits of onnxruntime-web we use. */
interface OrtLike {
  env: { wasm: { wasmPaths?: string; numThreads?: number } };
  Tensor: new (type: 'float32', data: Float32Array, dims: readonly number[]) => unknown;
  InferenceSession: {
    create: (
      uri: string,
      options: { executionProviders: string[] },
    ) => Promise<OrtSession>;
  };
}
interface OrtSession {
  inputNames: string[];
  outputNames: string[];
  run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>;
  release?: () => Promise<void>;
}

/** L2-normalize a vector in place-free fashion. */
export function l2Normalize(vec: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) sumSq += vec[i] * vec[i];
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vec.slice();
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

/** Cosine similarity of two equal-length L2-normalized vectors (== dot product). */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Browser face embedder. Lazily loads the ONNX session on first use and reuses it.
 *
 * Construct with an injected `ort` module (dynamic `import('onnxruntime-web')`)
 * so the heavy WASM runtime is code-split out of the main bundle and so tests can
 * supply the same module without a bundler. Mirrors `CardDetector`/`VoiceVAD`.
 */
export class FacenetEmbedder {
  private session: OrtSession | null = null;
  private loading: Promise<OrtSession> | null = null;

  constructor(
    private readonly ort: OrtLike,
    private readonly modelUrl: string = DEFAULT_FACENET_MODEL_URL,
    private readonly wasmPaths: string | undefined = undefined,
  ) {}

  /** Load (or reuse) the ONNX session. */
  async load(): Promise<OrtSession> {
    if (this.session) return this.session;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      if (this.wasmPaths) this.ort.env.wasm.wasmPaths = this.wasmPaths;
      const session = await this.ort.InferenceSession.create(this.modelUrl, {
        executionProviders: ['wasm'],
      });
      this.session = session;
      return session;
    })();
    return this.loading;
  }

  /**
   * Embed an already-aligned RGBA face crop → L2-normalized 512-d Float32Array.
   * The caller aligns the face (MediaPipe FaceLandmarker) before passing it here.
   */
  async embed(face: RgbaImage): Promise<Float32Array> {
    const session = await this.load();
    const tensor = preprocessFace(face);
    const inputName = session.inputNames[0];
    const outputName = session.outputNames[0];
    const feeds: Record<string, unknown> = {
      [inputName]: new this.ort.Tensor('float32', tensor, FACENET_INPUT_DIMS),
    };
    const outputs = await session.run(feeds);
    const raw = outputs[outputName].data;
    return l2Normalize(raw instanceof Float32Array ? raw : Float32Array.from(raw));
  }

  /** Release the ONNX session. */
  async dispose(): Promise<void> {
    await this.session?.release?.();
    this.session = null;
    this.loading = null;
  }
}
