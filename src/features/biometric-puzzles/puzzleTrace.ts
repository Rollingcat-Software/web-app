/**
 * puzzleTrace — landmark-trace capture for the PUZZLE session contract v2.
 *
 * Contract v1 sent ONE client-computed scalar per challenge (e.g. `{ ear: 0.18 }`)
 * and the server only thresholded it, so a modified client could forge a pass.
 * When the server advertises `trace_contract: 'v2'` on session CREATE (bio flag
 * `PUZZLE_TRACE_V2_ENABLED`), each SUBMIT instead carries a compact, timestamped
 * landmark trace and bio RECOMPUTES the metric, the temporal shape (blink =
 * open→closed→open, head turn = rest→excursion→return, …), the step duration
 * and basic plausibility (jitter, velocity) itself. See biometric-processor
 * `app/application/services/puzzle_trace_verifier.py`.
 *
 * Wire format (must match bio `PuzzleTrace`):
 *   { version: 2, frame_width, frame_height,
 *     frames: [{ t: <ms, performance.now()>, f?: int[96] | h?: int[63] | null }] }
 *   - face `f`: the 32 landmarks in `FACE_TRACE_INDICES` order, flat x,y,z;
 *   - hand `h`: the 21 MediaPipe hand landmarks, flat x,y,z, or `null` when no
 *     hand was visible (peek-a-boo's reveal is the absence of the hand);
 *   - every coordinate is an int in 1e-4 units of the normalised coordinate.
 *
 * Size: ≈0.5 KB per face frame and ≈0.3 KB per hand frame; at the ≤25 fps
 * sampling below a typical challenge is 10–25 KB (bio test
 * `test_payload_size_per_challenge_is_bounded`).
 */

/** MediaPipe 478-mesh indices a face trace frame carries, in wire order.
 *  Mirrors bio `FACE_TRACE_INDICES`; the server also advertises the list on
 *  CREATE (`trace_face_indices`), which takes precedence when present. */
export const FACE_TRACE_INDICES: readonly number[] = [
    1, 10, 13, 14, 33, 61, 63, 66, 70, 105, 107, 133, 144, 152, 153, 158,
    160, 168, 234, 263, 291, 293, 296, 300, 334, 336, 362, 373, 380, 385,
    387, 454,
]

export const TRACE_CONTRACT_V2 = 'v2'
const COORD_SCALE = 1e4
const COORD_ABS_MAX = 20_000
/** Minimum interval between recorded frames (≤ 25 fps keeps blinks sampled). */
export const TRACE_MIN_INTERVAL_MS = 40
/** Keep at most this much history before the completing frame. */
export const TRACE_WINDOW_MS = 4_000
/** Hard frame cap (bio rejects > 200). */
export const TRACE_MAX_FRAMES = 190

export interface TracePoint {
    x: number
    y: number
    z?: number
}

export interface PuzzleTraceFrame {
    t: number
    f?: number[]
    h?: number[] | null
}

export interface PuzzleTracePayload {
    version: 2
    frame_width: number
    frame_height: number
    frames: PuzzleTraceFrame[]
}

/** Split-capture binding frame: the frame the identity embedding came from. */
export interface PuzzleBindingFrame {
    t: number
    f: number[]
}

function q(v: number | undefined): number {
    const n = Math.round((v ?? 0) * COORD_SCALE)
    return Math.max(-COORD_ABS_MAX, Math.min(COORD_ABS_MAX, n))
}

/** Encode selected landmarks as the flat int wire form (x,y,z per point). */
export function encodePoints(
    landmarks: readonly TracePoint[],
    indices?: readonly number[],
): number[] | null {
    const out: number[] = []
    if (indices) {
        for (const i of indices) {
            const p = landmarks[i]
            if (!p) return null
            out.push(q(p.x), q(p.y), q(p.z))
        }
    } else {
        for (const p of landmarks) out.push(q(p.x), q(p.y), q(p.z))
    }
    return out
}

function sameInts(a: number[] | null | undefined, b: number[] | null | undefined): boolean {
    if (!a || !b || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
}

/**
 * Rolling recorder for one challenge attempt. Frames are down-sampled to
 * ≥ `TRACE_MIN_INTERVAL_MS` apart, bit-identical repeats (the same video frame
 * processed twice by rAF) are dropped, and only the last `TRACE_WINDOW_MS`
 * before the completing frame (plus any return tail) is kept.
 */
export class PuzzleTraceRecorder {
    private frames: PuzzleTraceFrame[] = []
    private lastT = -Infinity
    private frozenStart: number | null = null
    private width = 0
    private height = 0

    constructor(
        private readonly modality: 'face' | 'hand',
        private readonly faceIndices: readonly number[] = FACE_TRACE_INDICES,
    ) {}

    reset(): void {
        this.frames = []
        this.lastT = -Infinity
        this.frozenStart = null
    }

    setFrameSize(width: number, height: number): void {
        if (width > 0 && height > 0) {
            this.width = Math.round(width)
            this.height = Math.round(height)
        }
    }

    get length(): number {
        return this.frames.length
    }

    /** Timestamp of the most recently recorded frame (or null). When a forced
     *  push was dropped as a bit-identical repeat, this is the identical
     *  earlier frame — the right anchor for a binding frame. */
    get lastTimestamp(): number | null {
        return this.frames.length ? this.frames[this.frames.length - 1].t : null
    }

    /** Timestamp of the oldest frame still in the window (or null). */
    get firstTimestamp(): number | null {
        return this.frames.length ? this.frames[0].t : null
    }

    /**
     * Record one processed frame. `force` records it even inside the min
     * interval (used for the completing frame so the binding frame and the
     * gesture's decisive frame are always present).
     */
    push(t: number, landmarks: readonly TracePoint[] | null, force = false): boolean {
        const ts = Math.round(t)
        if (ts <= this.lastT) return false
        if (!force && ts - this.lastT < TRACE_MIN_INTERVAL_MS) return false
        let frame: PuzzleTraceFrame
        if (this.modality === 'face') {
            if (!landmarks) return false
            const f = encodePoints(landmarks, this.faceIndices)
            if (!f) return false
            const prev = this.frames[this.frames.length - 1]
            if (prev && sameInts(prev.f, f)) return false
            frame = { t: ts, f }
        } else {
            const h = landmarks && landmarks.length >= 21 ? encodePoints(landmarks.slice(0, 21)) : null
            const prev = this.frames[this.frames.length - 1]
            if (prev && h && sameInts(prev.h ?? null, h)) return false
            frame = { t: ts, h }
        }
        this.frames.push(frame)
        this.lastT = ts
        if (this.frozenStart === null) {
            // Rolling window: drop history older than TRACE_WINDOW_MS.
            while (this.frames.length > 1 && ts - this.frames[0].t > TRACE_WINDOW_MS) {
                this.frames.shift()
            }
        }
        while (this.frames.length > TRACE_MAX_FRAMES) this.frames.shift()
        return true
    }

    /** Stop trimming the window (the gesture completed; a return tail follows). */
    freezeWindow(): void {
        if (this.frozenStart === null) this.frozenStart = this.frames[0]?.t ?? 0
    }

    toPayload(): PuzzleTracePayload | null {
        if (!this.frames.length || !this.width || !this.height) return null
        return {
            version: 2,
            frame_width: this.width,
            frame_height: this.height,
            frames: this.frames.map((f) => ({ ...f })),
        }
    }
}

/** Build the split-capture binding frame from the embedding's source landmarks. */
export function encodeBindingFrame(
    landmarks: readonly TracePoint[],
    t: number,
    faceIndices: readonly number[] = FACE_TRACE_INDICES,
): PuzzleBindingFrame | null {
    const f = encodePoints(landmarks, faceIndices)
    return f ? { t: Math.round(t), f } : null
}

/** Compact JSON byte size of a payload (for diagnostics / tests). */
export function tracePayloadBytes(payload: unknown): number {
    return new TextEncoder().encode(JSON.stringify(payload)).length
}
