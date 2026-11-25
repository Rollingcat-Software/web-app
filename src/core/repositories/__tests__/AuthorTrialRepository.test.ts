import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthorTrialRepository } from '../AuthorTrialRepository'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type {
    AuthorTrialParticipantsResponse,
    AuthorTrialSessionRequest,
    AuthorTrialSessionResponse,
} from '@domain/models/AuthorTrial'

const ok = (data: unknown) => ({ data, status: 200, statusText: 'OK', headers: {} })

const KEY = 'trial-key'

const participants: AuthorTrialParticipantsResponse = {
    tenantId: 'tenant-1',
    participants: [
        { code: 'P1', enrolled: true },
        { code: 'P2', enrolled: false },
    ],
    flow: { method: 'PUZZLE', binding: true, difficulty: 'easy', count: 1, challenges: ['blink'] },
}

const session: AuthorTrialSessionResponse = {
    attemptId: 'attempt-1',
    mfaSessionToken: 'mfa-1',
    participantCode: 'P1',
    targetCode: 'P2',
    mode: 'attack',
    round: 1,
    position: 2,
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

describe('AuthorTrialRepository', () => {
    let httpClient: IHttpClient
    let repository: AuthorTrialRepository

    beforeEach(() => {
        httpClient = {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            patch: vi.fn(),
        }
        repository = new AuthorTrialRepository(httpClient)
    })

    it('GET /author-trial/participants carries X-Author-Trial-Key', async () => {
        vi.mocked(httpClient.get).mockResolvedValue(ok(participants))

        const result = await repository.getParticipants(KEY)

        expect(httpClient.get).toHaveBeenCalledWith('/author-trial/participants', {
            headers: { 'X-Author-Trial-Key': KEY },
        })
        expect(result).toBe(participants)
    })

    it('POST /author-trial/session sends the contract body and the key header', async () => {
        vi.mocked(httpClient.post).mockResolvedValue(ok(session))
        const request: AuthorTrialSessionRequest = {
            participantCode: 'P1',
            mode: 'attack',
            targetCode: 'P2',
            instrument: 'DeepFaceLive 2.0',
            instrumentPreset: 'live_face_swap',
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
            webVersion: 'web-1',
        }

        const result = await repository.createSession(KEY, request)

        expect(httpClient.post).toHaveBeenCalledWith('/author-trial/session', request, {
            headers: { 'X-Author-Trial-Key': KEY },
        })
        expect(result).toBe(session)
    })

    it('POST /author-trial/attempts/{id}/finish URL-encodes the attempt id', async () => {
        vi.mocked(httpClient.post).mockResolvedValue(ok({}))

        await repository.finishAttempt(KEY, 'a b/c', {
            clientOutcome: 'abandoned',
            clientLatencyMs: 1234,
            failureReason: 'stopped',
        })

        expect(httpClient.post).toHaveBeenCalledWith(
            '/author-trial/attempts/a%20b%2Fc/finish',
            { clientOutcome: 'abandoned', clientLatencyMs: 1234, failureReason: 'stopped' },
            { headers: { 'X-Author-Trial-Key': KEY } },
        )
    })

    it('POST /author-trial/enroll sends only the embedding + code + version', async () => {
        vi.mocked(httpClient.post).mockResolvedValue(ok({}))
        const embedding = Array.from({ length: 512 }, () => 0.01)

        await repository.enroll(KEY, { participantCode: 'P2', embedding, webVersion: 'web-1' })

        expect(httpClient.post).toHaveBeenCalledWith(
            '/author-trial/enroll',
            { participantCode: 'P2', embedding, webVersion: 'web-1' },
            { headers: { 'X-Author-Trial-Key': KEY } },
        )
    })

    it('GET /author-trial/export uses responseType text and the format param', async () => {
        vi.mocked(httpClient.get).mockResolvedValue(ok('date,participant\n'))

        const csv = await repository.exportSessions(KEY, 'csv')

        expect(httpClient.get).toHaveBeenCalledWith('/author-trial/export', {
            params: { format: 'csv' },
            headers: { 'X-Author-Trial-Key': KEY },
            responseType: 'text',
        })
        expect(csv).toBe('date,participant\n')

        await repository.exportSessions(KEY, 'json')
        expect(httpClient.get).toHaveBeenLastCalledWith('/author-trial/export', {
            params: { format: 'json' },
            headers: { 'X-Author-Trial-Key': KEY },
            responseType: 'text',
        })
    })
})