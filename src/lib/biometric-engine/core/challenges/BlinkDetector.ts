/**
 * BlinkDetector — detects a BLINK as a close→re-open EDGE (both eyes).
 *
 * A blink is a TRANSIENT action, not a sustained eyes-shut hold. Delegates to
 * the shared {@link BlinkTransitionTracker}: avg EAR drops below the closed
 * threshold for ≥ a couple of frames, then recovers above the reopen threshold.
 * `detect()` returns `true` exactly once, on the re-open edge. The engine treats
 * this challenge as transient (no 0.6s hold) so a natural ~120ms blink passes
 * and re-opening the eye COMPLETES the challenge instead of cancelling it.
 *
 * Canonical source of truth:
 * @see spoof-detector/src/infrastructure/analyzers/blink_analyzer.py:101-107,244-253
 * @see biometric-processor/app/application/services/active_liveness_manager.py:421-470
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { EAR_CLOSED_THRESHOLD, EAR_THRESHOLD, BLINK_EAR_CLOSED } from '../constants';
import { BlinkTransitionTracker } from './blinkTransition';

export class BlinkDetector implements IChallengeDetector {
  readonly type = ChallengeType.BLINK;
  readonly isTransient = true;

  private readonly tracker = new BlinkTransitionTracker();

  reset(): void {
    this.tracker.reset();
  }

  /** Stateful close→re-open edge; true on the frame the eyes re-open. */
  detect(metrics: FaceMetrics, _headPose: HeadPose): boolean {
    return this.tracker.update(metrics.eyes.avgEAR);
  }

  getMessage(metrics: FaceMetrics, _headPose: HeadPose): string {
    const { userLeftEAR, userRightEAR, avgEAR } = metrics.eyes;

    // Mid-blink: eyes are currently closing/closed.
    if (avgEAR < BLINK_EAR_CLOSED) {
      return 'Eyes closed — now open them to finish the blink!';
    }

    if (
      (userLeftEAR < EAR_CLOSED_THRESHOLD && userRightEAR > EAR_THRESHOLD) ||
      (userRightEAR < EAR_CLOSED_THRESHOLD && userLeftEAR > EAR_THRESHOLD)
    ) {
      return 'Blink with BOTH eyes!';
    }

    return 'Blink once (a quick natural blink)';
  }
}
