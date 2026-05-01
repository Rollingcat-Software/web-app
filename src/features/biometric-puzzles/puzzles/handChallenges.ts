/**
 * handChallenges
 *
 * Per-frame detectors for the 9 hand-gesture puzzles, ported from the
 * Python references in `practice-and-test/GestureAnalysis/*.py`.
 *
 * Inputs: a 21-point MediaPipe HandLandmarker result (one hand) plus
 * optional handedness ('Left'|'Right'). Outputs are pure functions —
 * the orchestration component manages temporal state (history, hold
 * timer, target prompts).
 *
 * IMPORTANT: MediaPipe handedness comes from the camera's perspective,
 * which on a user-facing webcam is mirrored. We do NOT attempt to
 * convert here; downstream challenges that care about left/right hand
 * handle the mirror at the prompt level.
 *
 * MediaPipe HandLandmarker landmark indices:
 *   0  wrist
 *   1-4  thumb (CMC, MCP, IP, TIP)
 *   5-8  index (MCP, PIP, DIP, TIP)
 *   9-12 middle
 *   13-16 ring
 *   17-20 pinky
 */
import { BiometricPuzzleId } from '../BiometricPuzzleId'

export interface HandLandmark {
    x: number
    y: number
    z?: number
}

export interface HandFrame {
    /** 21 normalised landmarks (0..1) for one hand. */
    landmarks: HandLandmark[]
    /** 'Left' | 'Right' from MediaPipe (camera perspective). */
    handedness?: 'Left' | 'Right'
    /** performance.now() timestamp of this frame. */
    timestamp: number
}

/** Squared 2D distance between two normalised landmarks. */
function dist2(a: HandLandmark, b: HandLandmark): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return dx * dx + dy * dy
}

function dist(a: HandLandmark, b: HandLandmark): number {
    return Math.sqrt(dist2(a, b))
}

/**
 * Approximate hand "scale" — the wrist→middle-MCP distance — used to
 * normalise pinch/tap thresholds across camera distances.
 */
function handScale(lms: HandLandmark[]): number {
    return dist(lms[0], lms[9]) || 0.0001
}

/**
 * Count extended fingers using the standard tip-vs-PIP heuristic.
 *
 * For the four fingers (index, middle, ring, pinky) a finger counts as
 * extended when its TIP is further from the wrist than its PIP joint
 * AND the TIP is above (smaller y) the PIP — this avoids counting
 * curled fingers in a fist.
 *
 * The thumb is special: its joint axis is roughly horizontal, so we
 * compare TIP-x to IP-x against the palm centre.
 */
export function countFingers(frame: HandFrame): number {
    const lms = frame.landmarks
    if (lms.length < 21) return 0

    let count = 0

    // Fingers 5-8, 9-12, 13-16, 17-20 — TIP is at idx+3 from MCP.
    const fingerMcpIdx = [5, 9, 13, 17]
    for (const mcp of fingerMcpIdx) {
        const pip = lms[mcp + 1]
        const tip = lms[mcp + 3]
        // Extended when TIP is "above" PIP in image coordinates (y smaller)
        if (tip.y < pip.y) count += 1
    }

    // Thumb: extended when TIP is further from index-MCP than IP is
    // (i.e. the thumb is splayed away from the palm). This avoids the
    // mirror-handedness trap.
    const thumbTip = lms[4]
    const thumbIp = lms[3]
    const indexMcp = lms[5]
    if (dist(thumbTip, indexMcp) > dist(thumbIp, indexMcp)) count += 1

    return count
}

/**
 * Returns true if the index finger is extended (TIP above PIP in image
 * coordinates). Less strict than `countFingers === 1` — used by the
 * shape-trace puzzles where the user is told to point but their thumb
 * frequently rides loose, which would otherwise abort the trace.
 */
export function isIndexExtended(frame: HandFrame): boolean {
    const lms = frame.landmarks
    if (lms.length < 21) return false
    return lms[8].y < lms[6].y
}

/** Returns true while thumb-tip and index-tip are pinched together. */
export function isPinching(frame: HandFrame): boolean {
    const lms = frame.landmarks
    if (lms.length < 21) return false
    const d = dist(lms[4], lms[8])
    return d < handScale(lms) * 0.35
}

/** Returns the normalised thumb-index distance (0..~1). */
export function thumbIndexDistance(frame: HandFrame): number {
    const lms = frame.landmarks
    if (lms.length < 21) return 1
    return dist(lms[4], lms[8]) / handScale(lms)
}

/**
 * Heuristic for palm-vs-back-of-hand. We use the cross product of
 * (wrist→index-MCP) × (wrist→pinky-MCP) in 3D. When the user faces
 * the palm at the camera the z-component flips sign relative to when
 * they show the back of the hand. This is approximate but good enough
 * for the "Flip Palm" puzzle.
 */
export function palmFacingCamera(frame: HandFrame): boolean {
    const lms = frame.landmarks
    if (lms.length < 21) return false
    const w = lms[0]
    const i = lms[5]
    const p = lms[17]
    const ax = i.x - w.x
    const ay = i.y - w.y
    const bx = p.x - w.x
    const by = p.y - w.y
    // Cross product z component (depth ignored — handled below as tiebreaker)
    const cz = ax * by - ay * bx
    // For camera-facing palm with right hand the cross-z flips depending on
    // mirror; combine with depth (z) of MCPs as a tie-breaker.
    const meanZ = ((i.z ?? 0) + (p.z ?? 0)) / 2
    return cz > 0 || meanZ < (w.z ?? 0)
}

/**
 * Detect a wave by tracking horizontal oscillation of the wrist over
 * a sliding window. Returns true once we've seen at least
 * `minSwings` direction changes within `windowMs`.
 */
export class WaveDetector {
    private history: { x: number; ts: number }[] = []
    private windowMs: number
    private minSwings: number
    private amplitudeThreshold: number

    constructor(windowMs = 1500, minSwings = 3, amplitudeThreshold = 0.05) {
        this.windowMs = windowMs
        this.minSwings = minSwings
        this.amplitudeThreshold = amplitudeThreshold
    }

    push(frame: HandFrame): boolean {
        const lms = frame.landmarks
        if (lms.length < 21) return false
        const wristX = lms[0].x
        const ts = frame.timestamp
        this.history.push({ x: wristX, ts })
        // Drop entries older than window
        while (this.history.length && ts - this.history[0].ts > this.windowMs) {
            this.history.shift()
        }
        if (this.history.length < 6) return false

        // Count direction changes whose amplitude exceeds threshold
        let swings = 0
        let dir = 0
        let lastExtreme = this.history[0].x
        for (let i = 1; i < this.history.length; i++) {
            const dx = this.history[i].x - this.history[i - 1].x
            const newDir = Math.sign(dx)
            if (newDir !== 0 && newDir !== dir && Math.abs(this.history[i].x - lastExtreme) > this.amplitudeThreshold) {
                swings += 1
                dir = newDir
                lastExtreme = this.history[i].x
            }
        }
        return swings >= this.minSwings
    }

    reset() {
        this.history = []
    }
}

/**
 * Detect a flip from palm→back-of-hand or back→palm: requires both
 * states to be observed within the window.
 */
export class FlipDetector {
    private states: { palm: boolean; ts: number }[] = []
    private windowMs: number

    constructor(windowMs = 3000) {
        this.windowMs = windowMs
    }

    push(frame: HandFrame): boolean {
        const palm = palmFacingCamera(frame)
        const ts = frame.timestamp
        this.states.push({ palm, ts })
        while (this.states.length && ts - this.states[0].ts > this.windowMs) {
            this.states.shift()
        }
        let sawPalm = false
        let sawBack = false
        for (const s of this.states) {
            if (s.palm) sawPalm = true
            else sawBack = true
        }
        return sawPalm && sawBack
    }

    reset() {
        this.states = []
    }
}

/**
 * Detect tap: thumb-index distance crossing the pinch threshold from
 * apart→together at least `taps` times within `windowMs`.
 */
export class TapDetector {
    private events: { close: boolean; ts: number }[] = []
    private taps = 0
    private windowMs: number
    private requiredTaps: number

    constructor(windowMs = 4000, requiredTaps = 3) {
        this.windowMs = windowMs
        this.requiredTaps = requiredTaps
    }

    push(frame: HandFrame): boolean {
        const close = isPinching(frame)
        const last = this.events[this.events.length - 1]
        const ts = frame.timestamp

        if (!last || last.close !== close) {
            this.events.push({ close, ts })
            // Count a tap as an apart→together transition.
            if (last && !last.close && close) this.taps += 1
        }

        // Drop stale events.
        while (this.events.length && ts - this.events[0].ts > this.windowMs) {
            this.events.shift()
        }
        // Recount taps inside the window only.
        let count = 0
        for (let i = 1; i < this.events.length; i++) {
            if (!this.events[i - 1].close && this.events[i].close) count += 1
        }
        this.taps = count
        return this.taps >= this.requiredTaps
    }

    reset() {
        this.events = []
        this.taps = 0
    }
}

/**
 * Detect a peek-a-boo: hand visible AND covering the screen centre,
 * then hand removed (no detection for at least 500ms while puzzle is
 * still active) → true.
 */
export class PeekABooDetector {
    private state: 'idle' | 'covered' | 'revealed' = 'idle'
    private coveredStartTs = 0
    private lastCoveredTs = 0

    push(frame: HandFrame | null): boolean {
        const now = performance.now()

        if (frame && frame.landmarks.length >= 21) {
            const lms = frame.landmarks
            // "Covering" if the wrist + middle-MCP are both near image centre.
            const cx = lms[9].x
            const cy = lms[9].y
            const covering =
                cx > 0.3 && cx < 0.7 && cy > 0.25 && cy < 0.75
            if (covering) {
                if (this.state === 'idle') {
                    this.state = 'covered'
                    this.coveredStartTs = now
                }
                this.lastCoveredTs = now
            }
        } else {
            // No hand seen — if we were covered, this is the reveal.
            if (this.state === 'covered' && now - this.lastCoveredTs > 350 && now - this.coveredStartTs > 600) {
                this.state = 'revealed'
                return true
            }
        }
        return this.state === 'revealed'
    }

    reset() {
        this.state = 'idle'
        this.coveredStartTs = 0
        this.lastCoveredTs = 0
    }
}

/**
 * Shape-trace detector: records the index-fingertip path while the
 * user has the index extended (loose-thumb tolerant), and reports
 * success once the path has reasonable arc length AND has revisited
 * its starting point (closed shape).
 *
 * 2026-04-30: switched from strict `countFingers === 1` to
 * `isIndexExtended`. Real users naturally let their thumb ride loose
 * when pointing — the strict check kept resetting the buffer on
 * ~every frame, so the puzzle never finished.
 */
export class ShapeTraceDetector {
    private path: { x: number; y: number; ts: number }[] = []
    private windowMs: number

    constructor(windowMs = 8000) {
        this.windowMs = windowMs
    }

    push(frame: HandFrame): boolean {
        const lms = frame.landmarks
        if (lms.length < 21) {
            return false
        }

        // Index must be extended; thumb / other fingers don't matter — the
        // tip path itself is what we evaluate.
        if (!isIndexExtended(frame)) {
            // Not in pointing pose yet — discard buffer until they are.
            this.path = []
            return false
        }

        const tip = lms[8]
        const ts = frame.timestamp
        this.path.push({ x: tip.x, y: tip.y, ts })

        // Drop stale points outside window.
        while (this.path.length && ts - this.path[0].ts > this.windowMs) {
            this.path.shift()
        }

        if (this.path.length < 30) return false

        // Arc length and closure check.
        let arc = 0
        for (let i = 1; i < this.path.length; i++) {
            const dx = this.path[i].x - this.path[i - 1].x
            const dy = this.path[i].y - this.path[i - 1].y
            arc += Math.sqrt(dx * dx + dy * dy)
        }
        const start = this.path[0]
        const end = this.path[this.path.length - 1]
        const closeDist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2)

        // Require a path of at least 0.6 normalised units (a reasonable
        // shape) and end within 0.1 of the start.
        return arc > 0.6 && closeDist < 0.1
    }

    reset() {
        this.path = []
    }
}

/**
 * Sliding-window finger-count smoother. `countFingers` is per-frame and
 * jitters by ±1 when the thumb relaxes — that jitter caused the
 * HAND_MATH and HAND_FINGER_COUNT puzzles to never accumulate the 700ms
 * hold because every wobble reset the timer. The smoother accepts a
 * target as "matched" once the target value is the most common count
 * over the last `windowMs` of samples AND occupies at least
 * `dominanceRatio` of the window. A null frame is treated as a
 * "no-hand" sample of count -1 (never matches).
 *
 * Synthetic tests still pass: when every frame reports the same count,
 * the mode equals that count after `minSamples` (default 3) frames
 * accumulate in the window. (Earlier docs said "immediately", which
 * contradicted the `if (this.samples.length < this.minSamples) return
 * false` guard in `push()` — Copilot post-merge on PR #51.)
 */
export class FingerCountSmoother {
    private samples: { count: number; ts: number }[] = []
    private windowMs: number
    private minSamples: number
    private dominanceRatio: number

    constructor(windowMs = 500, minSamples = 3, dominanceRatio = 0.6) {
        this.windowMs = windowMs
        this.minSamples = minSamples
        this.dominanceRatio = dominanceRatio
    }

    /** Push a finger count (or -1 if no hand). Returns true when the
     *  target is dominant in the current window. */
    push(count: number, ts: number, target: number): boolean {
        this.samples.push({ count, ts })
        while (this.samples.length && ts - this.samples[0].ts > this.windowMs) {
            this.samples.shift()
        }
        if (this.samples.length < this.minSamples) return false
        let matches = 0
        for (const s of this.samples) {
            if (s.count === target) matches += 1
        }
        return matches / this.samples.length >= this.dominanceRatio
    }

    reset() {
        this.samples = []
    }
}

/**
 * Per-puzzle dispatcher. Most challenges use stateless detectors, but
 * a few maintain temporal state — those are passed in via `state` and
 * the caller is responsible for keeping the same instance across
 * frames.
 */
export interface HandPuzzleState {
    wave?: WaveDetector
    flip?: FlipDetector
    tap?: TapDetector
    peek?: PeekABooDetector
    shape?: ShapeTraceDetector
    /** Smooths per-frame finger counts so single-frame jitter doesn't
     *  reset the hold timer. Used by FINGER_COUNT and MATH. */
    countSmoother?: FingerCountSmoother
    /** Random target finger count for FINGER_COUNT / MATH puzzles. */
    targetFingerCount?: number
    /** For MATH: the human-readable prompt ("2 + 3"). */
    mathPrompt?: string
}

export interface HandPuzzleEvalInput {
    /** Latest hand frame, or null if no hand is currently visible. */
    frame: HandFrame | null
    state: HandPuzzleState
}

export interface HandPuzzleEvalResult {
    /** True if the gesture is currently being performed. */
    detected: boolean
    /** True once the puzzle's success criterion has fully been met. */
    completed: boolean
    /** Optional progress 0..100 for hold-style challenges. */
    progress?: number
}

/**
 * Generate a puzzle's per-session random parameters (target finger
 * count, math prompt, etc.). Call once on puzzle.start().
 */
export function initialHandState(id: BiometricPuzzleId): HandPuzzleState {
    const s: HandPuzzleState = {}
    switch (id) {
        case BiometricPuzzleId.HAND_FINGER_COUNT:
            // Pick a target between 1..5 inclusive.
            s.targetFingerCount = 1 + Math.floor(Math.random() * 5)
            s.countSmoother = new FingerCountSmoother()
            break
        case BiometricPuzzleId.HAND_MATH: {
            // Constrain so a+b lands in [2, 5] — one hand's 5 fingers max.
            const a = 1 + Math.floor(Math.random() * 4)
            const b = 1 + Math.floor(Math.random() * (5 - a))
            s.targetFingerCount = a + b
            s.mathPrompt = `${a} + ${b}`
            s.countSmoother = new FingerCountSmoother()
            break
        }
        case BiometricPuzzleId.HAND_WAVE:
            s.wave = new WaveDetector()
            break
        case BiometricPuzzleId.HAND_FLIP:
            s.flip = new FlipDetector()
            break
        case BiometricPuzzleId.HAND_FINGER_TAP:
            s.tap = new TapDetector()
            break
        case BiometricPuzzleId.HAND_PEEK_A_BOO:
            s.peek = new PeekABooDetector()
            break
        case BiometricPuzzleId.HAND_SHAPE_TRACE:
        case BiometricPuzzleId.HAND_TRACE_TEMPLATE:
            s.shape = new ShapeTraceDetector()
            break
        default:
            break
    }
    return s
}

/** How long the gesture must be held continuously, in ms. */
const HAND_HOLD_MS = 700

interface HoldTracker {
    detectedSince: number | null
}

/**
 * Evaluate a single frame against the chosen puzzle. The component
 * caller maintains a `HoldTracker` for the hold-style puzzles.
 */
export function evaluateHandPuzzle(
    id: BiometricPuzzleId,
    input: HandPuzzleEvalInput,
    hold: HoldTracker,
): HandPuzzleEvalResult {
    const { frame, state } = input
    const now = frame?.timestamp ?? performance.now()

    function holdResult(detected: boolean): HandPuzzleEvalResult {
        if (!detected) {
            hold.detectedSince = null
            return { detected: false, completed: false, progress: 0 }
        }
        if (hold.detectedSince == null) hold.detectedSince = now
        const heldMs = now - hold.detectedSince
        const progress = Math.min(100, (heldMs / HAND_HOLD_MS) * 100)
        return {
            detected: true,
            completed: heldMs >= HAND_HOLD_MS,
            progress,
        }
    }

    switch (id) {
        case BiometricPuzzleId.HAND_FINGER_COUNT:
        case BiometricPuzzleId.HAND_MATH: {
            const target = state.targetFingerCount ?? -1
            // Guard against an unset / negative target. Without this the
            // no-hand path (count = -1) trivially matches target = -1 and
            // the puzzle reports `detected` for an empty frame (Copilot
            // post-merge on PR #51). `initialHandState` always sets a
            // positive target, so this branch only fires if a caller
            // forgot to call it.
            if (target < 0) return { detected: false, completed: false }
            const smoother = state.countSmoother
            // Push -1 for no-hand frames so the dominance ratio drops; once
            // a hand reappears the smoother fills back up.
            const count = frame ? countFingers(frame) : -1
            const matched = smoother
                ? smoother.push(count, now, target)
                : count === target
            return holdResult(matched)
        }
        case BiometricPuzzleId.HAND_PINCH: {
            if (!frame) return holdResult(false)
            return holdResult(isPinching(frame))
        }
        case BiometricPuzzleId.HAND_WAVE: {
            if (!frame || !state.wave) return { detected: false, completed: false }
            const ok = state.wave.push(frame)
            return { detected: ok, completed: ok }
        }
        case BiometricPuzzleId.HAND_FLIP: {
            if (!frame || !state.flip) return { detected: false, completed: false }
            const ok = state.flip.push(frame)
            return { detected: ok, completed: ok }
        }
        case BiometricPuzzleId.HAND_FINGER_TAP: {
            if (!frame || !state.tap) return { detected: false, completed: false }
            const ok = state.tap.push(frame)
            return { detected: ok, completed: ok }
        }
        case BiometricPuzzleId.HAND_PEEK_A_BOO: {
            if (!state.peek) return { detected: false, completed: false }
            const ok = state.peek.push(frame)
            return { detected: ok, completed: ok }
        }
        case BiometricPuzzleId.HAND_SHAPE_TRACE:
        case BiometricPuzzleId.HAND_TRACE_TEMPLATE: {
            if (!frame || !state.shape) return { detected: false, completed: false }
            const ok = state.shape.push(frame)
            return { detected: ok, completed: ok }
        }
        default:
            return { detected: false, completed: false }
    }
}
