/**
 * Local stub of the identity-core-api author-trial contract, for the Playwright
 * e2e only. No external dependencies, no internet, no real accounts.
 *
 * It implements:
 *   GET  /api/v1/author-trial/participants
 *   POST /api/v1/author-trial/session
 *   POST /api/v1/author-trial/attempts/:id/finish
 *   POST /api/v1/author-trial/enroll
 *   GET  /api/v1/author-trial/export?format=csv|json   (real CSV)
 *   POST /api/v1/auth/mfa/puzzle/session                (one challenge, never completed)
 *   POST /api/v1/auth/mfa/puzzle/session/:id/challenge
 *   POST /api/v1/auth/mfa/step
 *
 * Test-only state lives at /__test__/state and /__test__/reset.
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.AUTHOR_TRIAL_STUB_PORT || 4311)
const ACCESS_CODE = process.env.AUTHOR_TRIAL_STUB_KEY || 'e2e-trial-key'
const PARTICIPANTS = [
    { code: 'P1', enrolled: true },
    { code: 'P2', enrolled: true },
    { code: 'P3', enrolled: false },
]
const FLOW = {
    method: 'PUZZLE',
    binding: true,
    difficulty: 'easy',
    count: 1,
    challenges: ['blink', 'smile'],
}

const CSV_HEADER = [
    'date',
    'participant',
    'operator',
    'session_no',
    'condition',
    'attack_type',
    'attack_medium',
    'binding',
    'k',
    'difficulty',
    'contract',
    'face_embedding_liveness_mode',
    'deployment_commits',
    'outcome',
    'liveness_verdict',
    'identity_verdict',
    'failure_reason',
    'completion_time_s',
    'device_browser',
    'lighting',
    'server_session_id',
    'excluded',
    'notes',
    'mode',
    'target',
    'instrument',
    'instrument_preset',
    'round',
    'position',
    'challenge',
    'planned_challenge',
    'identity_score',
    'identity_distance',
    'identity_threshold',
    'latency_ms',
    'client_latency_ms',
    'started_at',
    'decided_at',
    'local_time_of_day',
    'brightness',
    'exposure_score',
    'frame_rate',
    'camera_label',
    'camera_resolution',
    'device_label',
    'os',
    'browser',
    'screen',
    'web_version',
    'api_version',
    'bio_version',
    'mfa_session_id',
    'step_outcome',
    'challenges_submitted',
    'last_challenge_verdict',
    'last_challenge_reason',
    'attempt_id',
]

/** @type {Array<any>} */
let attempts = []
let attemptSeq = 0
let puzzleSeq = 0
/** @type {Map<string, string>} */
let puzzleByMfaToken = new Map()

function json(res, status, body) {
    const text = JSON.stringify(body)
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(text),
    })
    res.end(text)
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8')
            if (!raw) return resolve({})
            try {
                resolve(JSON.parse(raw))
            } catch (error) {
                reject(error)
            }
        })
        req.on('error', reject)
    })
}

function csvCell(value) {
    const text = value == null ? '' : String(value)
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function lightingBucket(brightness) {
    if (typeof brightness !== 'number' || !Number.isFinite(brightness)) return 'unknown'
    if (brightness >= 0.65) return 'bright'
    if (brightness >= 0.4) return 'moderate'
    if (brightness >= 0.2) return 'dim'
    return 'dark'
}

function attackType(attempt) {
    if (attempt.body.mode !== 'attack') return 'none'
    const preset = attempt.body.instrumentPreset
    return ['live_face_swap', 'deepfake_replay', 'virtual_camera', 'other'].includes(preset)
        ? preset
        : 'other'
}

function rowFor(attempt) {
    const finish = attempt.finish
    const client = finish?.clientOutcome
    const outcome =
        client === 'accepted' ? 'accept' : client === 'rejected' ? 'reject' : client ? client : 'pending'
    const excluded = outcome === 'accept' || outcome === 'reject' ? '' : 'yes'
    const device = attempt.body.device ?? {}
    const env = attempt.body.env ?? {}
    const target = attempt.body.mode === 'attack' ? attempt.body.targetCode : attempt.body.participantCode
    return {
        date: attempt.createdAt.slice(0, 10),
        participant: target,
        operator: attempt.body.participantCode,
        session_no: attempt.sessionNo,
        condition: attempt.body.mode === 'genuine' ? 'bona_fide' : 'attack',
        attack_type: attackType(attempt),
        attack_medium: attempt.body.mode === 'attack' ? attempt.body.instrument ?? '' : '',
        binding: 'on',
        k: 1,
        difficulty: 'easy',
        contract: 'v2',
        face_embedding_liveness_mode: 'off',
        deployment_commits: `bio=stub-bio;api=stub-api;web=${attempt.body.webVersion ?? ''}`,
        outcome,
        liveness_verdict: outcome === 'accept' ? 'pass' : outcome === 'reject' ? 'fail' : '',
        identity_verdict: outcome === 'accept' ? 'pass' : outcome === 'reject' ? 'fail' : '',
        failure_reason: finish?.failureReason ?? '',
        completion_time_s: '',
        device_browser: [device.label, device.os, device.browser, device.cameraLabel]
            .filter(Boolean)
            .join(' / '),
        lighting: lightingBucket(env.brightness),
        server_session_id: attempt.puzzleSessionId ?? '',
        excluded,
        notes: [attempt.body.instrumentPreset, finish?.failureReason].filter(Boolean).join('; '),
        mode: attempt.body.mode,
        target,
        instrument: attempt.body.instrument ?? '',
        instrument_preset: attempt.body.instrumentPreset ?? '',
        round: attempt.round,
        position: attempt.position,
        challenge: attempt.challenge,
        planned_challenge: attempt.challenge,
        identity_score: '',
        identity_distance: '',
        identity_threshold: '',
        latency_ms: '',
        client_latency_ms: finish?.clientLatencyMs ?? '',
        started_at: attempt.createdAt,
        decided_at: finish?.finishedAt ?? '',
        local_time_of_day: env.localTimeOfDay ?? '',
        brightness: env.brightness ?? '',
        exposure_score: env.exposureScore ?? '',
        frame_rate: env.frameRate ?? '',
        camera_label: device.cameraLabel ?? '',
        camera_resolution: device.cameraResolution ?? '',
        device_label: device.label ?? '',
        os: device.os ?? '',
        browser: device.browser ?? '',
        screen: device.screen ?? '',
        web_version: attempt.body.webVersion ?? '',
        api_version: 'stub-api',
        bio_version: 'stub-bio',
        mfa_session_id: attempt.mfaSessionToken,
        step_outcome: outcome === 'accept' ? 'pass' : outcome === 'reject' ? 'fail' : '',
        challenges_submitted: finish ? 0 : '',
        last_challenge_verdict: '',
        last_challenge_reason: '',
        attempt_id: attempt.attemptId,
    }
}

function exportCsv() {
    const lines = [CSV_HEADER.join(',')]
    for (const attempt of attempts) {
        const row = rowFor(attempt)
        lines.push(CSV_HEADER.map((column) => csvCell(row[column])).join(','))
    }
    return `${lines.join('\r\n')}\r\n`
}

function nextSessionNo(targetCode) {
    return attempts.filter((a) => (a.body.targetCode ?? a.body.participantCode) === targetCode).length + 1
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const path = url.pathname
    const method = req.method ?? 'GET'

    try {
        if (method === 'OPTIONS') {
            res.writeHead(204)
            res.end()
            return
        }
        if (method === 'GET' && path === '/health') {
            json(res, 200, { ok: true })
            return
        }
        if (method === 'GET' && path === '/__test__/state') {
            json(res, 200, { attempts })
            return
        }
        if (method === 'POST' && path === '/__test__/reset') {
            attempts = []
            attemptSeq = 0
            puzzleSeq = 0
            puzzleByMfaToken = new Map()
            json(res, 200, { ok: true })
            return
        }

        if (path.startsWith('/api/v1/author-trial/')) {
            const key = req.headers['x-author-trial-key']
            if (key !== ACCESS_CODE) {
                json(res, 401, { code: 'TRIAL_KEY_INVALID' })
                return
            }

            if (method === 'GET' && path === '/api/v1/author-trial/participants') {
                json(res, 200, { tenantId: 'trial-tenant', participants: PARTICIPANTS, flow: FLOW })
                return
            }

            if (method === 'POST' && path === '/api/v1/author-trial/session') {
                const body = await readBody(req)
                const known = new Set(PARTICIPANTS.map((p) => p.code))
                if (!known.has(body.participantCode)) {
                    json(res, 400, { code: 'TRIAL_PARTICIPANT_INVALID' })
                    return
                }
                if (body.mode === 'attack') {
                    if (!known.has(body.targetCode) || body.targetCode === body.participantCode) {
                        json(res, 400, { code: 'TRIAL_TARGET_INVALID' })
                        return
                    }
                }
                attemptSeq += 1
                const targetCode =
                    body.mode === 'attack' ? body.targetCode : body.participantCode
                const attempt = {
                    attemptId: `attempt-${attemptSeq}`,
                    sequence: attemptSeq,
                    sessionNo: nextSessionNo(targetCode),
                    mfaSessionToken: `mfa-${attemptSeq}`,
                    body,
                    createdAt: new Date().toISOString(),
                    round: 1,
                    position: attemptSeq,
                    challenge: 'blink',
                    puzzleSessionId: null,
                    finish: null,
                }
                attempts.push(attempt)
                json(res, 200, {
                    attemptId: attempt.attemptId,
                    mfaSessionToken: attempt.mfaSessionToken,
                    participantCode: body.participantCode,
                    targetCode,
                    mode: body.mode,
                    round: attempt.round,
                    position: attempt.position,
                    challenge: attempt.challenge,
                    binding: true,
                    difficulty: 'easy',
                    count: 1,
                    puzzleConfig: {
                        allowedChallengeTypes: ['blink'],
                        count: 1,
                        difficulty: 'easy',
                        alsoMatchFaceIdentity: true,
                    },
                })
                return
            }

            const finishMatch = path.match(/^\/api\/v1\/author-trial\/attempts\/([^/]+)\/finish$/)
            if (method === 'POST' && finishMatch) {
                const attemptId = decodeURIComponent(finishMatch[1])
                const body = await readBody(req)
                const attempt = attempts.find((a) => a.attemptId === attemptId)
                if (!attempt) {
                    json(res, 404, { code: 'TRIAL_ATTEMPT_NOT_FOUND' })
                    return
                }
                attempt.finish = { ...body, finishedAt: new Date().toISOString() }
                json(res, 200, { ok: true })
                return
            }

            if (method === 'POST' && path === '/api/v1/author-trial/enroll') {
                await readBody(req)
                json(res, 200, { ok: true })
                return
            }

            if (method === 'GET' && path === '/api/v1/author-trial/export') {
                const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv'
                if (format === 'json') {
                    json(res, 200, attempts.map(rowFor))
                } else {
                    const text = exportCsv()
                    res.writeHead(200, {
                        'Content-Type': 'text/csv; charset=utf-8',
                        'Content-Disposition': 'attachment; filename="author_trial_sessions.csv"',
                        'Cache-Control': 'no-store',
                        'Content-Length': Buffer.byteLength(text),
                    })
                    res.end(text)
                }
                return
            }

            json(res, 404, { code: 'TRIAL_NOT_FOUND' })
            return
        }

        if (method === 'POST' && path === '/api/v1/auth/mfa/puzzle/session') {
            const body = await readBody(req)
            puzzleSeq += 1
            const puzzleId = `puzzle-${puzzleSeq}`
            if (typeof body.sessionToken === 'string') {
                puzzleByMfaToken.set(body.sessionToken, puzzleId)
                const attempt = attempts.find((a) => a.mfaSessionToken === body.sessionToken)
                if (attempt) attempt.puzzleSessionId = puzzleId
            }
            json(res, 200, {
                session_id: puzzleId,
                challenges: [{ action: 'blink', params: null }],
                trace_contract: 'v2',
                trace_face_indices: [],
            })
            return
        }

        if (method === 'POST' && /^\/api\/v1\/auth\/mfa\/puzzle\/session\/[^/]+\/challenge$/.test(path)) {
            await readBody(req)
            json(res, 200, { verified: true, action: 'blink', reason_code: null })
            return
        }

        if (method === 'POST' && path === '/api/v1/auth/mfa/step') {
            await readBody(req)
            json(res, 200, { status: 'FAILED', message: 'stub: challenge never completes' })
            return
        }

        if (path === '/api/v1/auth/me' || path === '/api/v1/auth/refresh' || path === '/api/v1/auth/logout') {
            json(res, 401, { errorCode: 'UNAUTHORIZED' })
            return
        }

        json(res, 404, { code: 'NOT_FOUND', path })
    } catch (error) {
        json(res, 500, { code: 'STUB_ERROR', message: String(error?.message ?? error) })
    }
})

server.listen(PORT, '127.0.0.1', () => {
    // eslint-disable-next-line no-console -- Playwright webServer health log
    console.log(`[author-trial stub] listening on http://127.0.0.1:${PORT}`)
})