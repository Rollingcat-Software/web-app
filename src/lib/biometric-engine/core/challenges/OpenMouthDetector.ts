/**
 * OpenMouthDetector — Detects mouth wide open (OPEN_MOUTH challenge).
 *
 * Detection: mar > MOUTH_OPEN_THRESHOLD (0.12)
 * @see demo_local_fast.py line 780
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { MOUTH_OPEN_THRESHOLD } from '../constants';

export class OpenMouthDetector implements IChallengeDetector {
  readonly type = ChallengeType.OPEN_MOUTH;

  /** @see demo_local_fast.py line 780 */
  detect(metrics: FaceMetrics, _headPose: HeadPose): boolean {
    return metrics.mouth.mar > MOUTH_OPEN_THRESHOLD;
  }

  /** @see demo_local_fast.py lines 781-784 */
  getMessage(metrics: FaceMetrics, _headPose: HeadPose): string {
    const { mar } = metrics.mouth;

    if (mar > MOUTH_OPEN_THRESHOLD) {
      return 'Mouth open!';
    }

    return `Open: ${mar.toFixed(2)} - Open WIDER! Need >${MOUTH_OPEN_THRESHOLD}`;
  }
}
