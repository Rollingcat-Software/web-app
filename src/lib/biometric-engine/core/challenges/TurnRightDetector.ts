/**
 * TurnRightDetector — Detects head turned to the right (TURN_RIGHT challenge).
 *
 * Detection: yaw > YAW_THRESHOLD (20)
 * @see demo_local_fast.py line 796
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { YAW_THRESHOLD } from '../constants';

export class TurnRightDetector implements IChallengeDetector {
  readonly type = ChallengeType.TURN_RIGHT;

  /** @see demo_local_fast.py line 796 */
  detect(_metrics: FaceMetrics, headPose: HeadPose): boolean {
    return headPose.yaw > YAW_THRESHOLD;
  }

  /** @see demo_local_fast.py lines 797-802 */
  getMessage(_metrics: FaceMetrics, headPose: HeadPose): string {
    const { yaw } = headPose;

    if (yaw > YAW_THRESHOLD) {
      return 'Turned right!';
    }

    if (yaw < -YAW_THRESHOLD) {
      return `WRONG WAY! Turn RIGHT, not left! Yaw: ${yaw.toFixed(0)}deg`;
    }

    return `Yaw: ${yaw.toFixed(0)}deg - Turn RIGHT more!`;
  }
}
