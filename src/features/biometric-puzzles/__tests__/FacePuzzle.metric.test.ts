/**
 * FacePuzzle canonical-metric surfacing (SP-B CV-3, 2026-06-12)
 *
 * The face puzzle already surfaces EAR/MAR/brow/yaw/pitch for the static
 * gestures. This pins the NEW nod/shake path: an `OscillationCounter` counts
 * head-pose direction reversals across the gesture and `canonicalFaceMetric`
 * exposes that tally as bio's `oscillation_count` (challenge_metric_scorer.py,
 * gate >= 2). The engine`s Nod/ShakeHeadDetector gate on pitch/yaw RANGE; the
 * counter is independent read-only evidence and never feeds that gate.
 *
 * `canonicalFaceMetric` / `OscillationCounter` are pure and exported from the
 * component module so they can be unit-tested without a camera / MediaPipe.
 */
import { describe, it, expect } from 'vitest'
import { ChallengeType } from '@/lib/biometric-engine/types'
import type { FaceMetrics, HeadPose } from '@/lib/biometric-engine/types'
import {
    OscillationCounter,
    canonicalFaceMetric,
} from '../puzzles/FacePuzzle'

function metrics(over: Partial<{
    avgEAR: number
    mar: number
    bothRatio: number
    leftRatio: number
    rightRatio: number
}> = {}): FaceMetrics {
    return {
        eyes: {
            leftEAR: 0.3,
            rightEAR: 0.3,
            avgEAR: over.avgEAR ?? 0.3,
            userLeftEAR: 0.3,
            userRightEAR: 0.3,
        },
        mouth: {
            mar: over.mar ?? 0.1,
            smileCornerRaise: 0,
            smileWidthRatio: 0,
        },
        eyebrows: {
            bothRatio: over.bothRatio ?? 0,
            leftRatio: over.leftRatio ?? 0,
            rightRatio: over.rightRatio ?? 0,
        },
    }
}

const pose = (yaw: number, pitch: number): HeadPose => ({ yaw, pitch })

describe('OscillationCounter', () => {
    it('counts direction reversals above the swing gate', () => {
        const c = new OscillationCounter()
        // A nod up/down/up/down with >8 deg swings: -15, +15, -15, +15.
        // 4 extremes ⇒ 3 direction segments ⇒ 2 reversals (matches bio`s
        // direction-change count; the first segment establishes the direction).
        for (const p of [-15, 15, -15, 15]) c.push(p)
        expect(c.reversals).toBe(2)
    })

    it('one full nod cycle (down-up-down-up-down) counts 3 reversals', () => {
        const c = new OscillationCounter()
        for (const p of [-15, 15, -15, 15, -15]) c.push(p)
        expect(c.reversals).toBe(3)
    })

    it('ignores sub-threshold jitter (no spurious reversals)', () => {
        const c = new OscillationCounter()
        // +-2 deg per-frame jitter is below the 8 deg swing gate.
        for (const p of [0, 2, -1, 1, -2, 1, 0]) c.push(p)
        expect(c.reversals).toBe(0)
    })

    it('reset() clears the tally', () => {
        const c = new OscillationCounter()
        for (const p of [-15, 15, -15]) c.push(p)
        expect(c.reversals).toBeGreaterThan(0)
        c.reset()
        expect(c.reversals).toBe(0)
    })
})

describe('canonicalFaceMetric — nod/shake oscillation_count', () => {
    it('NOD → { oscillation_count } from the counter (>= 2 passes bio)', () => {
        const m = canonicalFaceMetric(ChallengeType.NOD, metrics(), pose(0, 0), 3)
        expect(m).toEqual({ oscillation_count: 3 })
    })

    it('SHAKE_HEAD → { oscillation_count } from the counter', () => {
        const m = canonicalFaceMetric(
            ChallengeType.SHAKE_HEAD,
            metrics(),
            pose(0, 0),
            4,
        )
        expect(m).toEqual({ oscillation_count: 4 })
    })

    it('surfaces a too-low count verbatim (bio fails closed, never faked)', () => {
        const m = canonicalFaceMetric(ChallengeType.NOD, metrics(), pose(0, 0), 1)
        expect(m).toEqual({ oscillation_count: 1 })
    })
})

describe('canonicalFaceMetric — static gestures unchanged', () => {
    it('BLINK → { ear }', () => {
        expect(
            canonicalFaceMetric(ChallengeType.BLINK, metrics({ avgEAR: 0.18 }), null, 0),
        ).toEqual({ ear: 0.18 })
    })
    it('SMILE → { mar }', () => {
        expect(
            canonicalFaceMetric(ChallengeType.SMILE, metrics({ mar: 0.55 }), null, 0),
        ).toEqual({ mar: 0.55 })
    })
    it('RAISE_BOTH_BROWS → { brow_raise } from bothRatio', () => {
        expect(
            canonicalFaceMetric(
                ChallengeType.RAISE_BOTH_BROWS,
                metrics({ bothRatio: 0.12 }),
                null,
                0,
            ),
        ).toEqual({ brow_raise: 0.12 })
    })
    it('TURN_LEFT → { yaw }', () => {
        expect(
            canonicalFaceMetric(ChallengeType.TURN_LEFT, null, pose(-20, 0), 0),
        ).toEqual({ yaw: -20 })
    })
    it('LOOK_DOWN → { pitch }', () => {
        expect(
            canonicalFaceMetric(ChallengeType.LOOK_DOWN, null, pose(0, 15), 0),
        ).toEqual({ pitch: 15 })
    })
})
