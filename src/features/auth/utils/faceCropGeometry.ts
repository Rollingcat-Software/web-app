/**
 * faceCropGeometry: the one definition of where the FACE capture crop sits in the
 * camera frame, shared by the crop itself (`cropFaceToDataURL`) and by the landmark
 * mapping the client embedder needs (`mapLandmarksToFaceCrop`).
 *
 * The FaceLandmarker mesh is normalized to the full, unmirrored camera frame. The
 * image the embedder aligns is the padded, square, horizontally mirrored crop.
 * Both sides must use this geometry, or the aligner warps the wrong region of the
 * face (measured on LFW: EER 9.03% with frame landmarks against 3.56% with the
 * landmarks mapped into the crop).
 */

/** Edge length of the square FACE capture crop, in pixels. */
export const FACE_CROP_OUTPUT_SIZE = 320

/** Padding added on each side of the face box, as a fraction of the box size. */
export const FACE_CROP_PADDING = 0.2

/**
 * The crop is the mirror image of the raw (unmirrored) camera frame, so it matches
 * the CSS-flipped selfie preview. Server templates were enrolled from mirrored
 * crops, so this stays as is; the landmark mapping applies the same flip.
 */
export const FACE_CROP_MIRRORED = true

/** Normalized face box (0-1, relative to the frame). */
export interface NormalizedBox {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
}

/** A 2D point; landmarks may carry more fields, only x and y are used. */
export interface CropPoint {
    readonly x: number
    readonly y: number
}

/**
 * The square crop region in frame pixels. It may extend past the frame edges;
 * the part outside the frame is rendered black so the scale stays uniform.
 */
export interface FaceCropRect {
    readonly x: number
    readonly y: number
    readonly size: number
}

/**
 * Square region centred on the face box, with `padding` added on each side of the
 * larger box dimension. Returns null for an empty frame or a region that does not
 * overlap the frame.
 */
export function computeFaceCropRect(
    frameWidth: number,
    frameHeight: number,
    bbox: NormalizedBox,
    padding: number = FACE_CROP_PADDING,
): FaceCropRect | null {
    if (frameWidth <= 0 || frameHeight <= 0) return null
    const rawW = bbox.width * frameWidth
    const rawH = bbox.height * frameHeight
    const size = Math.max(rawW * (1 + 2 * padding), rawH * (1 + 2 * padding))
    if (!(size > 0)) return null
    const x = bbox.x * frameWidth + rawW / 2 - size / 2
    const y = bbox.y * frameHeight + rawH / 2 - size / 2
    const overlaps = x < frameWidth && y < frameHeight && x + size > 0 && y + size > 0
    return overlaps ? { x, y, size } : null
}

/**
 * Re-express frame-normalized landmarks in the crop's own normalized frame (0-1 of
 * the crop edge), applying the crop's horizontal mirror. Other fields (z) are kept
 * as they are. Indices are preserved, so MediaPipe's anatomical labels still hold;
 * the aligner pairs points by image side.
 *
 * @returns The mapped points, or null when landmarks, box or frame are missing.
 */
export function mapLandmarksToFaceCrop<T extends CropPoint>(
    landmarks: ReadonlyArray<T> | null | undefined,
    frameWidth: number,
    frameHeight: number,
    bbox: NormalizedBox | null | undefined,
    padding: number = FACE_CROP_PADDING,
): T[] | null {
    if (!landmarks || landmarks.length === 0 || !bbox) return null
    const rect = computeFaceCropRect(frameWidth, frameHeight, bbox, padding)
    if (!rect) return null
    return landmarks.map((p) => {
        const u = (p.x * frameWidth - rect.x) / rect.size
        const v = (p.y * frameHeight - rect.y) / rect.size
        return { ...p, x: FACE_CROP_MIRRORED ? 1 - u : u, y: v }
    })
}
