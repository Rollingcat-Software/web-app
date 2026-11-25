/**
 * Continuous author-trial loop + its React binding.
 *
 * The pure state machine lives in {@link AuthorTrialRunner} so it can be
 * unit-tested without React or a DOM (inject repository, probe, clock and the
 * step runner). The hook only renders the shared PUZZLE step and settles the
 * runner's promise when `AuthRepository.verifyMfaStep` answers.
 *
 * Loop (contract §5): idle -> probing -> running; each attempt is
 *   probe env -> POST /author-trial/session -> render the SHARED PUZZLE step
 *   -> await the REAL /auth/mfa/step verdict -> POST .../finish -> short pause
 * -> next attempt, until Stop. A per-attempt timeout (default 120 s) records
 * `error`/`attempt_timeout`; Stop records `abandoned`/`stopped`. The server is
 * authoritative; the finish call carries technical status only.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IAuthorTrialRepository } from '@domain/interfaces/IAuthorTrialRepository'
import type { IAuthRepository, MfaStepResponse } from '@domain/interfaces/IAuthRepository'
import type {
    AuthorTrialClientOutcome,
    AuthorTrialInstrumentPreset,
    AuthorTrialMode,
    AuthorTrialParticipant,
    AuthorTrialFlow,
    AuthorTrialSessionResponse,
} from '@domain/models/AuthorTrial'
import { formatApiError } from '@utils/formatApiError'
import { probeTrialEnvironment, type TrialProbeResult } from './cameraProbe'
import {
    ATTEMPT_PAUSE_MS,
    MAX_FEED_ENTRIES,
    classifyStepResponse,
    emptyEnvSnapshot,
    mergeDeviceSnapshots,
    newLocalId,
    readIdentityScore,
    resolveAttemptTimeoutMs,
    sanitizeInstrument,
    sanitizeText,
    webVersion,
    type AuthorTrialEnvSnapshot,
} from './protocol'

export interface AttemptVerdict {
    outcome: AuthorTrialClientOutcome
    reason?: string
    identityScore?: number | null
}

export type TrialFeedOutcome = AuthorTrialClientOutcome | 'session_error'

/** One row of the on-screen attempt feed (newest last; the UI reverses it). */
export interface TrialFeedEntry {
    key: string
    /** Wall-clock epoch ms (display only). */
    at: number
    attemptId: string | null
    participantCode: string
    targetCode: string
    mode: AuthorTrialMode
    round: number | null
    position: number | null
    count: number | null
    challenge: string | null
    outcome: TrialFeedOutcome
    latencyMs: number | null
    reason?: string
    identityScore?: number | null
}

export type TrialPhase = 'idle' | 'probing' | 'running' | 'stopping'

export interface TrialRunnerState {
    phase: TrialPhase
    current: AuthorTrialSessionResponse | null
    attempts: number
    accepted: number
    rejected: number
    errors: number
    abandoned: number
    lastError: string | null
    lastIdentityScore: number | null
    feed: TrialFeedEntry[]
    runStartedAt: number | null
}

export function emptyTrialRunnerState(): TrialRunnerState {
    return {
        phase: 'idle',
        current: null,
        attempts: 0,
        accepted: 0,
        rejected: 0,
        errors: 0,
        abandoned: 0,
        lastError: null,
        lastIdentityScore: null,
        feed: [],
        runStartedAt: null,
    }
}

export interface TrialRunConfig {
    participantCode: string
    mode: AuthorTrialMode
    targetCode?: string
    instrument?: string
    instrumentPreset?: AuthorTrialInstrumentPreset
    /** Operator-edited snapshot; the probe fills the remaining fields. */
    device: ReturnType<typeof mergeDeviceSnapshots>
}

export interface TrialLoopDeps {
    repository: IAuthorTrialRepository
    accessCode: string
    config: TrialRunConfig
    /** Best-effort camera/device probe for one attempt. */
    probe: () => Promise<TrialProbeResult>
    /**
     * Renders/drives the shared PUZZLE step for one session and resolves with
     * the verdict the real `/auth/mfa/step` produced (or an abort verdict).
     */
    runAttempt: (
        session: AuthorTrialSessionResponse,
        signal: AbortSignal,
    ) => Promise<AttemptVerdict>
    /** Monotonic ms clock for latency accounting (tests inject one). */
    now?: () => number
    attemptTimeoutMs?: number
    pauseMs?: number
    webVersion?: string
    onUpdate?: (patch: Partial<TrialRunnerState>) => void
    newId?: () => string
}

function abortWithReason(controller: AbortController, reason: string): void {
    try {
        // `abort(reason)` is supported by current browsers; fall back for older ones.
        controller.abort(reason)
    } catch {
        controller.abort()
    }
}

function signalReason(signal: AbortSignal): unknown {
    return (signal as AbortSignal & { reason?: unknown }).reason
}

function abortVerdict(signal: AbortSignal): AttemptVerdict {
    return signalReason(signal) === 'timeout'
        ? { outcome: 'error', reason: 'attempt_timeout' }
        : { outcome: 'abandoned', reason: 'stopped' }
}

/**
 * Resolves as soon as the signal aborts. The runner races it with `runAttempt`
 * so a step that ignores the signal can never hang the loop.
 */
function whenAborted(signal: AbortSignal): Promise<AttemptVerdict> {
    return new Promise<AttemptVerdict>((resolve) => {
        if (signal.aborted) {
            resolve(abortVerdict(signal))
            return
        }
        signal.addEventListener('abort', () => resolve(abortVerdict(signal)), { once: true })
    })
}

/** Short technical reason stored in the attempt row; never includes secrets. */
export function technicalErrorText(error: unknown): string {
    const status = (error as { response?: { status?: number } } | null)?.response?.status
    if (typeof status === 'number' && status > 0) return `http_${status}`
    const message = (error as { message?: unknown } | null)?.message
    return sanitizeText(typeof message === 'string' ? message : 'unknown_error', 80) || 'unknown_error'
}

/**
 * The headless state machine. `start()` resolves when the loop stops; `stop()`
 * aborts the in-flight attempt (finished as `abandoned`) and ends the loop.
 */
export class AuthorTrialRunner {
    private readonly now: () => number
    private readonly attemptTimeoutMs: number
    private readonly pauseMs: number
    private readonly version: string
    private readonly newId: () => string
    private state: TrialRunnerState = emptyTrialRunnerState()
    private stopped = false
    private running = false
    private currentAbort: AbortController | null = null
    private wake: (() => void) | null = null
    private wakeTimer: ReturnType<typeof setTimeout> | null = null

    constructor(private readonly deps: TrialLoopDeps) {
        this.now = deps.now ?? (() => performance.now())
        this.attemptTimeoutMs = resolveAttemptTimeoutMs(deps.attemptTimeoutMs, null)
        this.pauseMs = Math.max(0, deps.pauseMs ?? ATTEMPT_PAUSE_MS)
        this.version = deps.webVersion ?? webVersion()
        this.newId = deps.newId ?? (() => newLocalId())
    }

    getState(): TrialRunnerState {
        return this.state
    }

    isRunning(): boolean {
        return this.running
    }

    /** Ends the loop; the in-flight attempt is recorded as abandoned. */
    stop(): void {
        if (!this.running) {
            this.patch({ phase: 'idle', current: null })
            return
        }
        this.stopped = true
        this.patch({ phase: 'stopping' })
        if (this.currentAbort) abortWithReason(this.currentAbort, 'stopped')
        this.wakeNow()
    }

    async start(): Promise<void> {
        if (this.running) return
        this.running = true
        this.stopped = false
        // Reset EVERY runner-visible field: a restart (Stop -> Start) must not
        // carry the previous run's counts or feed. The full snapshot is pushed
        // because the hook merges patches into its own state.
        const initial: TrialRunnerState = {
            ...emptyTrialRunnerState(),
            phase: 'probing',
            runStartedAt: Date.now(),
        }
        this.state = initial
        this.deps.onUpdate?.(initial)
        const config = this.deps.config

        while (!this.stopped) {
            this.patch({ phase: 'probing' })
            let probe: TrialProbeResult | null = null
            try {
                probe = await this.deps.probe()
            } catch {
                probe = null
            }
            if (this.stopped) break

            this.patch({ phase: 'running' })
            const device = mergeDeviceSnapshots(probe?.device, config.device)
            const env: AuthorTrialEnvSnapshot = probe?.env ?? emptyEnvSnapshot()
            const startedAt = this.now()
            const targetCode =
                config.mode === 'attack' && config.targetCode
                    ? config.targetCode
                    : config.participantCode

            const instrument = sanitizeInstrument(config.instrument)
            let session: AuthorTrialSessionResponse
            try {
                session = await this.deps.repository.createSession(this.deps.accessCode, {
                    participantCode: config.participantCode,
                    mode: config.mode,
                    ...(config.mode === 'attack' && config.targetCode
                        ? { targetCode: config.targetCode }
                        : {}),
                    ...(instrument ? { instrument } : {}),
                    ...(config.instrumentPreset ? { instrumentPreset: config.instrumentPreset } : {}),
                    device,
                    env,
                    webVersion: this.version,
                })
            } catch (error) {
                const reason = technicalErrorText(error)
                this.patch({ lastError: reason })
                this.appendFeed({
                    key: this.newId(),
                    at: Date.now(),
                    attemptId: null,
                    participantCode: config.participantCode,
                    targetCode,
                    mode: config.mode,
                    round: null,
                    position: null,
                    count: null,
                    challenge: null,
                    outcome: 'session_error',
                    latencyMs: null,
                    reason,
                })
                if (this.stopped) break
                await this.pause()
                continue
            }

            this.patch({ attempts: this.state.attempts + 1 })
            if (this.stopped) {
                // Stop arrived while the session was being created: the attempt
                // exists server-side, so finish it as abandoned.
                await this.finish(
                    session,
                    { outcome: 'abandoned', reason: 'stopped' },
                    Math.max(0, Math.round(this.now() - startedAt)),
                    device,
                    env,
                )
                break
            }

            this.patch({ current: session })
            const controller = new AbortController()
            this.currentAbort = controller
            const timer = setTimeout(
                () => abortWithReason(controller, 'timeout'),
                this.attemptTimeoutMs,
            )
            let verdict: AttemptVerdict
            try {
                verdict = await Promise.race([
                    this.deps.runAttempt(session, controller.signal),
                    whenAborted(controller.signal),
                ])
            } catch (error) {
                verdict = { outcome: 'error', reason: technicalErrorText(error) }
            } finally {
                clearTimeout(timer)
                // Release the abort listeners of the losing side of the race.
                if (!controller.signal.aborted) abortWithReason(controller, 'settled')
                this.currentAbort = null
            }
            this.patch({ current: null })

            await this.finish(
                session,
                verdict,
                Math.max(0, Math.round(this.now() - startedAt)),
                device,
                env,
            )
            if (this.stopped) break
            await this.pause()
        }

        this.running = false
        this.currentAbort = null
        this.patch({ phase: 'idle', current: null })
    }

    private async finish(
        session: AuthorTrialSessionResponse,
        verdict: AttemptVerdict,
        latencyMs: number,
        device: ReturnType<typeof mergeDeviceSnapshots>,
        env: AuthorTrialEnvSnapshot,
    ): Promise<void> {
        try {
            await this.deps.repository.finishAttempt(this.deps.accessCode, session.attemptId, {
                clientOutcome: verdict.outcome,
                clientLatencyMs: latencyMs,
                ...(verdict.reason ? { failureReason: verdict.reason } : {}),
                device,
                env,
            })
        } catch (error) {
            this.patch({ lastError: technicalErrorText(error) })
        }

        const patch: Partial<TrialRunnerState> = {}
        if (verdict.outcome === 'accepted') patch.accepted = this.state.accepted + 1
        else if (verdict.outcome === 'rejected') patch.rejected = this.state.rejected + 1
        else if (verdict.outcome === 'error') patch.errors = this.state.errors + 1
        else patch.abandoned = this.state.abandoned + 1
        if (typeof verdict.identityScore === 'number' && Number.isFinite(verdict.identityScore)) {
            patch.lastIdentityScore = verdict.identityScore
        }
        this.patch(patch)

        this.appendFeed({
            key: this.newId(),
            at: Date.now(),
            attemptId: session.attemptId,
            participantCode: session.participantCode,
            targetCode: session.targetCode,
            mode: session.mode,
            round: session.round,
            position: session.position,
            count: session.count,
            challenge: session.challenge,
            outcome: verdict.outcome,
            latencyMs,
            ...(verdict.reason ? { reason: verdict.reason } : {}),
            identityScore: verdict.identityScore ?? null,
        })
    }

    private appendFeed(entry: TrialFeedEntry): void {
        const feed = [...this.state.feed, entry].slice(-MAX_FEED_ENTRIES)
        this.patch({ feed })
    }

    private patch(patch: Partial<TrialRunnerState>): void {
        this.state = { ...this.state, ...patch }
        this.deps.onUpdate?.(patch)
    }

    /** Sleeps between attempts; Stop wakes it immediately. */
    private pause(): Promise<void> {
        if (this.stopped || this.pauseMs <= 0) return Promise.resolve()
        return new Promise<void>((resolve) => {
            let settled = false
            const done = () => {
                if (settled) return
                settled = true
                if (this.wakeTimer) clearTimeout(this.wakeTimer)
                this.wakeTimer = null
                this.wake = null
                resolve()
            }
            this.wake = done
            this.wakeTimer = setTimeout(done, this.pauseMs)
        })
    }

    private wakeNow(): void {
        this.wake?.()
    }
}

export interface UseAuthorTrialOptions {
    /** Tests only: lower the per-attempt ceiling. Query param works in the app. */
    attemptTimeoutMs?: number
    pauseMs?: number
    probe?: () => Promise<TrialProbeResult>
    repository?: IAuthorTrialRepository
    authRepository?: IAuthRepository
    now?: () => number
}

export interface UseAuthorTrialState extends TrialRunnerState {
    connected: boolean
    participants: AuthorTrialParticipant[]
    flow: AuthorTrialFlow | null
    participantsLoading: boolean
    participantsError: string | null
    stepLoading: boolean
    stepError: string | null
}

const INITIAL_HOOK_STATE: UseAuthorTrialState = {
    ...emptyTrialRunnerState(),
    connected: false,
    participants: [],
    flow: null,
    participantsLoading: false,
    participantsError: null,
    stepLoading: false,
    stepError: null,
}

/** React binding for the trial loop and the participant/config calls. */
export function useAuthorTrial(options: UseAuthorTrialOptions = {}) {
    const { t } = useTranslation()
    const injectedRepository = useService<IAuthorTrialRepository>(TYPES.AuthorTrialRepository)
    const injectedAuthRepository = useService<IAuthRepository>(TYPES.AuthRepository)
    const repository = options.repository ?? injectedRepository
    const authRepository = options.authRepository ?? injectedAuthRepository

    const [state, setState] = useState<UseAuthorTrialState>(INITIAL_HOOK_STATE)
    const codeRef = useRef<string | null>(null)
    const runnerRef = useRef<AuthorTrialRunner | null>(null)
    const sessionRef = useRef<AuthorTrialSessionResponse | null>(null)
    const pendingRef = useRef<{
        attemptId: string
        resolve: (verdict: AttemptVerdict) => void
    } | null>(null)
    /** Per-attempt settle guard: a late response never settles a NEW attempt. */
    const settledAttemptRef = useRef<string | null>(null)

    const merge = useCallback((patch: Partial<UseAuthorTrialState>) => {
        setState((prev) => ({ ...prev, ...patch }))
    }, [])

    const settleAttempt = useCallback((attemptId: string, verdict: AttemptVerdict) => {
        if (settledAttemptRef.current === attemptId) return
        const pending = pendingRef.current
        if (!pending || pending.attemptId !== attemptId) return
        settledAttemptRef.current = attemptId
        pending.resolve(verdict)
    }, [])

    const connect = useCallback(
        async (accessCode: string): Promise<boolean> => {
            const code = sanitizeText(accessCode, 200)
            if (!code) return false
            merge({ participantsLoading: true, participantsError: null })
            try {
                const response = await repository.getParticipants(code)
                codeRef.current = code
                merge({
                    connected: true,
                    participants: Array.isArray(response.participants) ? response.participants : [],
                    flow: response.flow ?? null,
                    participantsLoading: false,
                    participantsError: null,
                })
                return true
            } catch (error) {
                merge({
                    connected: false,
                    participants: [],
                    flow: null,
                    participantsLoading: false,
                    participantsError: formatApiError(error, t),
                })
                return false
            }
        },
        [merge, repository, t],
    )

    const refreshParticipants = useCallback(async (): Promise<void> => {
        const code = codeRef.current
        if (code) await connect(code)
    }, [connect])

    const runAttempt = useCallback(
        (session: AuthorTrialSessionResponse, signal: AbortSignal): Promise<AttemptVerdict> => {
            sessionRef.current = session
            settledAttemptRef.current = null
            merge({ current: session, stepLoading: false, stepError: null })
            return new Promise<AttemptVerdict>((resolve) => {
                let settled = false
                const settle = (verdict: AttemptVerdict) => {
                    if (settled) return
                    settled = true
                    resolve(verdict)
                }
                pendingRef.current = {
                    attemptId: session.attemptId,
                    resolve: (verdict) => settle(verdict),
                }
                if (signal.aborted) settle(abortVerdict(signal))
                else signal.addEventListener('abort', () => settle(abortVerdict(signal)), { once: true })
            })
        },
        [merge],
    )

    const verifyStep = useCallback(
        async (
            methodType: string,
            data: Record<string, unknown>,
        ): Promise<MfaStepResponse | undefined> => {
            const session = sessionRef.current
            if (!session) return undefined
            merge({ stepLoading: true, stepError: null })
            try {
                const response = await authRepository.verifyMfaStep(
                    session.mfaSessionToken,
                    methodType,
                    data,
                )
                settleAttempt(session.attemptId, {
                    ...classifyStepResponse(response),
                    identityScore: readIdentityScore(response),
                })
                return response
            } catch (error) {
                settleAttempt(session.attemptId, { outcome: 'error', reason: 'transport_error' })
                merge({ stepError: formatApiError(error, t) })
                return undefined
            } finally {
                merge({ stepLoading: false })
            }
        },
        [authRepository, merge, settleAttempt, t],
    )

    const onAuthenticated = useCallback(
        (response: MfaStepResponse) => {
            const attemptId = sessionRef.current?.attemptId
            if (!attemptId) return
            settleAttempt(attemptId, {
                ...classifyStepResponse(response),
                identityScore: readIdentityScore(response),
            })
        },
        [settleAttempt],
    )

    const onStepError = useCallback(
        (message: string) => merge({ stepError: message }),
        [merge],
    )

    const requestWebAuthnChallenge = useCallback(async () => null, [])
    const onBack = useCallback(() => undefined, [])

    const start = useCallback(
        (config: TrialRunConfig): void => {
            const accessCode = codeRef.current
            const runner = runnerRef.current
            if (!accessCode || (runner && runner.isRunning())) return
            const next = new AuthorTrialRunner({
                repository,
                accessCode,
                config,
                probe: options.probe ?? (() => probeTrialEnvironment()),
                runAttempt,
                now: options.now,
                // Explicit test option wins; otherwise the query parameter, then 120 s.
                attemptTimeoutMs: resolveAttemptTimeoutMs(options.attemptTimeoutMs),
                pauseMs: options.pauseMs,
                webVersion: webVersion(),
                onUpdate: (patch) => merge(patch),
                newId: () => newLocalId(),
            })
            runnerRef.current = next
            void next.start().finally(() => {
                if (runnerRef.current === next) runnerRef.current = null
            })
        },
        [merge, options.attemptTimeoutMs, options.now, options.pauseMs, options.probe, repository, runAttempt],
    )

    const stop = useCallback((): void => {
        runnerRef.current?.stop()
    }, [])

    useEffect(
        () => () => {
            runnerRef.current?.stop()
        },
        [],
    )

    return {
        state,
        connect,
        refreshParticipants,
        start,
        stop,
        verifyStep,
        requestWebAuthnChallenge,
        onAuthenticated,
        onBack,
        onStepError,
    }
}