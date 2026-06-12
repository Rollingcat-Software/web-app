/**
 * MiniFasNetPadAnalyzer — minimal single-frame MiniFASNet anti-spoof analyzer
 * for the advisory client-side PAD score (SP-D, Phase-1B).
 *
 * This is a FAITHFUL minimal PORT of the MiniFASNet single-frame inference in
 * `@rollingcat/spoof-detector`
 * (`spoof-detector/web/src/infrastructure/analyzers/MiniFASNetAnalyzer.ts` +
 * `.../utils/imageOps.ts`). We port — rather than import the package — because:
 *   1. `@rollingcat/spoof-detector` is NOT a web-app dependency, and adding it
 *      pulls the full 26-analyzer fusion session + its own onnxruntime-web copy.
 *   2. SP-D needs ONLY the single-frame real/spoof head — no gates, no fusion,
 *      no face_landmarker. A ~120-line port is the lower-risk path and keeps the
 *      dark, advisory-only feature out of the synchronous bundle.
 *
 * Model contract (verbatim from the source / UniFace MiniFASNetV2):
 *   - input: 80×80, **BGR NCHW float32, NO mean/std normalization** (raw 0..255
 *     pixel values; UniFace reads via cv2.imread which is already BGR and casts
 *     to float32 with no scaling).
 *   - output: (1, 2) logits → softmax → [pSpoof, pReal]; class 1 == REAL.
 *
 * Context caveat: the upstream analyzer prefers the ORIGINAL full frame + face
 * bbox so MiniFASNet can read surrounding context (scale 2.7). The SP-D capture
 * path only has a TIGHT face crop (a ~320×320 square JPEG from faceCropper),
 * so we treat the whole crop as the face region (bbox = full image, clamped by
 * the crop-rect math to the image bounds → a plain resize to 80×80). This is the
 * documented "padded_crop" fallback semantics: less accurate than the
 * full-frame path, but a valid single-frame advisory signal — and SP-D is
 * advisory ONLY, never a gate.
 *
 * @see spoof-detector/web/src/infrastructure/analyzers/MiniFASNetAnalyzer.ts
 * @see lib/biometric-engine/core/CardDetector.ts (same lazy onnxruntime-web pattern)
 */

/**
 * Model URL CONSTANT. Defaults to a **same-origin** `/models/minifasnet_v2.onnx`.
 *
 * MODEL HOSTING — Phase-2 deferred:
 *   The 1.7 MB `minifasnet_v2.onnx` is currently served only at
 *   `amispoof.fivucsas.com/models/`. It must be hosted at
 *   `app.fivucsas.com/models/` (alongside facenet512) in Phase-2 for this
 *   advisory path to resolve on the dashboard / hosted login. Until then the
 *   model is fetched only at RUNTIME and only when `VITE_CLIENT_PAD_ADVISORY`
 *   is ON — so while the flag is OFF (default) there is ZERO deploy/CORS impact
 *   and `deploy-hostinger` is unaffected.
 *
 *   We deliberately do NOT add this model to `public/models/manifest.json`: a
 *   build-prefetch entry would FATAL `npm run fetch-models` (and thus
 *   `deploy-hostinger`) because the file is not yet at `app.fivucsas.com/models`
 *   — the exact failure mode facenet hit. Keep it a runtime-only same-origin
 *   fetch until Phase-2 hosting lands.
 *
 *   CORS: a same-origin `/models/` path needs no CORS. If Phase-2 instead points
 *   this at a cross-origin host (e.g. amispoof.fivucsas.com), that host must send
 *   `Access-Control-Allow-Origin` for app.fivucsas.com or the fetch (and thus the
 *   advisory score) silently fails — which falls back gracefully to the light
 *   detector / null, never blocking login.
 */
export const MINIFASNET_MODEL_URL = '/models/minifasnet_v2.onnx'

/** MiniFASNet V2 input is 80×80. */
const INPUT_W = 80
const INPUT_H = 80

/**
 * Minimal single-frame MiniFASNet analyzer.
 *
 * Lifecycle:
 *   const a = new MiniFasNetPadAnalyzer()
 *   const live = await a.scoreFace(faceImageData)  // 0..1 live-confidence | null
 *
 * `scoreFace` lazily warms the ONNX session on first call (dynamic import of
 * onnxruntime-web, same as CardDetector). It returns `null` on ANY failure
 * (model fetch, WebGPU/WASM init, inference, decode) — it NEVER throws, so the
 * caller can fall back to the light detector or null without a try/catch dance.
 */
export class MiniFasNetPadAnalyzer {
    /** ONNX InferenceSession — `unknown` to avoid bundling ort types at build time. */
    private session: unknown = null
    private inputName = 'input'
    private outputName = 'output'
    private initPromise: Promise<boolean> | null = null
    /** Set once init has been attempted and FAILED, to short-circuit retries. */
    private initFailed = false

    constructor(private readonly modelUrl: string = MINIFASNET_MODEL_URL) {}

    /**
     * Compute a 0..1 live-confidence for a tight face crop.
     *
     * @param face A captured face frame (tight crop is fine — the whole image is
     *             treated as the face region; see the context caveat above).
     * @returns live-confidence in [0, 1] (1 = most live-like), or `null` on any
     *          failure. NEVER throws.
     */
    async scoreFace(face: ImageData): Promise<number | null> {
        try {
            if (!face || face.width <= 2 || face.height <= 2) return null
            const ready = await this.ensureSession()
            if (!ready || !this.session) return null

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore — onnxruntime-web is loaded at runtime
            const ort = await import('onnxruntime-web')

            const planar = preprocessBgrNchw(face, INPUT_W, INPUT_H)
            if (!planar) return null
            const input = new ort.Tensor('float32', planar, [1, 3, INPUT_H, INPUT_W])

            const feeds: Record<string, unknown> = { [this.inputName]: input }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const outputs = await (this.session as any).run(feeds)
            const out = outputs[this.outputName] ?? outputs[Object.keys(outputs)[0]]
            const data = out?.data as Float32Array | undefined
            if (!data || data.length < 2) return null

            // Output (1, 2): class 0 = spoof, class 1 = real (UniFace convention).
            const [, pReal] = softmax2(data[0], data[1])
            // pReal IS the live-confidence in [0, 1]. Round to 4 dp for a clean wire value.
            return Math.round(Math.min(1, Math.max(0, pReal)) * 1e4) / 1e4
        } catch {
            // Resilient: any inference failure → null (caller falls back).
            return null
        }
    }

    /** Idempotent lazy init. Returns true on a ready session, false on failure. */
    private async ensureSession(): Promise<boolean> {
        if (this.session) return true
        if (this.initFailed) return false
        if (this.initPromise) return this.initPromise
        this.initPromise = this.initSession()
        return this.initPromise
    }

    private async initSession(): Promise<boolean> {
        try {
            // Dynamic import keeps onnxruntime-web out of the synchronous bundle —
            // mirrors CardDetector.ts. Only runs when the advisory flag is ON.
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore — onnxruntime-web is loaded at runtime
            const ort = await import('onnxruntime-web')

            // WASM-paths note (see CardDetector.ts): Apache otherwise returns
            // index.html for /ort-wasm-*.wasm, so pin the CDN dist.
            ort.env.wasm.wasmPaths =
                'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/'

            // Try WebGPU first (MiniFASNetV2 is a small MobileNetV2 — runs on the
            // WebGPU EP), fall back to WASM. Brave-mobile may advertise
            // `navigator.gpu` but reject WGSL compile, so we belt-and-suspenders
            // retry on WASM if the WebGPU create call throws.
            const providers = preferWebGpuProviders()
            try {
                this.session = await ort.InferenceSession.create(this.modelUrl, {
                    executionProviders: providers as unknown as string[],
                })
            } catch (primaryErr) {
                if (providers[0] !== 'wasm') {
                    this.session = await ort.InferenceSession.create(this.modelUrl, {
                        executionProviders: ['wasm'] as unknown as string[],
                    })
                } else {
                    throw primaryErr
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const session = this.session as any
            this.inputName = session.inputNames?.[0] ?? 'input'
            this.outputName = session.outputNames?.[0] ?? 'output'
            return true
        } catch {
            // Model not hosted yet (Phase-2), offline, WASM/WebGPU unavailable, etc.
            // Mark failed so we don't re-attempt on every capture; caller falls back.
            this.initFailed = true
            this.session = null
            return false
        }
    }
}

/**
 * Preprocess a face ImageData to a planar **BGR NCHW float32** tensor at
 * (outW, outH), with NO mean/std normalization (raw 0..255), matching UniFace
 * MiniFASNet. Resizes the whole crop via a 2D canvas (the tight crop IS the
 * face region — see the context caveat). Returns null if a canvas/ctx is
 * unavailable (e.g. SSR / jsdom without canvas).
 */
function preprocessBgrNchw(
    face: ImageData,
    outW: number,
    outH: number,
): Float32Array | null {
    const resized = resizeImageData(face, outW, outH)
    if (!resized) return null
    const { data } = resized
    const plane = outW * outH
    const out = new Float32Array(3 * plane)
    // Channel order B, G, R (NCHW, C=3); raw pixel values, no scaling.
    for (let i = 0, p = 0; i < plane; i++, p += 4) {
        out[i] = data[p + 2] // B
        out[plane + i] = data[p + 1] // G
        out[2 * plane + i] = data[p] // R
    }
    return out
}

/**
 * Resize an ImageData to (w, h) via a 2D canvas (high-quality smoothing for the
 * downscale to 80×80). Uses OffscreenCanvas when available, else a DOM canvas.
 * Returns null when no 2D context is obtainable.
 */
function resizeImageData(src: ImageData, w: number, h: number): ImageData | null {
    const stage = makeCanvas(src.width, src.height)
    const out = makeCanvas(w, h)
    if (!stage || !out) return null
    const sctx = stage.getContext('2d') as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null
    const octx = out.getContext('2d') as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null
    if (!sctx || !octx) return null
    sctx.putImageData(src, 0, 0)
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = 'high'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    octx.drawImage(stage as any, 0, 0, src.width, src.height, 0, 0, w, h)
    return octx.getImageData(0, 0, w, h)
}

/** Create an OffscreenCanvas if available, else a DOM <canvas>, else null. */
function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas | null {
    try {
        if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
        if (typeof document !== 'undefined') {
            const c = document.createElement('canvas')
            c.width = w
            c.height = h
            return c
        }
    } catch {
        // fall through
    }
    return null
}

/** 2-class numerically-stable softmax → [p0, p1]. Mirrors UniFace's softmax. */
function softmax2(l0: number, l1: number): [number, number] {
    const m = Math.max(l0, l1)
    const e0 = Math.exp(l0 - m)
    const e1 = Math.exp(l1 - m)
    const z = e0 + e1
    return [e0 / z, e1 / z]
}

/**
 * Prefer the WebGPU EP when `navigator.gpu` is present (cheap feature-detect, no
 * adapter probe), else WASM-only. ORT-Web negotiates the fallback chain itself.
 */
function preferWebGpuProviders(): ReadonlyArray<'wasm' | 'webgpu'> {
    try {
        if (
            typeof navigator !== 'undefined' &&
            'gpu' in navigator &&
            (navigator as Navigator & { gpu?: unknown }).gpu != null
        ) {
            return ['webgpu', 'wasm']
        }
    } catch {
        // navigator access can throw under unusual sandboxing — fall through.
    }
    return ['wasm']
}
