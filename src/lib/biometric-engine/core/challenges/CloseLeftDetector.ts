/**
 * CloseLeftDetector — Detects user's left eye closed, right open (CLOSE_LEFT challenge).
 *
 * Detection: userLeftEAR < 0.17 AND userRightEAR > 0.22
 * @see demo_local_fast.py line 745
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { EAR_CLOSED_THRESHOLD, EAR_THRESHOLD } from '../constants';

export class CloseLeftDetector implements IChallengeDetector {
  readonly type = ChallengeType.CLOSE_LEFT;

  /** @see demo_local_fast.py line 745 */
  detect(metrics: FaceMetrics, _headPose: HeadPose): boolean {
    return (
      metrics.eyes.userLeftEAR < EAR_CLOSED_THRESHOLD &&
      metrics.eyes.userRightEAR > EAR_THRESHOLD
    );
  }

  /** @see demo_local_fast.py lines 747-753 */
  getMessage(metrics: FaceMetrics, _headPose: HeadPose): string {
    const { userLeftEAR, userRightEAR } = metrics.eyes;

    if (userLeftEAR < EAR_CLOSED_THRESHOLD && userRightEAR > EAR_THRESHOLD) {
      return 'Left eye closed!';
    }

    if (userRightEAR < EAR_CLOSED_THRESHOLD && userLeftEAR > EAR_THRESHOLD) {
      return "WRONG! That's your RIGHT eye! Close LEFT!";
    }

    if (userLeftEAR < EAR_CLOSED_THRESHOLD && userRightEAR < EAR_CLOSED_THRESHOLD) {
      return 'OPEN your RIGHT eye! Only close LEFT!';
    }

    return `L:${userLeftEAR.toFixed(2)} - Close your LEFT eye!`;
  }
}
