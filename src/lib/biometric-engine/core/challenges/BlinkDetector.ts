/**
 * BlinkDetector — Detects both eyes closed (BLINK challenge).
 *
 * Detection: avg_ear < EAR_CLOSED_THRESHOLD (0.17)
 * @see demo_local_fast.py line 734
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { EAR_CLOSED_THRESHOLD, EAR_THRESHOLD } from '../constants';

export class BlinkDetector implements IChallengeDetector {
  readonly type = ChallengeType.BLINK;

  /** @see demo_local_fast.py line 734 */
  detect(metrics: FaceMetrics, _headPose: HeadPose): boolean {
    return metrics.eyes.avgEAR < EAR_CLOSED_THRESHOLD;
  }

  /** @see demo_local_fast.py lines 736-742 */
  getMessage(metrics: FaceMetrics, _headPose: HeadPose): string {
    const { userLeftEAR, userRightEAR, avgEAR } = metrics.eyes;

    if (avgEAR < EAR_CLOSED_THRESHOLD) {
      return 'Both eyes closed!';
    }

    if (userLeftEAR < EAR_CLOSED_THRESHOLD && userRightEAR > EAR_THRESHOLD) {
      return 'Only LEFT closed! Close your RIGHT eye too!';
    }

    if (userRightEAR < EAR_CLOSED_THRESHOLD && userLeftEAR > EAR_THRESHOLD) {
      return 'Only RIGHT closed! Close your LEFT eye too!';
    }

    return `EAR: ${avgEAR.toFixed(2)} - Close BOTH eyes!`;
  }
}
