/**
 * oscillation — the ONE direction-reversal counter for NOD (pitch) and
 * SHAKE_HEAD (yaw), shared by the engine gate (Nod/ShakeHeadDetector) and the
 * FacePuzzle `oscillation_count` metric.
 *
 * A reversal counts when the signal changes direction after a swing of at
 * least `minSwing` degrees from the last extreme, so ±2-3° per-frame jitter is
 * not counted. 1:1 with biometric-processor `_count_reversals` (the server's
 * nod/shake rule: ≥ 2 reversals at an 8° swing). A single excursion (down and
 * back) is ONE reversal and does not pass, unlike the old range gate.
 */

import { OSCILLATION_MIN_SWING_DEG } from '../constants';

/** Count direction reversals in a pose series (degrees). */
export function countReversals(series: readonly number[], minSwing = OSCILLATION_MIN_SWING_DEG): number {
  let count = 0;
  let lastExtreme: number | null = null;
  let dir: 1 | -1 | 0 = 0;
  for (const v of series) {
    if (lastExtreme === null) {
      lastExtreme = v;
      continue;
    }
    const delta = v - lastExtreme;
    if (Math.abs(delta) < minSwing) continue;
    const newDir: 1 | -1 = delta > 0 ? 1 : -1;
    if (dir !== 0 && newDir !== dir) count += 1;
    dir = newDir;
    lastExtreme = v;
  }
  return count;
}

/** Incremental form of {@link countReversals} (same result for the same samples). */
export class OscillationCounter {
  private count = 0;
  private lastExtreme: number | null = null;
  private dir: 1 | -1 | 0 = 0;

  constructor(private readonly minSwing = OSCILLATION_MIN_SWING_DEG) {}

  /** Feed one angle sample (pitch for nod, yaw for shake). */
  push(angle: number): void {
    if (this.lastExtreme === null) {
      this.lastExtreme = angle;
      return;
    }
    const delta = angle - this.lastExtreme;
    if (Math.abs(delta) < this.minSwing) return;
    const newDir: 1 | -1 = delta > 0 ? 1 : -1;
    if (this.dir !== 0 && newDir !== this.dir) this.count += 1;
    this.dir = newDir;
    this.lastExtreme = angle;
  }

  get reversals(): number {
    return this.count;
  }

  reset(): void {
    this.count = 0;
    this.lastExtreme = null;
    this.dir = 0;
  }
}
