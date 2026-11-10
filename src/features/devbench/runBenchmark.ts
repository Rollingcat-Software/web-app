/**
 * One benchmark run and the run document it produces.
 *
 * The document keeps the field names of the earlier artifact page ("fivucsas devbench
 * artifact v3") so older and newer runs can be analysed together. Fields that only made
 * sense inside the artifact (`uid`, `submittedVia: 'db'`) are null here.
 */
import type { DeviceInfo, BatteryLike } from './deviceProbe'
import {
    INPUT_DIMS,
    ORT_VERSION,
    RUNS_PER_VISIT,
    SOURCE,
    TOOL,
    WARM_RUNS,
    deviceKey,
    makeInput,
    r2,
    summariseWarm,
    type WarmSummary,
} from './protocol'

/** The bits of onnxruntime-web one run uses. */
export interface OrtLike {
    env: { wasm: { wasmPaths?: string; numThreads?: number; proxy?: boolean } }
    Tensor: new (type: 'float32', data: Float32Array, dims: readonly number[]) => unknown
    InferenceSession: {
        create: (source: ArrayBuffer | Uint8Array, options: { executionProviders: string[] }) => Promise<OrtSession>
    }
}
interface OrtSession {
    inputNames: string[]
    outputNames: string[]
    run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: ArrayLike<number> }>>
    release?: () => Promise<void>
}

export interface ModelCheck {
    bytes: number
    sha256: string
    sha256Match: boolean
    fetchMs: number | null
}

export interface RunContext {
    batchId: string
    runIndex: number
    participant: string | null
    device: DeviceInfo
    model: ModelCheck
}

export interface RunHooks {
    now: () => number
    readBattery: () => Promise<BatteryLike | null>
    visibility: () => string
    visibilityChanges: () => number
    /** 0..1 progress inside this run. */
    onProgress: (fraction: number) => void
    onPhase: (phase: 'session' | 'first' | 'warm', done?: number) => void
    yieldToUi: () => Promise<void>
}

export interface RunDoc {
    tool: string
    timestamp: string
    source: string
    submittedVia: string | null
    batchId: string
    runIndex: number
    runsInBatch: number
    participant: string | null
    deviceLabel: string
    deviceKey: string
    deviceType: string
    deviceAgeBand: null
    priceClass: null
    chargingReported: boolean | null
    chargingSource: string
    userAgent: string
    uaPlatform: string | null
    uaMobile: boolean | null
    uaHighEntropy: DeviceInfo['uaHighEntropy']
    browser: DeviceInfo['browser']
    webgl: DeviceInfo['webgl']
    hardwareConcurrency: number | null
    deviceMemoryGB: number | null
    screen: DeviceInfo['screen']
    connectionEffectiveType: string | null
    timezone: string | null
    language: string | null
    crossOriginIsolated: boolean
    ortVersion: string
    ortBundle: string
    executionProvider: string
    wasmThreads: number
    model: { bytes: number; sha256: string; sha256Match: boolean; outputLength?: number }
    timingsMs: {
        modelFetch_appHost?: number | null
        sessionCreateCold?: number | null
        firstInference?: number | null
        warm?: WarmSummary
    }
    errors: string[]
    battery: { levelStart: number | null; chargingStart: boolean | null; levelEnd: number | null; chargingEnd: boolean | null }
    visibilityAtEnd: string
    visibilityChanges: number
}

/** Pins the runtime to the measured configuration: WASM, one thread, no worker proxy. */
export function configureOrt(ort: OrtLike, wasmPaths: string): void {
    ort.env.wasm.wasmPaths = wasmPaths
    ort.env.wasm.numThreads = 1
    ort.env.wasm.proxy = false
}

export async function runOnce(ort: OrtLike, modelBytes: Uint8Array, ctx: RunContext, hooks: RunHooks): Promise<RunDoc> {
    const d = ctx.device
    const b0 = await hooks.readBattery()
    const vis0 = hooks.visibilityChanges()
    const doc: RunDoc = {
        tool: TOOL,
        timestamp: new Date().toISOString(),
        source: SOURCE,
        submittedVia: 'api',
        batchId: ctx.batchId,
        runIndex: ctx.runIndex,
        runsInBatch: RUNS_PER_VISIT,
        participant: ctx.participant,
        deviceLabel: d.label,
        deviceKey: deviceKey(d.label),
        deviceType: d.type,
        deviceAgeBand: null,
        priceClass: null,
        chargingReported: b0 ? b0.charging : null,
        chargingSource: b0 ? 'battery-api' : 'unavailable',
        userAgent: d.userAgent,
        uaPlatform: d.uaPlatform,
        uaMobile: d.uaMobile,
        uaHighEntropy: d.uaHighEntropy,
        browser: d.browser,
        webgl: d.webgl,
        hardwareConcurrency: d.hardwareConcurrency,
        deviceMemoryGB: d.deviceMemoryGB,
        screen: d.screen,
        connectionEffectiveType: d.connectionEffectiveType,
        timezone: d.timezone,
        language: d.language,
        crossOriginIsolated: d.crossOriginIsolated,
        ortVersion: ORT_VERSION,
        ortBundle: 'onnxruntime-web (npm esm)',
        executionProvider: 'wasm',
        wasmThreads: 1,
        model: { bytes: ctx.model.bytes, sha256: ctx.model.sha256, sha256Match: ctx.model.sha256Match },
        timingsMs: ctx.runIndex === 1 ? { modelFetch_appHost: ctx.model.fetchMs } : {},
        errors: [],
        battery: { levelStart: b0?.level ?? null, chargingStart: b0?.charging ?? null, levelEnd: null, chargingEnd: null },
        visibilityAtEnd: '',
        visibilityChanges: 0,
    }
    try {
        hooks.onPhase('session')
        hooks.onProgress(0.02)
        let t0 = hooks.now()
        const session = await ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'] })
        doc.timingsMs.sessionCreateCold = r2(hooks.now() - t0)
        hooks.onProgress(0.1)

        const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', makeInput(INPUT_DIMS), INPUT_DIMS) }
        hooks.onPhase('first')
        t0 = hooks.now()
        let out = await session.run(feeds)
        doc.timingsMs.firstInference = r2(hooks.now() - t0)
        doc.model.outputLength = out[session.outputNames[0]].data.length
        hooks.onProgress(0.15)

        const warm: number[] = []
        for (let i = 0; i < WARM_RUNS; i++) {
            t0 = hooks.now()
            out = await session.run(feeds)
            warm.push(hooks.now() - t0)
            hooks.onProgress(0.15 + ((i + 1) / WARM_RUNS) * 0.85)
            if ((i + 1) % 5 === 0) hooks.onPhase('warm', i + 1)
            await hooks.yieldToUi()
        }
        doc.timingsMs.warm = summariseWarm(warm)
        try {
            await session.release?.()
        } catch {
            // releasing is best effort; the timings are already recorded
        }
    } catch (e) {
        doc.errors.push(String((e as Error)?.message ?? e).slice(0, 300))
    }
    const b1 = await hooks.readBattery()
    doc.battery.levelEnd = b1?.level ?? null
    doc.battery.chargingEnd = b1?.charging ?? null
    doc.visibilityAtEnd = hooks.visibility()
    doc.visibilityChanges = hooks.visibilityChanges() - vis0
    return doc
}
