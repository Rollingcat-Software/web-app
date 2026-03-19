/**
 * LookDownDetector — Detects head tilted down / chin down (LOOK_DOWN challenge).
 *
 * Detection: pitch > PITCH_THRESHOLD (12)
 * Note: Positive pitch = looking down in the Python coordinate system.
 * @see demo_local_fast.py line 814
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { PITCH_THRESHOLD } from '../constants';

export class LookDownDetector implements IChallengeDetector {
  readonly type = ChallengeType.LOOK_DOWN;

  /** @see demo_local_fast.py line 814 */
  detect(_metrics: FaceMetrics, headPose: HeadPose): boolean {
    return headPose.pitch > PITCH_THRESHOLD;
  }

  /** @see demo_local_fast.py lines 815-820 */
  getMessage(_metrics: FaceMetrics, headPose: HeadPose): string {
    const { pitch } = headPose;

    if (pitch > PITCH_THRESHOLD) {
      return 'Looking down!';
    }

    if (pitch < -PITCH_THRESHOLD) {
      return `WRONG WAY! Chin DOWN, not up! Pitch: ${pitch.toFixed(0)}deg`;
    }

    return `Pitch: ${pitch.toFixed(0)}deg - Tilt chin DOWN more!`;
  }
}
