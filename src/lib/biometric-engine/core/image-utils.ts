/**
 * Biometric Engine — Image Processing Utilities
 *
 * Browser-native replacements for OpenCV operations used in demo_local_fast.py.
 * All functions operate on ImageData (Canvas API) instead of numpy arrays.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5f (Canvas-based Laplacian)
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Appendix B (Gabor Kernel Parameters)
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Appendix C (HSV Conversion Formula)
 */

import type { BoundingBox } from '../types';

// ===== Grayscale Conversion =====

/**
 * Convert RGBA ImageData to grayscale Float32Array.
 *
 * Uses the standard luminance formula: 0.299*R + 0.587*G + 0.114*B
 * This matches OpenCV's cv2.COLOR_BGR2GRAY / cv2.COLOR_RGB2GRAY weighting.
 *
 * @param imageData - Source ImageData from Canvas
 * @returns Grayscale pixel values (0-255 range) as Float32Array
 * @see demo_local_fast.py line 343: cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)
 */
export function toGrayscale(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4; // RGBA
    gray[i] = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
  }

  return gray;
}

// ===== Laplacian Blur Detection =====

/**
 * Compute Laplacian variance of a grayscale image.
 *
 * Applies a 3x3 Laplacian kernel [-4*center + top + bottom + left + right]
 * and computes the variance of all output values. Higher variance indicates
 * a sharper image; low variance indicates blur.
 *
 * This is the browser equivalent of:
 *   cv2.Laplacian(gray, cv2.CV_64F).var()
 *
 * @param gray - Grayscale pixel values from toGrayscale()
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Variance of Laplacian values (higher = sharper)
 * @see demo_local_fast.py line 346: cv2.Laplacian(gray, cv2.CV_64F).var()
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5f (Canvas-based Laplacian)
 */
export function computeLaplacianVariance(gray: Float32Array, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = gray[y * width + x];
      const lap =
        -4 * center +
        gray[(y - 1) * width + x] +
        gray[(y + 1) * width + x] +
        gray[y * width + (x - 1)] +
        gray[y * width + (x + 1)];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;

  const mean = sum / count;
  return sumSq / count - mean * mean; // variance = E[X^2] - E[X]^2
}

// ===== HSV Conversion =====

/**
 * Convert RGB to HSV in OpenCV scale (H:0-180, S:0-255, V:0-255).
 *
 * @param r - Red channel 0-255
 * @param g - Green channel 0-255
 * @param b - Blue channel 0-255
 * @returns Tuple [H, S, V] in OpenCV scale
 * @see demo_local_fast.py — cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Appendix C
 */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  // Convert to OpenCV scale: H [0, 180], S [0, 255], V [0, 255]
  const hOpenCV = h / 2;
  const s = max === 0 ? 0 : (d / max) * 255;
  const v = max * 255;

  return [hOpenCV, s, v];
}

/**
 * Compute mean HSV values over all pixels of an ImageData.
 *
 * @param imageData - Source RGBA image data
 * @returns Mean H, S, V values in OpenCV scale
 * @see demo_local_fast.py — np.mean(hsv[:,:,channel])
 */
export function computeMeanHSV(imageData: ImageData): { h: number; s: number; v: number } {
  const { data, width, height } = imageData;
  const pixelCount = width * height;

  if (pixelCount === 0) return { h: 0, s: 0, v: 0 };

  let sumH = 0;
  let sumS = 0;
  let sumV = 0;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const [hVal, sVal, vVal] = rgbToHsv(data[offset], data[offset + 1], data[offset + 2]);
    sumH += hVal;
    sumS += sVal;
    sumV += vVal;
  }

  return {
    h: sumH / pixelCount,
    s: sumS / pixelCount,
    v: sumV / pixelCount,
  };
}

// ===== Gabor Filter =====

/**
 * Generate a Gabor filter kernel.
 * Replaces cv2.getGaborKernel().
 *
 * @param ksize - Kernel size (e.g. 21)
 * @param sigma - Gaussian envelope standard deviation (e.g. 5.0)
 * @param theta - Orientation in radians
 * @param lambd - Wavelength of sinusoidal component (e.g. 10.0)
 * @param gamma - Spatial aspect ratio (e.g. 0.5)
 * @returns Kernel as Float32Array of ksize*ksize elements
 * @see demo_local_fast.py lines 382-385 — cv2.getGaborKernel
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Appendix B
 */
export function generateGaborKernel(
  ksize: number,
  sigma: number,
  theta: number,
  lambd: number,
  gamma: number,
): Float32Array {
  const kernel = new Float32Array(ksize * ksize);
  const half = Math.floor(ksize / 2);
  const sigmaSquared2 = 2 * sigma * sigma;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const lambdFactor = (2 * Math.PI) / lambd;

  for (let y = -half; y <= half; y++) {
    for (let x = -half; x <= half; x++) {
      const xp = x * cosTheta + y * sinTheta;
      const yp = -x * sinTheta + y * cosTheta;
      kernel[(y + half) * ksize + (x + half)] =
        Math.exp(-(xp * xp + gamma * gamma * yp * yp) / sigmaSquared2) *
        Math.cos(lambdFactor * xp);
    }
  }

  return kernel;
}

/**
 * Pre-computed Gabor kernels at 4 orientations: 0, pi/4, pi/2, 3*pi/4.
 * Kernel size 21x21, sigma=5.0, lambda=10.0, gamma=0.5.
 *
 * @see demo_local_fast.py lines 382-385
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Appendix B
 */
export const GABOR_KERNELS: Float32Array[] = [
  0,
  Math.PI / 4,
  Math.PI / 2,
  (3 * Math.PI) / 4,
].map((theta) => generateGaborKernel(21, 5.0, theta, 10.0, 0.5));

/**
 * Apply a 2D convolution filter (Gabor or other) to a grayscale image.
 * Replaces cv2.filter2D(gray, cv2.CV_64F, kernel).
 *
 * @param gray - Grayscale pixel values
 * @param width - Image width
 * @param height - Image height
 * @param kernel - Convolution kernel as flat Float32Array
 * @param ksize - Kernel dimension (kernel is ksize x ksize)
 * @returns Filtered image as Float32Array
 * @see demo_local_fast.py — cv2.filter2D
 */
export function applyGaborFilter(
  gray: Float32Array,
  width: number,
  height: number,
  kernel: Float32Array,
  ksize: number,
): Float32Array {
  const half = Math.floor(ksize / 2);
  const result = new Float32Array(width * height);

  for (let y = half; y < height - half; y++) {
    for (let x = half; x < width - half; x++) {
      let sum = 0;
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          sum +=
            gray[(y + ky) * width + (x + kx)] *
            kernel[(ky + half) * ksize + (kx + half)];
        }
      }
      result[y * width + x] = sum;
    }
  }

  return result;
}

// ===== Statistical Functions =====

/**
 * Compute arithmetic mean of a Float32Array.
 *
 * @param arr - Input array
 * @returns Arithmetic mean
 * @see demo_local_fast.py — np.mean()
 */
export function computeMean(arr: Float32Array): number {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum / arr.length;
}

/**
 * Compute variance of a Float32Array.
 *
 * @param arr - Input array
 * @returns Variance
 * @see demo_local_fast.py — np.var()
 */
export function computeVariance(arr: Float32Array): number {
  if (arr.length === 0) return 0;
  const mean = computeMean(arr);
  let sumSq = 0;
  for (let i = 0; i < arr.length; i++) {
    const diff = arr[i] - mean;
    sumSq += diff * diff;
  }
  return sumSq / arr.length;
}

/**
 * Compute standard deviation of a Float32Array.
 *
 * @param arr - Input array
 * @returns Standard deviation
 * @see demo_local_fast.py — np.std()
 */
export function computeStd(arr: Float32Array): number {
  return Math.sqrt(computeVariance(arr));
}

// ===== Face ROI Extraction =====

/**
 * Extract face region of interest from a video element as ImageData.
 * Uses an offscreen Canvas for pixel extraction.
 * Handles padding and bounds clamping.
 *
 * @param video - Source HTMLVideoElement
 * @param bbox - Face bounding box in pixel coordinates
 * @param padding - Extra padding around the bounding box in pixels (default: 0)
 * @returns Face region as ImageData, or null if extraction fails
 * @see demo_local_fast.py — face ROI extraction for quality/liveness assessment
 */
export function extractFaceROI(
  video: HTMLVideoElement,
  bbox: BoundingBox,
  padding: number = 0,
): ImageData | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  if (vw === 0 || vh === 0) return null;

  // Apply padding and clamp to video bounds
  const x = Math.max(0, Math.floor(bbox.x - padding));
  const y = Math.max(0, Math.floor(bbox.y - padding));
  const x2 = Math.min(vw, Math.ceil(bbox.x + bbox.width + padding));
  const y2 = Math.min(vh, Math.ceil(bbox.y + bbox.height + padding));
  const w = x2 - x;
  const h = y2 - y;

  if (w <= 0 || h <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(video, x, y, w, h, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}
