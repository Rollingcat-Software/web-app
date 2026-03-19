/**
 * RaiseBothBrowsDetector — Detects both eyebrows raised (RAISE_BOTH_BROWS challenge).
 *
 * Detection: eyebrows.bothRatio > EYEBROW_RAISE_THRESHOLD (1.20)
 * @see demo_local_fast.py line 823
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { EYEBROW_RAISE_THRESHOLD, SINGLE_BROW_THRESHOLD } from '../constants';

export class RaiseBothBrowsDetector implements IChallengeDetector {
  readonly type = ChallengeType.RAISE_BOTH_BROWS;

  /** @see demo_local_fast.py line 823 */
  detect(metrics: FaceMetrics, _headPose: HeadPose): boolean {
    return metrics.eyebrows.bothRatio > EYEBROW_RAISE_THRESHOLD;
  }

  /** @see demo_local_fast.py lines 824-831 */
  getMessage(metrics: FaceMetrics, _headPose: HeadPose): string {
    const { bothRatio, leftRatio, rightRatio } = metrics.eyebrows;

    if (bothRatio > EYEBROW_RAISE_THRESHOLD) {
      return 'Both brows raised!';
    }

    if (leftRatio > SINGLE_BROW_THRESHOLD && rightRatio < EYEBROW_RAISE_THRESHOLD) {
      return 'Only LEFT raised! Raise RIGHT brow too!';
    }

    if (rightRatio > SINGLE_BROW_THRESHOLD && leftRatio < EYEBROW_RAISE_THRESHOLD) {
      return 'Only RIGHT raised! Raise LEFT brow too!';
    }

    return `Both: ${bothRatio.toFixed(2)}x - Raise BOTH eyebrows!`;
  }
}
