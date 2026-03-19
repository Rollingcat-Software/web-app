/**
 * RaiseLeftBrowDetector — Detects user's left eyebrow raised alone (RAISE_LEFT_BROW challenge).
 *
 * Detection: eyebrows.leftRatio > 1.25 AND rightRatio < 1.20
 * @see demo_local_fast.py line 834
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { EYEBROW_RAISE_THRESHOLD, SINGLE_BROW_THRESHOLD } from '../constants';

export class RaiseLeftBrowDetector implements IChallengeDetector {
  readonly type = ChallengeType.RAISE_LEFT_BROW;

  /** @see demo_local_fast.py line 834 */
  detect(metrics: FaceMetrics, _headPose: HeadPose): boolean {
    return (
      metrics.eyebrows.leftRatio > SINGLE_BROW_THRESHOLD &&
      metrics.eyebrows.rightRatio < EYEBROW_RAISE_THRESHOLD
    );
  }

  /** @see demo_local_fast.py lines 835-842 */
  getMessage(metrics: FaceMetrics, _headPose: HeadPose): string {
    const { leftRatio, rightRatio } = metrics.eyebrows;

    if (leftRatio > SINGLE_BROW_THRESHOLD && rightRatio < EYEBROW_RAISE_THRESHOLD) {
      return 'Left brow raised!';
    }

    if (rightRatio > SINGLE_BROW_THRESHOLD && leftRatio < EYEBROW_RAISE_THRESHOLD) {
      return "WRONG! That's your RIGHT brow! Raise LEFT!";
    }

    if (leftRatio > SINGLE_BROW_THRESHOLD && rightRatio > EYEBROW_RAISE_THRESHOLD) {
      return 'LOWER your RIGHT brow! Only raise LEFT!';
    }

    return `L:${leftRatio.toFixed(2)} - Raise your LEFT eyebrow!`;
  }
}
