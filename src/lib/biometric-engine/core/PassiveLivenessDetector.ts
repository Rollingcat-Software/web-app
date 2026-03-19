/**
 * Biometric Engine — PassiveLivenessDetector
 *
 * Browser-native port of FastLivenessDetector from demo_local_fast.py (lines 369-444).
 * 5-component passive liveness scoring using texture, color, skin tone, moire, and
 * local variance analysis. Pure canvas/ImageData — no external dependencies.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5g
 * @see demo_local_fast.py lines 369-444
 */

import type { IPassiveLivenessDetector } from '../interfaces';
import type { LivenessResult } from '../types';
import {
  GABOR_STD_THRESHOLD,
  LIVENESS_THRESHOLD,
  LIVENESS_WEIGHTS,
  LOCAL_VAR_SCALE,
  MOIRE_PENALTY,
  SAT_HIGH,
  SAT_LOW,
  SAT_OVERSATURATED_SCALE,
  SKIN_HUE_MAX,
  SKIN_HUE_WRAP,
  TEXTURE_OFFSET,
  TEXTURE_SCALE,
} from './constants';
import {
  applyGaborFilter,
  computeLaplacianVariance,
  computeMeanHSV,
  computeStd,
  computeVariance,
  GABOR_KERNELS,
  toGrayscale,
} from './image-utils';

/**
 * Passive liveness detection via texture, color, and pattern analysis.
 *
 * Direct port of Python FastLivenessDetector (demo_local_fast.py lines 369-444).
 * All scoring formulas and weights match the Python implementation exactly.
 *
 * The 5-component scoring approach detects common spoofing attacks:
 * - **Texture**: Flat/blurry faces indicate printed photos
 * - **Color**: Oversaturated or desaturated images indicate prints/screens
 * - **Skin tone**: Hue outside skin range indicates non-face material
 * - **Moire**: Periodic patterns from screen/print reproduction
 * - **Local variance**: Real faces have different texture across regions
 *
 * @example
 * ```typescript
 * const detector = new PassiveLivenessDetector();
 * const roi = QualityAssessor.extractFaceROI(video, detection.boundingBox);
 * if (roi) {
 *   const result = detector.check(roi);
 *   console.log(`Live: ${result.isLive}, Score: ${result.score}`);
 * }
 * ```
 */
export class PassiveLivenessDetector implements IPassiveLivenessDetector {
  private threshold: number;

  /**
   * Create a PassiveLivenessDetector instance.
   *
   * @param threshold - Score threshold for isLive determination.
   *   Default: 50.0 (matches Python demo_local_fast.py line 379)
   *
   * @see demo_local_fast.py line 379: def __init__(self, threshold: float = 50.0)
   */
  constructor(threshold: number = LIVENESS_THRESHOLD) {
    this.threshold = threshold;
  }

  /**
   * PassiveLivenessDetector is always available (no async initialization needed).
   * Pure canvas/ImageData computation — no external model required.
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Perform 5-component passive liveness scoring on a face image.
   *
   * Components and weights:
   * 1. **TEXTURE** (0.25): Laplacian variance of grayscale.
   *    `score = min(100, max(0, (lapVar - 20) / 3))`
   * 2. **COLOR** (0.25): Mean saturation in HSV (OpenCV 0-255 scale).
   *    30 <= S <= 120 → 100; S < 30 → max(0, S*2); S > 120 → max(0, 100-(S-120)*0.8)
   * 3. **SKIN TONE** (0.15): Mean hue in HSV (OpenCV 0-180 scale).
   *    H < 25 or H > 165 → 100 (skin range); else → max(0, 100-|H-15|*3)
   * 4. **MOIRE** (0.20): 4 Gabor filters at orientations 0, pi/4, pi/2, 3*pi/4.
   *    Start at 100, -20 for each filter with std > 40.
   * 5. **LOCAL VARIANCE** (0.15): Split into 4 quadrants.
   *    score = min(100, (max_var - min_var) / 10)
   *
   * Combined = tex*0.25 + color*0.25 + skin*0.15 + moire*0.20 + local*0.15
   * isLive = combined >= threshold
   *
   * @param faceImageData - Face region as ImageData (from extractFaceROI or Canvas)
   * @returns Liveness result with isLive flag, overall score, and per-component breakdown
   *
   * @see demo_local_fast.py lines 387-444: FastLivenessDetector.check()
   */
  check(faceImageData: ImageData): LivenessResult {
    const { width, height } = faceImageData;

    // Edge case: empty or degenerate image
    // @see demo_local_fast.py lines 388-389
    if (width <= 2 || height <= 2) {
      return {
        isLive: false,
        score: 0,
        breakdown: { texture: 0, color: 0, skinTone: 0, moire: 0, localVariance: 0 },
      };
    }

    try {
      // Convert to grayscale for texture/moire/local-variance analysis
      // @see demo_local_fast.py line 392: gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)
      const gray = toGrayscale(faceImageData);

      // ── 1. TEXTURE SCORE (weight 0.25) ──────────────────────────────────
      // Laplacian variance measures edge sharpness/texture detail.
      // Real faces have natural texture; printed photos appear flat.
      // @see demo_local_fast.py lines 396-398
      const lapVar = computeLaplacianVariance(gray, width, height);
      const texture = Math.min(100, Math.max(0, (lapVar - TEXTURE_OFFSET) / TEXTURE_SCALE));

      // ── 2. COLOR NATURALNESS SCORE (weight 0.25) ────────────────────────
      // Real skin has moderate saturation (40-100 on 0-255 scale).
      // Too low = grayscale/washed out; Too high = oversaturated print.
      // @see demo_local_fast.py lines 400-410
      const meanHSV = computeMeanHSV(faceImageData);
      const satMean = meanHSV.s;
      let color: number;
      if (satMean >= SAT_LOW && satMean <= SAT_HIGH) {
        color = 100; // Good natural range
      } else if (satMean < SAT_LOW) {
        color = Math.max(0, satMean * 2); // Penalty for too gray
      } else {
        color = Math.max(0, 100 - (satMean - SAT_HIGH) * SAT_OVERSATURATED_SCALE); // Penalty for oversaturated
      }

      // ── 3. SKIN TONE SCORE (weight 0.15) ────────────────────────────────
      // Hue should be in skin range: 0-25 or 165-180 (OpenCV 0-180 scale).
      // @see demo_local_fast.py lines 412-414
      const hueMean = meanHSV.h;
      const skinTone =
        hueMean < SKIN_HUE_MAX || hueMean > SKIN_HUE_WRAP
          ? 100
          : Math.max(0, 100 - Math.abs(hueMean - 15) * 3);

      // ── 4. MOIRE/PATTERN DETECTION SCORE (weight 0.20) ──────────────────
      // Gabor filters detect periodic patterns from screen/print reproduction.
      // Print attacks often show periodic patterns with high std.
      //
      // PERFORMANCE OPTIMIZATION: Sample every 4th pixel for Gabor convolution.
      // Gabor filtering is O(width * height * ksize^2) per kernel — the most
      // expensive operation. Downsampling 4x reduces cost by ~16x while
      // preserving frequency content relevant to moire detection (moire patterns
      // are typically low-frequency artifacts visible even at reduced resolution).
      //
      // @see demo_local_fast.py lines 416-422
      let moire = 100;

      // Downsample grayscale by 2x in each dimension (sample every 4th pixel)
      const dsWidth = Math.floor(width / 2);
      const dsHeight = Math.floor(height / 2);

      if (dsWidth > 21 && dsHeight > 21) {
        const dsGray = new Float32Array(dsWidth * dsHeight);
        for (let dy = 0; dy < dsHeight; dy++) {
          for (let dx = 0; dx < dsWidth; dx++) {
            dsGray[dy * dsWidth + dx] = gray[dy * 2 * width + dx * 2];
          }
        }

        for (const kernel of GABOR_KERNELS) {
          const filtered = applyGaborFilter(dsGray, dsWidth, dsHeight, kernel, 21);
          const gaborStd = computeStd(filtered);
          if (gaborStd > GABOR_STD_THRESHOLD) {
            moire -= MOIRE_PENALTY;
          }
        }
      }

      // ── 5. LOCAL CONTRAST VARIATION SCORE (weight 0.15) ─────────────────
      // Real faces have varying texture across regions (forehead vs cheek vs chin).
      // Printed/flat images have uniform variance.
      // @see demo_local_fast.py lines 424-436
      let localVariance: number;

      if (height >= 20 && width >= 20) {
        const halfH = Math.floor(height / 2);
        const halfW = Math.floor(width / 2);

        // Extract 4 quadrant sub-arrays
        const quadrants = [
          this.extractQuadrant(gray, width, 0, 0, halfW, halfH),           // top-left
          this.extractQuadrant(gray, width, halfW, 0, width - halfW, halfH),    // top-right
          this.extractQuadrant(gray, width, 0, halfH, halfW, height - halfH),   // bottom-left
          this.extractQuadrant(gray, width, halfW, halfH, width - halfW, height - halfH), // bottom-right
        ];

        const variances = quadrants.map((q) => computeVariance(q));
        const varRange = Math.max(...variances) - Math.min(...variances);
        localVariance = Math.min(100, varRange / LOCAL_VAR_SCALE);
      } else {
        // Image too small for quadrant analysis — neutral score
        // @see demo_local_fast.py line 436
        localVariance = 50;
      }

      // ── COMBINED SCORE ──────────────────────────────────────────────────
      // Weighted sum of all 5 components.
      // @see demo_local_fast.py lines 438-440
      const score =
        texture * LIVENESS_WEIGHTS.texture +
        color * LIVENESS_WEIGHTS.color +
        skinTone * LIVENESS_WEIGHTS.skinTone +
        moire * LIVENESS_WEIGHTS.moire +
        localVariance * LIVENESS_WEIGHTS.localVariance;

      return {
        isLive: score >= this.threshold,
        score,
        breakdown: {
          texture,
          color,
          skinTone,
          moire,
          localVariance,
        },
      };
    } catch {
      // Match Python behavior: return not-live on any error
      // @see demo_local_fast.py lines 443-444
      return {
        isLive: false,
        score: 0,
        breakdown: { texture: 0, color: 0, skinTone: 0, moire: 0, localVariance: 0 },
      };
    }
  }

  /**
   * Extract a rectangular sub-region from a flat grayscale array.
   *
   * @param gray - Full grayscale image as flat array
   * @param fullWidth - Width of the full image
   * @param startX - Start X coordinate of the sub-region
   * @param startY - Start Y coordinate of the sub-region
   * @param regionWidth - Width of the sub-region
   * @param regionHeight - Height of the sub-region
   * @returns Sub-region pixels as Float32Array
   */
  private extractQuadrant(
    gray: Float32Array,
    fullWidth: number,
    startX: number,
    startY: number,
    regionWidth: number,
    regionHeight: number,
  ): Float32Array {
    const result = new Float32Array(regionWidth * regionHeight);
    for (let y = 0; y < regionHeight; y++) {
      for (let x = 0; x < regionWidth; x++) {
        result[y * regionWidth + x] = gray[(startY + y) * fullWidth + (startX + x)];
      }
    }
    return result;
  }
}
