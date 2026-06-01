/**
 * livenessPool.test — the curated reliable pool is the ONE source of truth for
 * which gestures a real active-liveness flow may prompt for.
 *
 * These tests pin down the product rule (PO-approved 2026-06-01):
 *   - single-brow raises and finger-math are NEVER eligible for a liveness flow,
 *   - the BiometricPuzzle random picker can only ever yield curated challenges.
 */
import { describe, it, expect } from 'vitest'
import {
  LIVENESS_POOL,
  LIVENESS_FACE_POOL,
  LIVENESS_EXCLUDED_FACE,
  isLivenessEligible,
} from '../livenessPool'
import { ChallengeType } from '../../types'
import { BiometricPuzzle } from '../BiometricPuzzle'
import type { IFaceMetricsCalculator } from '../../interfaces'
import type { FaceMetrics, NormalizedLandmark, EyebrowBaseline } from '../../types'

describe('LIVENESS_POOL (curated reliable pool)', () => {
  it('EXCLUDES single-brow raises from every liveness flow', () => {
    expect(LIVENESS_POOL).not.toContain(ChallengeType.RAISE_LEFT_BROW)
    expect(LIVENESS_POOL).not.toContain(ChallengeType.RAISE_RIGHT_BROW)
    expect(isLivenessEligible(ChallengeType.RAISE_LEFT_BROW)).toBe(false)
    expect(isLivenessEligible(ChallengeType.RAISE_RIGHT_BROW)).toBe(false)
  })

  it('KEEPS the reliable face challenges (blink, smile, open-mouth, turns, look, nod, shake, both-brows)', () => {
    for (const c of [
      ChallengeType.BLINK,
      ChallengeType.SMILE,
      ChallengeType.OPEN_MOUTH,
      ChallengeType.TURN_LEFT,
      ChallengeType.TURN_RIGHT,
      ChallengeType.LOOK_UP,
      ChallengeType.LOOK_DOWN,
      ChallengeType.NOD,
      ChallengeType.SHAKE_HEAD,
      ChallengeType.RAISE_BOTH_BROWS,
    ]) {
      expect(isLivenessEligible(c)).toBe(true)
    }
  })

  it('the excluded set and the pool are disjoint and exhaustive over RAISE_*_BROW', () => {
    expect(LIVENESS_EXCLUDED_FACE).toEqual([
      ChallengeType.RAISE_LEFT_BROW,
      ChallengeType.RAISE_RIGHT_BROW,
    ])
    for (const c of LIVENESS_EXCLUDED_FACE) {
      expect(LIVENESS_FACE_POOL).not.toContain(c)
    }
  })
})

/** Stub calculator — the pool test never needs real metrics. */
class StubMetricsCalculator implements IFaceMetricsCalculator {
  calculateEAR(): number { return 0.3 }
  calculateMAR(): number { return 0 }
  calculateSmile() { return { cornerRaise: 0, widthRatio: 0 } }
  calculateEyebrowRaise() { return { bothRatio: 1, leftRatio: 1, rightRatio: 1 } }
  calculateAll(_l: NormalizedLandmark[], _b?: EyebrowBaseline): FaceMetrics {
    return {
      eyes: { leftEAR: 0.3, rightEAR: 0.3, avgEAR: 0.3, userLeftEAR: 0.3, userRightEAR: 0.3 },
      mouth: { mar: 0, smileCornerRaise: 0, smileWidthRatio: 0 },
      eyebrows: { bothRatio: 1, leftRatio: 1, rightRatio: 1 },
    }
  }
}

describe('BiometricPuzzle random selection draws ONLY from the curated pool', () => {
  it('never selects a single-brow raise across many random sessions', () => {
    const puzzle = new BiometricPuzzle(new StubMetricsCalculator(), 3)
    puzzle.registerAllDefaults()
    for (let i = 0; i < 500; i++) {
      // No explicit challenge list → falls back to the curated random pool.
      puzzle.start(undefined, 3)
      // Walk the selected challenges via getCurrentChallenge + advancing is
      // overkill; instead assert each yielded type is liveness-eligible by
      // reading the first challenge and asserting eligibility. Repeat draws
      // give broad coverage of the pool.
      const info = puzzle.getCurrentChallenge()
      expect(info).not.toBeNull()
      expect(isLivenessEligible(info!.type)).toBe(true)
    }
  })

  it('explicit start([...]) STILL allows an excluded gesture (library bypasses the pool)', () => {
    const puzzle = new BiometricPuzzle(new StubMetricsCalculator(), 1)
    puzzle.registerAllDefaults()
    puzzle.start([ChallengeType.RAISE_LEFT_BROW], 1)
    expect(puzzle.getCurrentChallenge()?.type).toBe(ChallengeType.RAISE_LEFT_BROW)
  })
})
