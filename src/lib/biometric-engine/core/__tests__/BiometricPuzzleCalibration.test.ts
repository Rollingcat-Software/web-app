/**
 * Engine tests for the 2026-11-01 calibration fixes (paper-B real-face
 * calibration). Every gate is now evaluated RELATIVE to the attempt baseline
 * (the oldest samples of the same rolling, 40 ms-sampled 4 s window the
 * contract-v2 trace recorder keeps), with biometric-processor's thresholds, so
 * a completed challenge is one the server accepts:
 *   - head pose relative to the baseline (a user sitting turned does not pass);
 *   - nod / shake need 2 direction reversals (a single excursion does not);
 *   - open mouth needs MAR > 0.50 from a closed-mouth baseline;
 *   - smile needs a corner-raise INCREASE ≥ 0.03 on top of the absolute gates;
 *   - brows +15% (both) / +20% (single) over the baseline;
 *   - no completion in the first MIN_ATTEMPT_MS;
 *   - a blink needs an open frame before the closure.
 */

import { describe, it, expect } from 'vitest'
import { BiometricPuzzle } from '../BiometricPuzzle'
import { ChallengeType } from '../../types'
import type { FaceMetrics, NormalizedLandmark, EyebrowBaseline, EyebrowMetrics } from '../../types'
import type { IFaceMetricsCalculator } from '../../interfaces'
import { MIN_ATTEMPT_MS } from '../constants'

const FRAME_MS = 33

interface Face {
  ear: number
  mar: number
  corner: number
  width: number
  browL: number
  browR: number
}

const NEUTRAL: Face = { ear: 0.3, mar: 0.05, corner: 0.0, width: 0.45, browL: 0.05, browR: 0.05 }

/** Stub calculator: the test sets the raw face state per frame. */
class Calc implements IFaceMetricsCalculator {
  face: Face = { ...NEUTRAL }
  calculateEAR(): number { return this.face.ear }
  calculateMAR(): number { return this.face.mar }
  calculateSmile() { return { cornerRaise: this.face.corner, widthRatio: this.face.width } }
  calculateEyebrowRaise(_l: NormalizedLandmark[], b?: EyebrowBaseline): EyebrowMetrics {
    const base = b ?? { left: 1, right: 1, avg: 1 }
    const avg = (this.face.browL + this.face.browR) / 2
    return { bothRatio: avg / base.avg, leftRatio: this.face.browL / base.left, rightRatio: this.face.browR / base.right }
  }
  calculateAll(): FaceMetrics {
    const f = this.face
    return {
      eyes: { leftEAR: f.ear, rightEAR: f.ear, avgEAR: f.ear, userLeftEAR: f.ear, userRightEAR: f.ear },
      mouth: { mar: f.mar, smileCornerRaise: f.corner, smileWidthRatio: f.width },
      eyebrows: { bothRatio: 1, leftRatio: 1, rightRatio: 1 },
    }
  }
}

const LM: NormalizedLandmark[] = [{ x: 0, y: 0, z: 0 }]

function setup(type: ChallengeType) {
  const calc = new Calc()
  let t = 50_000
  const puzzle = new BiometricPuzzle(calc, 1, () => (t += FRAME_MS))
  puzzle.registerAllDefaults()
  puzzle.start([type], 1)
  /** Feed n frames; returns true if the challenge completed. */
  const run = (n: number, face: Partial<Face> = {}, yaw = 0, pitch = 0): boolean => {
    calc.face = { ...NEUTRAL, ...face }
    let done = false
    for (let i = 0; i < n; i++) done = puzzle.checkChallenge(LM, yaw, pitch).completed === true || done
    return done
  }
  return { puzzle, run }
}

const SEC = Math.ceil(1000 / FRAME_MS)

describe('BiometricPuzzle — relative head pose', () => {
  it('a turn from the baseline completes TURN_LEFT (yaw < 0 = user\'s own left)', () => {
    const { run } = setup(ChallengeType.TURN_LEFT)
    expect(run(SEC)).toBe(false)
    expect(run(SEC, {}, -32)).toBe(true)
  })

  it('a user who sits turned (no movement) does NOT pass TURN_RIGHT', () => {
    const { run } = setup(ChallengeType.TURN_RIGHT)
    expect(run(3 * SEC, {}, 28)).toBe(false)
  })

  it('LOOK_DOWN needs pitch > 0 relative to the baseline, and a near-frontal yaw', () => {
    const a = setup(ChallengeType.LOOK_DOWN)
    a.run(SEC)
    expect(a.run(SEC, {}, 0, 20)).toBe(true)
    const b = setup(ChallengeType.LOOK_DOWN)
    b.run(SEC, {}, 40)
    expect(b.run(SEC, {}, 40, 20)).toBe(false) // profile pose: pitch is unreliable
  })
})

describe('BiometricPuzzle — nod / shake need two reversals', () => {
  it('a single down-and-back excursion does NOT complete NOD', () => {
    const { run } = setup(ChallengeType.NOD)
    run(SEC)
    run(10, {}, 0, 20)
    expect(run(SEC, {}, 0, 0)).toBe(false)
  })

  it('down-up-down completes NOD', () => {
    const { run } = setup(ChallengeType.NOD)
    run(SEC)
    run(10, {}, 0, 20)
    run(10, {}, 0, -5)
    expect(run(SEC, {}, 0, 20)).toBe(true)
  })

  it('left-right-left completes SHAKE_HEAD', () => {
    const { run } = setup(ChallengeType.SHAKE_HEAD)
    run(SEC)
    run(10, {}, -25)
    run(10, {}, 25)
    expect(run(SEC, {}, -25)).toBe(true)
  })
})

describe('BiometricPuzzle — mouth / smile / brows vs baseline', () => {
  it('OPEN_MOUTH: speech-level MAR 0.3 does not pass, MAR 0.6 does', () => {
    const a = setup(ChallengeType.OPEN_MOUTH)
    a.run(SEC)
    expect(a.run(2 * SEC, { mar: 0.3 })).toBe(false)
    expect(a.run(SEC, { mar: 0.6 })).toBe(true)
  })

  it('OPEN_MOUTH: a mouth already open at the baseline does not pass', () => {
    const { run } = setup(ChallengeType.OPEN_MOUTH)
    expect(run(3 * SEC, { mar: 0.7 })).toBe(false)
  })

  it('SMILE: the absolute gate alone (already smiling at the baseline) does not pass', () => {
    const { run } = setup(ChallengeType.SMILE)
    expect(run(3 * SEC, { corner: 0.08, width: 0.56 })).toBe(false)
  })

  it('SMILE: a corner raise of +0.06 from neutral passes', () => {
    const { run } = setup(ChallengeType.SMILE)
    run(SEC)
    expect(run(SEC, { corner: 0.06, width: 0.56 })).toBe(true)
  })

  it('RAISE_BOTH_BROWS: +10% (photo-noise level) fails, +20% passes', () => {
    const a = setup(ChallengeType.RAISE_BOTH_BROWS)
    a.run(SEC)
    expect(a.run(2 * SEC, { browL: 0.055, browR: 0.055 })).toBe(false)
    const b = setup(ChallengeType.RAISE_BOTH_BROWS)
    b.run(SEC)
    expect(b.run(SEC, { browL: 0.06, browR: 0.06 })).toBe(true)
  })

  it("RAISE_LEFT_BROW: +17% on the user's left brow fails, +24% passes", () => {
    const a = setup(ChallengeType.RAISE_LEFT_BROW)
    a.run(SEC)
    expect(a.run(2 * SEC, { browL: 0.0585 })).toBe(false)
    const b = setup(ChallengeType.RAISE_LEFT_BROW)
    b.run(SEC)
    expect(b.run(SEC, { browL: 0.062 })).toBe(true)
  })
})

describe('BiometricPuzzle — minimum attempt age and blink precondition', () => {
  it(`nothing completes in the first ${MIN_ATTEMPT_MS} ms`, () => {
    const { run } = setup(ChallengeType.TURN_LEFT)
    run(3)
    // 0.6 s hold reached at ≈ 0.7 s, but the attempt is younger than 1 s.
    expect(run(Math.floor((MIN_ATTEMPT_MS - 200) / FRAME_MS), {}, -35)).toBe(false)
    expect(run(SEC, {}, -35)).toBe(true)
  })

  it('a session that starts with the eyes shut does not complete on the first re-open', () => {
    const { run } = setup(ChallengeType.BLINK)
    run(2 * SEC, { ear: 0.1 })
    expect(run(SEC, { ear: 0.3 })).toBe(false)
    run(3, { ear: 0.1 })
    expect(run(2, { ear: 0.3 })).toBe(true)
  })
})
