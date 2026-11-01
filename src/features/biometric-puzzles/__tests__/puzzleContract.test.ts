/**
 * Cross-repo puzzle contract test (web client ⇒ bio server), 2026-11-01.
 *
 * Design rule: a challenge the web client reports as COMPLETED must be one the
 * biometric-processor trace verifier ACCEPTS.
 *
 * Input: `fixtures/puzzle_contract_segments.json.gz` — real MediaPipe
 * FaceLandmarker output on stock face videos (one genuine segment per face
 * challenge), reduced to what the engine reads: the 32 contract-v2 trace
 * landmarks (ints at 1e-4, delta-coded) and the facial transformation matrix.
 * No images. Built by fivucsas-papers
 * `paper-B-puzzle-pad/bench/calibration-2026-11-01/scripts/mkcontract.py`.
 *
 * This test drives the REAL `BiometricPuzzle` engine (gates, baselines,
 * detectors), the REAL `FaceMetricsCalculator` / `HeadPoseEstimator` and the
 * REAL `PuzzleTraceRecorder` the way `FacePuzzle` does with `collectTrace`
 * (face-gap restart, forced close-phase / decisive frames, return tail; the
 * passive-liveness gate is treated as "no verdict"). Each segment must
 * complete, and the produced v2 trace must equal the committed golden
 * `fixtures/puzzle_contract_golden_traces.json.gz`. The SAME golden file is
 * committed in biometric-processor
 * (`tests/fixtures/puzzle_contract/puzzle_contract_golden_traces.json.gz`),
 * where `tests/unit/application/services/test_puzzle_contract.py` asserts the
 * real verifier accepts every trace.
 *
 * Regenerate after an intentional engine / recorder change:
 *   UPDATE_PUZZLE_CONTRACT=1 npx vitest run src/features/biometric-puzzles/__tests__/puzzleContract.test.ts
 * then copy the golden file into biometric-processor and run its contract test.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { BiometricPuzzle } from '@/lib/biometric-engine/core/BiometricPuzzle'
import { FaceMetricsCalculator } from '@/lib/biometric-engine/core/FaceMetricsCalculator'
import { HeadPoseEstimator } from '@/lib/biometric-engine/core/HeadPoseEstimator'
import { ChallengeType } from '@/lib/biometric-engine/types'
import type { NormalizedLandmark } from '@/lib/biometric-engine/types'
import {
    ATTEMPT_SAMPLE_INTERVAL_MS,
    ATTEMPT_WINDOW_MS,
    BLINK_EAR_REOPEN,
    EXPRESSION_BASELINE_FRAMES,
    EYEBROW_RAISE_THRESHOLD,
    MOUTH_OPEN_THRESHOLD,
    OSCILLATION_MIN_REVERSALS,
    OSCILLATION_MIN_SWING_DEG,
    POSE_BASELINE_FRAMES,
    SINGLE_BROW_THRESHOLD,
    SMILE_CORNER_INCREASE_THRESHOLD,
    SMILE_CORNER_THRESHOLD,
    SMILE_WIDTH_THRESHOLD,
} from '@/lib/biometric-engine/core/constants'
import {
    FACE_TRACE_INDICES,
    PuzzleTraceRecorder,
    TRACE_MIN_INTERVAL_MS,
    TRACE_WINDOW_MS,
} from '../puzzleTrace'
import { PINCH_MAX_DIST_SCALED, TAP_MAX_DIST_SCALED } from '../puzzles/handChallenges'
import type { PuzzleTracePayload } from '../puzzleTrace'
import {
    FACE_GAP_RESET_MS,
    RETURN_PITCH_TOLERANCE_DEG,
    RETURN_TAIL_GIVEUP_MS,
    RETURN_TAIL_SETTLE_MS,
    RETURN_YAW_TOLERANCE_DEG,
    isTransientChallenge,
    median,
    needsReturnTail,
} from '../faceTraceContract'

const FIXTURES = join(__dirname, 'fixtures')
const SEGMENTS_FILE = join(FIXTURES, 'puzzle_contract_segments.json.gz')
const GOLDEN_FILE = join(FIXTURES, 'puzzle_contract_golden_traces.json.gz')
const T_OFFSET_MS = 1000

interface SegmentFrame { t: number; f: number[]; m: number[] }
interface Segment {
    id: string
    challenge: keyof typeof ChallengeType
    server_action: string
    width: number
    height: number
    frames: SegmentFrame[]
}

interface Golden {
    id: string
    challenge: string
    server_action: string
    hold_frames: number
    completed_at_ms: number
    trace: PuzzleTracePayload
}

/** Shared thresholds the client must hold to bio's values (bio's contract test
 *  asserts each one equals its own constant). Brow values are bio's increase
 *  form (web ratio − 1). */
const CONTRACT_CONSTANTS = {
    blink_reopen_ear: BLINK_EAR_REOPEN,
    open_mouth_mar_min: MOUTH_OPEN_THRESHOLD,
    smile_corner_raise_min: SMILE_CORNER_INCREASE_THRESHOLD,
    smile_corner_abs_min: SMILE_CORNER_THRESHOLD,
    smile_width_ratio_min: SMILE_WIDTH_THRESHOLD,
    brow_raise_both_min: Math.round((EYEBROW_RAISE_THRESHOLD - 1) * 1000) / 1000,
    brow_raise_single_min: Math.round((SINGLE_BROW_THRESHOLD - 1) * 1000) / 1000,
    oscillation_min_swing_deg: OSCILLATION_MIN_SWING_DEG,
    oscillation_min_reversals: OSCILLATION_MIN_REVERSALS,
    pose_baseline_frames: POSE_BASELINE_FRAMES,
    expression_baseline_frames: EXPRESSION_BASELINE_FRAMES,
    attempt_window_ms: ATTEMPT_WINDOW_MS,
    attempt_sample_interval_ms: ATTEMPT_SAMPLE_INTERVAL_MS,
    trace_window_ms: TRACE_WINDOW_MS,
    trace_min_interval_ms: TRACE_MIN_INTERVAL_MS,
    tap_max_dist_scaled: TAP_MAX_DIST_SCALED,
    pinch_max_dist_scaled: PINCH_MAX_DIST_SCALED,
}

function readGz<T>(path: string): T {
    return JSON.parse(gunzipSync(readFileSync(path)).toString('utf-8')) as T
}

/** Delta-decoded frames → 478-point normalised landmark arrays (only the 32
 *  trace indices are populated; the engine reads nothing else). */
function* decode(seg: Segment): Generator<{ ts: number; lms: NormalizedLandmark[]; m: number[] }> {
    let abs: number[] | null = null
    for (const fr of seg.frames) {
        abs = abs ? abs.map((v, i) => v + fr.f[i]) : [...fr.f]
        const lms: NormalizedLandmark[] = Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 }))
        FACE_TRACE_INDICES.forEach((idx, k) => {
            lms[idx] = { x: abs![3 * k] * 1e-4, y: abs![3 * k + 1] * 1e-4, z: abs![3 * k + 2] * 1e-4 }
        })
        yield { ts: fr.t + T_OFFSET_MS, lms, m: fr.m }
    }
}

/** FacePuzzle's detection loop (collectTrace=true), minus rendering / liveness / server. */
function drive(seg: Segment): { trace: PuzzleTracePayload | null; completedAt: number | null } {
    const challenge = ChallengeType[seg.challenge]
    let now = 0
    const puzzle = new BiometricPuzzle(new FaceMetricsCalculator(), 1, () => now)
    puzzle.registerAllDefaults()
    const pose = new HeadPoseEstimator()
    const rec = new PuzzleTraceRecorder('face')
    rec.setFrameSize(seg.width, seg.height)
    let poseHist: { t: number; yaw: number; pitch: number }[] = []
    let lastFace: number | null = null
    let completedAt: number | null = null
    let tail: { axis: 'yaw' | 'pitch'; start: number; base: number; returnedAt: number | null } | null = null
    puzzle.start([challenge], 1)

    for (const { ts, lms, m } of decode(seg)) {
        now = ts
        const hp = pose.estimateFromMatrix(m)
        if (lastFace !== null && ts - lastFace > FACE_GAP_RESET_MS) {
            rec.reset()
            poseHist = []
            if (tail) return { trace: null, completedAt: null }
            puzzle.start([challenge], 1)
        }
        lastFace = ts
        rec.push(ts, lms)
        poseHist.push({ t: ts, yaw: hp.yaw, pitch: hp.pitch })
        if (tail) {
            const tol = tail.axis === 'yaw' ? RETURN_YAW_TOLERANCE_DEG : RETURN_PITCH_TOLERANCE_DEG
            if (tail.returnedAt === null && Math.abs(hp[tail.axis] - tail.base) <= tol) tail.returnedAt = ts
            if (tail.returnedAt !== null && ts - tail.returnedAt >= RETURN_TAIL_SETTLE_MS) {
                return { trace: rec.toPayload(), completedAt }
            }
            if (ts - tail.start > RETURN_TAIL_GIVEUP_MS) return { trace: null, completedAt: null }
            continue
        }
        const r = puzzle.checkChallenge(lms, hp.yaw, hp.pitch)
        if (r.detected && !r.completed && isTransientChallenge(challenge)) rec.push(ts, lms, true)
        if (r.completed) {
            completedAt = ts - T_OFFSET_MS
            rec.push(ts, lms, true)
            const axis = needsReturnTail(challenge)
            if (!axis) return { trace: rec.toPayload(), completedAt }
            rec.freezeWindow()
            const startT = rec.firstTimestamp ?? 0
            const early = poseHist.filter((p) => p.t >= startT).slice(0, 3).map((p) => p[axis])
            tail = { axis, start: ts, base: median(early), returnedAt: null }
        }
    }
    return { trace: null, completedAt: null }
}

describe('puzzle contract: web completion ⇒ bio-acceptable trace (real landmarks)', () => {
    const doc = readGz<{ segments: Segment[] }>(SEGMENTS_FILE)
    const produced: Golden[] = doc.segments.map((seg) => {
        const { trace, completedAt } = drive(seg)
        return {
            id: seg.id,
            challenge: seg.challenge,
            server_action: seg.server_action,
            hold_frames: 2,
            completed_at_ms: completedAt ?? -1,
            trace: trace as PuzzleTracePayload,
        }
    })

    if (process.env.UPDATE_PUZZLE_CONTRACT === '1') {
        writeFileSync(
            GOLDEN_FILE,
            gzipSync(Buffer.from(JSON.stringify({
                    schema: 'fivucsas-puzzle-contract-golden/1',
                    constants: CONTRACT_CONSTANTS,
                    traces: produced,
                })), {
                level: 9,
            }),
        )
    }

    it('covers all 14 face challenges', () => {
        expect(new Set(doc.segments.map((s) => s.challenge)).size).toBe(14)
    })

    it.each(produced.map((p) => [p.id, p] as const))('%s: the engine completes the genuine gesture', (_id, p) => {
        expect(p.completed_at_ms).toBeGreaterThanOrEqual(0)
        expect(p.trace?.version).toBe(2)
        expect(p.trace!.frames.length).toBeGreaterThanOrEqual(6)
    })

    it('the produced traces equal the committed golden traces (bio asserts it accepts them)', () => {
        const golden = readGz<{ traces: Golden[] }>(GOLDEN_FILE)
        expect(produced).toEqual(golden.traces)
    })

    it('the shared thresholds equal the committed golden constants (bio pins its own to them)', () => {
        const golden = readGz<{ constants: typeof CONTRACT_CONSTANTS }>(GOLDEN_FILE)
        expect(CONTRACT_CONSTANTS).toEqual(golden.constants)
    })
})
