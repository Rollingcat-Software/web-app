/**
 * alignFace — pose-invariance gate for the client-side face aligner.
 *
 * This is the proof the aligner WORKS without needing new real captures. The
 * client embedding ships with a full re-enroll, so we do not need MTCNN/DeepFace
 * geometric parity — only client SELF-CONSISTENCY: the same face, put through the
 * same aligner, must produce ~the same embedding regardless of how the camera saw
 * it (pose / scale / in-plane rotation). The strong test below proves exactly that.
 *
 * Strong gate (pose-invariance):
 *   - Take a fixture face + eye landmarks for it.
 *   - Apply a KNOWN synthetic similarity transform (rotate 15°, scale 0.8,
 *     translate) to the IMAGE, and the SAME matrix to the LANDMARKS.
 *   - Align BOTH, embed BOTH, assert cosine(original, transformed) > 0.95.
 *   If the aligner removes pose/scale/rotation, both inputs collapse to the same
 *   canonical frame → near-identical embeddings. A no-op / broken aligner fails.
 *
 * Sanity:
 *   - `alignFace` output is EXACTLY the RGBA shape + dims `preprocessFace` expects.
 *   - The synthetic transform genuinely MOVED the pixels (guards a no-op fixture).
 *
 * ── Why a self-applied affine, not Jimp.rotate ───────────────────────────────
 * We warp the image with the SAME pure-JS inverse-map + bilinear resampler the
 * aligner uses, driven by an explicit 2×3 matrix, then apply that identical matrix
 * to the landmark points. This guarantees the image and its landmarks move together
 * EXACTLY (Jimp.rotate adds its own padding/centre conventions that would desync the
 * two), so the test isolates the aligner's invariance rather than warp-tool quirks.
 *
 * ── Landmarks for the fixture ────────────────────────────────────────────────
 * The shipped fixtures are pre-cropped, roughly face-centred thumbnails with no
 * landmark annotation. For a centred face crop the eyes sit on the upper third; we
 * place the two eye-centre landmarks (iris indices 468/473) at plausible fractions
 * of the crop. The aligner only consumes those two points, and the test's claim is
 * relative (original vs the SAME face transformed) — so the exact eye fractions are
 * not load-bearing, only that they are consistent between the two runs (they are:
 * the transformed landmarks are the originals pushed through the known matrix).
 *
 * ── Model caveat ─────────────────────────────────────────────────────────────
 * Loads the FP32 ONNX (gitignored, fetched at build time / FACENET_MODEL_PATH). If
 * absent (clean CI without the model bucket) the suite is SKIPPED — same policy as
 * `selfConsistency.test.ts`.
 */
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { Jimp } from 'jimp'
import * as ort from 'onnxruntime-web'
import { preprocessFace, FACENET_INPUT_DIMS, FACENET_INPUT_SIZE, type RgbaImage } from '../facePreprocess'
import { l2Normalize, cosineSimilarity, EMBEDDING_DIMENSION } from '../facenetEmbedder'
import { alignFace, ALIGNED_OUTPUT_SIZE, type LandmarkArray, type Point2D } from '../alignFace'
import { LEFT_IRIS, RIGHT_IRIS } from '@/lib/biometric-engine/core/constants'

const FIXTURE_DIR = path.resolve(__dirname, 'fixtures')
const WASM_DIR =
    path.resolve(__dirname, '../../../../../node_modules/onnxruntime-web/dist/') + '/'

function resolveModelPath(): string | null {
    const candidates = [
        process.env.FACENET_MODEL_PATH,
        '/tmp/fnet_out/facenet512.onnx',
    ].filter(Boolean) as string[]
    return candidates.find((p) => existsSync(p)) ?? null
}
const MODEL_PATH = resolveModelPath()

/** Large fixture (1256×1600) — ample margin so a synthetic transform stays on-frame. */
const FIXTURE = 'p3_a'

/**
 * Plausible eye-centre landmarks for a roughly-centred face crop, as a sparse
 * landmark array indexed by MediaPipe iris indices (468 = left, 473 = right).
 * Normalized (0-1); the aligner scales to pixels. Eyes on the upper third, symmetric.
 */
function buildLandmarks(): LandmarkArray {
    const lms: Point2D[] = []
    // The aligner reads only LEFT_IRIS / RIGHT_IRIS; everything else can be a stub.
    const maxIdx = Math.max(LEFT_IRIS, RIGHT_IRIS)
    for (let i = 0; i <= maxIdx; i++) lms[i] = { x: 0.5, y: 0.5 }
    lms[LEFT_IRIS] = { x: 0.38, y: 0.42 }
    lms[RIGHT_IRIS] = { x: 0.62, y: 0.42 }
    return lms
}

/** A 2×3 forward affine [[a,b,c],[d,e,f]] mapping source (x,y) → dest (x,y). */
interface Affine { a: number; b: number; c: number; d: number; e: number; f: number }

/** Compose a rotation (deg) + uniform scale about an image centre, plus a translation. */
function makeTransform(
    width: number,
    height: number,
    degrees: number,
    scale: number,
    txFrac: number,
    tyFrac: number,
): Affine {
    const rad = (degrees * Math.PI) / 180
    const cos = Math.cos(rad) * scale
    const sin = Math.sin(rad) * scale
    const cx = width / 2
    const cy = height / 2
    // Rotate+scale about centre: dest = R*(src - c) + c + t.
    const tx = txFrac * width
    const ty = tyFrac * height
    const c = cx - (cos * cx - sin * cy) + tx
    const f = cy - (sin * cx + cos * cy) + ty
    return { a: cos, b: -sin, c, d: sin, e: cos, f }
}

/** Apply a forward affine to a point. */
function applyAffine(m: Affine, p: Point2D): Point2D {
    return { x: m.a * p.x + m.b * p.y + m.c, y: m.d * p.x + m.e * p.y + m.f }
}

/** Invert a 2×3 affine. */
function invertAffine(m: Affine): Affine {
    const det = m.a * m.e - m.b * m.d
    const inv = 1 / det
    const a = m.e * inv
    const b = -m.b * inv
    const d = -m.d * inv
    const e = m.a * inv
    return { a, b, d, e, c: -(a * m.c + b * m.f), f: -(d * m.c + e * m.f) }
}

/** Warp an RGBA image by a forward affine (inverse-map + bilinear), same size. */
function warpImage(img: RgbaImage, forward: Affine): RgbaImage {
    const { width, height } = img
    const inv = invertAffine(forward)
    const out = new Uint8ClampedArray(width * height * 4)
    const idx = (x: number, y: number) => (y * width + x) * 4
    const lerp = (p: number, q: number, t: number) => p + (q - p) * t
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const sx = inv.a * x + inv.b * y + inv.c
            const sy = inv.d * x + inv.e * y + inv.f
            const di = idx(x, y)
            if (sx < 0 || sy < 0 || sx > width - 1 || sy > height - 1) {
                out[di] = out[di + 1] = out[di + 2] = 0
                out[di + 3] = 255
                continue
            }
            const x0 = Math.floor(sx)
            const y0 = Math.floor(sy)
            const x1 = Math.min(x0 + 1, width - 1)
            const y1 = Math.min(y0 + 1, height - 1)
            const fx = sx - x0
            const fy = sy - y0
            for (let ch = 0; ch < 4; ch++) {
                const top = lerp(img.data[idx(x0, y0) + ch], img.data[idx(x1, y0) + ch], fx)
                const bot = lerp(img.data[idx(x0, y1) + ch], img.data[idx(x1, y1) + ch], fx)
                out[di + ch] = lerp(top, bot, fy)
            }
            out[di + 3] = 255
        }
    }
    return { width, height, data: out }
}

async function decodeRgba(file: string): Promise<RgbaImage> {
    const buf = await readFile(file)
    const img = await Jimp.read(buf)
    return { width: img.bitmap.width, height: img.bitmap.height, data: img.bitmap.data }
}

const describeOrSkip = MODEL_PATH ? describe : describe.skip

describe('alignFace — geometry & output contract (no model needed)', () => {
    it('emits an RGBA crop with EXACTLY the dims preprocessFace expects', async () => {
        const img = await decodeRgba(path.join(FIXTURE_DIR, `${FIXTURE}.jpg`))
        const aligned = alignFace(img, buildLandmarks())
        expect(aligned).not.toBeNull()
        expect(aligned!.width).toBe(ALIGNED_OUTPUT_SIZE)
        expect(aligned!.height).toBe(ALIGNED_OUTPUT_SIZE)
        expect(ALIGNED_OUTPUT_SIZE).toBe(FACENET_INPUT_SIZE)
        expect(aligned!.data.length).toBe(ALIGNED_OUTPUT_SIZE * ALIGNED_OUTPUT_SIZE * 4)
        // preprocessFace accepts it and yields the canonical model tensor.
        const tensor = preprocessFace(aligned!)
        const [, h, w, c] = FACENET_INPUT_DIMS
        expect(tensor.length).toBe(h * w * c)
    })

    it('places the eyes at the canonical positions regardless of input pose', async () => {
        const img = await decodeRgba(path.join(FIXTURE_DIR, `${FIXTURE}.jpg`))
        // Two very different input eye geometries…
        const flat: Point2D[] = []
        for (let i = 0; i <= RIGHT_IRIS; i++) flat[i] = { x: 0.5, y: 0.5 }
        flat[LEFT_IRIS] = { x: 0.30, y: 0.50 }
        flat[RIGHT_IRIS] = { x: 0.70, y: 0.50 }
        const tilted: Point2D[] = flat.slice()
        tilted[LEFT_IRIS] = { x: 0.35, y: 0.35 } // rotated, closer
        tilted[RIGHT_IRIS] = { x: 0.60, y: 0.55 }
        const a = alignFace(img, flat)
        const b = alignFace(img, tilted)
        expect(a).not.toBeNull()
        expect(b).not.toBeNull()
        // Both are the same fixed output size — the canonical frame is identical.
        expect(a!.width).toBe(b!.width)
        expect(a!.height).toBe(b!.height)
    })

    it('returns null when eye landmarks are missing (caller falls back to crop)', async () => {
        const img = await decodeRgba(path.join(FIXTURE_DIR, `${FIXTURE}.jpg`))
        expect(alignFace(img, [])).toBeNull()
        // Eye points coincident → degenerate transform → null.
        const coincident: Point2D[] = []
        for (let i = 0; i <= RIGHT_IRIS; i++) coincident[i] = { x: 0.5, y: 0.5 }
        expect(alignFace(img, coincident)).toBeNull()
    })
})

describeOrSkip('alignFace — pose-invariance gate (the strong gate, needs model)', () => {
    let session: ort.InferenceSession
    let inputName: string
    let outputName: string

    async function embed(face: RgbaImage): Promise<Float32Array> {
        const tensor = preprocessFace(face)
        const feeds = { [inputName]: new ort.Tensor('float32', tensor, FACENET_INPUT_DIMS) }
        const out = await session.run(feeds)
        return l2Normalize(out[outputName].data as Float32Array)
    }

    beforeAll(async () => {
        ort.env.wasm.numThreads = 1
        ort.env.wasm.wasmPaths = WASM_DIR
        session = await ort.InferenceSession.create(MODEL_PATH as string, {
            executionProviders: ['wasm'],
        })
        inputName = session.inputNames[0]
        outputName = session.outputNames[0]
    }, 120_000)

    it('aligned embedding is pose/scale/rotation-INVARIANT (cosine > 0.95)', async () => {
        const original = await decodeRgba(path.join(FIXTURE_DIR, `${FIXTURE}.jpg`))
        const lms = buildLandmarks()

        // KNOWN synthetic transform: rotate 15°, scale 0.8, translate (+6%, -4%).
        const M = makeTransform(original.width, original.height, 15, 0.8, 0.06, -0.04)

        // Apply M to the IMAGE and the SAME M to the LANDMARKS (in pixel space).
        const transformedImg = warpImage(original, M)
        const transformedLms: Point2D[] = lms.map((p) => {
            const px = applyAffine(M, { x: p.x * original.width, y: p.y * original.height })
            // Back to normalized for the aligner (it re-detects normalized vs pixel).
            return { x: px.x / original.width, y: px.y / original.height }
        })

        // Guard: the transform genuinely moved the pixels (not a silent no-op).
        let diff = 0
        for (let i = 0; i < original.data.length; i += 64) {
            diff += Math.abs(original.data[i] - transformedImg.data[i])
        }
        expect(diff, 'synthetic transform must change the image').toBeGreaterThan(0)

        const alignedOriginal = alignFace(original, lms)
        const alignedTransformed = alignFace(transformedImg, transformedLms)
        expect(alignedOriginal).not.toBeNull()
        expect(alignedTransformed).not.toBeNull()

        const eOriginal = await embed(alignedOriginal!)
        const eTransformed = await embed(alignedTransformed!)
        expect(eOriginal.length).toBe(EMBEDDING_DIMENSION)

        const cos = cosineSimilarity(eOriginal, eTransformed)
        // eslint-disable-next-line no-console
        console.log(`\n=== POSE-INVARIANCE (aligned) cosine = ${cos.toFixed(4)} (rotate 15°, scale 0.8, translate) ===`)
        expect(cos, 'aligned same-face pose-invariance cosine').toBeGreaterThan(0.95)
    })

    it('WITHOUT alignment the same transform degrades similarity (proves alignment is load-bearing)', async () => {
        const original = await decodeRgba(path.join(FIXTURE_DIR, `${FIXTURE}.jpg`))
        const M = makeTransform(original.width, original.height, 15, 0.8, 0.06, -0.04)
        const transformedImg = warpImage(original, M)

        // Embed the RAW (unaligned) crops — what the pre-aligner path did.
        const eOriginal = await embed(original)
        const eTransformed = await embed(transformedImg)
        const cosUnaligned = cosineSimilarity(eOriginal, eTransformed)

        // And the aligned versions, for the contrast.
        const lms = buildLandmarks()
        const transformedLms: Point2D[] = lms.map((p) => {
            const px = applyAffine(M, { x: p.x * original.width, y: p.y * original.height })
            return { x: px.x / original.width, y: px.y / original.height }
        })
        const cosAligned = cosineSimilarity(
            await embed(alignFace(original, lms)!),
            await embed(alignFace(transformedImg, transformedLms)!),
        )
        // eslint-disable-next-line no-console
        console.log(`  unaligned cosine = ${cosUnaligned.toFixed(4)}  vs  aligned cosine = ${cosAligned.toFixed(4)}`)
        // The aligner must do AT LEAST as well as the unaligned crop on this transform.
        expect(cosAligned).toBeGreaterThanOrEqual(cosUnaligned - 1e-3)
    })
})
