/**
 * State machine of the public benchmark page:
 * probing -> countdown (auto start after 5 s) | idle (cancelled) -> running -> done.
 *
 * Every finished run is sent to the server on its own, so a phone that dies on run 3
 * still leaves runs 1 and 2 behind. Nothing here needs an account.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { getService } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { IDevbenchRepository } from '@domain/interfaces/IDevbenchRepository'
import { getModel } from '@features/biometrics/embedding/modelCache'
import { browserEnv, probeDevice, readBattery, type BatteryLike, type DeviceInfo } from './deviceProbe'
import {
    COUNTDOWN_SECONDS,
    MODEL_SHA256,
    MODEL_URL,
    ORT_WASM_PATHS,
    PARTICIPANT_MAX_CHARS,
    RUNS_PER_VISIT,
    newBatchId,
    r2,
} from './protocol'
import { configureOrt, runOnce, type OrtLike, type RunDoc } from './runBenchmark'

export type Phase = 'probing' | 'countdown' | 'idle' | 'running' | 'done'
export type RunStep = 'download' | 'session' | 'first' | 'warm'
export type Outcome = 'saved' | 'notSent' | 'partial' | 'failed'

export interface RunStatus {
    run: number
    step: RunStep
    warmDone: number
    progress: number
}

export interface DevbenchState {
    phase: Phase
    device: DeviceInfo | null
    battery: BatteryLike | null
    hidden: boolean
    secondsLeft: number
    status: RunStatus
    results: RunDoc[]
    saved: number
    /** Finished runs the server has not accepted yet (offline, blocked network). */
    unsent: RunDoc[]
    sending: boolean
    outcome: Outcome | null
    leftTab: boolean
    /** Technical reason when the measurement could not start (shown small, for support). */
    fatalError: string | null
}

const NAME_KEY = 'devbench.name'

function readStoredName(): string {
    try {
        return localStorage.getItem(NAME_KEY) ?? ''
    } catch {
        return ''
    }
}

function storeName(name: string): void {
    try {
        localStorage.setItem(NAME_KEY, name)
    } catch {
        // private mode: the name is simply not remembered
    }
}

export function outcomeOf(completeRuns: number, unsentRuns: number): Outcome {
    if (unsentRuns > 0) return 'notSent'
    if (completeRuns === RUNS_PER_VISIT) return 'saved'
    return completeRuns > 0 ? 'partial' : 'failed'
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function useDevbench() {
    const [name, setNameState] = useState(readStoredName)
    const [state, setState] = useState<DevbenchState>({
        phase: 'probing',
        device: null,
        battery: null,
        hidden: typeof document !== 'undefined' && document.visibilityState !== 'visible',
        secondsLeft: COUNTDOWN_SECONDS,
        status: { run: 0, step: 'download', warmDone: 0, progress: 0 },
        results: [],
        saved: 0,
        unsent: [],
        sending: false,
        outcome: null,
        leftTab: false,
        fatalError: null,
    })
    const visChanges = useRef(0)
    const running = useRef(false)
    const timer = useRef<ReturnType<typeof setInterval> | null>(null)
    const wakeLock = useRef<{ release: () => Promise<void> } | null>(null)
    const deviceRef = useRef<DeviceInfo | null>(null)
    const nameRef = useRef(name)
    nameRef.current = name

    const patch = useCallback((p: Partial<DevbenchState>) => setState((s) => ({ ...s, ...p })), [])
    const setStatus = useCallback(
        (p: Partial<RunStatus>) => setState((s) => ({ ...s, status: { ...s.status, ...p } })),
        []
    )

    const stopCountdown = useCallback(() => {
        if (timer.current) clearInterval(timer.current)
        timer.current = null
    }, [])

    const takeWakeLock = useCallback(async () => {
        try {
            const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
            if (wl && document.visibilityState === 'visible') wakeLock.current = await wl.request('screen')
        } catch {
            wakeLock.current = null
        }
    }, [])

    const start = useCallback(async () => {
        if (running.current || !deviceRef.current) return
        running.current = true
        stopCountdown()
        const participant = nameRef.current.trim().slice(0, PARTICIPANT_MAX_CHARS) || null
        storeName(nameRef.current.trim())
        visChanges.current = 0
        patch({ phase: 'running', results: [], saved: 0, unsent: [], outcome: null, leftTab: false, fatalError: null })
        setStatus({ run: 0, step: 'download', warmDone: 0, progress: 0 })
        await takeWakeLock()

        const env = browserEnv()
        const repo = getService<IDevbenchRepository>(TYPES.DevbenchRepository)
        const results: RunDoc[] = []
        const unsent: RunDoc[] = []
        let saved = 0
        let fatalError: string | null = null
        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore onnxruntime-web is loaded at runtime, as in embedCapturedFace
            const ort = (await import('onnxruntime-web')) as unknown as OrtLike
            configureOrt(ort, ORT_WASM_PATHS)
            const t0 = performance.now()
            const buf = await getModel(MODEL_URL, MODEL_SHA256)
            const fetchMs = r2(performance.now() - t0)
            const sha = await sha256Hex(buf)
            const model = { bytes: buf.byteLength, sha256: sha, sha256Match: sha === MODEL_SHA256, fetchMs }
            if (!model.sha256Match) throw new Error('model sha256 mismatch')
            const bytes = new Uint8Array(buf)
            const batchId = newBatchId()

            for (let i = 1; i <= RUNS_PER_VISIT; i++) {
                const base = (i - 1) / RUNS_PER_VISIT
                setStatus({ run: i, step: 'session', warmDone: 0, progress: base })
                const doc = await runOnce(
                    ort,
                    bytes,
                    { batchId, runIndex: i, participant, device: deviceRef.current, model },
                    {
                        now: () => performance.now(),
                        readBattery: () => readBattery(env),
                        visibility: () => document.visibilityState,
                        visibilityChanges: () => visChanges.current,
                        onProgress: (f) => setStatus({ progress: base + f / RUNS_PER_VISIT }),
                        onPhase: (step, done) => setStatus({ step, warmDone: done ?? 0 }),
                        yieldToUi: () => new Promise((r) => setTimeout(r, 0)),
                    }
                )
                results.push(doc)
                // Failed runs are sent too: a crash on a low-end phone is a result.
                try {
                    await repo.submitRun(doc)
                    saved++
                } catch (e) {
                    unsent.push(doc)
                    console.warn('devbench: run not saved', e)
                }
                patch({ results: [...results], saved })
            }
        } catch (e) {
            fatalError = String((e as Error)?.message ?? e).slice(0, 200)
            console.error('devbench: measurement stopped', e)
        }
        try {
            await wakeLock.current?.release()
        } catch {
            // already released by the browser
        }
        wakeLock.current = null
        running.current = false
        const complete = results.filter((r) => r.timingsMs.warm).length
        patch({
            phase: 'done',
            results,
            saved,
            unsent,
            outcome: outcomeOf(complete, unsent.length),
            fatalError,
            battery: await readBattery(env),
        })
    }, [patch, setStatus, stopCountdown, takeWakeLock])

    const startCountdown = useCallback(() => {
        stopCountdown()
        patch({ phase: 'countdown', secondsLeft: COUNTDOWN_SECONDS })
        let left = COUNTDOWN_SECONDS
        timer.current = setInterval(() => {
            left -= 1
            if (left <= 0) {
                stopCountdown()
                void start()
                return
            }
            patch({ secondsLeft: left })
        }, 1000)
    }, [patch, start, stopCountdown])

    const cancel = useCallback(() => {
        stopCountdown()
        patch({ phase: 'idle' })
    }, [patch, stopCountdown])

    const setName = useCallback(
        (v: string) => {
            if (timer.current) cancel()
            setNameState(v.slice(0, PARTICIPANT_MAX_CHARS))
        },
        [cancel]
    )

    /** Re-sends the runs the server did not accept; one button for the person, no copy and paste. */
    const resend = useCallback(async () => {
        const repo = getService<IDevbenchRepository>(TYPES.DevbenchRepository)
        const pending = state.unsent
        patch({ sending: true })
        const still: RunDoc[] = []
        let ok = 0
        for (const doc of pending) {
            try {
                await repo.submitRun(doc)
                ok++
            } catch (e) {
                still.push(doc)
                console.warn('devbench: resend failed', e)
            }
        }
        const complete = state.results.filter((r) => r.timingsMs.warm).length
        patch({ sending: false, unsent: still, saved: state.saved + ok, outcome: outcomeOf(complete, still.length) })
    }, [patch, state.unsent, state.results, state.saved])

    const again = useCallback(() => patch({ phase: 'idle' }), [patch])

    useEffect(() => {
        let alive = true
        const env = browserEnv()
        void (async () => {
            const device = await probeDevice(env)
            const battery = await readBattery(env)
            if (!alive) return
            deviceRef.current = device
            patch({ device, battery })
            startCountdown()
        })()
        const onVis = () => {
            const hidden = document.visibilityState !== 'visible'
            if (running.current && hidden) {
                visChanges.current++
                patch({ leftTab: true })
            }
            if (running.current && !hidden) void takeWakeLock()
            patch({ hidden })
        }
        document.addEventListener('visibilitychange', onVis)
        return () => {
            alive = false
            stopCountdown()
            document.removeEventListener('visibilitychange', onVis)
        }
        // run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return { state, name, setName, start, cancel, again, resend }
}
