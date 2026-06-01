/**
 * handChallenges.test
 *
 * Unit-tests for the per-puzzle hand-gesture detectors. The earlier
 * placeholder always succeeded, hiding the bug where the wrong
 * challenge could pass. These tests pin down the behavior of each
 * detector against synthetic landmark fixtures so a future refactor
 * cannot silently regress to "always succeed".
 */
import { describe, it, expect } from 'vitest'
import {
    countFingers,
    isPinching,
    palmFacingCamera,
    WaveDetector,
    FlipDetector,
    TapDetector,
    TapTransitionTracker,
    tapDistance,
    PeekABooDetector,
    ShapeTraceDetector,
    TemplateTraceDetector,
    GestureValidator,
    HandCalibrator,
    fingerRatio,
    resamplePath,
    centroidNormalise,
    dtwNormalisedCost,
    shapeTraceCost,
    SHAPE_TEMPLATES,
    randomShapeTemplate,
    evaluateHandPuzzle,
    initialHandState,
    type HandFrame,
    type HandLandmark,
} from '../puzzles/handChallenges'
import { BiometricPuzzleId } from '../BiometricPuzzleId'

/**
 * Build a 21-landmark hand at a "rest" pose (closed fist, palm-ish).
 * Image-coordinates: y grows downward. Wrist is at (0.5, 0.9).
 */
function fistFrame(timestamp = 0): HandFrame {
    const lms: HandLandmark[] = []
    // Wrist
    lms[0] = { x: 0.5, y: 0.9, z: 0 }
    // Thumb chain (1-4) — curled toward palm.
    lms[1] = { x: 0.46, y: 0.85, z: 0 }
    lms[2] = { x: 0.45, y: 0.82, z: 0 }
    lms[3] = { x: 0.46, y: 0.80, z: 0 }
    lms[4] = { x: 0.47, y: 0.79, z: 0 } // thumb tip — close to palm
    // Index chain (5-8) — curled, TIP below PIP.
    lms[5] = { x: 0.48, y: 0.75, z: 0 } // MCP
    lms[6] = { x: 0.48, y: 0.70, z: 0 } // PIP
    lms[7] = { x: 0.48, y: 0.72, z: 0 } // DIP
    lms[8] = { x: 0.48, y: 0.74, z: 0 } // TIP — y > PIP.y → curled
    // Middle (9-12)
    lms[9] = { x: 0.50, y: 0.74, z: 0 }
    lms[10] = { x: 0.50, y: 0.68, z: 0 }
    lms[11] = { x: 0.50, y: 0.71, z: 0 }
    lms[12] = { x: 0.50, y: 0.73, z: 0 }
    // Ring (13-16)
    lms[13] = { x: 0.52, y: 0.74, z: 0 }
    lms[14] = { x: 0.52, y: 0.69, z: 0 }
    lms[15] = { x: 0.52, y: 0.71, z: 0 }
    lms[16] = { x: 0.52, y: 0.73, z: 0 }
    // Pinky (17-20)
    lms[17] = { x: 0.54, y: 0.75, z: 0 }
    lms[18] = { x: 0.54, y: 0.71, z: 0 }
    lms[19] = { x: 0.54, y: 0.73, z: 0 }
    lms[20] = { x: 0.54, y: 0.74, z: 0 }
    return { landmarks: lms, timestamp }
}

/** Open-palm: all four fingers extended, thumb splayed. */
function openHandFrame(timestamp = 0): HandFrame {
    const f = fistFrame(timestamp)
    // Extend fingers: TIP y < PIP y (above PIP in image coords).
    f.landmarks[8] = { x: 0.48, y: 0.55, z: 0 }   // index TIP up
    f.landmarks[12] = { x: 0.50, y: 0.50, z: 0 }  // middle TIP up
    f.landmarks[16] = { x: 0.52, y: 0.55, z: 0 }  // ring TIP up
    f.landmarks[20] = { x: 0.54, y: 0.60, z: 0 }  // pinky TIP up
    // Thumb extended: tip far from index-MCP than IP.
    f.landmarks[3] = { x: 0.42, y: 0.78, z: 0 }
    f.landmarks[4] = { x: 0.34, y: 0.74, z: 0 }   // thumb TIP further from index-MCP than IP
    return f
}

/** Pointing pose: only index extended. */
function pointingFrame(timestamp = 0): HandFrame {
    const f = fistFrame(timestamp)
    f.landmarks[8] = { x: 0.48, y: 0.55, z: 0 }
    return f
}

/** Two-finger frame (index + middle). */
function twoFingerFrame(timestamp = 0): HandFrame {
    const f = pointingFrame(timestamp)
    f.landmarks[12] = { x: 0.50, y: 0.50, z: 0 }
    return f
}

/** Pinch frame: thumb tip touching index tip. */
function pinchFrame(timestamp = 0): HandFrame {
    const f = openHandFrame(timestamp)
    // Force thumb tip and index tip to coincide.
    f.landmarks[4] = { x: 0.48, y: 0.55, z: 0 }
    return f
}

describe('countFingers', () => {
    it('returns 0 for a closed fist', () => {
        expect(countFingers(fistFrame())).toBe(0)
    })
    it('returns 5 for an open hand', () => {
        expect(countFingers(openHandFrame())).toBe(5)
    })
    it('returns 1 for a pointing hand', () => {
        expect(countFingers(pointingFrame())).toBe(1)
    })
    it('returns 2 for index+middle extended', () => {
        expect(countFingers(twoFingerFrame())).toBe(2)
    })
})

describe('isPinching', () => {
    it('detects a pinch when thumb and index tips coincide', () => {
        expect(isPinching(pinchFrame())).toBe(true)
    })
    it('returns false on an open hand', () => {
        expect(isPinching(openHandFrame())).toBe(false)
    })
})

describe('palmFacingCamera', () => {
    it('does not crash on minimal landmarks', () => {
        // Just check the function stays a pure boolean.
        expect(typeof palmFacingCamera(openHandFrame())).toBe('boolean')
    })
})

describe('WaveDetector', () => {
    it('does not fire on a stationary hand', () => {
        const w = new WaveDetector()
        for (let i = 0; i < 30; i++) {
            const f = fistFrame(i * 50)
            // Wrist barely moves
            f.landmarks[0] = { x: 0.5, y: 0.9, z: 0 }
            expect(w.push(f)).toBe(false)
        }
    })
    it('fires for an oscillation inside the valid 1-4 Hz band', () => {
        // New frequency-gated WaveDetector signature:
        //   (bufferSize, minSwing, minTotalDisp, minReversals, minFreqHz, maxFreqHz)
        const w = new WaveDetector(40, 0.1, 0.2, 2, 1.0, 4.0)
        // ~2.5 Hz oscillation: a reversal every 200ms (full cycle 400ms).
        const xs = [0.3, 0.7, 0.3, 0.7, 0.3, 0.7, 0.3, 0.7]
        let detected = false
        for (let i = 0; i < xs.length; i++) {
            const f = fistFrame(i * 200)
            f.landmarks[0] = { x: xs[i], y: 0.9, z: 0 }
            if (w.push(f)) detected = true
        }
        expect(detected).toBe(true)
    })

    it('rejects an oscillation that is too fast (frequency gate)', () => {
        const w = new WaveDetector(40, 0.1, 0.2, 2, 1.0, 4.0)
        // Reversal every 20ms → ~25 Hz, well above the 4 Hz ceiling.
        const xs = [0.3, 0.7, 0.3, 0.7, 0.3, 0.7, 0.3, 0.7]
        let detected = false
        for (let i = 0; i < xs.length; i++) {
            const f = fistFrame(i * 20)
            f.landmarks[0] = { x: xs[i], y: 0.9, z: 0 }
            if (w.push(f)) detected = true
        }
        expect(detected).toBe(false)
    })
})

describe('tapDistance', () => {
    it('is small (touching) for a pinch and large (apart) for an open hand', () => {
        expect(tapDistance(pinchFrame())).toBeLessThan(0.35)
        expect(tapDistance(openHandFrame())).toBeGreaterThan(0.6)
    })
    it('returns Infinity when landmarks are missing (no-hand frame is never a touch)', () => {
        expect(tapDistance({ landmarks: [], timestamp: 0 })).toBe(Infinity)
    })
})

describe('TapTransitionTracker', () => {
    /** Run a fixed distance for n frames, return whether the tracker ever fired. */
    function feed(tracker: TapTransitionTracker, frames: number[]): boolean {
        let fired = false
        for (const d of frames) if (tracker.update(d)) fired = true
        return fired
    }

    it('fires once on the touch→release EDGE, not while merely touching', () => {
        const t = new TapTransitionTracker()
        // Touch for 3 frames — must NOT fire (no release yet).
        expect(t.update(0.05)).toBe(false)
        expect(t.update(0.05)).toBe(false)
        expect(t.update(0.05)).toBe(false)
        // Release — fires exactly once on this edge.
        expect(t.update(0.9)).toBe(true)
        // Staying apart does not re-fire.
        expect(t.update(0.9)).toBe(false)
    })

    it('does NOT fire on a single-frame touch (needs ≥ consecutive frames)', () => {
        const t = new TapTransitionTracker()
        // One touch frame then release — below TAP_CONSECUTIVE_FRAMES (2).
        expect(feed(t, [0.05, 0.9])).toBe(false)
    })

    it('does NOT count a sustained PINCH-and-HOLD as a tap', () => {
        const t = new TapTransitionTracker()
        // 30 frames of held touch (a pinch) then release — exceeds
        // TAP_MAX_TOUCH_FRAMES, so the release is NOT a tap.
        const frames = Array.from({ length: 30 }, () => 0.05)
        frames.push(0.9)
        expect(feed(t, frames)).toBe(false)
    })

    it('reset() clears an in-progress touch', () => {
        const t = new TapTransitionTracker()
        t.update(0.05)
        t.update(0.05)
        t.reset()
        // Immediate release after reset must not fire — touch count is back to 0.
        expect(t.update(0.9)).toBe(false)
    })
})

describe('TapDetector', () => {
    /** A held pinch (≥2 touching frames) followed by an open frame = one tap. */
    function tapOnce(detector: TapDetector, startTs: number): boolean {
        let detected = false
        // 3 touching frames…
        for (let i = 0; i < 3; i++) {
            if (detector.push(pinchFrame(startTs + i * 50))) detected = true
        }
        // …then release.
        if (detector.push(openHandFrame(startTs + 200))) detected = true
        return detected
    }

    it('completes on a single deliberate touch-and-release (default requiredTaps=1)', () => {
        const tap = new TapDetector()
        expect(tapOnce(tap, 0)).toBe(true)
    })

    it('does NOT complete while the user just holds a pinch (no release)', () => {
        const tap = new TapDetector()
        let detected = false
        for (let i = 0; i < 10; i++) {
            if (tap.push(pinchFrame(i * 50))) detected = true
        }
        expect(detected).toBe(false)
    })

    it('does NOT complete for an open hand that never touches', () => {
        const tap = new TapDetector()
        let detected = false
        for (let i = 0; i < 20; i++) {
            if (tap.push(openHandFrame(i * 50))) detected = true
        }
        expect(detected).toBe(false)
    })

    it('requires the configured number of separate taps', () => {
        const tap = new TapDetector(10_000, 2)
        // First tap.
        expect(tapOnce(tap, 0)).toBe(false) // only 1 tap so far
        // Second tap.
        expect(tapOnce(tap, 1000)).toBe(true)
    })
})

describe('FlipDetector', () => {
    it('requires both palm and back-of-hand states within the window', () => {
        const flip = new FlipDetector(5000)
        // Palm-facing: standard MCP layout (index MCP left of pinky MCP from
        // the camera perspective with wrist at the bottom centre).
        const palm = openHandFrame(0)
        palm.landmarks[5] = { x: 0.48, y: 0.75, z: 0 }
        palm.landmarks[17] = { x: 0.54, y: 0.75, z: 0 }
        expect(flip.push({ ...palm, timestamp: 0 })).toBe(false)

        // Back-of-hand: index/pinky MCP x-coords swap because the user's
        // hand has rotated. This flips the cross-product sign that
        // `palmFacingCamera` uses internally.
        const back = openHandFrame(200)
        back.landmarks[5] = { x: 0.54, y: 0.75, z: 0 }
        back.landmarks[17] = { x: 0.46, y: 0.75, z: 0 }
        // Push the back-of-hand frame.
        flip.push({ ...back, timestamp: 200 })
        // Re-feed palm — both states now seen.
        const ok = flip.push({ ...palm, timestamp: 400 })
        expect(ok).toBe(true)
    })
})

describe('PeekABooDetector', () => {
    it('fires only after cover→reveal sequence', () => {
        const peek = new PeekABooDetector()
        // Cover phase — hand at centre of frame.
        for (let i = 0; i < 10; i++) {
            const f = fistFrame(i * 100)
            // Move middle-MCP to image centre.
            f.landmarks[9] = { x: 0.5, y: 0.5, z: 0 }
            peek.push(f)
        }
        // Reveal: simulate no hand for a while.
        const startReveal = 1100
        let detected = false
        for (let i = 0; i < 20; i++) {
            const ts = startReveal + i * 60
            // Mock out performance.now so the detector sees fresh time.
            const realNow = performance.now
            performance.now = () => ts
            try {
                if (peek.push(null)) detected = true
            } finally {
                performance.now = realNow
            }
        }
        expect(detected).toBe(true)
    })
})

describe('ShapeTraceDetector', () => {
    it('accepts a closed-loop trace with sufficient arc length', () => {
        const trace = new ShapeTraceDetector(8000)
        // Trace a circle of radius 0.15 around (0.5, 0.5) over 60 frames.
        let detected = false
        for (let i = 0; i <= 60; i++) {
            const angle = (i / 60) * Math.PI * 2
            const x = 0.5 + 0.15 * Math.cos(angle)
            const y = 0.5 + 0.15 * Math.sin(angle)
            const f = pointingFrame(i * 100)
            f.landmarks[8] = { x, y, z: 0 }
            if (trace.push(f)) detected = true
        }
        expect(detected).toBe(true)
    })

    it('rejects a path that is too short', () => {
        const trace = new ShapeTraceDetector(8000)
        // Only 10 frames within tiny radius → arc < 0.6.
        for (let i = 0; i < 10; i++) {
            const f = pointingFrame(i * 100)
            f.landmarks[8] = { x: 0.5 + i * 0.001, y: 0.5, z: 0 }
            expect(trace.push(f)).toBe(false)
        }
    })
})

describe('evaluateHandPuzzle (HAND_PINCH)', () => {
    it('requires the user to actually pinch — not just hold an open hand', () => {
        const state = initialHandState(BiometricPuzzleId.HAND_PINCH)
        const hold = { detectedSince: null }
        // Many frames of open hand → never completes.
        let completed = false
        for (let i = 0; i < 30; i++) {
            const r = evaluateHandPuzzle(
                BiometricPuzzleId.HAND_PINCH,
                { frame: openHandFrame(i * 100), state },
                hold,
            )
            if (r.completed) completed = true
        }
        expect(completed).toBe(false)
    })

    it('completes once a pinch is held > 700ms', () => {
        const state = initialHandState(BiometricPuzzleId.HAND_PINCH)
        const hold = { detectedSince: null }
        let completed = false
        // 10 pinch frames spaced 100ms apart → 900ms hold > 700ms threshold.
        for (let i = 0; i < 10; i++) {
            const r = evaluateHandPuzzle(
                BiometricPuzzleId.HAND_PINCH,
                { frame: pinchFrame(i * 100), state },
                hold,
            )
            if (r.completed) completed = true
        }
        expect(completed).toBe(true)
    })
})

describe('evaluateHandPuzzle (HAND_FINGER_COUNT)', () => {
    it('rejects the wrong finger count', () => {
        const state = initialHandState(BiometricPuzzleId.HAND_FINGER_COUNT)
        // Force a known target.
        state.targetFingerCount = 2
        const hold = { detectedSince: null }
        // Show 1 finger only → never completes.
        let completed = false
        for (let i = 0; i < 20; i++) {
            const r = evaluateHandPuzzle(
                BiometricPuzzleId.HAND_FINGER_COUNT,
                { frame: pointingFrame(i * 100), state },
                hold,
            )
            if (r.completed) completed = true
        }
        expect(completed).toBe(false)
    })

    it('completes when the correct count is shown long enough', () => {
        const state = initialHandState(BiometricPuzzleId.HAND_FINGER_COUNT)
        state.targetFingerCount = 2
        const hold = { detectedSince: null }
        let completed = false
        for (let i = 0; i < 10; i++) {
            const r = evaluateHandPuzzle(
                BiometricPuzzleId.HAND_FINGER_COUNT,
                { frame: twoFingerFrame(i * 100), state },
                hold,
            )
            if (r.completed) completed = true
        }
        expect(completed).toBe(true)
    })

    it('survives single-frame finger-count jitter (4-layer validator: hysteresis + EWMA + median)', () => {
        // The GestureValidator's moving-median + EWMA suppress a single bad
        // frame so the 700ms hold isn't reset by a thumb that briefly flickers
        // curled. Frames are at ~30fps (33ms) — the cadence the pipeline is
        // tuned for — with a 1-frame count=2 jitter injected every 8th frame.
        const state = initialHandState(BiometricPuzzleId.HAND_FINGER_COUNT)
        state.targetFingerCount = 5
        const hold = { detectedSince: null }
        let completed = false
        for (let i = 0; i < 40; i++) {
            const ts = i * 33
            const frame = i % 8 === 0 ? twoFingerFrame(ts) : openHandFrame(ts)
            const r = evaluateHandPuzzle(
                BiometricPuzzleId.HAND_FINGER_COUNT,
                { frame, state },
                hold,
            )
            if (r.completed) completed = true
        }
        expect(completed).toBe(true)
    })

    it('refuses to report `detected` for an empty frame when target is unset (negative-target guard)', () => {
        // Caller forgot to call initialHandState → targetFingerCount stays
        // undefined → fallback target = -1. Pre-fix the no-hand path also
        // produced count = -1 and the dominance check trivially matched,
        // so the puzzle reported `detected` with no hand visible at all.
        // The negative-target guard short-circuits that.
        const hold = { detectedSince: null }
        const state = {} // intentionally not initialised
        const r = evaluateHandPuzzle(
            BiometricPuzzleId.HAND_FINGER_COUNT,
            { frame: null, state },
            hold,
        )
        expect(r.detected).toBe(false)
        expect(r.completed).toBe(false)
    })
})

describe('evaluateHandPuzzle (HAND_MATH)', () => {
    it('only completes when the user shows the arithmetic answer', () => {
        const state = initialHandState(BiometricPuzzleId.HAND_MATH)
        // Override randomness for a deterministic test.
        state.targetFingerCount = 5
        state.mathPrompt = '2 + 3'
        const hold = { detectedSince: null }

        // Show 2 fingers — wrong answer.
        let completed = false
        for (let i = 0; i < 10; i++) {
            const r = evaluateHandPuzzle(
                BiometricPuzzleId.HAND_MATH,
                { frame: twoFingerFrame(i * 100), state },
                hold,
            )
            if (r.completed) completed = true
        }
        expect(completed).toBe(false)

        // Now show 5 fingers — correct answer. Fresh state (the smoother
        // and hold-tracker reset when the user starts a new attempt).
        const state2 = initialHandState(BiometricPuzzleId.HAND_MATH)
        state2.targetFingerCount = 5
        state2.mathPrompt = '2 + 3'
        const hold2 = { detectedSince: null }
        for (let i = 0; i < 10; i++) {
            const r = evaluateHandPuzzle(
                BiometricPuzzleId.HAND_MATH,
                { frame: openHandFrame(i * 100), state: state2 },
                hold2,
            )
            if (r.completed) completed = true
        }
        expect(completed).toBe(true)
    })

    it('survives single-frame finger-count jitter (regression for "math doesn\'t work")', () => {
        // Real users' thumbs flicker between extended/curled — without
        // smoothing, a single jittered frame would reset the hold timer
        // and the puzzle would never finish. With the
        // `FingerCountSmoother`, the dominant count over the last 500ms
        // wins, so 1 jittered frame in 5 still completes.
        const state = initialHandState(BiometricPuzzleId.HAND_MATH)
        state.targetFingerCount = 5
        state.mathPrompt = '2 + 3'
        const hold = { detectedSince: null }
        let completed = false
        // ~30fps cadence (33ms), with a 1-frame count=2 jitter every 8th frame.
        // The validator's median + EWMA absorb the jitter so the hold holds.
        for (let i = 0; i < 40; i++) {
            const ts = i * 33
            const frame = i % 8 === 0
                ? twoFingerFrame(ts)  // wrong-count jitter (count=2)
                : openHandFrame(ts)   // correct count=5
            const r = evaluateHandPuzzle(
                BiometricPuzzleId.HAND_MATH,
                { frame, state },
                hold,
            )
            if (r.completed) completed = true
        }
        expect(completed).toBe(true)
    })
})

describe('evaluateHandPuzzle (HAND_SHAPE_TRACE)', () => {
    it('completes a closed-loop trace even when the thumb rides loose (regression for "shape drawing doesn\'t work")', () => {
        // Real users naturally hold the thumb loose while pointing.
        // Strict `countFingers === 1` rejected such frames and reset the
        // path buffer every frame, so the puzzle never accumulated
        // enough points. The new `isIndexExtended` check only requires
        // the index TIP to be above its PIP joint.
        const state = initialHandState(BiometricPuzzleId.HAND_SHAPE_TRACE)
        const hold = { detectedSince: null }
        let completed = false
        // 60 frames tracing a circle of radius 0.15 around (0.5, 0.5).
        // We use `openHandFrame` (5 fingers) but force the index TIP to
        // follow a circular path — `countFingers` returns 5 here,
        // which the OLD strict detector would reject. The NEW detector
        // only checks index extension and accepts.
        for (let i = 0; i <= 60; i++) {
            const angle = (i / 60) * Math.PI * 2
            const x = 0.5 + 0.15 * Math.cos(angle)
            const y = 0.5 + 0.15 * Math.sin(angle)
            const f = openHandFrame(i * 100)
            f.landmarks[8] = { x, y, z: 0 }
            const r = evaluateHandPuzzle(
                BiometricPuzzleId.HAND_SHAPE_TRACE,
                { frame: f, state },
                hold,
            )
            if (r.completed) completed = true
        }
        expect(completed).toBe(true)
    })
})

// ============================================================================
// 4-layer finger validator (gesture_validator.py port)
// ============================================================================

describe('GestureValidator (4-layer pipeline)', () => {
    it('finger_ratio separates a fist from an open hand', () => {
        const open = openHandFrame()
        const fist = fistFrame()
        expect(fingerRatio(open.landmarks, 1)).toBeGreaterThan(0.2)
        expect(fingerRatio(fist.landmarks, 1)).toBeLessThan(0.12)
    })

    it('reports a stable count of 5 for a held open hand', () => {
        const v = new GestureValidator()
        let last = -1
        for (let i = 0; i < 8; i++) last = v.countFingersStable(openHandFrame(i * 33).landmarks)
        expect(last).toBe(5)
    })

    it('reports 0 for a held fist (no false positive)', () => {
        const v = new GestureValidator()
        let last = -1
        for (let i = 0; i < 8; i++) last = v.countFingersStable(fistFrame(i * 33).landmarks)
        expect(last).toBe(0)
    })
})

describe('HandCalibrator', () => {
    it('completes after the calibration window and records per-finger averages', () => {
        const cal = new HandCalibrator(2000)
        cal.feed(openHandFrame().landmarks, 0)
        expect(cal.isDone).toBe(false)
        cal.feed(openHandFrame().landmarks, 1000)
        cal.feed(openHandFrame().landmarks, 2000)
        expect(cal.isDone).toBe(true)
        expect(cal.offsets['1']).toBeGreaterThan(0.2)
    })
})

// ============================================================================
// DTW shape matching (shape_tracer.py port) — HAND_TRACE_TEMPLATE
// ============================================================================

describe('DTW shape matching', () => {
    it('resamplePath produces exactly n points', () => {
        const path: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]
        expect(resamplePath(path, 50)).toHaveLength(50)
        expect(resamplePath([], 10)).toHaveLength(10)
    })

    it('centroidNormalise centres and scales into ~[-1,1]', () => {
        const norm = centroidNormalise([[0, 0], [2, 0], [2, 2], [0, 2]])
        const cx = norm.reduce((s, p) => s + p[0], 0) / norm.length
        const cy = norm.reduce((s, p) => s + p[1], 0) / norm.length
        expect(Math.abs(cx)).toBeLessThan(1e-9)
        expect(Math.abs(cy)).toBeLessThan(1e-9)
        const maxR = Math.max(...norm.map(([x, y]) => Math.hypot(x, y)))
        expect(maxR).toBeCloseTo(1, 5)
    })

    it('dtw cost is ~0 for identical paths', () => {
        const a: [number, number][] = [[0, 0], [0.5, 0.5], [1, 1]]
        expect(dtwNormalisedCost(a, a)).toBeLessThan(1e-6)
    })

    it('matches a faithfully-traced template and rejects a wrong shape', () => {
        const circle = SHAPE_TEMPLATES.find((s) => s.id === 'CIRCLE')!
        const square = SHAPE_TEMPLATES.find((s) => s.id === 'SQUARE')!
        const circleCost = shapeTraceCost(circle.waypoints, circle)
        expect(circleCost).toBeLessThan(0.25)
        const wrongCost = shapeTraceCost(square.waypoints, circle)
        expect(wrongCost).toBeGreaterThan(circleCost)
    })

    it('randomShapeTemplate returns one of the four templates', () => {
        const ids = new Set(SHAPE_TEMPLATES.map((s) => s.id))
        for (let i = 0; i < 20; i++) {
            expect(ids.has(randomShapeTemplate().id)).toBe(true)
        }
    })
})

describe('TemplateTraceDetector (HAND_TRACE_TEMPLATE)', () => {
    function tracePoint(x: number, y: number, ts: number): HandFrame {
        const f = openHandFrame(ts)
        f.landmarks[6] = { x: 0.48, y: 0.70, z: 0 }
        f.landmarks[8] = { x, y, z: 0 }
        return f
    }

    it('accepts a path that traces the assigned circle template', () => {
        const circle = SHAPE_TEMPLATES.find((s) => s.id === 'CIRCLE')!
        const det = new TemplateTraceDetector(circle)
        let ok = false
        for (let i = 0; i < circle.waypoints.length; i++) {
            const [wx, wy] = circle.waypoints[i]
            const y = 0.2 + (wy - 0.32) * 0.8
            if (det.push(tracePoint(wx, Math.min(0.65, y), i * 30))) ok = true
        }
        expect(det.lastCost).toBeLessThan(0.25)
        expect(ok).toBe(true)
    })

    it('does not accept while the index is not extended', () => {
        const det = new TemplateTraceDetector(SHAPE_TEMPLATES[0])
        for (let i = 0; i < 40; i++) {
            const f = fistFrame(i * 30)
            expect(det.push(f)).toBe(false)
        }
    })
})
