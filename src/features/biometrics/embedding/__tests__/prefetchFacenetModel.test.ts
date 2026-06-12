/**
 * Unit tests for prefetchFacenetModel — the fire-and-forget warm-up of the
 * Facenet512 model cache (SP-A go-live, so the ~47 MB download happens on the
 * login surface's idle time instead of freezing the FACE-step submit).
 *
 * Contract under test (getModel + the flag are mocked — no ONNX, no 47 MB fetch):
 *   - Flag OFF → no-op: getModel is never called; scheduleFacenetPrefetch never
 *     schedules idle work.
 *   - Flag ON  → getModel is called once with the canonical URL + SHA256.
 *   - De-dup: concurrent calls share ONE in-flight getModel (one download).
 *   - Never throws / never rejects: a failing getModel resolves the prefetch and
 *     resets so a later call can retry.
 *   - scheduleFacenetPrefetch uses requestIdleCallback when present (fallback
 *     setTimeout) and the returned cleanup cancels a still-pending schedule.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
    DEFAULT_FACENET_MODEL_URL,
    DEFAULT_FACENET_MODEL_SHA256,
} from '../facenetEmbedder'

// Injectable flag + getModel mock so the test is deterministic.
const flagState = { enabled: false }
const getModelMock = vi.fn<(url: string, sha: string) => Promise<ArrayBuffer>>()

vi.mock('../clientEmbeddingFlag', () => ({
    isClientSideEmbeddingEnabled: () => flagState.enabled,
}))
vi.mock('../modelCache', () => ({
    getModel: (url: string, sha: string) => getModelMock(url, sha),
}))

// Import AFTER the mocks so the module binds to them. Use a dynamic re-import per
// test via vi.resetModules so the module-scoped `inFlight` de-dup cache is fresh.
async function loadModule() {
    vi.resetModules()
    return import('../prefetchFacenetModel')
}

describe('prefetchFacenetModel', () => {
    beforeEach(() => {
        flagState.enabled = false
        getModelMock.mockReset()
        getModelMock.mockResolvedValue(new ArrayBuffer(8))
    })

    it('flag OFF: is a no-op — never calls getModel', async () => {
        flagState.enabled = false
        const { prefetchFacenetModel } = await loadModule()

        await prefetchFacenetModel()

        expect(getModelMock).not.toHaveBeenCalled()
    })

    it('flag ON: warms the cache with the canonical URL + SHA256', async () => {
        flagState.enabled = true
        const { prefetchFacenetModel } = await loadModule()

        await prefetchFacenetModel()

        expect(getModelMock).toHaveBeenCalledTimes(1)
        expect(getModelMock).toHaveBeenCalledWith(
            DEFAULT_FACENET_MODEL_URL,
            DEFAULT_FACENET_MODEL_SHA256,
        )
    })

    it('flag ON: concurrent calls share ONE in-flight download (de-dup)', async () => {
        flagState.enabled = true
        const { prefetchFacenetModel } = await loadModule()

        await Promise.all([
            prefetchFacenetModel(),
            prefetchFacenetModel(),
            prefetchFacenetModel(),
        ])

        expect(getModelMock).toHaveBeenCalledTimes(1)
    })

    it('flag ON: a failing getModel never rejects and resets for a later retry', async () => {
        flagState.enabled = true
        getModelMock.mockRejectedValueOnce(new Error('network down'))
        const { prefetchFacenetModel } = await loadModule()

        // Must not reject despite getModel throwing.
        await expect(prefetchFacenetModel()).resolves.toBeUndefined()

        // After a failure the in-flight cache resets, so a later call retries.
        getModelMock.mockResolvedValueOnce(new ArrayBuffer(8))
        await prefetchFacenetModel()
        expect(getModelMock).toHaveBeenCalledTimes(2)
    })
})

describe('scheduleFacenetPrefetch', () => {
    beforeEach(() => {
        flagState.enabled = false
        getModelMock.mockReset()
        getModelMock.mockResolvedValue(new ArrayBuffer(8))
    })

    it('flag OFF: returns a no-op cleanup and schedules nothing', async () => {
        flagState.enabled = false
        const ric = vi.fn()
        vi.stubGlobal('requestIdleCallback', ric)
        const { scheduleFacenetPrefetch } = await loadModule()

        const cleanup = scheduleFacenetPrefetch()

        expect(ric).not.toHaveBeenCalled()
        expect(() => cleanup()).not.toThrow()
        vi.unstubAllGlobals()
    })

    it('flag ON: schedules via requestIdleCallback when available', async () => {
        flagState.enabled = true
        let idleCb: (() => void) | null = null
        const ric = vi.fn((cb: () => void) => {
            idleCb = cb
            return 42
        })
        const cic = vi.fn()
        vi.stubGlobal('requestIdleCallback', ric)
        vi.stubGlobal('cancelIdleCallback', cic)
        const { scheduleFacenetPrefetch } = await loadModule()

        const cleanup = scheduleFacenetPrefetch()
        expect(ric).toHaveBeenCalledTimes(1)

        // Fire the idle callback → the prefetch runs and downloads.
        idleCb?.()
        await Promise.resolve()
        await Promise.resolve()
        expect(getModelMock).toHaveBeenCalledTimes(1)

        // Cleanup cancels the idle handle.
        cleanup()
        expect(cic).toHaveBeenCalledWith(42)
        vi.unstubAllGlobals()
    })

    it('flag ON: falls back to setTimeout when requestIdleCallback is absent', async () => {
        flagState.enabled = true
        vi.stubGlobal('requestIdleCallback', undefined)
        vi.stubGlobal('cancelIdleCallback', undefined)
        const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
        const { scheduleFacenetPrefetch } = await loadModule()

        const cleanup = scheduleFacenetPrefetch()
        expect(setTimeoutSpy).toHaveBeenCalled()

        cleanup()
        expect(clearTimeoutSpy).toHaveBeenCalled()

        setTimeoutSpy.mockRestore()
        clearTimeoutSpy.mockRestore()
        vi.unstubAllGlobals()
    })
})
