/**
 * SmileDetector — Detects a wide smile with raised lip corners (SMILE challenge).
 *
 * Detection: smileCornerRaise > 0.05 AND smileWidthRatio > 0.50 AND the corner
 * raise increased by ≥ SMILE_CORNER_INCREASE_THRESHOLD (0.03) over the attempt
 * baseline (`smileCornerIncrease`, set by BiometricPuzzle). The increase is
 * biometric-processor's smile rule (2026-11-01); the absolute gates are the
 * original demo ones, which bio now also requires on the same frames.
 * @see demo_local_fast.py lines 767-769
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import {
  SMILE_CORNER_THRESHOLD,
  SMILE_WIDTH_THRESHOLD,
  SMILE_CORNER_INCREASE_THRESHOLD,
} from '../constants';

export class SmileDetector implements IChallengeDetector {
  readonly type = ChallengeType.SMILE;

  /** @see demo_local_fast.py lines 767-769 */
  detect(metrics: FaceMetrics, _headPose: HeadPose): boolean {
    return (
      metrics.mouth.smileCornerRaise > SMILE_CORNER_THRESHOLD &&
      metrics.mouth.smileWidthRatio > SMILE_WIDTH_THRESHOLD &&
      (metrics.mouth.smileCornerIncrease ?? 0) >= SMILE_CORNER_INCREASE_THRESHOLD
    );
  }

  /** @see demo_local_fast.py lines 770-777 */
  getMessage(metrics: FaceMetrics, _headPose: HeadPose): string {
    const { smileCornerRaise, smileWidthRatio, smileCornerIncrease } = metrics.mouth;
    const isCornersRaised =
      smileCornerRaise > SMILE_CORNER_THRESHOLD &&
      (smileCornerIncrease ?? 0) >= SMILE_CORNER_INCREASE_THRESHOLD;
    const isMouthWide = smileWidthRatio > SMILE_WIDTH_THRESHOLD;

    if (isCornersRaised && isMouthWide) {
      return 'Great smile!';
    }

    if (isMouthWide && !isCornersRaised) {
      return 'Lift the corners of your mouth! Show teeth!';
    }

    if (isCornersRaised && !isMouthWide) {
      return `Smile WIDER! W:${smileWidthRatio.toFixed(2)} need >${SMILE_WIDTH_THRESHOLD}`;
    }

    return `SMILE! Show your teeth! W:${smileWidthRatio.toFixed(2)}`;
  }
}
