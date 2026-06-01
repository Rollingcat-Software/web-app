/**
 * BlinkDetector — detects a BLINK as a close→re-open EDGE (both eyes).
 *
 * A blink is a TRANSIENT action, not a sustained eyes-shut hold. The detector
 * is a small state machine that mirrors the production anti-spoof blink logic:
 *
 *   1. avg EAR drops below BLINK_EAR_CLOSED for ≥ BLINK_CONSECUTIVE_FRAMES → "closed"
 *   2. avg EAR then recovers to ≥ BLINK_EAR_REOPEN → RE-OPEN edge → blink complete
 *
 * `detect()` returns `true` exactly once, on the re-open edge. The engine treats
 * this challenge as transient (no 0.6s hold) so a natural ~120ms blink passes and
 * re-opening the eye COMPLETES the challenge instead of cancelling it.
 *
 * Canonical source of truth:
 * @see spoof-detector/src/infrastructure/analyzers/blink_analyzer.py:101-107,244-253
 * @see biometric-processor/app/application/services/active_liveness_manager.py:421-470
 */

import type { FaceMetrics, HeadPose } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import {
  EAR_CLOSED_THRESHOLD,
  EAR_THRESHOLD,
  BLINK_EAR_CLOSED,
  BLINK_EAR_REOPEN,
  BLINK_CONSECUTIVE_FRAMES,
  BLINK_MIN_OPEN_BETWEEN,
  BLINK_WARMUP_FRAMES,
} from '../constants';

export class BlinkDetector implements IChallengeDetector {
  readonly type = ChallengeType.BLINK;
  readonly isTransient = true;

  /** Total frames seen this attempt (for warm-up gating). */
  private frameCount = 0;
  /** Consecutive frames with both eyes below the closed threshold. */
  private closedFrames = 0;
  /** Frames since the last counted blink re-open (debounce). */
  private framesSinceBlink = Number.POSITIVE_INFINITY;

  reset(): void {
    this.frameCount = 0;
    this.closedFrames = 0;
    this.framesSinceBlink = Number.POSITIVE_INFINITY;
  }

  /**
   * Stateful close→re-open edge. Returns true on the frame the eyes re-open
   * after having been closed for ≥ BLINK_CONSECUTIVE_FRAMES.
   */
  detect(metrics: FaceMetrics, _headPose: HeadPose): boolean {
    const { avgEAR } = metrics.eyes;
    this.frameCount += 1;
    this.framesSinceBlink += 1;

    if (avgEAR < BLINK_EAR_CLOSED) {
      // Close phase — accumulate consecutive closed frames.
      this.closedFrames += 1;
      return false;
    }

    // Eye is (re)open this frame. Did a valid close just precede it?
    const reopenedAfterClose =
      this.closedFrames >= BLINK_CONSECUTIVE_FRAMES &&
      avgEAR >= BLINK_EAR_REOPEN &&
      this.frameCount > BLINK_WARMUP_FRAMES &&
      this.framesSinceBlink >= BLINK_MIN_OPEN_BETWEEN;

    // Reset the close counter now that the eye is open again, regardless.
    this.closedFrames = 0;

    if (reopenedAfterClose) {
      this.framesSinceBlink = 0;
      return true;
    }
    return false;
  }

  getMessage(metrics: FaceMetrics, _headPose: HeadPose): string {
    const { userLeftEAR, userRightEAR, avgEAR } = metrics.eyes;

    // Mid-blink: eyes are currently closing/closed.
    if (avgEAR < BLINK_EAR_CLOSED) {
      return 'Eyes closed — now open them to finish the blink!';
    }

    if (userLeftEAR < EAR_CLOSED_THRESHOLD && userRightEAR > EAR_THRESHOLD) {
      return 'Blink with BOTH eyes!';
    }

    if (userRightEAR < EAR_CLOSED_THRESHOLD && userLeftEAR > EAR_THRESHOLD) {
      return 'Blink with BOTH eyes!';
    }

    return 'Blink once (a quick natural blink)';
  }
}
