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

/** 3D Euclidean distance (z defaults to 0 when MediaPipe omits depth). */
function dist3(a: HandLandmark, b: HandLandmark): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    const dz = (a.z ?? 0) - (b.z ?? 0)
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Approximate hand "scale" — the wrist→middle-MCP distance — used to
 * normalise pinch/tap thresholds across camera distances.
 */
function handScale(lms: HandLandmark[]): number {
    return dist(lms[0], lms[9]) || 0.0001
}

/**
 * 3D hand scale: Dist(Wrist, MiddleMCP) in 3D. Normalisation baseline for
 * the finger-ratio metric ported from gesture_validator.py:hand_scale.
 */
function handScale3D(lms: HandLandmark[]): number {
    return dist3(lms[0], lms[9]) || 1e-4
}

// ============================================================================
// 4-LAYER FINGER PIPELINE (port of gesture_validator.py v6b)
//   Layer 1: Adaptive normalisation (3D hand_scale)
//   Layer 2: Hysteresis dual-threshold per finger
//   Layer 3: EWMA temporal smoothing
//   Layer 4: Moving-median of the per-frame count
// Plus a 2-second auto-calibration helper.
// ============================================================================

/** Finger indices 0..4 = thumb, index, middle, ring, pinky. */
const FINGERS = [0, 1, 2, 3, 4] as const
type FingerIdx = (typeof FINGERS)[number]

/** Per-finger (PIP, TIP) landmark indices for index..pinky. @see gesture_validator.py:_FINGER_JOINTS */
const FINGER_JOINTS: Record<Exclude<FingerIdx, 0>, [number, number]> = {
    1: [6, 8], // index
    2: [10, 12], // middle
    3: [14, 16], // ring
    4: [18, 20], // pinky
}

const THUMB_TIP = 4
const PINKY_MCP = 17
const WRIST = 0

/** Default open/close thresholds (tightened v6b values to reject the fist). */
const FINGER_OPEN_TH = 0.2
const FINGER_CLOSE_TH = 0.12
const THUMB_OPEN_TH = 0.75
const THUMB_CLOSE_TH = 0.6

/**
 * Normalised openness metric for one finger (v5 proven method).
 *   Index..Pinky: (Dist(Wrist,Tip) - Dist(Wrist,PIP)) / hand_scale
 *   Thumb:        Dist(ThumbTip, PinkyMCP) / hand_scale
 * @see gesture_validator.py:finger_ratio
 */
export function fingerRatio(lms: HandLandmark[], finger: FingerIdx): number {
    const hs = handScale3D(lms)
    if (hs < 1e-9) return 0
    if (finger === 0) {
        return dist3(lms[THUMB_TIP], lms[PINKY_MCP]) / hs
    }
    const [pip, tip] = FINGER_JOINTS[finger]
    const distTip = dist3(lms[WRIST], lms[tip])
    const distPip = dist3(lms[WRIST], lms[pip])
    return (distTip - distPip) / hs
}

/** Layer 2: per-finger hysteresis state machine. @see gesture_validator.py:_HysteresisState */
class HysteresisState {
    private state: Record<FingerIdx, boolean> = { 0: false, 1: false, 2: false, 3: false, 4: false }

    update(lms: HandLandmark[]): Record<FingerIdx, boolean> {
        for (const f of FINGERS) {
            const ratio = fingerRatio(lms, f)
            const isThumb = f === 0
            const openTh = isThumb ? THUMB_OPEN_TH : FINGER_OPEN_TH
            const closeTh = isThumb ? THUMB_CLOSE_TH : FINGER_CLOSE_TH
            if (this.state[f]) {
                if (ratio < closeTh) this.state[f] = false
            } else {
                if (ratio > openTh) this.state[f] = true
            }
        }
        return { ...this.state }
    }

    reset(): void {
        this.state = { 0: false, 1: false, 2: false, 3: false, 4: false }
    }
}

/** Layer 3: per-finger EWMA confidence; >0.5 = open. @see gesture_validator.py:_EWMASmoother */
class EWMASmoother {
    private conf: Record<FingerIdx, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
    constructor(private alpha = 0.35) {}

    update(hyst: Record<FingerIdx, boolean>): Record<FingerIdx, boolean> {
        const out = {} as Record<FingerIdx, boolean>
        for (const f of FINGERS) {
            const sample = hyst[f] ? 1 : 0
            this.conf[f] = this.alpha * sample + (1 - this.alpha) * this.conf[f]
            out[f] = this.conf[f] > 0.5
        }
        return out
    }

    reset(): void {
        this.conf = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
    }
}

/** Layer 4: moving median of recent counts. @see gesture_validator.py:_MedianFilter */
class MedianFilter {
    private buf: number[] = []
    constructor(private window = 5) {}

    filter(count: number): number {
        this.buf.push(count)
        if (this.buf.length > this.window) this.buf.shift()
        const sorted = [...this.buf].sort((a, b) => a - b)
        return sorted[Math.floor(sorted.length / 2)]
    }

    reset(): void {
        this.buf = []
    }
}

/**
 * Full 4-layer finger validator. Stateful across frames — the caller keeps
 * one instance per puzzle session. `countFingersStable` runs the whole
 * pipeline; `detectFingers` exposes the post-EWMA boolean vector.
 * @see gesture_validator.py:GestureValidator
 */
export class GestureValidator {
    private hysteresis = new HysteresisState()
    private smoother: EWMASmoother
    private median: MedianFilter

    constructor(ewmaAlpha = 0.35, medianWindow = 5) {
        this.smoother = new EWMASmoother(ewmaAlpha)
        this.median = new MedianFilter(medianWindow)
    }

    /** Hysteresis + EWMA boolean vector (no median). */
    detectFingers(lms: HandLandmark[]): Record<FingerIdx, boolean> {
        const hyst = this.hysteresis.update(lms)
        return this.smoother.update(hyst)
    }

    /** Full pipeline finger count (Adaptive + Hysteresis + EWMA + Median). */
    countFingersStable(lms: HandLandmark[]): number {
        const open = this.detectFingers(lms)
        let raw = 0
        for (const f of FINGERS) if (open[f]) raw += 1
        return this.median.filter(raw)
    }

    reset(): void {
        this.hysteresis.reset()
        this.smoother.reset()
        this.median.reset()
    }
}

/**
 * 2-second auto-calibration: collects per-finger ratio samples while the user
 * shows an open hand then a fist, then stores the per-finger average for
 * diagnostics. A lightweight port of gesture_validator.py:HandCalibrator —
 * the engine still uses the tightened default thresholds; calibration just
 * confirms the user's ratios separate cleanly.
 */
export class HandCalibrator {
    private start: number | null = null
    private samples: Record<FingerIdx, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] }
    private done = false
    private _offsets: Record<string, number> = {}

    constructor(private durationMs = 2000) {}

    get isDone(): boolean {
        return this.done
    }

    progress(now: number): number {
        if (this.start === null) return 0
        return Math.min((now - this.start) / this.durationMs, 1)
    }

    get offsets(): Record<string, number> {
        return this._offsets
    }

    feed(lms: HandLandmark[], now: number): void {
        if (this.done) return
        if (this.start === null) this.start = now
        for (const f of FINGERS) this.samples[f].push(fingerRatio(lms, f))
        if (now - this.start >= this.durationMs) {
            for (const f of FINGERS) {
                const vals = this.samples[f]
                if (vals.length) this._offsets[String(f)] = vals.reduce((a, b) => a + b, 0) / vals.length
            }
            this.done = true
        }
    }

    reset(): void {
        this.start = null
        this.samples = { 0: [], 1: [], 2: [], 3: [], 4: [] }
        this.done = false
        this._offsets = {}
    }
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

/**
 * Thumb-tip ↔ index-tip distance normalised by hand scale. Lower = closer to a
 * touch. Returns Infinity when landmarks are missing so a no-hand frame never
 * looks like a touch.
 */
export function tapDistance(frame: HandFrame): number {
    const lms = frame.landmarks
    if (lms.length < 21) return Infinity
    return dist(lms[4], lms[8]) / handScale(lms)
}

/**
 * TapTransitionTracker — the close→re-open EDGE detector for a finger TAP,
 * mirroring the face `BlinkTransitionTracker`. A tap is an EVENT, not a hold:
 * the thumb-tip touches the index-tip (distance drops below TOUCH) and then
 * RELEASES (distance rises back above RELEASE) within a short window. It fires
 * exactly once, on the RELEASE edge.
 *
 * The dual TOUCH/RELEASE thresholds form a hysteresis band that rejects
 * boundary chatter (a single jittering threshold counts a held pinch as many
 * spurious taps). The `maxTouchFrames` window means a sustained PINCH-and-HOLD
 * (the separate HAND_PINCH challenge) is NOT counted as a tap — a real tap is
 * brief.
 *
 * @see lib/biometric-engine/core/challenges/blinkTransition.ts (BlinkTransitionTracker)
 */
/** Distance (normalised by hand scale) below which thumb+index are "touching". */
export const TAP_TOUCH_THRESHOLD = 0.35
/** Distance above which a touch is considered RELEASED (hysteresis band). */
export const TAP_RELEASE_THRESHOLD = 0.6
/** Min consecutive touching frames before a release can count (rejects 1-frame noise). */
export const TAP_CONSECUTIVE_FRAMES = 2
/** Max touching frames still counted as a tap — beyond this it's a PINCH-hold, not a tap. */
export const TAP_MAX_TOUCH_FRAMES = 20

export class TapTransitionTracker {
    private touchingFrames = 0

    constructor(
        private readonly touchThreshold: number = TAP_TOUCH_THRESHOLD,
        private readonly releaseThreshold: number = TAP_RELEASE_THRESHOLD,
        private readonly consecutiveFrames: number = TAP_CONSECUTIVE_FRAMES,
        private readonly maxTouchFrames: number = TAP_MAX_TOUCH_FRAMES,
    ) {}

    reset(): void {
        this.touchingFrames = 0
    }

    /** True while the fingers are currently touching (touch phase). */
    isTouching(distance: number): boolean {
        return distance < this.touchThreshold
    }

    /**
     * Feed one frame's normalised tap distance. Returns `true` exactly once —
     * on the frame the fingers RELEASE (distance ≥ releaseThreshold) after
     * having touched for ≥ consecutiveFrames and ≤ maxTouchFrames.
     */
    update(distance: number): boolean {
        if (distance < this.touchThreshold) {
            // Touch phase. Cap the counter so a long hold can't satisfy a tap on
            // release — a hold is the PINCH challenge, not a tap.
            this.touchingFrames = Math.min(this.touchingFrames + 1, this.maxTouchFrames + 1)
            return false
        }

        if (distance >= this.releaseThreshold) {
            const released =
                this.touchingFrames >= this.consecutiveFrames &&
                this.touchingFrames <= this.maxTouchFrames
            this.touchingFrames = 0
            return released
        }

        // In the hysteresis dead-band: neither a clear touch nor a clear
        // release. Hold the current touch count (don't reset) so boundary
        // flicker doesn't abort an in-progress tap.
        return false
    }
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
 * Frequency-gated wave detector (port of motion_analyzer.py:WaveDetector).
 *
 * A wave is valid only when ALL of these hold over the buffer:
 *   1. Total wrist-X displacement > `minTotalDisp` (default 0.20 of frame).
 *   2. At least `minReversals` direction changes, each with a swing
 *      ≥ `minSwing` (after 3-sample moving-average smoothing).
 *   3. The oscillation frequency falls in [`minFreqHz`, `maxFreqHz`] — this
 *      rejects both a slow drift and frantic random shaking, which the old
 *      swing-count-only detector accepted.
 */
export class WaveDetector {
    private data: { t: number; x: number }[] = []
    private bufferSize: number
    private minSwing: number
    private minTotalDisp: number
    private minReversals: number
    private minFreq: number
    private maxFreq: number

    constructor(
        bufferSize = 40,
        minSwing = 0.1,
        minTotalDisp = 0.2,
        minReversals = 2,
        minFreqHz = 1.0,
        maxFreqHz = 4.0,
    ) {
        this.bufferSize = bufferSize
        this.minSwing = minSwing
        this.minTotalDisp = minTotalDisp
        this.minReversals = minReversals
        this.minFreq = minFreqHz
        this.maxFreq = maxFreqHz
    }

    push(frame: HandFrame): boolean {
        const lms = frame.landmarks
        if (lms.length < 21) return false
        // Store seconds for the frequency calc.
        this.data.push({ t: frame.timestamp / 1000, x: lms[0].x })
        if (this.data.length > this.bufferSize) this.data.shift()
        return this.isWaving()
    }

    isWaving(): boolean {
        const [nReversals, extremaTimes] = this.findExtrema()
        if (nReversals < this.minReversals) return false

        // Total displacement gate.
        const xs = this.data.map((d) => d.x)
        const totalDisp = Math.max(...xs) - Math.min(...xs)
        if (totalDisp < this.minTotalDisp) return false

        // Frequency gate.
        if (extremaTimes.length >= 2) {
            const duration = extremaTimes[extremaTimes.length - 1] - extremaTimes[0]
            if (duration > 0) {
                const halfCycleFreq = nReversals / duration // reversals/sec
                const fullFreq = halfCycleFreq / 2
                if (fullFreq < this.minFreq || fullFreq > this.maxFreq) return false
            }
        }
        return true
    }

    /** @returns [reversalCount, extremaTimestamps] */
    private findExtrema(): [number, number[]] {
        if (this.data.length < 5) return [0, []]
        const raw = this.data.map((d) => d.x)
        const times = this.data.map((d) => d.t)

        // 3-sample moving-average smoothing.
        const smoothed: number[] = [raw[0]]
        for (let i = 1; i < raw.length - 1; i++) {
            smoothed.push((raw[i - 1] + raw[i] + raw[i + 1]) / 3)
        }
        smoothed.push(raw[raw.length - 1])

        const extremaTs: number[] = []
        let lastExtremeVal = smoothed[0]
        let goingPositive: boolean | null = null

        for (let i = 1; i < smoothed.length; i++) {
            const dx = smoothed[i] - smoothed[i - 1]
            if (Math.abs(dx) < 0.002) continue
            const currentDir = dx > 0
            if (goingPositive === null) {
                goingPositive = currentDir
                continue
            }
            if (currentDir !== goingPositive) {
                const peakVal = smoothed[i - 1]
                const swing = Math.abs(peakVal - lastExtremeVal)
                if (swing >= this.minSwing) {
                    extremaTs.push(times[i - 1])
                    lastExtremeVal = peakVal
                }
                goingPositive = currentDir
            }
        }
        return [extremaTs.length, extremaTs]
    }

    reset() {
        this.data = []
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
 * Detect a finger TAP — an EVENT, not a hold. A tap is a touch→release EDGE:
 * thumb-tip and index-tip come together (distance below TOUCH) and then SEPARATE
 * again (distance back above RELEASE) within a brief window. Counted once per
 * release edge by `TapTransitionTracker` (the same close→re-open pattern the
 * face blink detector uses), so it cannot be satisfied by holding a pinch
 * (that's the separate HAND_PINCH challenge) and isn't fooled by boundary
 * chatter.
 *
 * Completes after `requiredTaps` release edges. Default is a SINGLE deliberate
 * tap — the previous 0.6s/4-tap models were fiddly; one clean touch-and-release
 * is enough liveness signal and far more reliable on real webcams.
 */
export class TapDetector {
    private tracker = new TapTransitionTracker()
    private taps = 0
    private events: number[] = []
    private windowMs: number
    private requiredTaps: number

    constructor(windowMs = 4000, requiredTaps = 1) {
        this.windowMs = windowMs
        this.requiredTaps = requiredTaps
    }

    push(frame: HandFrame): boolean {
        const ts = frame.timestamp
        if (this.tracker.update(tapDistance(frame))) {
            this.events.push(ts)
        }
        // Keep only release edges inside the rolling window.
        while (this.events.length && ts - this.events[0] > this.windowMs) {
            this.events.shift()
        }
        this.taps = this.events.length
        return this.taps >= this.requiredTaps
    }

    reset() {
        this.tracker.reset()
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

// ============================================================================
// DTW SHAPE MATCHING (port of shape_tracer.py)
//   Resample → centroid-normalise → DTW alignment cost → accept if ≤ threshold.
//   Used by HAND_TRACE_TEMPLATE to match a specific random target shape, which
//   differentiates it from HAND_SHAPE_TRACE's free-form "draw any closed loop".
// ============================================================================

type Point = [number, number]

export type ShapeTemplateId = 'CIRCLE' | 'SQUARE' | 'TRIANGLE' | 'S_CURVE'

export interface ShapeTemplate {
    id: ShapeTemplateId
    /** Ordered waypoints in normalised [0,1]² screen coords. */
    waypoints: Point[]
}

/** Circle traced clockwise from the 3-o'clock position. @see shape_tracer.py:_circle_template */
function circleTemplate(cx = 0.5, cy = 0.5, r = 0.18, n = 48): ShapeTemplate {
    const pts: Point[] = []
    for (let i = 0; i <= n; i++) {
        const a = (2 * Math.PI * i) / n
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    }
    return { id: 'CIRCLE', waypoints: pts }
}

/** Closed rectangle traced clockwise from top-left. @see shape_tracer.py:_square_template */
function squareTemplate(l = 0.32, t = 0.3, r = 0.68, b = 0.7): ShapeTemplate {
    return { id: 'SQUARE', waypoints: [[l, t], [r, t], [r, b], [l, b], [l, t]] }
}

/** Isosceles triangle: top → bottom-right → bottom-left → top. @see shape_tracer.py:_triangle_template */
function triangleTemplate(cx = 0.5, ty = 0.25, by = 0.72, hw = 0.22): ShapeTemplate {
    return { id: 'TRIANGLE', waypoints: [[cx, ty], [cx + hw, by], [cx - hw, by], [cx, ty]] }
}

/** S-curve from two opposing quarter-arcs, top-to-bottom. @see shape_tracer.py:_s_curve_template */
function sCurveTemplate(): ShapeTemplate {
    const pts: Point[] = []
    for (let i = 0; i < 9; i++) {
        const a = Math.PI + (Math.PI / 2) * (i / 8)
        pts.push([0.62 + 0.14 * Math.cos(a), 0.375 + 0.125 * Math.sin(a)])
    }
    for (let i = 0; i < 9; i++) {
        const a = Math.PI * 2 + (Math.PI / 2) * (i / 8)
        pts.push([0.38 + 0.14 * Math.cos(a), 0.625 + 0.125 * Math.sin(a)])
    }
    return { id: 'S_CURVE', waypoints: pts }
}

export const SHAPE_TEMPLATES: ShapeTemplate[] = [
    circleTemplate(),
    squareTemplate(),
    triangleTemplate(),
    sCurveTemplate(),
]

/** Pick one of the four templates at random (for HAND_TRACE_TEMPLATE). */
export function randomShapeTemplate(): ShapeTemplate {
    return SHAPE_TEMPLATES[Math.floor(Math.random() * SHAPE_TEMPLATES.length)]
}

/** Resample a polyline to exactly n arc-length-even points. @see shape_tracer.py:_resample */
export function resamplePath(path: Point[], n: number): Point[] {
    if (path.length === 0) return Array.from({ length: n }, () => [0, 0] as Point)
    if (path.length === 1) return Array.from({ length: n }, () => path[0])

    const dists: number[] = [0]
    for (let i = 1; i < path.length; i++) {
        const dx = path[i][0] - path[i - 1][0]
        const dy = path[i][1] - path[i - 1][1]
        dists.push(dists[dists.length - 1] + Math.sqrt(dx * dx + dy * dy))
    }
    const total = dists[dists.length - 1]
    if (total < 1e-9) return Array.from({ length: n }, () => path[0])

    const out: Point[] = []
    let j = 0
    for (let k = 0; k < n; k++) {
        const target = (k * total) / (n - 1)
        while (j < dists.length - 2 && dists[j + 1] < target) j += 1
        const seg = dists[j + 1] - dists[j]
        const t = seg > 1e-9 ? (target - dists[j]) / seg : 0
        out.push([
            path[j][0] + t * (path[j + 1][0] - path[j][0]),
            path[j][1] + t * (path[j + 1][1] - path[j][1]),
        ])
    }
    return out
}

/** Translate to centroid, scale by max radius → translation+scale invariant. @see shape_tracer.py:_centroid_normalise */
export function centroidNormalise(path: Point[]): Point[] {
    const n = path.length
    if (n === 0) return []
    const cx = path.reduce((s, p) => s + p[0], 0) / n
    const cy = path.reduce((s, p) => s + p[1], 0) / n
    const centred: Point[] = path.map((p) => [p[0] - cx, p[1] - cy])
    let maxR = 0
    for (const [x, y] of centred) maxR = Math.max(maxR, Math.sqrt(x * x + y * y))
    if (maxR < 1e-9) maxR = 1
    return centred.map(([x, y]) => [x / maxR, y / maxR])
}

/**
 * DTW alignment cost normalised by path length (per-point average distance).
 * Both inputs should already be resampled to the same length. @see shape_tracer.py:dtw_normalised_cost
 */
export function dtwNormalisedCost(a: Point[], b: Point[]): number {
    const n = a.length
    const m = b.length
    if (n === 0 || m === 0) return Infinity

    const INF = Infinity
    // (n+1) x (m+1) DP table with INF borders.
    const prev = new Array<number>(m + 1).fill(INF)
    const curr = new Array<number>(m + 1).fill(INF)
    prev[0] = 0

    for (let i = 1; i <= n; i++) {
        curr.fill(INF)
        for (let j = 1; j <= m; j++) {
            const dx = a[i - 1][0] - b[j - 1][0]
            const dy = a[i - 1][1] - b[j - 1][1]
            const cost = Math.sqrt(dx * dx + dy * dy)
            curr[j] = cost + Math.min(prev[j], curr[j - 1], prev[j - 1])
        }
        for (let j = 0; j <= m; j++) prev[j] = curr[j]
    }
    return prev[m] / Math.max(n, m)
}

/** Default normalised per-point DTW cost accepted as a valid trace. @see shape_tracer.py:DEFAULT_DTW_THRESH */
const DEFAULT_DTW_THRESH = 0.25
/** Number of resampled points for DTW. @see shape_tracer.py:DEFAULT_RESAMPLE_N */
const DEFAULT_RESAMPLE_N = 50

/**
 * Compute the normalised DTW cost between a traced path and a template,
 * applying resample + centroid-normalise to both. Lower is better;
 * a result ≤ `DEFAULT_DTW_THRESH` is a match.
 */
export function shapeTraceCost(tracedPath: Point[], template: ShapeTemplate): number {
    const a = centroidNormalise(resamplePath(tracedPath, DEFAULT_RESAMPLE_N))
    const b = centroidNormalise(resamplePath(template.waypoints, DEFAULT_RESAMPLE_N))
    return dtwNormalisedCost(a, b)
}

/**
 * Template-trace detector (HAND_TRACE_TEMPLATE): the user must trace a SPECIFIC
 * target shape (circle / square / triangle / S-curve). Records the
 * index-fingertip path while pointing and, once enough points are collected,
 * accepts when the DTW cost against the assigned template is below threshold.
 *
 * This is deliberately stricter than the free-form ShapeTraceDetector
 * (HAND_SHAPE_TRACE) — it checks the SHAPE, not just "drew a closed loop".
 */
export class TemplateTraceDetector {
    private path: Point[] = []
    private windowMs: number
    readonly template: ShapeTemplate
    private dtwThreshold: number
    private minPoints: number

    constructor(template?: ShapeTemplate, windowMs = 10000, dtwThreshold = DEFAULT_DTW_THRESH, minPoints = 25) {
        this.template = template ?? randomShapeTemplate()
        this.windowMs = windowMs
        this.dtwThreshold = dtwThreshold
        this.minPoints = minPoints
    }

    /** Last computed DTW cost (for UI / progress). Infinity until evaluated. */
    lastCost = Infinity

    push(frame: HandFrame): boolean {
        const lms = frame.landmarks
        if (lms.length < 21) return false
        if (!isIndexExtended(frame)) {
            // Not pointing — discard the partial trace.
            this.path = []
            return false
        }
        const tip = lms[8]
        this.path.push([tip.x, tip.y])
        // Bound the buffer by time via a coarse point cap (~windowMs at 30fps).
        const maxPoints = Math.ceil((this.windowMs / 1000) * 30)
        if (this.path.length > maxPoints) this.path.shift()

        if (this.path.length < this.minPoints) return false

        this.lastCost = shapeTraceCost(this.path, this.template)
        return this.lastCost <= this.dtwThreshold
    }

    reset() {
        this.path = []
        this.lastCost = Infinity
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
    /** Free-form closed-loop trace (HAND_SHAPE_TRACE). */
    shape?: ShapeTraceDetector
    /** DTW match against a specific target shape (HAND_TRACE_TEMPLATE). */
    templateTrace?: TemplateTraceDetector
    /** 4-layer finger validator (Adaptive + Hysteresis + EWMA + Median). Used
     *  by FINGER_COUNT and MATH — replaces the old per-frame countFingers +
     *  FingerCountSmoother with the full gesture_validator.py pipeline. */
    validator?: GestureValidator
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
            s.validator = new GestureValidator()
            break
        case BiometricPuzzleId.HAND_MATH: {
            // Constrain so a+b lands in [2, 5] — one hand's 5 fingers max.
            const a = 1 + Math.floor(Math.random() * 4)
            const b = 1 + Math.floor(Math.random() * (5 - a))
            s.targetFingerCount = a + b
            s.mathPrompt = `${a} + ${b}`
            s.validator = new GestureValidator()
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
            // Free-form: draw any closed loop.
            s.shape = new ShapeTraceDetector()
            break
        case BiometricPuzzleId.HAND_TRACE_TEMPLATE:
            // Specific target shape matched via DTW.
            s.templateTrace = new TemplateTraceDetector()
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
            // 4-layer validator (Adaptive + Hysteresis + EWMA + Median). When a
            // hand is present we run the full pipeline; a missing hand feeds a
            // -1 raw count so the median decays and never matches a real target.
            const validator = state.validator
            let count: number
            if (frame) {
                count = validator
                    ? validator.countFingersStable(frame.landmarks)
                    : countFingers(frame)
            } else {
                count = -1
            }
            return holdResult(count === target)
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
        case BiometricPuzzleId.HAND_SHAPE_TRACE: {
            // Free-form: any closed loop with enough arc length.
            if (!frame || !state.shape) return { detected: false, completed: false }
            const ok = state.shape.push(frame)
            return { detected: ok, completed: ok }
        }
        case BiometricPuzzleId.HAND_TRACE_TEMPLATE: {
            // Specific target shape matched via DTW.
            if (!frame || !state.templateTrace) return { detected: false, completed: false }
            const ok = state.templateTrace.push(frame)
            return { detected: ok, completed: ok }
        }
        default:
            return { detected: false, completed: false }
    }
}
