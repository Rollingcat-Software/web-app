/**
 * RaiseRightBrowDetector — Detects user's right eyebrow raised alone (RAISE_RIGHT_BROW challenge).
 *
 * Detection: eyebrows.rightRatio > 1.25 AND leftRatio < 1.20
 * @see demo_local_fast.py line 845
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { EYEBROW_RAISE_THRESHOLD, SINGLE_BROW_THRESHOLD } from '../constants';

export class RaiseRightBrowDetector implements IChallengeDetector {
  readonly type = ChallengeType.RAISE_RIGHT_BROW;

  /** @see demo_local_fast.py line 845 */
  detect(metrics: FaceMetrics, _headPose: HeadPose): boolean {
    return (
      metrics.eyebrows.rightRatio > SINGLE_BROW_THRESHOLD &&
      metrics.eyebrows.leftRatio < EYEBROW_RAISE_THRESHOLD
    );
  }

  /** @see demo_local_fast.py lines 846-853 */
  getMessage(metrics: FaceMetrics, _headPose: HeadPose): string {
    const { leftRatio, rightRatio } = metrics.eyebrows;

    if (rightRatio > SINGLE_BROW_THRESHOLD && leftRatio < EYEBROW_RAISE_THRESHOLD) {
      return 'Right brow raised!';
    }

    if (leftRatio > SINGLE_BROW_THRESHOLD && rightRatio < EYEBROW_RAISE_THRESHOLD) {
      return "WRONG! That's your LEFT brow! Raise RIGHT!";
    }

    if (rightRatio > SINGLE_BROW_THRESHOLD && leftRatio > EYEBROW_RAISE_THRESHOLD) {
      return 'LOWER your LEFT brow! Only raise RIGHT!';
    }

    return `R:${rightRatio.toFixed(2)} - Raise your RIGHT eyebrow!`;
  }
}
