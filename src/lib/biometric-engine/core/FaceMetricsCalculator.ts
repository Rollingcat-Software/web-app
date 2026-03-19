/**
 * FaceMetricsCalculator — Shared face metric calculations.
 *
 * Single implementation of EAR, MAR, smile, and eyebrow raise calculations.
 * Both BiometricPuzzle and FrameProcessor depend on this class (DRY).
 *
 * Direct port from demo_local_fast.py BiometricPuzzle methods:
 *   - calculate_ear()           (lines 575-597)
 *   - calculate_mar()           (lines 600-620)
 *   - calculate_smile()         (lines 622-665)
 *   - calculate_eyebrow_raise() (lines 667-700)
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5d
 */

import type {
  NormalizedLandmark,
  SmileMetrics,
  EyebrowMetrics,
  EyebrowBaseline,
  FaceMetrics,
  EyeMetrics,
  MouthMetrics,
} from '../types';

import type { IFaceMetricsCalculator } from '../interfaces';

import {
  LEFT_EYE,
  RIGHT_EYE,
  UPPER_LIP,
  LOWER_LIP,
  MOUTH_LEFT,
  MOUTH_RIGHT,
  LEFT_EYEBROW,
  RIGHT_EYEBROW,
  NOSE_TIP,
  CHIN,
} from './constants';

/**
 * Euclidean distance between two normalized landmarks.
 *
 * Uses only (x, y) coordinates, matching the Python np.linalg.norm behavior
 * on 2D tuples (demo_local_fast.py lines 582-596).
 *
 * @param landmarks - Array of normalized landmarks
 * @param i - Index of the first landmark
 * @param j - Index of the second landmark
 * @returns Euclidean distance between the two landmarks
 */
function landmarkDist(landmarks: NormalizedLandmark[], i: number, j: number): number {
  const a = landmarks[i];
  const b = landmarks[j];
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Average Y coordinate of landmarks at the given indices.
 *
 * @param landmarks - Array of normalized landmarks
 * @param indices - Readonly array of landmark indices to average
 * @returns Mean Y value
 */
function avgY(landmarks: NormalizedLandmark[], indices: readonly number[]): number {
  let sum = 0;
  for (const idx of indices) {
    sum += landmarks[idx].y;
  }
  return sum / indices.length;
}

export class FaceMetricsCalculator implements IFaceMetricsCalculator {
  /**
   * Internal eyebrow baseline state.
   * Set on the first call to calculateEyebrowRaise when no baseline is provided.
   * Reset via resetBaseline().
   */
  private baselineEyebrowDist: EyebrowBaseline | null = null;

  /**
   * Calculate Eye Aspect Ratio (EAR) for a single eye.
   *
   * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
   *
   * For LEFT_EYE [362, 385, 387, 263, 373, 380]:
   *   p1=362 (outer), p2=385 (upper-outer), p3=387 (upper-inner),
   *   p4=263 (inner), p5=373 (lower-inner), p6=380 (lower-outer)
   *
   * For RIGHT_EYE [33, 160, 158, 133, 153, 144]:
   *   p1=33 (outer), p2=160 (upper-outer), p3=158 (upper-inner),
   *   p4=133 (inner), p5=153 (lower-inner), p6=144 (lower-outer)
   *
   * Low EAR = eye closed, High EAR = eye open.
   * Returns 0.3 (default open) if horizontal distance is 0.
   *
   * @see demo_local_fast.py lines 575-597
   *
   * @param landmarks - 478-point normalized landmarks from MediaPipe
   * @param eyeIndices - 6 landmark indices: [outer, upper-outer, upper-inner, inner, lower-inner, lower-outer]
   * @returns EAR value (typically 0.15-0.35)
   */
  calculateEAR(landmarks: NormalizedLandmark[], eyeIndices: number[]): number {
    try {
      const p1 = landmarks[eyeIndices[0]];
      const p2 = landmarks[eyeIndices[1]];
      const p3 = landmarks[eyeIndices[2]];
      const p4 = landmarks[eyeIndices[3]];
      const p5 = landmarks[eyeIndices[4]];
      const p6 = landmarks[eyeIndices[5]];

      // Vertical distances
      const vertical1 = Math.sqrt(
        (p2.x - p6.x) ** 2 + (p2.y - p6.y) ** 2,
      );
      const vertical2 = Math.sqrt(
        (p3.x - p5.x) ** 2 + (p3.y - p5.y) ** 2,
      );

      // Horizontal distance
      const horizontal = Math.sqrt(
        (p1.x - p4.x) ** 2 + (p1.y - p4.y) ** 2,
      );

      if (horizontal === 0) {
        return 0.3; // Default open
      }

      return (vertical1 + vertical2) / (2.0 * horizontal);
    } catch {
      return 0.3; // Default open on error
    }
  }

  /**
   * Calculate Mouth Aspect Ratio (MAR) for mouth open/close detection.
   *
   * MAR = |lower_lip(14) - upper_lip(13)| / |mouth_right(291) - mouth_left(61)|
   *
   * High MAR = mouth open, Low MAR = mouth closed.
   *
   * @see demo_local_fast.py lines 600-620
   *
   * @param landmarks - 478-point normalized landmarks from MediaPipe
   * @returns MAR value (typically 0.0-0.5)
   */
  calculateMAR(landmarks: NormalizedLandmark[]): number {
    try {
      const horizontal = landmarkDist(landmarks, MOUTH_RIGHT, MOUTH_LEFT);
      const vertical = landmarkDist(landmarks, LOWER_LIP, UPPER_LIP);

      if (horizontal === 0) {
        return 0.0;
      }

      return vertical / horizontal;
    } catch {
      return 0.0;
    }
  }

  /**
   * Calculate smile metrics based on lip corner position.
   *
   * When smiling:
   * - Mouth corners move UP (Y decreases in image coords)
   * - Mouth corners move OUT (width increases)
   *
   * cornerRaise = (mouth_center_y - avg_corner_y) / face_height
   *   where mouth_center_y = (upper_lip_y + lower_lip_y) / 2
   *   face_height = |chin(152) - nose_tip(1)|
   *   Positive value = corners raised above center (smiling)
   *
   * widthRatio = mouth_width / face_height
   *
   * SMILE detected when:
   *   cornerRaise > 0.05 (SMILE_CORNER_THRESHOLD)
   *   AND widthRatio > 0.60 (SMILE_WIDTH_THRESHOLD)
   *
   * @see demo_local_fast.py lines 622-665
   *
   * @param landmarks - 478-point normalized landmarks from MediaPipe
   * @returns SmileMetrics with cornerRaise and widthRatio
   */
  calculateSmile(landmarks: NormalizedLandmark[]): SmileMetrics {
    try {
      // Get mouth landmarks
      const leftCorner = landmarks[MOUTH_LEFT];
      const rightCorner = landmarks[MOUTH_RIGHT];
      const upperLip = landmarks[UPPER_LIP];
      const lowerLip = landmarks[LOWER_LIP];

      // Get face reference points
      const noseTip = landmarks[NOSE_TIP];
      const chin = landmarks[CHIN];

      // Face height for normalization
      const faceHeight = Math.sqrt(
        (chin.x - noseTip.x) ** 2 + (chin.y - noseTip.y) ** 2,
      );

      if (faceHeight === 0) {
        return { cornerRaise: 0.0, widthRatio: 0.0 };
      }

      // Mouth center Y
      const mouthCenterY = (upperLip.y + lowerLip.y) / 2;

      // Corner raise = how much corners are above mouth center
      // (lower Y = higher position, so mouth_center_y - corner_y is positive when raised)
      const leftRaise = mouthCenterY - leftCorner.y;
      const rightRaise = mouthCenterY - rightCorner.y;
      const avgRaise = (leftRaise + rightRaise) / 2;

      // Normalize by face height
      const cornerRaise = avgRaise / faceHeight;

      // Mouth width ratio
      const mouthWidth = Math.sqrt(
        (rightCorner.x - leftCorner.x) ** 2 + (rightCorner.y - leftCorner.y) ** 2,
      );
      const widthRatio = mouthWidth / faceHeight;

      return { cornerRaise, widthRatio };
    } catch {
      return { cornerRaise: 0.0, widthRatio: 0.0 };
    }
  }

  /**
   * Calculate eyebrow raise ratio compared to baseline.
   *
   * Measures the distance from each eyebrow to its corresponding eye.
   * When eyebrows raise, the distance increases (eyebrow Y decreases while eye Y stays).
   *
   * Coordinate system:
   *   MediaPipe Y increases downward. Eye is below eyebrow.
   *   dist = avg(eye_y) - avg(eyebrow_y) > 0
   *   When eyebrow raises, eyebrow_y decreases, dist increases.
   *
   * Baseline-relative:
   *   First call with no baseline stores current distances as baseline and returns (1.0, 1.0, 1.0).
   *   Subsequent calls return ratio of current distance to baseline.
   *
   * LEFT_EYEBROW = [70, 63, 105, 66, 107]
   * RIGHT_EYEBROW = [300, 293, 334, 296, 336]
   * LEFT_EYE = [362, 385, 387, 263, 373, 380]
   * RIGHT_EYE = [33, 160, 158, 133, 153, 144]
   *
   * @see demo_local_fast.py lines 667-700
   *
   * @param landmarks - 478-point normalized landmarks from MediaPipe
   * @param baseline - Optional external baseline. If not provided, internal baseline is used.
   * @returns EyebrowMetrics with bothRatio, leftRatio, rightRatio
   */
  calculateEyebrowRaise(landmarks: NormalizedLandmark[], baseline?: EyebrowBaseline): EyebrowMetrics {
    try {
      // Average eyebrow Y position
      const leftBrowY = avgY(landmarks, LEFT_EYEBROW);
      const rightBrowY = avgY(landmarks, RIGHT_EYEBROW);

      // Average eye Y position
      const leftEyeY = avgY(landmarks, LEFT_EYE);
      const rightEyeY = avgY(landmarks, RIGHT_EYE);

      // Distance from eyebrow to eye (larger = raised more)
      const leftDist = leftEyeY - leftBrowY;
      const rightDist = rightEyeY - rightBrowY;
      const avgDist = (leftDist + rightDist) / 2;

      // Determine which baseline to use
      const effectiveBaseline = baseline ?? this.baselineEyebrowDist;

      // Set internal baseline on first call (when no external baseline provided)
      if (effectiveBaseline === null || effectiveBaseline === undefined) {
        this.baselineEyebrowDist = { left: leftDist, right: rightDist, avg: avgDist };
        return { bothRatio: 1.0, leftRatio: 1.0, rightRatio: 1.0 };
      }

      const bothRatio = effectiveBaseline.avg > 0 ? avgDist / effectiveBaseline.avg : 1.0;
      const leftRatio = effectiveBaseline.left > 0 ? leftDist / effectiveBaseline.left : 1.0;
      const rightRatio = effectiveBaseline.right > 0 ? rightDist / effectiveBaseline.right : 1.0;

      return { bothRatio, leftRatio, rightRatio };
    } catch {
      return { bothRatio: 1.0, leftRatio: 1.0, rightRatio: 1.0 };
    }
  }

  /**
   * Calculate all face metrics in one pass.
   *
   * Computes EAR (both eyes), MAR, smile, and eyebrow raise,
   * then applies the mirror swap for user perspective:
   *   userLeftEAR = rightEAR (MediaPipe RIGHT = User's LEFT)
   *   userRightEAR = leftEAR (MediaPipe LEFT = User's RIGHT)
   *
   * Used by both FrameProcessor (for TrackedFace) and BiometricPuzzle (for challenge detection).
   *
   * @see demo_local_fast.py lines 575-700
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5d
   *
   * @param landmarks - 478-point normalized landmarks from MediaPipe
   * @param baseline - Optional external eyebrow baseline
   * @returns Complete FaceMetrics object
   */
  calculateAll(landmarks: NormalizedLandmark[], baseline?: EyebrowBaseline): FaceMetrics {
    // Calculate EAR for both eyes
    const leftEAR = this.calculateEAR(landmarks, [...LEFT_EYE]);
    const rightEAR = this.calculateEAR(landmarks, [...RIGHT_EYE]);
    const avgEAR = (leftEAR + rightEAR) / 2;

    // Mirror swap for user perspective:
    // MediaPipe LEFT_EYE = anatomical left = user's RIGHT in mirrored camera
    // MediaPipe RIGHT_EYE = anatomical right = user's LEFT in mirrored camera
    const eyes: EyeMetrics = {
      leftEAR,
      rightEAR,
      avgEAR,
      userLeftEAR: rightEAR,   // MediaPipe RIGHT = User's LEFT
      userRightEAR: leftEAR,   // MediaPipe LEFT = User's RIGHT
    };

    // Calculate mouth metrics
    const mar = this.calculateMAR(landmarks);
    const smile = this.calculateSmile(landmarks);
    const mouth: MouthMetrics = {
      mar,
      smileCornerRaise: smile.cornerRaise,
      smileWidthRatio: smile.widthRatio,
    };

    // Calculate eyebrow metrics
    const eyebrows = this.calculateEyebrowRaise(landmarks, baseline);

    return { eyes, mouth, eyebrows };
  }

  /**
   * Reset the internal eyebrow baseline.
   * Call this when starting a new puzzle session so that
   * the next calculateEyebrowRaise call will establish a fresh baseline.
   *
   * @see demo_local_fast.py line 548 (self._baseline_eyebrow_dist = None)
   */
  resetBaseline(): void {
    this.baselineEyebrowDist = null;
  }
}
