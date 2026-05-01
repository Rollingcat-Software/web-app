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
    PeekABooDetector,
    ShapeTraceDetector,
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
    it('fires after multiple direction changes', () => {
        const w = new WaveDetector(5000, 3, 0.05)
        // Generate strong oscillation: 5 swings spread across 30 frames.
        const xs = [0.3, 0.7, 0.3, 0.7, 0.3, 0.7]
        let detected = false
        for (let i = 0; i < xs.length; i++) {
            const f = fistFrame(i * 80)
            f.landmarks[0] = { x: xs[i], y: 0.9, z: 0 }
            if (w.push(f)) detected = true
        }
        expect(detected).toBe(true)
    })
})

describe('TapDetector', () => {
    it('counts apart→together transitions', () => {
        const tap = new TapDetector(10_000, 3)
        let detected = false
        for (let i = 0; i < 6; i++) {
            const ts = i * 200
            // alternate open / pinch
            const f = i % 2 === 0 ? openHandFrame(ts) : pinchFrame(ts)
            if (tap.push(f)) detected = true
        }
        expect(detected).toBe(true)
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

    it('survives single-frame finger-count jitter (regression: HAND_FINGER_COUNT must use the smoother)', () => {
        // Mirrors the HAND_MATH jitter test but pinned for HAND_FINGER_COUNT
        // specifically. Pre-fix coverage (Copilot post-merge on PR #51)
        // exercised only HAND_MATH, so a refactor that quietly stopped
        // wiring `countSmoother` for HAND_FINGER_COUNT would have slipped
        // through — this test fails loudly in that scenario.
        const state = initialHandState(BiometricPuzzleId.HAND_FINGER_COUNT)
        state.targetFingerCount = 5
        const hold = { detectedSince: null }
        let completed = false
        // 12 frames at 80ms apart → 960ms total, well over the 700ms hold.
        // Inject a 1-frame jitter (count=2) every 5th frame.
        for (let i = 0; i < 12; i++) {
            const ts = i * 80
            const frame = i % 5 === 0 ? twoFingerFrame(ts) : openHandFrame(ts)
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
        // 12 frames at 80ms apart → 960ms total, well over the 700ms hold.
        // Inject a 1-frame jitter (2 fingers instead of 5) every 5th frame
        // — `twoFingerFrame` returns count=2, which is the actual signal we
        // throw at the smoother below. (Comment was previously off-by-one:
        // it said "4 fingers" while the code clearly used twoFingerFrame.
        // Copilot post-merge on PR #51.)
        for (let i = 0; i < 12; i++) {
            const ts = i * 80
            const frame = i % 5 === 0
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
