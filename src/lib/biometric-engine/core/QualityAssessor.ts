/**
 * Biometric Engine — QualityAssessor
 *
 * Browser-native port of FastQualityAssessor from demo_local_fast.py (lines 332-366).
 * Assesses face image quality based on blur, size, and brightness.
 * Uses Canvas API and manual Laplacian convolution instead of OpenCV.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5f
 * @see demo_local_fast.py lines 332-366
 */

import type { IQualityAssessor } from '../interfaces';
import type { BoundingBox, QualityIssue, QualityReport } from '../types';
import {
  DEFAULT_BLUR_THRESHOLD,
  DEFAULT_FACE_ROI_PADDING,
  MAX_BRIGHTNESS,
  MIN_BRIGHTNESS,
  REFERENCE_FACE_DIMENSION,
} from './constants';
import { computeLaplacianVariance, computeMean, toGrayscale } from './image-utils';

/**
 * Assesses face image quality using blur, size, and brightness metrics.
 *
 * Direct port of Python FastQualityAssessor (demo_local_fast.py lines 332-366).
 * All scoring formulas match the Python implementation exactly.
 *
 * @example
 * ```typescript
 * const assessor = new QualityAssessor();
 * const roi = QualityAssessor.extractFaceROI(video, detection.boundingBox);
 * if (roi) {
 *   const report = assessor.assess(roi);
 *   console.log(`Quality: ${report.score}, Issues: ${report.issues}`);
 * }
 * ```
 */
export class QualityAssessor implements IQualityAssessor {
  private blurThreshold: number;

  /**
   * Create a QualityAssessor instance.
   *
   * @param blurThreshold - Laplacian variance divisor for blur scoring.
   *   Higher values make the blur check more lenient.
   *   Default: 100.0 (matches Python demo_local_fast.py line 335)
   *
   * @see demo_local_fast.py line 335: def __init__(self, blur_threshold: float = 100.0)
   */
  constructor(blurThreshold: number = DEFAULT_BLUR_THRESHOLD) {
    this.blurThreshold = blurThreshold;
  }

  /**
   * QualityAssessor is always available (no async initialization needed).
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Assess face image quality.
   *
   * Computes three sub-scores and an overall score:
   * 1. **Blur score** (0-100): Laplacian variance of grayscale image.
   *    Higher variance = sharper image = higher score.
   * 2. **Size score** (0-100): Based on the smaller dimension of the face.
   *    Larger faces score higher.
   * 3. **Brightness score** (100 or 50): Binary check whether mean brightness
   *    falls in the acceptable range (50-200).
   *
   * Overall = (blur + size + brightness) / 3
   *
   * @param faceImageData - Face region as ImageData (from extractFaceROI or Canvas)
   * @returns Quality report with scores and detected issues
   *
   * @see demo_local_fast.py lines 338-366: FastQualityAssessor.assess()
   */
  assess(faceImageData: ImageData): QualityReport {
    const { width, height } = faceImageData;

    // Edge case: empty or degenerate image
    if (width <= 2 || height <= 2) {
      return {
        score: 0,
        blur: 0,
        size: 0,
        brightness: 0,
        brightnessOk: false,
        issues: ['Blurry', 'Small', 'Dark'],
      };
    }

    // Step 1: Convert to grayscale
    // Python: gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)
    // @see demo_local_fast.py line 343
    const gray = toGrayscale(faceImageData);

    // Step 2: Blur score via Laplacian variance
    // Python: lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    // Python: blur_score = min(100, (lap_var / self.blur_threshold) * 100)
    // @see demo_local_fast.py lines 346-347
    const lapVar = computeLaplacianVariance(gray, width, height);
    const blurScore = Math.min(100, (lapVar / this.blurThreshold) * 100);

    // Step 3: Size score based on smallest dimension
    // Python: size_score = min(100, min(h, w) / 80 * 50)
    // @see demo_local_fast.py line 350
    const sizeScore = Math.min(100, (Math.min(height, width) / REFERENCE_FACE_DIMENSION) * 50);

    // Step 4: Brightness check
    // Python: brightness = np.mean(gray)
    // Python: bright_ok = 50 < brightness < 200
    // @see demo_local_fast.py lines 353-354
    const brightness = computeMean(gray);
    const brightnessOk = brightness > MIN_BRIGHTNESS && brightness < MAX_BRIGHTNESS;
    const brightnessScore = brightnessOk ? 100 : 50;

    // Step 5: Detect issues
    // @see demo_local_fast.py lines 356-362
    const issues: QualityIssue[] = [];
    if (blurScore < 50) {
      issues.push('Blurry');
    }
    if (sizeScore < 50) {
      issues.push('Small');
    }
    if (!brightnessOk) {
      issues.push(brightness <= MIN_BRIGHTNESS ? 'Dark' : 'Bright');
    }

    // Step 6: Overall score
    // Python: score = (blur_score + size_score + (100 if bright_ok else 50)) / 3
    // @see demo_local_fast.py line 364
    const score = (blurScore + sizeScore + brightnessScore) / 3;

    return {
      score,
      blur: blurScore,
      size: sizeScore,
      brightness,
      brightnessOk,
      issues,
    };
  }

  /**
   * Extract face region of interest (ROI) from a video frame.
   *
   * Creates an offscreen canvas, draws the face region with configurable padding,
   * and returns the pixel data as ImageData. Handles bounds clamping to prevent
   * drawing outside the video frame.
   *
   * @param video - Source HTMLVideoElement (must be playing and have valid dimensions)
   * @param boundingBox - Face bounding box in pixel coordinates
   * @param padding - Padding ratio around the face (0.3 = 30% on each side). Default: 0.3
   * @returns ImageData of the face region, or null if video/bbox is invalid
   *
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5f (extractFaceROI)
   */
  static extractFaceROI(
    video: HTMLVideoElement,
    boundingBox: BoundingBox,
    padding: number = DEFAULT_FACE_ROI_PADDING,
  ): ImageData | null {
    // Validate video readiness
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    // Validate bounding box
    const { x, y, width, height } = boundingBox;
    if (width <= 0 || height <= 0) {
      return null;
    }

    // Compute padded region
    const padX = width * padding;
    const padY = height * padding;

    // Clamp to video bounds
    const sx = Math.max(0, Math.floor(x - padX));
    const sy = Math.max(0, Math.floor(y - padY));
    const ex = Math.min(video.videoWidth, Math.ceil(x + width + padX));
    const ey = Math.min(video.videoHeight, Math.ceil(y + height + padY));

    const cropWidth = ex - sx;
    const cropHeight = ey - sy;

    if (cropWidth <= 0 || cropHeight <= 0) {
      return null;
    }

    // Create offscreen canvas and extract pixels
    const canvas = document.createElement('canvas');
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.drawImage(video, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    return ctx.getImageData(0, 0, cropWidth, cropHeight);
  }
}
