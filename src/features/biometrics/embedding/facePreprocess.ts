/**
 * facePreprocess — reproduce DeepFace Facenet512's preprocessing in the browser.
 *
 * FIVUCSAS is moving the face embedding into the browser so the raw image never
 * leaves the device; only the 512-d vector is uploaded. This module turns an
 * already-detected, aligned face crop into the EXACT tensor the server's
 * DeepFace `Facenet512` model is fed, so the client embedding is self-consistent
 * with (and close to) the server's.
 *
 * Server ground truth — `DeepFace.represent(Facenet512, detector=mtcnn,
 * align=True, normalization="base")` then L2-normalize. The tensor handed to the
 * model (verified from the installed `deepface==0.0.98` source in spike report
 * `docs/THESIS_AUDIT_2026-06-11/16_facenet_browser_spike.md` §1):
 *
 *   1. aspect-ratio-preserving resize to fit 160×160 (scale = min(160/h, 160/w))
 *   2. centre BLACK padding (constant 0) to exactly 160×160 — NOT a naive stretch
 *   3. pixels scaled to [0,1] (normalization="base" is the identity — NO prewhiten)
 *   4. colour order **BGR** (DeepFace flips channels internally; the final tensor
 *      is BGR). ⚠️ Feeding RGB instead drops parity cosine from 1.0 to ~0.86-0.95.
 *   5. layout NHWC `(1, 160, 160, 3)` float32 (this ONNX export takes NHWC input)
 *
 * The OUTPUT 512-d vector is L2-normalized by the caller (see `facenetEmbedder`).
 *
 * ── Alignment (the load-bearing, riskiest step) ──────────────────────────────
 * DeepFace aligns the face (eyes level via a 2-point similarity transform) BEFORE
 * this resize/pad. Self-consistency across captures depends on that alignment
 * being deterministic. The production browser path uses the **MediaPipe
 * FaceLandmarker** that the web app already runs (`@mediapipe/tasks-vision`, see
 * `features/auth/hooks/useFaceDetection.ts`) to produce the eye landmarks and the
 * similarity transform, then feeds the aligned crop here. THIS module is
 * deliberately alignment-agnostic: it takes an already-aligned RGBA crop and only
 * owns the resize/pad/colour/scale contract. Callers (browser) MUST align first.
 *
 * The colour-order and pixel-range contract are pinned here in ONE place so the
 * browser pipeline cannot silently drift (the RGB-vs-BGR result shows how easy
 * drift is).
 */

/** Model input edge length. Facenet512 takes 160×160. */
export const FACENET_INPUT_SIZE = 160;

/** Channels (BGR). */
const CHANNELS = 3;

/**
 * A decoded image as tightly-packed RGBA bytes (canvas `ImageData` shape, also
 * what `jimp`'s `bitmap` exposes). `data.length === width * height * 4`.
 */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  /** Row-major RGBA, 4 bytes per pixel, values 0-255. */
  readonly data: Uint8ClampedArray | Uint8Array;
}

/** Nearest-neighbour-free box: integer source dims after aspect-preserving fit. */
function fitSize(
  width: number,
  height: number,
  target: number,
): { scaledW: number; scaledH: number } {
  const scale = Math.min(target / width, target / height);
  return {
    scaledW: Math.max(1, Math.round(width * scale)),
    scaledH: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Bilinear sample of the RGBA source at fractional (sx, sy). Returns [R,G,B] in
 * 0-255. Bilinear (not nearest) matches `cv2.resize`'s default INTER_LINEAR that
 * DeepFace's `resize_image` uses, keeping the browser resize close to the server.
 */
function sampleBilinear(
  img: RgbaImage,
  sx: number,
  sy: number,
): [number, number, number] {
  const { width, height, data } = img;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = sx - x0;
  const fy = sy - y0;

  const idx = (x: number, y: number) => (y * width + x) * 4;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const top = lerp(data[idx(x0, y0) + c], data[idx(x1, y0) + c], fx);
    const bottom = lerp(data[idx(x0, y1) + c], data[idx(x1, y1) + c], fx);
    out[c] = lerp(top, bottom, fy);
  }
  return out;
}

/**
 * Preprocess an (already-aligned) RGBA face crop into the Facenet512 input
 * tensor: aspect-preserving resize to fit 160×160, centre black-pad to 160×160,
 * scale to [0,1], **BGR** channel order, NHWC layout.
 *
 * @returns Float32Array of length `1 * 160 * 160 * 3` (NHWC, BGR, [0,1]).
 */
export function preprocessFace(img: RgbaImage): Float32Array {
  const size = FACENET_INPUT_SIZE;
  const { scaledW, scaledH } = fitSize(img.width, img.height, size);

  // Zero-initialised => the surrounding pad is black (constant 0), as np.pad does.
  const tensor = new Float32Array(size * size * CHANNELS);

  const offsetX = Math.floor((size - scaledW) / 2);
  const offsetY = Math.floor((size - scaledH) / 2);

  // Map each destination pixel in the scaled region back to the source and
  // bilinear-sample. (Equivalent to resize-then-place; done in one pass.)
  const xRatio = img.width / scaledW;
  const yRatio = img.height / scaledH;

  for (let y = 0; y < scaledH; y++) {
    const sy = (y + 0.5) * yRatio - 0.5;
    const syClamped = Math.min(Math.max(sy, 0), img.height - 1);
    for (let x = 0; x < scaledW; x++) {
      const sx = (x + 0.5) * xRatio - 0.5;
      const sxClamped = Math.min(Math.max(sx, 0), img.width - 1);
      const [r, g, b] = sampleBilinear(img, sxClamped, syClamped);

      const dstX = x + offsetX;
      const dstY = y + offsetY;
      const di = (dstY * size + dstX) * CHANNELS;
      // BGR order, scaled to [0,1].
      tensor[di] = b / 255;
      tensor[di + 1] = g / 255;
      tensor[di + 2] = r / 255;
    }
  }

  return tensor;
}

/** Tensor dims for the Facenet512 ONNX input (NHWC). */
export const FACENET_INPUT_DIMS: readonly number[] = [
  1,
  FACENET_INPUT_SIZE,
  FACENET_INPUT_SIZE,
  CHANNELS,
];
