/**
 * faceCropper.ts — Client-side face cropping utility.
 *
 * Always crops the face bounding box to a fixed square JPEG (FACE_CROP_OUTPUT_SIZE) before sending
 * to the server. This eliminates the 200-730ms server-side detection step
 * because the server receives a tight face crop instead of a full 640×480 frame.
 *
 * Canvas2D API: supported in all modern browsers including Safari 14+.
 *
 * Output: a square JPEG crop. Defaults raised (2026-05-30) to 320px @ q0.92
 * from 224px @ q0.85 — the larger, sharper crop measurably improves the
 * server-side face embedding while a tight face crop keeps the payload small
 * (~20-35KB).
 *
 * @see CLIENT_SIDE_ML_PLAN.md Phase 4.2.1
 */

import {
  FACE_CROP_MIRRORED,
  FACE_CROP_OUTPUT_SIZE,
  FACE_CROP_PADDING,
  computeFaceCropRect,
  type NormalizedBox,
} from './faceCropGeometry'

/** Normalized bounding box returned by BlazeFace / useFaceDetection (0–1 range). */
export type FaceBoundingBox = NormalizedBox

/**
 * Crop a face from a video/canvas source to a square offscreen canvas.
 *
 * Algorithm:
 * 1. Take the padded square region around the face box (`computeFaceCropRect`,
 *    the geometry `mapLandmarksToFaceCrop` also uses).
 * 2. Draw the part of that region inside the frame at one uniform scale; any part
 *    outside the frame stays black (no stretching at the frame edge).
 * 3. Mirror horizontally (selfie video is CSS-flipped, so we un-flip for server).
 * 4. Return a JPEG data-URL at quality 0.92.
 *
 * @param source      Live video element or an already-drawn canvas.
 * @param bbox        Normalized bounding box from BlazeFace / MediaPipe.
 * @param outputSize  Output square size in pixels. Default: FACE_CROP_OUTPUT_SIZE.
 * @param padding     Fractional padding around the bbox. Default: FACE_CROP_PADDING.
 * @returns           Base64 JPEG data-URL string, or null on canvas failure.
 */
export function cropFaceToDataURL(
  source: HTMLVideoElement | HTMLCanvasElement,
  bbox: FaceBoundingBox,
  outputSize = FACE_CROP_OUTPUT_SIZE,
  padding = FACE_CROP_PADDING,
): string | null {
  const srcWidth =
    source instanceof HTMLVideoElement ? source.videoWidth : source.width
  const srcHeight =
    source instanceof HTMLVideoElement ? source.videoHeight : source.height

  const rect = computeFaceCropRect(srcWidth, srcHeight, bbox, padding)
  if (!rect) return null

  // Visible part of the square region, in source pixels.
  const sx0 = Math.max(0, rect.x)
  const sy0 = Math.max(0, rect.y)
  const sx1 = Math.min(srcWidth, rect.x + rect.size)
  const sy1 = Math.min(srcHeight, rect.y + rect.size)
  if (sx1 <= sx0 || sy1 <= sy0) return null

  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // JPEG has no alpha: start from opaque black so the off-frame part is black.
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, outputSize, outputSize)

  if (FACE_CROP_MIRRORED) {
    ctx.translate(outputSize, 0)
    ctx.scale(-1, 1)
  }

  const scale = outputSize / rect.size
  ctx.drawImage(
    source,
    sx0, sy0, sx1 - sx0, sy1 - sy0,                       // source rect
    (sx0 - rect.x) * scale, (sy0 - rect.y) * scale,       // dest origin
    (sx1 - sx0) * scale, (sy1 - sy0) * scale,             // dest size
  )

  return canvas.toDataURL('image/jpeg', 0.92)
}

/**
 * Convert a base64 JPEG data-URL to an ImageData object.
 *
 * Retained for generic image-to-pixel-data conversion. Note that as of
 * 2026-04-18 the client embedding path uses landmark geometry (not pixel
 * data), so EmbeddingComputer.extract() no longer consumes ImageData.
 *
 * @param dataURL  Base64 JPEG data-URL (e.g. from cropFaceToDataURL).
 * @returns        ImageData, or null if the canvas context fails.
 */
export async function dataURLToImageData(dataURL: string): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(ctx.getImageData(0, 0, img.width, img.height))
    }
    img.onerror = () => resolve(null)
    img.src = dataURL
  })
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
 * @param outputSize  Output square size in pixels. Default: FACE_CROP_OUTPUT_SIZE.
 * @returns           Base64 JPEG data-URL, or null if no face available.
 */
export function captureAndCropFace(
  videoEl: HTMLVideoElement,
  bbox: FaceBoundingBox | null,
  outputSize = FACE_CROP_OUTPUT_SIZE,
): string | null {
  if (!bbox) return null
  if (videoEl.readyState < 2) return null
  return cropFaceToDataURL(videoEl, bbox, outputSize, FACE_CROP_PADDING)
}
