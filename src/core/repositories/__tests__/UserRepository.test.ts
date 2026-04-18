import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UserRepository, parseContentDispositionFilename } from '../UserRepository'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'

/**
 * Covers the GDPR data export wiring added to UserRepository.
 * The rest of the repository is exercised via feature-level tests.
 */
describe('UserRepository.exportData', () => {
    let repository: UserRepository
    let httpClient: IHttpClient
    let logger: ILogger

    const userId = '123e4567-e89b-12d3-a456-426614174000'

    beforeEach(() => {
        httpClient = {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            patch: vi.fn(),
        }
        logger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }
        repository = new UserRepository(httpClient, logger)
    })

    it('returns the blob + filename from Content-Disposition on success', async () => {
        const serverBlob = new Blob(['{"user":"payload"}'], { type: 'application/json' })
        vi.mocked(httpClient.get).mockResolvedValue({
            data: serverBlob,
            status: 200,
            statusText: 'OK',
            headers: {
                'content-disposition': 'attachment; filename="fivucsas-export-abc-2026.json"',
            },
        })

        const result = await repository.exportData(userId)

        expect(httpClient.get).toHaveBeenCalledWith(
            `/users/${userId}/export`,
            { responseType: 'blob' }
        )
        expect(result.blob).toBe(serverBlob)
        expect(result.filename).toBe('fivucsas-export-abc-2026.json')
        expect(logger.info).toHaveBeenCalledWith(`Exporting user data for ${userId}`)
    })

    it('returns null filename when Content-Disposition is absent', async () => {
        vi.mocked(httpClient.get).mockResolvedValue({
            data: new Blob(['{}']),
            status: 200,
            statusText: 'OK',
            headers: {},
        })

        const result = await repository.exportData(userId)

        expect(result.filename).toBeNull()
    })

    it('propagates HTTP 429 so callers can surface a rate-limit message', async () => {
        const rateLimitError = {
            response: {
                status: 429,
                headers: { 'retry-after': '3600' },
                data: new Blob(),
            },
            message: 'Request failed with status code 429',
        }
        vi.mocked(httpClient.get).mockRejectedValue(rateLimitError)

        await expect(repository.exportData(userId)).rejects.toMatchObject({
            response: { status: 429, headers: { 'retry-after': '3600' } },
        })
        expect(logger.error).toHaveBeenCalledWith(
            `Failed to export user data for ${userId}`,
            rateLimitError
        )
    })
})

describe('parseContentDispositionFilename', () => {
    it('extracts a quoted filename', () => {
        expect(parseContentDispositionFilename('attachment; filename="foo.json"'))
            .toBe('foo.json')
    })

    it('extracts an unquoted filename', () => {
        expect(parseContentDispositionFilename('attachment; filename=bar.json'))
            .toBe('bar.json')
    })

    it('prefers RFC 5987 extended form when both are present', () => {
        expect(parseContentDispositionFilename(
            "attachment; filename=\"fallback.json\"; filename*=UTF-8''f%C3%B6o.json"
        )).toBe('föo.json')
    })

    it('returns null for missing or unparseable headers', () => {
        expect(parseContentDispositionFilename(undefined)).toBeNull()
        expect(parseContentDispositionFilename(null)).toBeNull()
        expect(parseContentDispositionFilename('')).toBeNull()
        expect(parseContentDispositionFilename('attachment')).toBeNull()
    })
})
