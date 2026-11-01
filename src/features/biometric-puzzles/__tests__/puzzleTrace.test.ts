/**
 * PUZZLE contract v2 landmark-trace recorder (puzzleTrace.ts).
 *
 * The wire format must match biometric-processor `PuzzleTrace`
 * (`app/api/schemas/puzzle_session.py`): ints in 1e-4 units, 32 face landmarks
 * (FACE_TRACE_INDICES order) or 21 hand landmarks per frame, ≤ 200 frames.
 */
import { describe, it, expect } from 'vitest'
import {
    FACE_TRACE_INDICES,
    PuzzleTraceRecorder,
    TRACE_MAX_FRAMES,
    TRACE_MIN_INTERVAL_MS,
    TRACE_WINDOW_MS,
    encodeBindingFrame,
    encodePoints,
    tracePayloadBytes,
} from '../puzzleTrace'

function mesh(seed: number): { x: number; y: number; z: number }[] {
    // 478 points with small per-frame variation (stands in for MediaPipe jitter).
    return Array.from({ length: 478 }, (_, i) => ({
        x: 0.3 + ((i * 37) % 400) / 1000 + Math.sin(seed * 1.7 + i) * 0.0008,
        y: 0.2 + ((i * 53) % 500) / 1000 + Math.cos(seed * 1.3 + i) * 0.0008,
        z: -0.05 + ((i * 11) % 100) / 1000,
    }))
}

function hand(seed: number): { x: number; y: number; z: number }[] {
    return Array.from({ length: 21 }, (_, i) => ({
        x: 0.4 + i * 0.01 + Math.sin(seed + i) * 0.001,
        y: 0.6 - i * 0.01,
        z: -0.01 * (i % 4),
    }))
}

describe('puzzleTrace — encoding', () => {
    it('FACE_TRACE_INDICES mirrors bio (32 sorted unique indices)', () => {
        expect(FACE_TRACE_INDICES).toHaveLength(32)
        expect([...FACE_TRACE_INDICES]).toEqual([...new Set(FACE_TRACE_INDICES)].sort((a, b) => a - b))
    })

    it('encodes x,y,z as ints in 1e-4 units, clamped to ±20000', () => {
        expect(encodePoints([{ x: 0.12345, y: -0.5, z: 3 }])).toEqual([1235, -5000, 20000])
        expect(encodePoints([{ x: 0.1, y: 0.2 }])).toEqual([1000, 2000, 0])
    })

    it('returns null when a requested face index is missing', () => {
        expect(encodePoints([{ x: 0, y: 0, z: 0 }], [0, 5])).toBeNull()
    })

    it('binding frame carries the 96 trace-subset ints + rounded timestamp', () => {
        const b = encodeBindingFrame(mesh(1), 1234.6)
        expect(b?.t).toBe(1235)
        expect(b?.f).toHaveLength(96)
    })
})

describe('PuzzleTraceRecorder', () => {
    it('down-samples to ≥ TRACE_MIN_INTERVAL_MS and drops repeated frames', () => {
        const r = new PuzzleTraceRecorder('face')
        r.setFrameSize(640, 480)
        expect(r.push(1000, mesh(1))).toBe(true)
        expect(r.push(1000 + TRACE_MIN_INTERVAL_MS - 1, mesh(2))).toBe(false)
        expect(r.push(1000 + TRACE_MIN_INTERVAL_MS, mesh(1))).toBe(false) // identical to previous
        expect(r.push(1000 + TRACE_MIN_INTERVAL_MS, mesh(3))).toBe(true)
        expect(r.length).toBe(2)
    })

    it('force-records the completing frame inside the min interval', () => {
        const r = new PuzzleTraceRecorder('face')
        r.setFrameSize(640, 480)
        r.push(1000, mesh(1))
        expect(r.push(1010, mesh(2), true)).toBe(true)
        expect(r.lastTimestamp).toBe(1010)
    })

    it('keeps only the last TRACE_WINDOW_MS until frozen, then keeps the tail', () => {
        const r = new PuzzleTraceRecorder('face')
        r.setFrameSize(640, 480)
        for (let k = 0; k < 200; k++) r.push(k * 50, mesh(k))
        const p = r.toPayload()!
        expect(p.frames[p.frames.length - 1].t - p.frames[0].t).toBeLessThanOrEqual(TRACE_WINDOW_MS)
        r.freezeWindow()
        const first = r.firstTimestamp
        for (let k = 200; k < 230; k++) r.push(k * 50, mesh(k))
        expect(r.firstTimestamp).toBe(first)
        expect(r.length).toBeLessThanOrEqual(TRACE_MAX_FRAMES)
    })

    it('emits the bio wire shape for face and hand traces', () => {
        const f = new PuzzleTraceRecorder('face')
        f.setFrameSize(640, 480)
        f.push(1000, mesh(1))
        const fp = f.toPayload()!
        expect(fp).toMatchObject({ version: 2, frame_width: 640, frame_height: 480 })
        expect(fp.frames[0].f).toHaveLength(96)

        const h = new PuzzleTraceRecorder('hand')
        h.setFrameSize(640, 480)
        h.push(1000, hand(1))
        h.push(1050, null) // no hand visible (peek-a-boo reveal)
        const hp = h.toPayload()!
        expect(hp.frames[0].h).toHaveLength(63)
        expect(hp.frames[1].h).toBeNull()
    })

    it('returns null without a frame size or frames', () => {
        const r = new PuzzleTraceRecorder('face')
        expect(r.toPayload()).toBeNull()
        r.push(1, mesh(1))
        expect(r.toPayload()).toBeNull()
    })

    it('payload size per challenge is small (reported)', () => {
        const face = new PuzzleTraceRecorder('face')
        face.setFrameSize(640, 480)
        for (let k = 0; k < 50; k++) face.push(k * TRACE_MIN_INTERVAL_MS, mesh(k)) // 2 s @ 25 fps
        const hnd = new PuzzleTraceRecorder('hand')
        hnd.setFrameSize(640, 480)
        for (let k = 0; k < 50; k++) hnd.push(k * TRACE_MIN_INTERVAL_MS, hand(k))
        const faceBytes = tracePayloadBytes(face.toPayload())
        const handBytes = tracePayloadBytes(hnd.toPayload())
        // eslint-disable-next-line no-console -- reported payload size (docs)
        console.info(`v2 trace bytes (2 s @25 fps): face=${faceBytes} hand=${handBytes}`)
        expect(faceBytes).toBeLessThan(30_000)
        expect(handBytes).toBeLessThan(20_000)
    })
})
