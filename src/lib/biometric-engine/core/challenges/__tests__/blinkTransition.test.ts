/**
 * Tests for BlinkTransitionTracker — the canonical close→re-open blink/wink
 * edge detector shared by the puzzle BlinkDetector and enrollment.
 *
 * Behaviour under test (mirrors blink_analyzer.py V-shape validation):
 *   - A close→re-open V-shape fires exactly once, on the RE-OPEN edge.
 *   - Holding the eyes shut forever does NOT keep firing (and never fires while shut).
 *   - A momentary single-frame dip (< CONSECUTIVE_FRAMES) does NOT fire.
 *   - The re-open must clear the REOPEN (hysteresis) threshold, not just the
 *     CLOSED threshold.
 *   - The wink gate (other eye open) is honoured: a close that happens while the
 *     gate is false is abandoned.
 */

import { describe, it, expect } from 'vitest'
import { BlinkTransitionTracker } from '../blinkTransition'
import {
  BLINK_EAR_CLOSED,
  BLINK_EAR_REOPEN,
  BLINK_CONSECUTIVE_FRAMES,
  BLINK_MIN_OPEN_BETWEEN,
  BLINK_WARMUP_FRAMES,
} from '../../constants'

const OPEN = 0.30 // comfortably above BLINK_EAR_REOPEN (0.23)
const SHUT = 0.10 // comfortably below BLINK_EAR_CLOSED (0.18)

/** Feed N frames at a fixed EAR; return how many times the tracker fired. */
function feed(tracker: BlinkTransitionTracker, ear: number, n: number, gate = true): number {
  let fires = 0
  for (let i = 0; i < n; i++) if (tracker.update(ear, gate)) fires++
  return fires
}

/** Warm the tracker past BLINK_WARMUP_FRAMES with open-eye frames. */
function warmup(tracker: BlinkTransitionTracker): void {
  feed(tracker, OPEN, BLINK_WARMUP_FRAMES + 1)
}

describe('BlinkTransitionTracker', () => {
  it('fires exactly once on the re-open edge of a close→open V-shape', () => {
    const t = new BlinkTransitionTracker()
    warmup(t)
    // Close for >= CONSECUTIVE_FRAMES — no fire while closing.
    expect(feed(t, SHUT, BLINK_CONSECUTIVE_FRAMES)).toBe(0)
    // First open frame after a valid close = the re-open edge → exactly one fire.
    expect(t.update(OPEN)).toBe(true)
    // Subsequent open frames must NOT keep firing.
    expect(feed(t, OPEN, 5)).toBe(0)
  })

  it('NEVER fires while the eyes stay shut (sustained-closed does not pass)', () => {
    const t = new BlinkTransitionTracker()
    warmup(t)
    // 300 frames of eyes-shut — the OLD model would have "passed" after a hold;
    // the transition model must never fire without a re-open.
    expect(feed(t, SHUT, 300)).toBe(0)
  })

  it('does not fire for a single-frame dip below CONSECUTIVE_FRAMES', () => {
    const t = new BlinkTransitionTracker()
    warmup(t)
    expect(BLINK_CONSECUTIVE_FRAMES).toBeGreaterThan(1)
    // One closed frame then re-open — not enough consecutive closed frames.
    expect(t.update(SHUT)).toBe(false)
    expect(t.update(OPEN)).toBe(false)
  })

  it('requires the re-open frame to clear the REOPEN threshold directly', () => {
    // Canonical V-shape (blink_analyzer.py): the frame that leaves the closed
    // state must itself clear the REOPEN (hysteresis) threshold. A frame that
    // only rises into the CLOSED..REOPEN band counts as "not closed" and clears
    // the close phase, so a SLOW re-open through the band does not fire — this
    // matches the production analyzer exactly.
    const between = (BLINK_EAR_CLOSED + BLINK_EAR_REOPEN) / 2
    expect(between).toBeGreaterThanOrEqual(BLINK_EAR_CLOSED)
    expect(between).toBeLessThan(BLINK_EAR_REOPEN)

    // Case A — re-open directly to >= REOPEN: fires.
    const a = new BlinkTransitionTracker()
    warmup(a)
    feed(a, SHUT, BLINK_CONSECUTIVE_FRAMES)
    expect(a.update(OPEN)).toBe(true)

    // Case B — re-open into the band first: the band frame clears the close,
    // so the later full-open does NOT fire (no confirmed V-shape).
    const b = new BlinkTransitionTracker()
    warmup(b)
    feed(b, SHUT, BLINK_CONSECUTIVE_FRAMES)
    expect(b.update(between)).toBe(false)
    expect(b.update(OPEN)).toBe(false)
  })

  it('counts two separated blinks but debounces blinks that are too close', () => {
    const t = new BlinkTransitionTracker()
    warmup(t)

    // Blink #1.
    feed(t, SHUT, BLINK_CONSECUTIVE_FRAMES)
    expect(t.update(OPEN)).toBe(true)

    // Immediate second blink BEFORE MIN_OPEN_BETWEEN open frames have elapsed →
    // debounced, must not count.
    feed(t, SHUT, BLINK_CONSECUTIVE_FRAMES)
    expect(t.update(OPEN)).toBe(false)

    // Wait out the debounce window with open frames, then a clean blink → counts.
    feed(t, OPEN, BLINK_MIN_OPEN_BETWEEN)
    feed(t, SHUT, BLINK_CONSECUTIVE_FRAMES)
    expect(t.update(OPEN)).toBe(true)
  })

  it('does not fire during warm-up frames', () => {
    const t = new BlinkTransitionTracker()
    // Immediately attempt a blink before warm-up completes.
    feed(t, SHUT, BLINK_CONSECUTIVE_FRAMES)
    // frameCount is still <= warmup → re-open must be ignored.
    expect(t.update(OPEN)).toBe(false)
  })

  it('abandons the close phase when the wink gate is false (other eye not open)', () => {
    const t = new BlinkTransitionTracker()
    warmup(t)
    // Eye closes but the gate (e.g. "other eye open") is false → no valid close.
    expect(feed(t, SHUT, BLINK_CONSECUTIVE_FRAMES, /* gate */ false)).toBe(0)
    // Re-open now must NOT fire because no valid gated close accumulated.
    expect(t.update(OPEN)).toBe(false)
  })

  it('reset() clears state so a half-finished blink does not leak across attempts', () => {
    const t = new BlinkTransitionTracker()
    warmup(t)
    feed(t, SHUT, BLINK_CONSECUTIVE_FRAMES) // mid-blink (closed, not yet re-opened)
    t.reset()
    // After reset we are back in warm-up; an immediate re-open cannot fire.
    expect(t.update(OPEN)).toBe(false)
  })
})
