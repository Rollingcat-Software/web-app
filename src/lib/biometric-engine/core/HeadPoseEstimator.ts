/**
 * HeadPoseEstimator — Head pose estimation from face geometry.
 *
 * PRIMARY path: decomposes the MediaPipe FaceLandmarker 4x4 facial
 * transformation matrix (`outputFacialTransformationMatrixes: true`) into
 * true yaw / pitch / roll Euler angles in degrees. This is real metric head
 * rotation — not an image-plane approximation — so the puzzle challenges
 * (turn left/right, look up/down, nod, shake) track actual head movement.
 *
 * FALLBACK path: when no matrix is available (older models, BlazeFace, or the
 * matrix output disabled), it uses the legacy landmark-ratio approximation
 * which yields yaw + pitch only (no roll). This keeps detection working even
 * when the metric matrix is missing.
 *
 * Sign convention (consistent with the challenge detectors and constants):
 *   yaw   < 0  → head turned to the USER's left  (TURN_LEFT)
 *   yaw   > 0  → head turned to the USER's right  (TURN_RIGHT)
 *   pitch < 0  → looking up / chin up             (LOOK_UP)
 *   pitch > 0  → looking down / chin down         (LOOK_DOWN)
 *   roll  < 0  → head tilted toward user's left shoulder
 *   roll  > 0  → head tilted toward user's right shoulder
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5i
 */

import type { NormalizedLandmark, PixelLandmark, HeadPose } from '../types';

import type { IHeadPoseEstimator } from '../interfaces';

import {
  POSE_NOSE,
  POSE_LEFT_EYE_OUTER,
  POSE_RIGHT_EYE_OUTER,
  POSE_MOUTH_LEFT,
  POSE_MOUTH_RIGHT,
  MIN_LANDMARKS_FOR_POSE,
} from './constants';

/**
 * Clamp a value to the range [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const RAD_TO_DEG = 180 / Math.PI;

export class HeadPoseEstimator implements IHeadPoseEstimator {
  /**
   * Whether the estimator is available. Always true since this is a
   * pure geometric calculation with no model loading required.
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Decompose true yaw / pitch / roll from a 4x4 facial transformation matrix.
   *
   * MediaPipe returns the matrix in COLUMN-MAJOR order (16 floats). The upper
   * 3x3 block is the rotation R that maps face-space to camera-space. We
   * extract intrinsic Tait–Bryan angles from R and map them to our sign
   * convention (see class doc).
   *
   * Column-major index layout (m[col*4 + row]):
   *   R[0][0]=m[0]  R[0][1]=m[4]  R[0][2]=m[8]
   *   R[1][0]=m[1]  R[1][1]=m[5]  R[1][2]=m[9]
   *   R[2][0]=m[2]  R[2][1]=m[6]  R[2][2]=m[10]
   *
   * @param m - 16-element column-major 4x4 matrix.
   * @returns HeadPose with yaw, pitch, roll in degrees.
   */
  estimateFromMatrix(m: number[]): HeadPose {
    if (!m || m.length < 16) {
      return { yaw: 0, pitch: 0, roll: 0 };
    }

    // Rotation matrix entries (row, col), de-column-majored.
    const r00 = m[0];
    const r10 = m[1];
    const r20 = m[2];
    const r21 = m[6];
    const r22 = m[10];

    // Intrinsic Tait–Bryan decomposition.
    //   pitch (X) = atan2(r21, r22)
    //   yaw   (Y) = atan2(-r20, sqrt(r00^2 + r10^2))
    //   roll  (Z) = atan2(r10, r00)
    const sy = Math.sqrt(r00 * r00 + r10 * r10);
    const gimbalLock = sy < 1e-6;

    let pitchRad: number;
    let yawRad: number;
    let rollRad: number;

    if (!gimbalLock) {
      pitchRad = Math.atan2(r21, r22);
      yawRad = Math.atan2(-r20, sy);
      rollRad = Math.atan2(r10, r00);
    } else {
      // Degenerate (looking straight up/down) — roll is undefined; fold into pitch.
      pitchRad = Math.atan2(-m[9], m[5]);
      yawRad = Math.atan2(-r20, sy);
      rollRad = 0;
    }

    // MediaPipe's camera space has +Y up and the face looking down -Z. The raw
    // pitch from the matrix is therefore inverted relative to our convention
    // (we want pitch<0 = chin up). Yaw sign already matches user-left = negative
    // because the face mesh is in the camera (un-mirrored) frame.
    const yaw = yawRad * RAD_TO_DEG;
    let pitch = -pitchRad * RAD_TO_DEG;
    let roll = rollRad * RAD_TO_DEG;

    // Pitch comes out near ±180 when the face looks at the camera (the X axis
    // points away). Wrap into [-90, 90] so "level" reads ~0.
    if (pitch > 90) pitch -= 180;
    else if (pitch < -90) pitch += 180;

    // Roll likewise wraps to keep upright ≈ 0.
    if (roll > 90) roll -= 180;
    else if (roll < -90) roll += 180;

    return {
      yaw: clamp(yaw, -90, 90),
      pitch: clamp(pitch, -90, 90),
      roll: clamp(roll, -90, 90),
    };
  }

  /**
   * Estimate head pose.
   *
   * If a transformation matrix is supplied, decompose true Euler angles from
   * it (preferred). Otherwise fall back to the landmark-ratio approximation.
   *
   * @param landmarks - 478-point landmarks in pixel coordinates.
   * @param frameSize - Video frame dimensions (used by the fallback path only).
   * @param transformationMatrix - Optional 4x4 column-major MediaPipe matrix.
   * @returns HeadPose in degrees.
   */
  estimate(
    landmarks: PixelLandmark[],
    frameSize: { width: number; height: number },
    transformationMatrix?: number[] | null,
  ): HeadPose {
    void frameSize;

    if (transformationMatrix && transformationMatrix.length >= 16) {
      return this.estimateFromMatrix(transformationMatrix);
    }

    return this.estimateFromLandmarks(landmarks);
  }

  /**
   * Legacy landmark-ratio fallback (yaw + pitch only, no roll).
   *
   * Kept for cases where the metric matrix is unavailable. This is the old
   * nose-offset heuristic; its degree values are approximate and should not be
   * relied upon when the matrix path is active.
   *
   * @see demo_local_fast.py lines 1413-1437
   */
  private estimateFromLandmarks(landmarks: PixelLandmark[]): HeadPose {
    if (!landmarks || landmarks.length < MIN_LANDMARKS_FOR_POSE) {
      return { yaw: 0, pitch: 0, roll: 0 };
    }

    try {
      const nose = landmarks[POSE_NOSE];
      const leftEye = landmarks[POSE_LEFT_EYE_OUTER];
      const rightEye = landmarks[POSE_RIGHT_EYE_OUTER];
      const mouthLeft = landmarks[POSE_MOUTH_LEFT];
      const mouthRight = landmarks[POSE_MOUTH_RIGHT];

      // YAW: horizontal offset of nose from eye center, normalized by eye distance
      const eyeCx = (leftEye.x + rightEye.x) / 2;
      const eyeDist = Math.abs(rightEye.x - leftEye.x);
      const yaw = eyeDist > 0 ? ((nose.x - eyeCx) / eyeDist) * 60 : 0;

      // PITCH: vertical offset of nose from face midpoint, normalized by face height
      const eyeCy = (leftEye.y + rightEye.y) / 2;
      const mouthCy = (mouthLeft.y + mouthRight.y) / 2;
      const faceH = mouthCy - eyeCy;
      const midY = (eyeCy + mouthCy) / 2;
      const pitch = faceH > 0 ? ((nose.y - midY) / faceH) * 60 : 0;

      // ROLL: angle of the eye line relative to horizontal.
      const roll =
        Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * RAD_TO_DEG;

      return {
        yaw: clamp(yaw, -45, 45),
        pitch: clamp(pitch, -35, 35),
        roll: clamp(roll, -45, 45),
      };
    } catch {
      return { yaw: 0, pitch: 0, roll: 0 };
    }
  }

  /**
   * Convenience: estimate from normalized landmarks (0-1 range) plus optional
   * transformation matrix. Converts to pixel coordinates for the fallback path.
   *
   * @param landmarks - 478-point normalized landmarks from MediaPipe.
   * @param frameSize - Video frame dimensions for converting to pixel coordinates.
   * @param transformationMatrix - Optional 4x4 column-major MediaPipe matrix.
   * @returns HeadPose in degrees.
   */
  estimateFromNormalized(
    landmarks: NormalizedLandmark[],
    frameSize: { width: number; height: number },
    transformationMatrix?: number[] | null,
  ): HeadPose {
    if (transformationMatrix && transformationMatrix.length >= 16) {
      return this.estimateFromMatrix(transformationMatrix);
    }

    if (!landmarks || landmarks.length < MIN_LANDMARKS_FOR_POSE) {
      return { yaw: 0, pitch: 0, roll: 0 };
    }

    const pixelLandmarks: PixelLandmark[] = landmarks.map((lm) => ({
      x: lm.x * frameSize.width,
      y: lm.y * frameSize.height,
    }));

    return this.estimateFromLandmarks(pixelLandmarks);
  }
}
