/**
 * LookUpDetector — Detects head tilted up / chin up (LOOK_UP challenge).
 *
 * Detection: pitch < -PITCH_THRESHOLD (-12)
 * Note: Negative pitch = looking up in the Python coordinate system.
 * @see demo_local_fast.py line 805
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { PITCH_THRESHOLD } from '../constants';

export class LookUpDetector implements IChallengeDetector {
  readonly type = ChallengeType.LOOK_UP;

  /** @see demo_local_fast.py line 805 */
  detect(_metrics: FaceMetrics, headPose: HeadPose): boolean {
    return headPose.pitch < -PITCH_THRESHOLD;
  }

  /** @see demo_local_fast.py lines 806-811 */
  getMessage(_metrics: FaceMetrics, headPose: HeadPose): string {
    const { pitch } = headPose;

    if (pitch < -PITCH_THRESHOLD) {
      return 'Looking up!';
    }

    if (pitch > PITCH_THRESHOLD) {
      return `WRONG WAY! Chin UP, not down! Pitch: ${pitch.toFixed(0)}deg`;
    }

    return `Pitch: ${pitch.toFixed(0)}deg - Tilt chin UP more!`;
  }
}
