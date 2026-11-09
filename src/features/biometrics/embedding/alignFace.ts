/**
 * alignFace — deterministic in-browser face aligner (client-side Facenet512).
 *
 * THE load-bearing step for client self-consistency. `preprocessFace` only owns
 * resize/pad/colour/scale and expects an ALREADY-ALIGNED crop; without an aligner
 * the embedding is computed from a raw bbox crop, so pose/scale/rotation vary
 * capture-to-capture. This module removes that variation by fitting five stable
 * landmarks (eye centres, nose tip, mouth corners) to a FIXED canonical template
 * with a least-squares 2D similarity transform (the standard five-point face
 * alignment).
 *
 * The landmarks must be in the frame of the image being aligned. For a capture
 * crop that is `mapLandmarksToFaceCrop` (features/auth/utils/faceCropGeometry),
 * which re-expresses the camera-frame mesh in the mirrored crop. Passing the
 * camera-frame mesh straight in was the defect fixed by FACE_ALIGNMENT_VERSION 2.
 *
 * ── Why self-consistency, not server parity ──────────────────────────────────
 * Client embedding ships with a FULL re-enroll: both the enrollment template AND
 * the login probe are computed through THIS identical aligner. So we do NOT need
 * to reproduce MTCNN/DeepFace's absolute geometry (MTCNN-align ≠ MediaPipe-align).
 * We only need the aligner to be DETERMINISTIC and to normalise pose/scale/rotation
 * so that two captures of the same face land in the same canonical frame. The
 * shared export below is therefore the SINGLE aligner both enroll and verify call.
 *
 * ── Landmarks ────────────────────────────────────────────────────────────────
 * MediaPipe FaceLandmarker (478-pt) indices from `biometric-engine/core/constants`:
 * eye centres = iris centres 468 / 473 (outer eye corners 33 / 263 on a 468-pt
 * mesh), nose tip 1, mouth corners 61 / 291. When the nose or a mouth corner is
 * missing, the two eyes alone are fitted to the template's eye points.
 *
 * ── No canvas dependency (deterministic + headless-testable) ──────────────────
 * The transform is applied by pure-JS inverse-mapping + bilinear resampling
 * (identical maths to `preprocessFace`), NOT a canvas 2D `setTransform` draw. This
 * keeps the aligner byte-deterministic, free of canvas/anti-alias driver drift,
 * and runnable in the headless vitest environment (jsdom has no 2D canvas), so the
 * pose-invariance gate exercises the REAL production code path.
 */

import {
    LEFT_IRIS,
    RIGHT_IRIS,
    HEAD_POSE_LEFT_EYE,
    HEAD_POSE_RIGHT_EYE,
    NOSE_TIP,
    MOUTH_LEFT,
    MOUTH_RIGHT,
} from '@/lib/biometric-engine/core/constants'
import { FACENET_INPUT_SIZE, type RgbaImage } from './facePreprocess'

/** A 2D point in image space (pixels for pixel landmarks, fractions for normalized). */
export interface Point2D {
    readonly x: number
    readonly y: number
}

/**
 * The minimal landmark shape the aligner needs: an indexable array of points.
 * Compatible with MediaPipe's `NormalizedLandmark[]` (0-1) and `PixelLandmark[]`
 * (pixel coords); the aligner scales normalized landmarks to pixels itself.
 * The points must be in the coordinate frame of the image being aligned (for a
 * capture crop: `mapLandmarksToFaceCrop`), not the camera frame.
 */
export type LandmarkArray = ReadonlyArray<Point2D | undefined>

/**
 * Output edge length of the aligned square crop. Defaults to the Facenet512 input
 * edge (160) so the aligned crop drops straight into `preprocessFace` with no pad.
 */
export const ALIGNED_OUTPUT_SIZE = FACENET_INPUT_SIZE

/**
 * Version of the alignment geometry. Embeddings from different versions are not
 * comparable, so a template enrolled under an older version must be re-enrolled.
 *   1: two eye points; frame-normalized landmarks applied to the crop (defective).
 *   2: five points mapped into the crop, least-squares similarity to the template.
 */
export const FACE_ALIGNMENT_VERSION = 2

/** The standard 112 px five-point face template (eye centres, nose tip, mouth corners). */
const REFERENCE_TEMPLATE_112: ReadonlyArray<readonly [number, number]> = [
    [38.2946, 51.6963],
    [73.5318, 51.5014],
    [56.0252, 71.7366],
    [41.5493, 92.3655],
    [70.7299, 92.2041],
]

/**
 * Zoom applied to the reference template about the image centre (below 1 keeps
 * more forehead, chin and cheeks in the crop). Chosen on LFW View 1
 * (pairsDevTrain) through the browser pipeline; see fivucsas-papers
 * paper-A-system-edge/bench/lfw-browser/aligned/results.md.
 */
const TEMPLATE_ZOOM = 0.8

/**
 * Canonical five-point template, as fractions of the output edge, in IMAGE order:
 * left eye, right eye, nose tip, left mouth corner, right mouth corner (left = the
 * image's left).
 */
export const FACE_ALIGNMENT_TEMPLATE: ReadonlyArray<Point2D> = REFERENCE_TEMPLATE_112.map(([x, y]) => ({
    x: 0.5 + (x / 112 - 0.5) * TEMPLATE_ZOOM,
    y: 0.5 + (y / 112 - 0.5) * TEMPLATE_ZOOM,
}))

/** 2×3 affine matrix [[a, b, c], [d, e, f]] mapping source (x,y) → dest (x,y). */
export interface Affine {
    a: number
    b: number
    c: number
    d: number
    e: number
    f: number
}

function isFinitePoint(p: Point2D | undefined): p is Point2D {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y)
}

/** Eye centre: the iris centre on the refined 478-pt mesh, else the outer eye corner. */
function eyeCentre(landmarks: LandmarkArray, iris: number, corner: number): Point2D | null {
    const p = landmarks[iris]
    if (isFinitePoint(p)) return p
    const q = landmarks[corner]
    return isFinitePoint(q) ? q : null
}

/**
 * The alignment keypoints in template order (image-left first). MediaPipe labels
 * are anatomical: 468/33/61 are the subject's right side, which is the image left
 * in an unmirrored camera frame and the image right in the mirrored capture crop.
 * The side is decided from the geometry (the mouth lies below the eye line in the
 * face's own frame), so mirrored and unmirrored inputs both align upright.
 * Returns the two eyes only when the nose or a mouth corner is unavailable.
 */
function resolveKeypoints(landmarks: LandmarkArray): Point2D[] | null {
    const eyeA = eyeCentre(landmarks, LEFT_IRIS, HEAD_POSE_LEFT_EYE)
    const eyeB = eyeCentre(landmarks, RIGHT_IRIS, HEAD_POSE_RIGHT_EYE)
    if (!eyeA || !eyeB) return null
    const nose = landmarks[NOSE_TIP]
    const mouthA = landmarks[MOUTH_LEFT]
    const mouthB = landmarks[MOUTH_RIGHT]
    if (!isFinitePoint(nose) || !isFinitePoint(mouthA) || !isFinitePoint(mouthB)) {
        return [eyeA, eyeB]
    }
    // z of (eyeB - eyeA) x (mouth centre - eye centre): positive when eyeA is on the
    // image left (y grows downward), negative when the image is mirrored.
    const ex = eyeB.x - eyeA.x
    const ey = eyeB.y - eyeA.y
    const mx = (mouthA.x + mouthB.x - eyeA.x - eyeB.x) / 2
    const my = (mouthA.y + mouthB.y - eyeA.y - eyeB.y) / 2
    const mirrored = ex * my - ey * mx < 0
    return mirrored ? [eyeB, eyeA, nose, mouthB, mouthA] : [eyeA, eyeB, nose, mouthA, mouthB]
}

/**
 * Least-squares similarity transform (rotation, uniform scale, translation; no
 * reflection) mapping `src[i]` onto `dst[i]` (Umeyama's closed form in 2D). With two
 * points it is the exact eye-to-eye transform.
 */
function fitSimilarity(src: ReadonlyArray<Point2D>, dst: ReadonlyArray<Point2D>): Affine | null {
    const n = src.length
    let sx = 0
    let sy = 0
    let dx = 0
    let dy = 0
    for (let i = 0; i < n; i++) {
        sx += src[i].x
        sy += src[i].y
        dx += dst[i].x
        dy += dst[i].y
    }
    sx /= n
    sy /= n
    dx /= n
    dy /= n
    let dot = 0
    let cross = 0
    let norm = 0
    for (let i = 0; i < n; i++) {
        const px = src[i].x - sx
        const py = src[i].y - sy
        const qx = dst[i].x - dx
        const qy = dst[i].y - dy
        dot += px * qx + py * qy
        cross += px * qy - py * qx
        norm += px * px + py * py
    }
    if (norm < 1e-9) return null
    // Rotation+scale [[a, -b], [b, a]]; translation maps the source centroid onto
    // the destination centroid.
    const a = dot / norm
    const b = cross / norm
    return { a, b: -b, c: dx - (a * sx - b * sy), d: b, e: a, f: dy - (b * sx + a * sy) }
}

/**
 * Forward transform (image pixels → output pixels) that puts the face's keypoints
 * on the template, or null when the eyes are missing or degenerate.
 *
 * @param landmarks  Points in the image's own frame, normalized (0-1) or pixels.
 */
export function estimateAlignmentTransform(
    landmarks: LandmarkArray,
    width: number,
    height: number,
    template: ReadonlyArray<Point2D> = FACE_ALIGNMENT_TEMPLATE,
    outputSize: number = ALIGNED_OUTPUT_SIZE,
): Affine | null {
    if (!width || !height || !landmarks || landmarks.length === 0) return null
    const keypoints = resolveKeypoints(landmarks)
    if (!keypoints) return null

    // Landmarks may be normalized (0-1) or already pixel-space. If both eye points
    // fall inside the unit square, treat the whole set as normalized and scale to
    // pixels. (Pixel landmarks on any real frame exceed 1 in at least one axis.)
    const [eyeL, eyeR] = keypoints
    const normalized =
        Math.abs(eyeL.x) <= 1 && Math.abs(eyeL.y) <= 1 &&
        Math.abs(eyeR.x) <= 1 && Math.abs(eyeR.y) <= 1
    const src = keypoints.map((p) => (normalized ? { x: p.x * width, y: p.y * height } : p))

    // Degenerate (eyes coincident) → cannot define a transform.
    if (Math.hypot(src[1].x - src[0].x, src[1].y - src[0].y) < 1e-3) return null

    const dst = template
        .slice(0, src.length)
        .map((p) => ({ x: p.x * outputSize, y: p.y * outputSize }))
    return fitSimilarity(src, dst)
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
 * Align a face by fitting its five keypoints (eye centres, nose tip, mouth corners)
 * to `FACE_ALIGNMENT_TEMPLATE` with a least-squares similarity transform, then
 * resampling an N×N crop. Deterministic and pure given `(image, landmarks)`.
 *
 * @param image      Decoded RGBA face image (canvas `ImageData` shape).
 * @param landmarks  MediaPipe mesh in the image's own frame (for a capture crop:
 *                   `mapLandmarksToFaceCrop`), normalized (0-1) or pixel-space.
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
    return alignFaceToTemplate(image, landmarks, FACE_ALIGNMENT_TEMPLATE, outputSize)
}

/** `alignFace` against an explicit template (the benchmark compares templates with it). */
export function alignFaceToTemplate(
    image: RgbaImage,
    landmarks: LandmarkArray,
    template: ReadonlyArray<Point2D>,
    outputSize: number = ALIGNED_OUTPUT_SIZE,
): RgbaImage | null {
    if (!image.width || !image.height) return null
    const forward = estimateAlignmentTransform(landmarks, image.width, image.height, template, outputSize)
    const inverse = forward ? invertAffine(forward) : null
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
