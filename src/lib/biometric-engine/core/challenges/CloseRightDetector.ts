/**
 * CloseRightDetector — detects a RIGHT-eye wink as a close→re-open EDGE.
 *
 * Like BLINK, a wink is a TRANSIENT (momentary) action, not a sustained hold.
 * Delegates to the shared {@link BlinkTransitionTracker} on the user's RIGHT eye,
 * gated on the LEFT eye staying open during the close phase. `detect()` returns
 * `true` exactly once, on the re-open edge; the engine treats it as transient
 * (no 0.6s hold), so re-opening completes it.
 *
 * @see spoof-detector/src/infrastructure/analyzers/blink_analyzer.py:244-253
 * @see demo_local_fast.py line 756 (eye-state thresholds)
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { EAR_CLOSED_THRESHOLD, EAR_THRESHOLD, BLINK_EAR_CLOSED } from '../constants';
import { BlinkTransitionTracker } from './blinkTransition';

export class CloseRightDetector implements IChallengeDetector {
  readonly type = ChallengeType.CLOSE_RIGHT;
  readonly isTransient = true;

  private readonly tracker = new BlinkTransitionTracker();

  reset(): void {
    this.tracker.reset();
  }

  /** Close→re-open edge for the user's RIGHT eye (left must stay open). */
  detect(metrics: FaceMetrics, _headPose: HeadPose): boolean {
    const { userLeftEAR, userRightEAR } = metrics.eyes;
    const leftOpen = userLeftEAR > EAR_THRESHOLD;
    return this.tracker.update(userRightEAR, leftOpen);
  }

  getMessage(metrics: FaceMetrics, _headPose: HeadPose): string {
    const { userLeftEAR, userRightEAR } = metrics.eyes;

    if (userRightEAR < BLINK_EAR_CLOSED && userLeftEAR > EAR_THRESHOLD) {
      return 'Right eye winking — now open it to finish!';
    }

    if (userLeftEAR < EAR_CLOSED_THRESHOLD && userRightEAR > EAR_THRESHOLD) {
      return "WRONG! That's your LEFT eye — wink your RIGHT!";
    }

    if (userLeftEAR < EAR_CLOSED_THRESHOLD && userRightEAR < EAR_CLOSED_THRESHOLD) {
      return 'Keep your LEFT eye OPEN — wink only your RIGHT!';
    }

    return 'Wink your RIGHT eye once';
  }
}
