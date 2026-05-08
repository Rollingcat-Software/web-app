/**
 * Unit tests for LoggerService — locks the prod sink contract.
 *
 * Regression motivation (P1, audit 2026-05-07): `sendToLogService` and
 * `sendToErrorTracking` were silent no-ops, so every browser-side error
 * was dropped on the floor in production. This test asserts that:
 *   1. With the feature flag OFF the sink stays a no-op (network silent).
 *   2. With the feature flag ON the sink invokes navigator.sendBeacon
 *      against `${apiBaseUrl}/client-logs` for both info/warn and errors.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { LoggerService } from '../LoggerService'
import type { IConfig } from '@domain/interfaces/IConfig'

function makeConfig(overrides: Partial<IConfig> = {}): IConfig {
    return {
        apiBaseUrl: 'https://api.example.com/api/v1',
        apiTimeout: 5000,
        useMockAPI: false,
        environment: 'production',
        logLevel: 'info',
        ...overrides,
    } as IConfig
}

const originalSendBeacon = (globalThis.navigator as Navigator | undefined)?.sendBeacon
const originalFetch = globalThis.fetch

afterEach(() => {
    if (originalSendBeacon !== undefined) {
        Object.defineProperty(globalThis.navigator, 'sendBeacon', {
            value: originalSendBeacon,
            configurable: true,
        })
    }
    globalThis.fetch = originalFetch
    vi.unstubAllEnvs()
})

describe('LoggerService — prod sink wiring', () => {
    let beacon: ReturnType<typeof vi.fn>

    beforeEach(() => {
        beacon = vi.fn().mockReturnValue(true)
        Object.defineProperty(globalThis.navigator, 'sendBeacon', {
            value: beacon,
            configurable: true,
            writable: true,
        })
    })

    it('feature flag OFF: sink is a no-op (no beacon, no fetch)', () => {
        vi.stubEnv('VITE_CLIENT_LOG_SINK_ENABLED', 'false')
        const fetchSpy = vi.fn()
        globalThis.fetch = fetchSpy as unknown as typeof fetch

        const logger = new LoggerService(makeConfig())
        logger.error('boom', new Error('x'))
        logger.info('hi', { a: 1 })

        expect(beacon).not.toHaveBeenCalled()
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('feature flag ON: error path posts to /client-logs via sendBeacon', () => {
        vi.stubEnv('VITE_CLIENT_LOG_SINK_ENABLED', 'true')

        const logger = new LoggerService(makeConfig())
        logger.error('upload failed', new Error('502'))

        expect(beacon).toHaveBeenCalledTimes(1)
        const [url, blob] = beacon.mock.calls[0] as [string, Blob]
        expect(url).toBe('https://api.example.com/api/v1/client-logs')
        expect(blob).toBeInstanceOf(Blob)
    })

    it('feature flag ON: info path posts to /client-logs via sendBeacon', () => {
        vi.stubEnv('VITE_CLIENT_LOG_SINK_ENABLED', 'true')

        const logger = new LoggerService(makeConfig())
        logger.info('user clicked verify')

        expect(beacon).toHaveBeenCalledTimes(1)
        const [url] = beacon.mock.calls[0] as [string]
        expect(url).toBe('https://api.example.com/api/v1/client-logs')
    })

    it('falls back to fetch keepalive when sendBeacon is unavailable', async () => {
        vi.stubEnv('VITE_CLIENT_LOG_SINK_ENABLED', 'true')
        // Simulate no sendBeacon support
        Object.defineProperty(globalThis.navigator, 'sendBeacon', {
            value: undefined,
            configurable: true,
            writable: true,
        })
        const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
        globalThis.fetch = fetchSpy as unknown as typeof fetch

        const logger = new LoggerService(makeConfig())
        logger.error('boom', new Error('x'))

        expect(fetchSpy).toHaveBeenCalledTimes(1)
        const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
        expect(url).toBe('https://api.example.com/api/v1/client-logs')
        expect(init.method).toBe('POST')
        expect(init.keepalive).toBe(true)
    })
})
