/**
 * TurnLeftDetector — Detects head turned to the left (TURN_LEFT challenge).
 *
 * Detection: yaw < -YAW_THRESHOLD (-20)
 * @see demo_local_fast.py line 787
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { YAW_THRESHOLD } from '../constants';

export class TurnLeftDetector implements IChallengeDetector {
  readonly type = ChallengeType.TURN_LEFT;

  /** @see demo_local_fast.py line 787 */
  detect(_metrics: FaceMetrics, headPose: HeadPose): boolean {
    return headPose.yaw < -YAW_THRESHOLD;
  }

  /** @see demo_local_fast.py lines 788-793 */
  getMessage(_metrics: FaceMetrics, headPose: HeadPose): string {
    const { yaw } = headPose;

    if (yaw < -YAW_THRESHOLD) {
      return 'Turned left!';
    }

    if (yaw > YAW_THRESHOLD) {
      return `WRONG WAY! Turn LEFT, not right! Yaw: ${yaw.toFixed(0)}deg`;
    }

    return `Yaw: ${yaw.toFixed(0)}deg - Turn LEFT more!`;
  }
}
