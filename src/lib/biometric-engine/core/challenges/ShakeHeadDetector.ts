/**
 * ShakeHeadDetector — Detects head shaking motion via yaw oscillation (SHAKE_HEAD challenge).
 *
 * Detection: yaw range > 35 degrees over motion history (min 20 frames).
 * This is a motion-aware detector that requires setMotionHistory() to be called
 * each frame before detect().
 *
 * @see demo_local_fast.py lines 859-861, 892-899
 */

import type { FaceMetrics, HeadPose, MotionEntry } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { SHAKE_YAW_RANGE, MOTION_MIN_FRAMES } from '../constants';

/**
 * Motion-aware challenge detector that requires a motion history buffer.
 * BiometricPuzzle calls setMotionHistory() before detect() each frame.
 */
export class ShakeHeadDetector implements IChallengeDetector {
  readonly type = ChallengeType.SHAKE_HEAD;

  private motionHistory: ReadonlyArray<MotionEntry> = [];

  /**
   * Set the current motion history buffer.
   * Called by BiometricPuzzle before detect() each frame.
   * @see demo_local_fast.py line 519 (_motion_history)
   */
  setMotionHistory(history: ReadonlyArray<MotionEntry>): void {
    this.motionHistory = history;
  }

  /**
   * Check for head shake motion (yaw oscillation).
   * @see demo_local_fast.py lines 892-899 (_check_shake)
   */
  detect(_metrics: FaceMetrics, _headPose: HeadPose): boolean {
    if (this.motionHistory.length < MOTION_MIN_FRAMES) {
      return false;
    }

    const yaws = this.motionHistory.map((entry) => entry.yaw);
    const yawRange = Math.max(...yaws) - Math.min(...yaws);
    return yawRange > SHAKE_YAW_RANGE;
  }

  /** @see demo_local_fast.py line 861 */
  getMessage(_metrics: FaceMetrics, _headPose: HeadPose): string {
    const detected = this.motionHistory.length >= MOTION_MIN_FRAMES && this.detectFromHistory();

    if (detected) {
      return 'Shake your head left and right - Done!';
    }

    return 'Shake your head left and right';
  }

  /** Internal helper to check detection without re-calling detect(). */
  private detectFromHistory(): boolean {
    const yaws = this.motionHistory.map((entry) => entry.yaw);
    const yawRange = Math.max(...yaws) - Math.min(...yaws);
    return yawRange > SHAKE_YAW_RANGE;
  }
}
