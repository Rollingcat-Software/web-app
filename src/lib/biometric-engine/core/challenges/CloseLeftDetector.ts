/**
 * CloseLeftDetector — detects a LEFT-eye wink as a close→re-open EDGE.
 *
 * Like BLINK, a wink is a TRANSIENT (momentary) action, not a sustained hold:
 *   1. user's LEFT eye drops below BLINK_EAR_CLOSED while the RIGHT eye stays
 *      open (> EAR_THRESHOLD) for ≥ BLINK_CONSECUTIVE_FRAMES → "winking"
 *   2. the LEFT eye then recovers to ≥ BLINK_EAR_REOPEN → RE-OPEN edge → complete
 *
 * `detect()` returns `true` exactly once, on the re-open edge. The engine treats
 * this as a transient challenge (no 0.6s hold), so re-opening completes it.
 *
 * @see spoof-detector/src/infrastructure/analyzers/blink_analyzer.py:244-253
 * @see demo_local_fast.py line 745 (eye-state thresholds)
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
  BLINK_WARMUP_FRAMES,
} from '../constants';

export class CloseLeftDetector implements IChallengeDetector {
  readonly type = ChallengeType.CLOSE_LEFT;
  readonly isTransient = true;

  private frameCount = 0;
  /** Consecutive frames the LEFT eye was closed while the RIGHT stayed open. */
  private winkFrames = 0;

  reset(): void {
    this.frameCount = 0;
    this.winkFrames = 0;
  }

  /** Stateful close→re-open edge for the user's LEFT eye (right stays open). */
  detect(metrics: FaceMetrics, _headPose: HeadPose): boolean {
    const { userLeftEAR, userRightEAR } = metrics.eyes;
    this.frameCount += 1;

    const leftClosed = userLeftEAR < BLINK_EAR_CLOSED;
    const rightOpen = userRightEAR > EAR_THRESHOLD;

    if (leftClosed && rightOpen) {
      // Wink close phase (left shut, right open).
      this.winkFrames += 1;
      return false;
    }

    // Left eye is (re)open this frame. Did a valid wink-close just precede it?
    const reopenedAfterWink =
      this.winkFrames >= BLINK_CONSECUTIVE_FRAMES &&
      userLeftEAR >= BLINK_EAR_REOPEN &&
      this.frameCount > BLINK_WARMUP_FRAMES;

    this.winkFrames = 0;
    return reopenedAfterWink;
  }

  getMessage(metrics: FaceMetrics, _headPose: HeadPose): string {
    const { userLeftEAR, userRightEAR } = metrics.eyes;

    if (userLeftEAR < BLINK_EAR_CLOSED && userRightEAR > EAR_THRESHOLD) {
      return 'Left eye winking — now open it to finish!';
    }

    if (userRightEAR < EAR_CLOSED_THRESHOLD && userLeftEAR > EAR_THRESHOLD) {
      return "WRONG! That's your RIGHT eye — wink your LEFT!";
    }

    if (userLeftEAR < EAR_CLOSED_THRESHOLD && userRightEAR < EAR_CLOSED_THRESHOLD) {
      return 'Keep your RIGHT eye OPEN — wink only your LEFT!';
    }

    return 'Wink your LEFT eye once';
  }
}
