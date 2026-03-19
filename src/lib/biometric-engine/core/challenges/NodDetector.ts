/**
 * NodDetector — Detects nodding motion via pitch oscillation (NOD challenge).
 *
 * Detection: pitch range > 25 degrees over motion history (min 20 frames).
 * This is a motion-aware detector that requires setMotionHistory() to be called
 * each frame before detect().
 *
 * @see demo_local_fast.py lines 855-857, 883-890
 */

import type { FaceMetrics, HeadPose, MotionEntry } from '../../types';
import { ChallengeType } from '../../types';
import type { IChallengeDetector } from '../../interfaces';
import { NOD_PITCH_RANGE, MOTION_MIN_FRAMES } from '../constants';

/**
 * Motion-aware challenge detector that requires a motion history buffer.
 * BiometricPuzzle calls setMotionHistory() before detect() each frame.
 */
export class NodDetector implements IChallengeDetector {
  readonly type = ChallengeType.NOD;

  private motionHistory: ReadonlyArray<MotionEntry> = [];

  /**
   * Set the current motion history buffer.
   * Called by BiometricPuzzle before detect() each frame.
   * @see demo_local_fast.py line 519 (_motion_history)
   */
  setMotionHistory(history: ReadonlyArray<MotionEntry>): void {
    this.motionHistory = history;
  }

  /**
   * Check for nodding motion (pitch oscillation).
   * @see demo_local_fast.py lines 883-890 (_check_nod)
   */
  detect(_metrics: FaceMetrics, _headPose: HeadPose): boolean {
    if (this.motionHistory.length < MOTION_MIN_FRAMES) {
      return false;
    }

    const pitches = this.motionHistory.map((entry) => entry.pitch);
    const pitchRange = Math.max(...pitches) - Math.min(...pitches);
    return pitchRange > NOD_PITCH_RANGE;
  }

  /** @see demo_local_fast.py line 857 */
  getMessage(_metrics: FaceMetrics, _headPose: HeadPose): string {
    const detected = this.motionHistory.length >= MOTION_MIN_FRAMES && this.detectFromHistory();

    if (detected) {
      return 'Nod your head up and down - Done!';
    }

    return 'Nod your head up and down';
  }

  /** Internal helper to check detection without re-calling detect(). */
  private detectFromHistory(): boolean {
    const pitches = this.motionHistory.map((entry) => entry.pitch);
    const pitchRange = Math.max(...pitches) - Math.min(...pitches);
    return pitchRange > NOD_PITCH_RANGE;
  }
}
