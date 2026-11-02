/**
 * ShakeHeadDetector — SHAKE_HEAD: head yaw oscillation.
 *
 * Detection (2026-11-01): at least OSCILLATION_MIN_REVERSALS (2) direction
 * reversals of the smoothed yaw, each after a swing of ≥ 8°, within the
 * engine's rolling attempt window — the same rule biometric-processor applies
 * to the submitted trace. The former range gate (> 35° over ~1 s)
 * passed a single excursion, which the server rejects (INSUFFICIENT_OSCILLATION).
 * Motion-aware: BiometricPuzzle calls setMotionHistory() before detect().
 *
 * @see demo_local_fast.py lines 855-857, 883-898
 */

import type { FaceMetrics, HeadPose, MotionEntry } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { OSCILLATION_MIN_REVERSALS } from '../constants';
import { countReversals } from './oscillation';

export class ShakeHeadDetector implements IChallengeDetector {
  readonly type = ChallengeType.SHAKE_HEAD;

  private motionHistory: ReadonlyArray<MotionEntry> = [];

  /** Set the smoothed pose history (BiometricPuzzle, every frame). */
  setMotionHistory(history: ReadonlyArray<MotionEntry>): void {
    this.motionHistory = history;
  }

  /** Direction reversals of the yaw in the current history. */
  reversals(): number {
    return countReversals(this.motionHistory.map((entry) => entry.yaw));
  }

  detect(_metrics: FaceMetrics, _headPose: HeadPose): boolean {
    return this.reversals() >= OSCILLATION_MIN_REVERSALS;
  }

  getMessage(_metrics: FaceMetrics, _headPose: HeadPose): string {
    if (this.reversals() >= OSCILLATION_MIN_REVERSALS) {
      return 'Shake your head left and right - Done!';
    }
    return 'Shake your head left and right';
  }
}
