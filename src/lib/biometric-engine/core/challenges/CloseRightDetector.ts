/**
 * CloseRightDetector — Detects user's right eye closed, left open (CLOSE_RIGHT challenge).
 *
 * Detection: userRightEAR < 0.17 AND userLeftEAR > 0.22
 * @see demo_local_fast.py line 756
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { EAR_CLOSED_THRESHOLD, EAR_THRESHOLD } from '../constants';

export class CloseRightDetector implements IChallengeDetector {
  readonly type = ChallengeType.CLOSE_RIGHT;

  /** @see demo_local_fast.py line 756 */
  detect(metrics: FaceMetrics, _headPose: HeadPose): boolean {
    return (
      metrics.eyes.userRightEAR < EAR_CLOSED_THRESHOLD &&
      metrics.eyes.userLeftEAR > EAR_THRESHOLD
    );
  }

  /** @see demo_local_fast.py lines 758-764 */
  getMessage(metrics: FaceMetrics, _headPose: HeadPose): string {
    const { userLeftEAR, userRightEAR } = metrics.eyes;

    if (userRightEAR < EAR_CLOSED_THRESHOLD && userLeftEAR > EAR_THRESHOLD) {
      return 'Right eye closed!';
    }

    if (userLeftEAR < EAR_CLOSED_THRESHOLD && userRightEAR > EAR_THRESHOLD) {
      return "WRONG! That's your LEFT eye! Close RIGHT!";
    }

    if (userLeftEAR < EAR_CLOSED_THRESHOLD && userRightEAR < EAR_CLOSED_THRESHOLD) {
      return 'OPEN your LEFT eye! Only close RIGHT!';
    }

    return `R:${userRightEAR.toFixed(2)} - Close your RIGHT eye!`;
  }
}
