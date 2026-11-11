import { describe, it, expect, vi } from 'vitest'
import { configureOrt, runOnce, type OrtLike, type RunHooks } from '../runBenchmark'
import type { DeviceInfo } from '../deviceProbe'
import { TOOL, WARM_RUNS } from '../protocol'

const device: DeviceInfo = {
    type: 'phone_tablet',
    model: 'SM-A145F',
    platform: 'Android',
    browser: { name: 'Chrome', version: '130' },
    webgl: { renderer: 'Mali-G57', vendor: 'ARM' },
    uaHighEntropy: { model: 'SM-A145F', platform: 'Android', platformVersion: '14', architecture: '', bitness: '', fullVersionList: null },
    hardwareConcurrency: 8,
    deviceMemoryGB: 4,
    screen: { width: 720, height: 1600, dpr: 2 },
    connectionEffectiveType: '4g',
    timezone: 'Europe/Istanbul',
    language: 'tr-TR',
    crossOriginIsolated: false,
    userAgent: 'UA',
    uaPlatform: 'Android',
    uaMobile: true,
    label: 'SM-A145F',
}

/** A clock that advances 10 ms per read, so every timed span is exactly 10 ms. */
function hooks(): RunHooks & { clock: number } {
    const h = {
        clock: 0,
        now: () => (h.clock += 10),
        readBattery: async () => ({ level: 0.5, charging: true }),
        visibility: () => 'visible',
        visibilityChanges: () => 0,
        onProgress: vi.fn(),
        onPhase: vi.fn(),
        yieldToUi: async () => {},
    }
    return h
}

function fakeOrt(runImpl?: () => Promise<unknown>): OrtLike & { runs: number } {
    const o = {
        runs: 0,
        env: { wasm: {} as { wasmPaths?: string; numThreads?: number; proxy?: boolean } },
        Tensor: class {
            constructor(public type: string, public data: Float32Array, public dims: readonly number[]) {}
        },
        InferenceSession: {
            create: async () => ({
                inputNames: ['input'],
                outputNames: ['out'],
                run: async () => {
                    o.runs++
                    if (runImpl) await runImpl()
                    return { out: { data: new Float32Array(512) } }
                },
                release: async () => {},
            }),
        },
    }
    return o as unknown as OrtLike & { runs: number }
}

const ctx = (runIndex: number) => ({
    batchId: 'b1',
    runIndex,
    participant: 'Ayse',
    device,
    model: { bytes: 47072627, sha256: 'abc', sha256Match: true, fetchMs: 1234 },
})

describe('runOnce', () => {
    it('runOnce_WhenModelRuns_ShouldProduceArtifactCompatibleDoc', async () => {
        const ort = fakeOrt()
        const doc = await runOnce(ort, new Uint8Array(1), ctx(1), hooks())

        expect(ort.runs).toBe(1 + WARM_RUNS)
        expect(doc).toMatchObject({
            tool: TOOL,
            batchId: 'b1',
            runIndex: 1,
            runsInBatch: 3,
            participant: 'Ayse',
            deviceKey: 'sm-a145f',
            deviceType: 'phone_tablet',
            chargingReported: true,
            executionProvider: 'wasm',
            wasmThreads: 1,
            errors: [],
        })
        expect(doc.timingsMs).toMatchObject({ modelFetch_appHost: 1234, sessionCreateCold: 10, firstInference: 10 })
        expect(doc.timingsMs.warm).toMatchObject({ n: WARM_RUNS, p50: 10, p95: 10 })
        expect(doc.model.outputLength).toBe(512)
        expect('uid' in doc).toBe(false)
    })

    it('runOnce_WhenNotFirstRun_ShouldNotRepeatFetchTime', async () => {
        const doc = await runOnce(fakeOrt(), new Uint8Array(1), ctx(2), hooks())
        expect(doc.timingsMs.modelFetch_appHost).toBeUndefined()
    })

    it('runOnce_WhenInferenceFails_ShouldRecordErrorWithoutWarm', async () => {
        const doc = await runOnce(
            fakeOrt(async () => {
                throw new Error('out of memory')
            }),
            new Uint8Array(1),
            ctx(1),
            hooks()
        )
        expect(doc.errors).toEqual(['out of memory'])
        expect(doc.timingsMs.warm).toBeUndefined()
    })

    it('configureOrt_ShouldPinWasmSingleThread', () => {
        const ort = fakeOrt()
        configureOrt(ort, 'https://cdn/x/')
        expect(ort.env.wasm).toEqual({ wasmPaths: 'https://cdn/x/', numThreads: 1, proxy: false })
    })
})
