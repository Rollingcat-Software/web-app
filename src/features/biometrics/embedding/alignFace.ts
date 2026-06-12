/**
 * alignFace — deterministic in-browser face aligner (client-side Facenet512).
 *
 * THE load-bearing step for client self-consistency. `preprocessFace` only owns
 * resize/pad/colour/scale and explicitly expects an ALREADY-ALIGNED crop; without
 * an aligner the embedding is computed from a raw bbox crop, so pose/scale/rotation
 * vary capture-to-capture and same-person cosine collapses. This module removes
 * that variation by mapping two stable eye landmarks to FIXED canonical positions
 * via a 2D similarity transform — exactly the operation DeepFace's `align=True`
 * performs (see the spike report `docs/THESIS_AUDIT_2026-06-11/16_facenet_browser_spike.md`
 * §"Browser pipeline", step 2).
 *
 * ── Why self-consistency, not server parity ──────────────────────────────────
 * Client embedding ships with a FULL re-enroll: both the enrollment template AND
 * the login probe are computed through THIS identical aligner. So we do NOT need
 * to reproduce MTCNN/DeepFace's absolute geometry (MTCNN-align ≠ MediaPipe-align).
 * We only need the aligner to be DETERMINISTIC and to normalise pose/scale/rotation
 * so that two captures of the same face land in the same canonical frame. The
 * shared export below is therefore the SINGLE aligner both enroll and verify call.
 *
 * ── Eye landmarks ────────────────────────────────────────────────────────────
 * Uses the MediaPipe FaceLandmarker (478-pt) landmarks the web app already runs
 * (`useFaceDetection` → `BiometricEngine.faceDetector`). The eye CENTERS are the
 * iris centres `LEFT_IRIS = 468` / `RIGHT_IRIS = 473` (present in the refined
 * 478-pt mesh). When those are unavailable (e.g. a 468-pt mesh) we fall back to
 * the eye OUTER corners `HEAD_POSE_LEFT_EYE = 33` / `HEAD_POSE_RIGHT_EYE = 263`,
 * which the head-pose estimator already relies on. Both indices are reused from
 * `biometric-engine/core/constants` so there is ONE source of truth.
 *
 * ── No canvas dependency (deterministic + headless-testable) ──────────────────
 * The transform is applied by pure-JS inverse-mapping + bilinear resampling
 * (identical maths to `preprocessFace`), NOT a canvas 2D `setTransform` draw. This
 * keeps the aligner byte-deterministic, free of canvas/anti-alias driver drift,
 * and runnable in the headless vitest environment (jsdom has no 2D canvas), so the
 * pose-invariance gate exercises the REAL production code path.
 */

import { LEFT_IRIS, RIGHT_IRIS, HEAD_POSE_LEFT_EYE, HEAD_POSE_RIGHT_EYE } from '@/lib/biometric-engine/core/constants'
import { FACENET_INPUT_SIZE, type RgbaImage } from './facePreprocess'

/** A 2D point in image space (pixels for pixel landmarks, fractions for normalized). */
export interface Point2D {
    readonly x: number
    readonly y: number
}

/**
 * The minimal landmark shape the aligner needs: an indexable array of points.
 * Compatible with MediaPipe's `NormalizedLandmark[]` (0-1) and `PixelLandmark[]`
 * (pixel coords) — the aligner scales normalized landmarks to pixels itself.
 */
export type LandmarkArray = ReadonlyArray<Point2D>

/**
 * Output edge length of the aligned square crop. Defaults to the Facenet512 input
 * edge (160) so the aligned crop drops straight into `preprocessFace` with no pad.
 */
export const ALIGNED_OUTPUT_SIZE = FACENET_INPUT_SIZE

/**
 * Canonical eye positions in the N×N output, expressed as fractions of the edge.
 * Eyes level on the same row (`y = 0.40`), symmetric about the vertical centre
 * (`x = 0.35` / `0.65`), so inter-eye distance fills 30% of the width. This is the
 * de-facto face-alignment convention (eyes upper-third, centred). Both probe and
 * template use these SAME constants, which is all self-consistency requires.
 */
export const CANONICAL_LEFT_EYE: Point2D = { x: 0.35, y: 0.40 }
export const CANONICAL_RIGHT_EYE: Point2D = { x: 0.65, y: 0.40 }

/** 2×3 affine matrix [[a, b, c], [d, e, f]] mapping source (x,y) → dest (x,y). */
interface Affine {
    a: number
    b: number
    c: number
    d: number
    e: number
    f: number
}

/** Resolve the left/right eye CENTERS from a landmark array (pixel-space points). */
function resolveEyeCenters(
    landmarks: LandmarkArray,
): { left: Point2D; right: Point2D } | null {
    // Prefer iris centres (refined 478-pt mesh); fall back to eye outer corners.
    const irisLeft = landmarks[LEFT_IRIS]
    const irisRight = landmarks[RIGHT_IRIS]
    if (isFinitePoint(irisLeft) && isFinitePoint(irisRight)) {
        return { left: irisLeft, right: irisRight }
    }
    const cornerLeft = landmarks[HEAD_POSE_LEFT_EYE]
    const cornerRight = landmarks[HEAD_POSE_RIGHT_EYE]
    if (isFinitePoint(cornerLeft) && isFinitePoint(cornerRight)) {
        return { left: cornerLeft, right: cornerRight }
    }
    return null
}

function isFinitePoint(p: Point2D | undefined): p is Point2D {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y)
}

/**
 * Build the similarity transform (rotation + uniform scale + translation) that maps
 * the two source eye centres onto the two canonical destination positions.
 *
 * A 2-point similarity transform is fully determined: the scale is the ratio of the
 * destination inter-eye distance to the source inter-eye distance; the rotation is
 * the angle between the two eye vectors; the translation places the source left eye
 * on the canonical left eye. We return the SOURCE→DEST matrix, then invert it for
 * resampling (each dest pixel reads back into the source).
 */
function similarityFromEyes(
    srcLeft: Point2D,
    srcRight: Point2D,
    dstLeft: Point2D,
    dstRight: Point2D,
): Affine {
    // Source and destination eye vectors.
    const sdx = srcRight.x - srcLeft.x
    const sdy = srcRight.y - srcLeft.y
    const ddx = dstRight.x - dstLeft.x
    const ddy = dstRight.y - dstLeft.y

    const srcLenSq = sdx * sdx + sdy * sdy || 1e-9

    // Solve for the rotation+scale part [[a, -b], [b, a]] such that it maps the
    // source eye vector onto the destination eye vector. With s = (a,b):
    //   a = (src · dst) / |src|^2,  b = (src × dst) / |src|^2.
    const a = (sdx * ddx + sdy * ddy) / srcLenSq
    const b = (sdx * ddy - sdy * ddx) / srcLenSq

    // Translation so the source left eye lands exactly on the destination left eye:
    //   dst = R*src + t  ⇒  t = dstLeft - R*srcLeft.
    const c = dstLeft.x - (a * srcLeft.x - b * srcLeft.y)
    const f = dstLeft.y - (b * srcLeft.x + a * srcLeft.y)

    return { a, b: -b, c, d: b, e: a, f }
}

/** Invert a 2×3 affine matrix. Returns null if singular (degenerate transform). */
function invertAffine(m: Affine): Affine | null {
    const det = m.a * m.e - m.b * m.d
    if (Math.abs(det) < 1e-12) return null
    const inv = 1 / det
    const a = m.e * inv
    const b = -m.b * inv
    const d = -m.d * inv
    const e = m.a * inv
    // c, f account for the original translation.
    const c = -(a * m.c + b * m.f)
    const f = -(d * m.c + e * m.f)
    return { a, b, c, d, e, f }
}

/** Bilinear RGBA sample at fractional (sx, sy); out-of-bounds reads return black. */
function sampleBilinearRgba(
    img: RgbaImage,
    sx: number,
    sy: number,
    out: Uint8ClampedArray,
    di: number,
): void {
    const { width, height, data } = img
    if (sx < 0 || sy < 0 || sx > width - 1 || sy > height - 1) {
        // Outside the source → black, opaque (matches preprocessFace's zero pad).
        out[di] = 0
        out[di + 1] = 0
        out[di + 2] = 0
        out[di + 3] = 255
        return
    }
    const x0 = Math.floor(sx)
    const y0 = Math.floor(sy)
    const x1 = Math.min(x0 + 1, width - 1)
    const y1 = Math.min(y0 + 1, height - 1)
    const fx = sx - x0
    const fy = sy - y0
    const idx = (x: number, y: number) => (y * width + x) * 4
    const lerp = (p: number, q: number, t: number) => p + (q - p) * t
    for (let ch = 0; ch < 4; ch++) {
        const top = lerp(data[idx(x0, y0) + ch], data[idx(x1, y0) + ch], fx)
        const bottom = lerp(data[idx(x0, y1) + ch], data[idx(x1, y1) + ch], fx)
        out[di + ch] = lerp(top, bottom, fy)
    }
    out[di + 3] = 255
}

/**
 * Align a face by mapping its eye centres onto fixed canonical positions in an
 * N×N square crop via a 2-point similarity transform (rotation + scale +
 * translation). Deterministic and pure given `(image, landmarks)`.
 *
 * @param image      Decoded RGBA face frame (canvas `ImageData` shape).
 * @param landmarks  MediaPipe landmarks. Accepts normalized (0-1) or pixel-space
 *                   points; normalized points are detected (all |x|,|y| ≤ 1) and
 *                   scaled to pixels using the image dimensions.
 * @param outputSize Edge length of the square output. Default `ALIGNED_OUTPUT_SIZE`.
 * @returns An aligned `RgbaImage` (outputSize × outputSize) ready for
 *          `preprocessFace`, or `null` when eye landmarks are missing/degenerate
 *          (the caller falls back to the unaligned crop).
 */
export function alignFace(
    image: RgbaImage,
    landmarks: LandmarkArray,
    outputSize: number = ALIGNED_OUTPUT_SIZE,
): RgbaImage | null {
    if (!image.width || !image.height || !landmarks || landmarks.length === 0) {
        return null
    }

    const eyes = resolveEyeCenters(landmarks)
    if (!eyes) return null

    // Landmarks may be normalized (0-1) or already pixel-space. If BOTH eye points
    // fall inside the unit square, treat the whole set as normalized and scale to
    // pixels. (Pixel landmarks on any real frame exceed 1 in at least one axis.)
    const normalized =
        Math.abs(eyes.left.x) <= 1 && Math.abs(eyes.left.y) <= 1 &&
        Math.abs(eyes.right.x) <= 1 && Math.abs(eyes.right.y) <= 1
    const toPixels = (p: Point2D): Point2D =>
        normalized ? { x: p.x * image.width, y: p.y * image.height } : p
    const srcLeft = toPixels(eyes.left)
    const srcRight = toPixels(eyes.right)

    // Degenerate (eyes coincident) → cannot define a transform.
    const dxs = srcRight.x - srcLeft.x
    const dys = srcRight.y - srcLeft.y
    if (dxs * dxs + dys * dys < 1e-6) return null

    const dstLeft: Point2D = {
        x: CANONICAL_LEFT_EYE.x * outputSize,
        y: CANONICAL_LEFT_EYE.y * outputSize,
    }
    const dstRight: Point2D = {
        x: CANONICAL_RIGHT_EYE.x * outputSize,
        y: CANONICAL_RIGHT_EYE.y * outputSize,
    }

    const forward = similarityFromEyes(srcLeft, srcRight, dstLeft, dstRight)
    const inverse = invertAffine(forward)
    if (!inverse) return null

    // Inverse-map every destination pixel back into the source and bilinear-sample.
    const data = new Uint8ClampedArray(outputSize * outputSize * 4)
    for (let y = 0; y < outputSize; y++) {
        for (let x = 0; x < outputSize; x++) {
            const sx = inverse.a * x + inverse.b * y + inverse.c
            const sy = inverse.d * x + inverse.e * y + inverse.f
            sampleBilinearRgba(image, sx, sy, data, (y * outputSize + x) * 4)
        }
    }

    return { width: outputSize, height: outputSize, data }
}
