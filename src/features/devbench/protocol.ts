/**
 * Paper A device benchmark protocol: the single definition of what one run measures.
 *
 * Same protocol as the earlier "fivucsas devbench artifact v3" page, so results stay
 * comparable: Facenet512 FP16, onnxruntime-web 1.18.0, WASM execution provider with
 * one thread, a fixed synthetic 1x160x160x3 input, then cold session create, first
 * inference and {@link WARM_RUNS} warm inferences summarised as p50/p95.
 */
import {
    DEFAULT_FACENET_MODEL_SHA256,
    DEFAULT_FACENET_MODEL_URL,
} from '@features/biometrics/embedding/facenetEmbedder'
import { FACENET_INPUT_DIMS } from '@features/biometrics/embedding/facePreprocess'

export const TOOL = 'fivucsas devbench app v1'
export const SOURCE = 'app'
export const ORT_VERSION = '1.18.0'
export const ORT_WASM_PATHS = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`
export const MODEL_URL = DEFAULT_FACENET_MODEL_URL
export const MODEL_SHA256 = DEFAULT_FACENET_MODEL_SHA256
export const MODEL_BYTES = 47_072_627
export const INPUT_DIMS: readonly number[] = FACENET_INPUT_DIMS
export const WARM_RUNS = 30
export const RUNS_PER_VISIT = 3
export const COUNTDOWN_SECONDS = 5
export const PARTICIPANT_MAX_CHARS = 60

/** Two decimals, null stays null. */
export const r2 = (x: number | null | undefined): number | null =>
    x == null ? null : Math.round(x * 100) / 100

/** Linear-interpolated percentile, p in [0, 1]. */
export function percentile(values: readonly number[], p: number): number {
    if (values.length === 0) throw new Error('percentile of an empty list')
    const s = [...values].sort((a, b) => a - b)
    const i = (s.length - 1) * p
    const lo = Math.floor(i)
    const hi = Math.ceil(i)
    return s[lo] + (s[hi] - s[lo]) * (i - lo)
}

export interface WarmSummary {
    n: number
    p50: number | null
    p95: number | null
    mean: number | null
    min: number | null
    max: number | null
    all: (number | null)[]
}

export function summariseWarm(samples: readonly number[]): WarmSummary {
    return {
        n: samples.length,
        p50: r2(percentile(samples, 0.5)),
        p95: r2(percentile(samples, 0.95)),
        mean: r2(samples.reduce((a, b) => a + b, 0) / samples.length),
        min: r2(Math.min(...samples)),
        max: r2(Math.max(...samples)),
        all: samples.map(r2),
    }
}

/**
 * The fixed pseudo-random input (seed 12345), value for value identical to the artifact
 * pages. Keep the plain float multiply: it loses precision above 2^53 exactly as the
 * artifact did, and Math.imul would produce a different sequence.
 */
export function makeInput(dims: readonly number[] = INPUT_DIMS): Float32Array {
    const n = dims.reduce((a, b) => a * b, 1)
    const d = new Float32Array(n)
    let s = 12345
    for (let i = 0; i < n; i++) {
        s = (s * 1103515245 + 12345) >>> 0
        d[i] = (s >>> 8) / 16777216
    }
    return d
}

/** One normalised id per physical device (browser names stripped), as in the artifact. */
const DEVICE_ALIAS: Record<string, string> = { 'hp-victus-gaming': 'hp-victus', 'brawe-hp-pc': 'hp-victus' }

export function deviceKey(label: string | null | undefined): string {
    let s = String(label ?? '').toLowerCase()
    s = s.replace(/\b(google chrome|chrome|safari|firefox|edge|brave|opera)\b/g, ' ')
    s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return DEVICE_ALIAS[s] ?? (s || 'unknown')
}

/** Batch id: UTC timestamp digits plus four random base-36 characters. */
export function newBatchId(now: Date = new Date(), rand: () => number = Math.random): string {
    return now.toISOString().replace(/[^0-9]/g, '') + rand().toString(36).slice(2, 6)
}
