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
import { getModel } from './modelCache';

/** Length of a Facenet512 embedding. */
export const EMBEDDING_DIMENSION = 512;

/**
 * Default model location served by Hostinger (`public/models/`, fetched at build
 * time). FP16 export (47 MB, opset 17). INT8 is NOT web-compatible (ConvInteger
 * unimplemented on onnxruntime-web WASM EP — see file header).
 * Override for tests / alternative hosting.
 */
export const DEFAULT_FACENET_MODEL_URL = '/models/facenet512-1ad91552.fp16.onnx';

/**
 * SHA256 of the FP16 model. Verified at runtime by `getModel` before the bytes
 * are cached or passed to ONNX Runtime.
 */
export const DEFAULT_FACENET_MODEL_SHA256 =
  '1ad9155214adb83595b60492b0624bbd44300427c5c3921c876f390c7b44bd66';

/** Minimal structural type for the bits of onnxruntime-web we use. */
interface OrtLike {
  env: { wasm: { wasmPaths?: string; numThreads?: number } };
  Tensor: new (type: 'float32', data: Float32Array, dims: readonly number[]) => unknown;
  InferenceSession: {
    create: (
      // onnxruntime-web accepts a URI string or an ArrayBuffer.
      source: string | ArrayBuffer,
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
 *
 * When `modelSha256` is provided (default: the shipped FP16 hash), model bytes
 * are routed through `getModel` which enforces download-once + SHA256 verification
 * before handing the buffer to ONNX Runtime. Pass `null` explicitly to bypass
 * (tests that supply their own model path).
 */
export class FacenetEmbedder {
  private session: OrtSession | null = null;
  private loading: Promise<OrtSession> | null = null;

  constructor(
    private readonly ort: OrtLike,
    private readonly modelUrl: string = DEFAULT_FACENET_MODEL_URL,
    private readonly wasmPaths: string | undefined = undefined,
    private readonly modelSha256: string | null = DEFAULT_FACENET_MODEL_SHA256,
  ) {}

  /** Load (or reuse) the ONNX session. */
  async load(): Promise<OrtSession> {
    if (this.session) return this.session;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      if (this.wasmPaths) this.ort.env.wasm.wasmPaths = this.wasmPaths;

      // Obtain model bytes via the download-once cache when a SHA256 is known;
      // fall back to the URI directly when sha256 is null (e.g. test fixtures).
      const source: string | ArrayBuffer =
        this.modelSha256 != null
          ? await getModel(this.modelUrl, this.modelSha256)
          : this.modelUrl;

      const session = await this.ort.InferenceSession.create(source, {
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
