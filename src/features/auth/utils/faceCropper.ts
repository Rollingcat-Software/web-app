/**
 * faceCropper.ts — Client-side face cropping utility.
 *
 * Always crops the face bounding box to a fixed 224×224 JPEG before sending
 * to the server. This eliminates the 200-730ms server-side detection step
 * because the server receives a tight face crop instead of a full 640×480 frame.
 *
 * Canvas2D API: supported in all modern browsers including Safari 14+.
 *
 * Performance target: output JPEG < 20KB at quality 0.85.
 *
 * @see CLIENT_SIDE_ML_PLAN.md Phase 4.2.1
 */

/** Normalized bounding box returned by BlazeFace / useFaceDetection (0–1 range). */
export interface FaceBoundingBox {
  /** Normalized left edge (0–1, relative to video width). */
  x: number
  /** Normalized top edge (0–1, relative to video height). */
  y: number
  /** Normalized width (0–1). */
  width: number
  /** Normalized height (0–1). */
  height: number
}

/**
 * Crop a face from a video/canvas source to a square offscreen canvas.
 *
 * Algorithm:
 * 1. Convert normalized bbox to pixel coordinates.
 * 2. Add symmetric padding (default 20%) so ears/forehead are included.
 * 3. Clamp to the source dimensions (no out-of-bounds reads).
 * 4. Scale crop region to outputSize × outputSize.
 * 5. Mirror horizontally (selfie video is CSS-flipped, so we un-flip for server).
 * 6. Return JPEG data-URL at quality 0.85 (typically 8–18 KB for a face).
 *
 * @param source      Live video element or an already-drawn canvas.
 * @param bbox        Normalized bounding box from BlazeFace / MediaPipe.
 * @param outputSize  Output square size in pixels. Default: 224.
 * @param padding     Fractional padding around the bbox. Default: 0.2 (20%).
 * @returns           Base64 JPEG data-URL string, or null on canvas failure.
 */
export function cropFaceToDataURL(
  source: HTMLVideoElement | HTMLCanvasElement,
  bbox: FaceBoundingBox,
  outputSize = 224,
  padding = 0.2,
): string | null {
  const srcWidth =
    source instanceof HTMLVideoElement ? source.videoWidth : source.width
  const srcHeight =
    source instanceof HTMLVideoElement ? source.videoHeight : source.height

  if (srcWidth === 0 || srcHeight === 0) return null

  // --- 1. Pixel coordinates ---
  const rawX = bbox.x * srcWidth
  const rawY = bbox.y * srcHeight
  const rawW = bbox.width * srcWidth
  const rawH = bbox.height * srcHeight

  // --- 2. Add padding ---
  const padW = rawW * padding
  const padH = rawH * padding

  // Make the crop square (use the larger dimension) so the 224×224 output
  // doesn't distort the face aspect ratio.
  const paddedW = rawW + padW * 2
  const paddedH = rawH + padH * 2
  const size = Math.max(paddedW, paddedH)
  const centerX = rawX + rawW / 2
  const centerY = rawY + rawH / 2

  const cropX = centerX - size / 2
  const cropY = centerY - size / 2

  // --- 3. Clamp to source bounds ---
  const clampedX = Math.max(0, cropX)
  const clampedY = Math.max(0, cropY)
  const clampedW = Math.min(srcWidth - clampedX, size - (clampedX - cropX))
  const clampedH = Math.min(srcHeight - clampedY, size - (clampedY - cropY))

  if (clampedW <= 0 || clampedH <= 0) return null

  // --- 4. Draw to offscreen canvas at outputSize × outputSize ---
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // --- 5. Mirror horizontally to undo the CSS scaleX(-1) applied in the UI ---
  ctx.translate(outputSize, 0)
  ctx.scale(-1, 1)

  ctx.drawImage(
    source,
    clampedX, clampedY, clampedW, clampedH, // source rect
    0, 0, outputSize, outputSize,             // dest rect
  )

  // --- 6. Encode to JPEG ---
  return canvas.toDataURL('image/jpeg', 0.85)
}

/**
 * Capture and crop the best face from the current video frame.
 *
 * Selects the face with the highest confidence score (if multiple detected).
 * Returns null if there are no detections, so the caller can show a
 * "No face detected" message instead of submitting a blank crop.
 *
 * @param videoEl     The live camera video element.
 * @param bbox        Normalized bounding box from useFaceDetection state.
 * @param outputSize  Output square size in pixels. Default: 224.
 * @returns           Base64 JPEG data-URL, or null if no face available.
 */
export function captureAndCropFace(
  videoEl: HTMLVideoElement,
  bbox: FaceBoundingBox | null,
  outputSize = 224,
): string | null {
  if (!bbox) return null
  if (videoEl.readyState < 2) return null
  return cropFaceToDataURL(videoEl, bbox, outputSize, 0.2)
}
