/**
 * HeadPoseEstimator — Geometric head pose estimation from face landmarks.
 *
 * Estimates yaw (left/right turn) and pitch (up/down tilt) using a simple
 * geometric ratio approach. NOT solvePnP — the Python implementation uses
 * this simplified method and it works well enough for puzzle challenges.
 *
 * Direct port from demo_local_fast.py estimate_pose() method (lines 1413-1437).
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

export class HeadPoseEstimator implements IHeadPoseEstimator {
  /**
   * Whether the estimator is available. Always true since this is a
   * pure geometric calculation with no model loading required.
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Estimate head yaw and pitch from pixel-space landmarks.
   *
   * Uses 5 key landmarks:
   *   nose        = landmarks[1]   (NOSE_TIP)
   *   leftEye     = landmarks[33]  (LEFT_EYE outer corner)
   *   rightEye    = landmarks[263] (RIGHT_EYE outer corner)
   *   mouthLeft   = landmarks[61]  (MOUTH_LEFT)
   *   mouthRight  = landmarks[291] (MOUTH_RIGHT)
   *
   * YAW calculation:
   *   eye_cx = (leftEye.x + rightEye.x) / 2
   *   eye_dist = |rightEye.x - leftEye.x|
   *   yaw = (nose.x - eye_cx) / eye_dist * 60
   *   Clamped to [-45, 45]
   *
   * PITCH calculation:
   *   eye_cy = (leftEye.y + rightEye.y) / 2
   *   mouth_cy = (mouthLeft.y + mouthRight.y) / 2
   *   face_h = mouth_cy - eye_cy
   *   mid_y = (eye_cy + mouth_cy) / 2
   *   pitch = (nose.y - mid_y) / face_h * 60
   *   Clamped to [-35, 35]
   *
   * @see demo_local_fast.py lines 1413-1437
   *
   * @param landmarks - 478-point landmarks in pixel coordinates
   * @param frameSize - Video frame dimensions (used for landmark count validation only)
   * @returns HeadPose with yaw [-45, 45] and pitch [-35, 35] in degrees
   */
  estimate(landmarks: PixelLandmark[], frameSize: { width: number; height: number }): HeadPose {
    // Suppress unused variable warning — frameSize is part of the interface
    // contract and may be used by alternative implementations (e.g. solvePnP).
    void frameSize;

    // Guard: need at least 468 landmarks (same as Python line 1415)
    if (!landmarks || landmarks.length < MIN_LANDMARKS_FOR_POSE) {
      return { yaw: 0, pitch: 0 };
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
      const yaw = eyeDist > 0
        ? (nose.x - eyeCx) / eyeDist * 60
        : 0;

      // PITCH: vertical offset of nose from face midpoint, normalized by face height
      const eyeCy = (leftEye.y + rightEye.y) / 2;
      const mouthCy = (mouthLeft.y + mouthRight.y) / 2;
      const faceH = mouthCy - eyeCy;
      const midY = (eyeCy + mouthCy) / 2;
      const pitch = faceH > 0
        ? (nose.y - midY) / faceH * 60
        : 0;

      return {
        yaw: clamp(yaw, -45, 45),
        pitch: clamp(pitch, -35, 35),
      };
    } catch {
      return { yaw: 0, pitch: 0 };
    }
  }

  /**
   * Convenience method: estimate head pose from normalized landmarks (0-1 range).
   *
   * Converts normalized landmarks to pixel coordinates first, then delegates
   * to the standard estimate() method. This is useful when working directly
   * with MediaPipe FaceLandmarker output (which returns normalized coords).
   *
   * @see demo_local_fast.py lines 1413-1437
   *
   * @param landmarks - 478-point normalized landmarks from MediaPipe (0-1 range)
   * @param frameSize - Video frame dimensions for converting to pixel coordinates
   * @returns HeadPose with yaw [-45, 45] and pitch [-35, 35] in degrees
   */
  estimateFromNormalized(
    landmarks: NormalizedLandmark[],
    frameSize: { width: number; height: number },
  ): HeadPose {
    if (!landmarks || landmarks.length < MIN_LANDMARKS_FOR_POSE) {
      return { yaw: 0, pitch: 0 };
    }

    // Convert normalized to pixel coordinates
    const pixelLandmarks: PixelLandmark[] = landmarks.map((lm) => ({
      x: lm.x * frameSize.width,
      y: lm.y * frameSize.height,
    }));

    return this.estimate(pixelLandmarks, frameSize);
  }
}
