/**
 * Engine-level tests for the BLINK transition through BiometricPuzzle.
 *
 * Drives BiometricPuzzle.checkChallenge() with a stub metrics calculator so we
 * can feed exact EAR values frame-by-frame and assert the TRANSIENT semantics:
 *   - The blink completes on the close→re-open EDGE, with NO 0.6s hold.
 *   - Holding the eyes shut forever does NOT complete the challenge.
 *   - Re-opening COMPLETES the challenge (it must not cancel progress).
 *   - SUSTAINED challenges still require the hold (regression guard).
 */

import { describe, it, expect } from 'vitest'
import { BiometricPuzzle } from '../BiometricPuzzle'
import { ChallengeType } from '../../types'
import type { FaceMetrics, NormalizedLandmark, EyebrowBaseline } from '../../types'
import type { IFaceMetricsCalculator } from '../../interfaces'
import {
  BLINK_CONSECUTIVE_FRAMES,
  BLINK_WARMUP_FRAMES,
  YAW_THRESHOLD,
} from '../constants'

const OPEN = 0.30
const SHUT = 0.10

function metricsForEAR(avgEAR: number): FaceMetrics {
  return {
    eyes: {
      leftEAR: avgEAR,
      rightEAR: avgEAR,
      avgEAR,
      userLeftEAR: avgEAR,
      userRightEAR: avgEAR,
    },
    mouth: { mar: 0, smileCornerRaise: 0, smileWidthRatio: 0 },
    eyebrows: { bothRatio: 1, leftRatio: 1, rightRatio: 1 },
  }
}

/**
 * Stub metrics calculator whose returned EAR is set per-frame by the test
 * harness. BiometricPuzzle ignores the actual landmark values and uses what
 * calculateAll() returns.
 */
class StubMetricsCalculator implements IFaceMetricsCalculator {
  nextEAR = OPEN
  calculateEAR(): number { return this.nextEAR }
  calculateMAR(): number { return 0 }
  calculateSmile() { return { cornerRaise: 0, widthRatio: 0 } }
  calculateEyebrowRaise() { return { bothRatio: 1, leftRatio: 1, rightRatio: 1 } }
  calculateAll(_l: NormalizedLandmark[], _b?: EyebrowBaseline): FaceMetrics {
    return metricsForEAR(this.nextEAR)
  }
}

const LM: NormalizedLandmark[] = [{ x: 0, y: 0, z: 0 }]

/** Feed one frame at the given EAR; returns the check result. */
function frame(puzzle: BiometricPuzzle, calc: StubMetricsCalculator, ear: number) {
  calc.nextEAR = ear
  return puzzle.checkChallenge(LM, /* yaw */ 0, /* pitch */ 0)
}

describe('BiometricPuzzle — BLINK transient semantics', () => {
  it('completes on the re-open edge with NO sustained hold', () => {
    const calc = new StubMetricsCalculator()
    const puzzle = new BiometricPuzzle(calc, 1)
    puzzle.registerAllDefaults()
    puzzle.start([ChallengeType.BLINK], 1)

    // Warm-up with open-eye frames.
    for (let i = 0; i < BLINK_WARMUP_FRAMES + 1; i++) frame(puzzle, calc, OPEN)

    // Close the eyes for the required consecutive frames — must NOT complete
    // (no re-open yet), but should report in-progress (closing) feedback.
    for (let i = 0; i < BLINK_CONSECUTIVE_FRAMES; i++) {
      const r = frame(puzzle, calc, SHUT)
      expect(r.completed).toBeFalsy()
      expect(r.detected).toBe(true) // closing → partial progress
      expect(r.progress).toBeGreaterThan(0)
      expect(r.progress).toBeLessThan(100)
    }

    // Re-open: the very next open frame should COMPLETE the challenge — this is
    // a single edge, not a 0.6s hold.
    const done = frame(puzzle, calc, OPEN)
    expect(done.completed).toBe(true)
    expect(done.progress).toBe(100)
    expect(puzzle.getPassed()).toBe(true)
  })

  it('does NOT complete while the eyes stay shut forever', () => {
    const calc = new StubMetricsCalculator()
    const puzzle = new BiometricPuzzle(calc, 1)
    puzzle.registerAllDefaults()
    puzzle.start([ChallengeType.BLINK], 1)

    for (let i = 0; i < BLINK_WARMUP_FRAMES + 1; i++) frame(puzzle, calc, OPEN)

    // 500 frames of eyes-shut: the old global 0.6s-hold model would have
    // completed; the transition model must never complete without a re-open.
    for (let i = 0; i < 500; i++) {
      const r = frame(puzzle, calc, SHUT)
      expect(r.completed).toBeFalsy()
    }
    expect(puzzle.getPassed()).toBe(false)
    expect(puzzle.getIsComplete()).toBe(false)
  })

  it('a fresh start() resets the detector so a prior half-blink does not leak', () => {
    const calc = new StubMetricsCalculator()
    const puzzle = new BiometricPuzzle(calc, 1)
    puzzle.registerAllDefaults()

    puzzle.start([ChallengeType.BLINK], 1)
    for (let i = 0; i < BLINK_WARMUP_FRAMES + 1; i++) frame(puzzle, calc, OPEN)
    for (let i = 0; i < BLINK_CONSECUTIVE_FRAMES; i++) frame(puzzle, calc, SHUT) // mid-blink

    // Restart mid-blink.
    puzzle.start([ChallengeType.BLINK], 1)
    // An immediate re-open must NOT complete (we are back in warm-up, no close).
    const r = frame(puzzle, calc, OPEN)
    expect(r.completed).toBeFalsy()
    expect(puzzle.getPassed()).toBe(false)
  })
})

describe('BiometricPuzzle — sustained challenge regression guard', () => {
  it('TURN_LEFT still requires a continuous hold (not an instant edge)', () => {
    const calc = new StubMetricsCalculator()
    const puzzle = new BiometricPuzzle(calc, 1)
    puzzle.registerAllDefaults()
    puzzle.start([ChallengeType.TURN_LEFT], 1)

    // A single in-threshold frame must report progress but NOT complete
    // immediately (sustained challenges keep HOLD_DURATION).
    calc.nextEAR = OPEN
    const yawLeft = -(YAW_THRESHOLD + 10)
    const r = puzzle.checkChallenge(LM, yawLeft, 0)
    expect(r.detected).toBe(true)
    expect(r.completed).toBeFalsy()
    expect(r.progress).toBeLessThan(100)
    expect(puzzle.getPassed()).toBe(false)
  })
})
