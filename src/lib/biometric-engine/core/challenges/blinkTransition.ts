/**
 * blinkTransition — the ONE canonical close→re-open blink/wink edge detector.
 *
 * A blink (or wink) is a TRANSIENT action: the relevant eye's EAR drops below
 * the CLOSED threshold for a couple of frames and then RECOVERS above a higher
 * REOPEN threshold. This tracker fires exactly once, on the re-open edge.
 *
 * This is the single source of truth shared by:
 *   - BlinkDetector / CloseLeftDetector / CloseRightDetector (puzzle engine)
 *   - useFaceChallenge (enrollment blink stage)
 * so enrollment and puzzles agree on what "a blink" is, and both match the
 * production anti-spoof V-shape validation.
 *
 * @see spoof-detector/src/infrastructure/analyzers/blink_analyzer.py:244-253
 * @see biometric-processor/app/application/services/active_liveness_manager.py:421-470
 */

import {
  BLINK_EAR_CLOSED,
  BLINK_EAR_REOPEN,
  BLINK_CONSECUTIVE_FRAMES,
  BLINK_MIN_OPEN_BETWEEN,
  BLINK_WARMUP_FRAMES,
} from '../constants';

export class BlinkTransitionTracker {
  private frameCount = 0;
  private closedFrames = 0;
  private framesSinceBlink = Number.POSITIVE_INFINITY;

  constructor(
    private readonly closedThreshold: number = BLINK_EAR_CLOSED,
    private readonly reopenThreshold: number = BLINK_EAR_REOPEN,
    private readonly consecutiveFrames: number = BLINK_CONSECUTIVE_FRAMES,
    private readonly minOpenBetween: number = BLINK_MIN_OPEN_BETWEEN,
    private readonly warmupFrames: number = BLINK_WARMUP_FRAMES,
  ) {}

  reset(): void {
    this.frameCount = 0;
    this.closedFrames = 0;
    this.framesSinceBlink = Number.POSITIVE_INFINITY;
  }

  /** True while the eye is currently below the closed threshold (close phase). */
  isClosing(ear: number): boolean {
    return ear < this.closedThreshold;
  }

  /**
   * Feed one frame's EAR. Returns `true` exactly once — on the frame the eye
   * re-opens (≥ reopenThreshold) after having been closed for ≥ consecutiveFrames.
   *
   * @param gateOpen - optional extra condition that must hold during the CLOSE
   *   phase for it to count (e.g. for a wink: "the OTHER eye is open"). When the
   *   gate is false the close phase is abandoned. Defaults to always-open.
   */
  update(ear: number, gateOpen = true): boolean {
    this.frameCount += 1;
    this.framesSinceBlink += 1;

    if (ear < this.closedThreshold) {
      // Close phase — only accumulate while the gate condition holds.
      this.closedFrames = gateOpen ? this.closedFrames + 1 : 0;
      return false;
    }

    const reopened =
      this.closedFrames >= this.consecutiveFrames &&
      ear >= this.reopenThreshold &&
      this.frameCount > this.warmupFrames &&
      this.framesSinceBlink >= this.minOpenBetween;

    this.closedFrames = 0;

    if (reopened) {
      this.framesSinceBlink = 0;
      return true;
    }
    return false;
  }
}
