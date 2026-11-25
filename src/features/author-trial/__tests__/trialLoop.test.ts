import { describe, it, expect, vi } from 'vitest'
import type { IAuthorTrialRepository } from '@domain/interfaces/IAuthorTrialRepository'
import type { AuthorTrialSessionResponse } from '../protocol'
import type { TrialProbeResult } from '../cameraProbe'
import {
    AuthorTrialRunner,
    technicalErrorText,
    type AttemptVerdict,
    type TrialLoopDeps,
    type TrialRunConfig,
} from '../useAuthorTrial'

function session(index: number): AuthorTrialSessionResponse {
    return {
        attemptId: `attempt-${index}`,
        mfaSessionToken: `mfa-${index}`,
        participantCode: 'P1',
        targetCode: 'P1',
        mode: 'genuine',
        round: 1,
        position: index,
        challenge: 'blink',
        binding: true,
        difficulty: 'easy',
        count: 1,
        puzzleConfig: {
            allowedChallengeTypes: ['blink'],
            count: 1,
            difficulty: 'easy',
            alsoMatchFaceIdentity: true,
        },
    }
}

const PROBE: TrialProbeResult = {
    device: {
        label: 'Desk',
        os: 'Windows',
        browser: 'Chrome 130',
        screen: '1920x1080@2',
        cameraLabel: 'Cam',
        cameraResolution: '1280x720',
        hardwareConcurrency: 8,
        deviceMemoryGB: 16,
        type: 'computer',
    },
    env: { localTimeOfDay: '21:14', brightness: 0.42, exposureScore: 0.03, frameRate: 29.8 },
    camera: {
        cameraLabel: 'Cam',
        cameraResolution: '1280x720',
        frameRate: 29.8,
        brightness: 0.42,
        exposureScore: 0.03,
    },
}

const CONFIG: TrialRunConfig = {
    participantCode: 'P1',
    mode: 'genuine',
    device: PROBE.device,
}

function makeRepo() {
    let created = 0
    const repo = {
        getParticipants: vi.fn(),
        createSession: vi.fn(async () => session(++created)),
        finishAttempt: vi.fn(async () => undefined),
        enroll: vi.fn(),
        exportSessions: vi.fn(),
    }
    return repo as typeof repo & IAuthorTrialRepository
}

type Repo = ReturnType<typeof makeRepo>

function deps(
    repo: Repo,
    runAttempt: TrialLoopDeps['runAttempt'],
    overrides: Partial<TrialLoopDeps> = {},
): TrialLoopDeps {
    return {
        repository: repo,
        accessCode: 'key',
        config: CONFIG,
        probe: async () => PROBE,
        runAttempt,
        now: () => 1_000,
        attemptTimeoutMs: 1_000,
        pauseMs: 0,
        webVersion: 'test-web',
        ...overrides,
    }
}

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
    const started = Date.now()
    while (!predicate()) {
        if (Date.now() - started > timeoutMs) throw new Error('waitFor timeout')
        await new Promise((resolve) => setTimeout(resolve, 5))
    }
}

describe('AuthorTrialRunner', () => {
    it('accepts an AUTHENTICATED attempt, finishes it, then stops', async () => {
        const repo = makeRepo()
        const runner = new AuthorTrialRunner(
            deps(repo, async () => ({ outcome: 'accepted', identityScore: 0.91 }), {
                onUpdate: (patch) => {
                    if (patch.accepted === 1) runner.stop()
                },
            }),
        )

        await runner.start()

        expect(repo.createSession).toHaveBeenCalledTimes(1)
        expect(repo.finishAttempt).toHaveBeenCalledTimes(1)
        expect(repo.finishAttempt).toHaveBeenCalledWith(
            'key',
            'attempt-1',
            expect.objectContaining({
                clientOutcome: 'accepted',
                clientLatencyMs: 0,
            }),
        )
        const finishBody = repo.finishAttempt.mock.calls[0][2] as unknown as {
            clientOutcome: string
            failureReason?: string
        }
        expect(finishBody.failureReason).toBeUndefined()
        expect(runner.getState()).toMatchObject({
            phase: 'idle',
            current: null,
            attempts: 1,
            accepted: 1,
            rejected: 0,
            errors: 0,
            abandoned: 0,
            lastIdentityScore: 0.91,
        })
        expect(runner.getState().feed).toHaveLength(1)
        expect(runner.getState().feed[0]).toMatchObject({
            attemptId: 'attempt-1',
            outcome: 'accepted',
            participantCode: 'P1',
            targetCode: 'P1',
            challenge: 'blink',
        })
    })

    it('records a server rejection with its reason', async () => {
        const repo = makeRepo()
        const runner = new AuthorTrialRunner(
            deps(repo, async () => ({ outcome: 'rejected', reason: 'step_failed' }), {
                onUpdate: (patch) => {
                    if (patch.rejected === 1) runner.stop()
                },
            }),
        )

        await runner.start()

        expect(repo.finishAttempt).toHaveBeenCalledWith(
            'key',
            'attempt-1',
            expect.objectContaining({ clientOutcome: 'rejected', failureReason: 'step_failed' }),
        )
        expect(runner.getState()).toMatchObject({ rejected: 1, accepted: 0 })
        expect(runner.getState().feed[0].reason).toBe('step_failed')
    })

    it('times out a stuck step as error/attempt_timeout', async () => {
        const repo = makeRepo()
        const runner = new AuthorTrialRunner(
            deps(repo, () => new Promise<AttemptVerdict>(() => undefined), {
                attemptTimeoutMs: 25,
                onUpdate: (patch) => {
                    if (patch.errors === 1) runner.stop()
                },
            }),
        )

        await runner.start()

        expect(repo.finishAttempt).toHaveBeenCalledWith(
            'key',
            'attempt-1',
            expect.objectContaining({ clientOutcome: 'error', failureReason: 'attempt_timeout' }),
        )
        expect(runner.getState()).toMatchObject({ phase: 'idle', attempts: 1, errors: 1 })
        expect(runner.getState().feed[0]).toMatchObject({
            outcome: 'error',
            reason: 'attempt_timeout',
            latencyMs: 0,
        })
    })

    it('finishes a stopped in-flight attempt as abandoned', async () => {
        const repo = makeRepo()
        const runner = new AuthorTrialRunner(
            deps(
                repo,
                (_session, signal) =>
                    new Promise<AttemptVerdict>((resolve) => {
                        const settle = () => resolve({ outcome: 'abandoned', reason: 'stopped' })
                        if (signal.aborted) settle()
                        else signal.addEventListener('abort', settle, { once: true })
                    }),
                { attemptTimeoutMs: 10_000 },
            ),
        )

        const done = runner.start()
        await waitFor(() => runner.getState().current != null)
        runner.stop()
        await done

        expect(repo.finishAttempt).toHaveBeenCalledWith(
            'key',
            'attempt-1',
            expect.objectContaining({ clientOutcome: 'abandoned', failureReason: 'stopped' }),
        )
        expect(runner.getState()).toMatchObject({ phase: 'idle', attempts: 1, abandoned: 1 })
    })

    it('starts the next attempt after a completed one', async () => {
        const repo = makeRepo()
        const runner = new AuthorTrialRunner(
            deps(repo, async () => ({ outcome: 'accepted' }), {
                pauseMs: 1,
                onUpdate: (patch) => {
                    if (patch.accepted === 2) runner.stop()
                },
            }),
        )

        await runner.start()

        expect(repo.createSession).toHaveBeenCalledTimes(2)
        expect(repo.finishAttempt).toHaveBeenCalledTimes(2)
        expect(runner.getState()).toMatchObject({ attempts: 2, accepted: 2, phase: 'idle' })
        expect(runner.getState().feed.map((entry) => entry.attemptId)).toEqual(['attempt-1', 'attempt-2'])
    })

    it('reports a session-create failure without inventing an attempt', async () => {
        const repo = makeRepo()
        repo.createSession.mockRejectedValueOnce(
            Object.assign(new Error('boom'), { response: { status: 500 } }),
        )
        const runner = new AuthorTrialRunner(
            deps(repo, async () => ({ outcome: 'accepted' }), {
                pauseMs: 0,
                onUpdate: (patch) => {
                    if (patch.feed?.length === 1) runner.stop()
                },
            }),
        )

        await runner.start()

        expect(repo.finishAttempt).not.toHaveBeenCalled()
        expect(runner.getState()).toMatchObject({ attempts: 0, lastError: 'http_500' })
        expect(runner.getState().feed[0]).toMatchObject({
            outcome: 'session_error',
            attemptId: null,
            reason: 'http_500',
        })
    })

    it('resets counts and feed when restarted after a stop', async () => {
        const repo = makeRepo()
        const runner = new AuthorTrialRunner(
            deps(repo, async () => ({ outcome: 'accepted' }), {
                onUpdate: (patch) => {
                    if (patch.accepted === 1) runner.stop()
                },
            }),
        )

        await runner.start()
        expect(runner.getState().feed).toHaveLength(1)
        expect(runner.getState().accepted).toBe(1)

        await runner.start()

        expect(runner.getState().feed).toHaveLength(1)
        expect(runner.getState().accepted).toBe(1)
        expect(runner.getState().attempts).toBe(1)
        expect(repo.createSession).toHaveBeenCalledTimes(2)
    })

    it('technicalErrorText never leaks a raw object', () => {
        expect(technicalErrorText(Object.assign(new Error('x'), { response: { status: 401 } }))).toBe('http_401')
        expect(technicalErrorText(new Error('plain'))).toBe('plain')
        expect(technicalErrorText(null)).toBe('unknown_error')
    })
})