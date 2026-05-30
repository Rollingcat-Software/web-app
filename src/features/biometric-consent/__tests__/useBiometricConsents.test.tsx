/**
 * useBiometricConsents — Phase-3 per-tenant biometric consent hook (edge cases).
 *
 * REGRESSION GUARD (real shipped bug): the request path MUST be the
 * base-relative `/identity/biometric/consents`. The DI HttpClient base URL
 * already carries `/api/v1`, so a leading `/api/v1` here doubled the segment to
 * `/api/v1/api/v1/identity/biometric/consents` and 404'd
 * (NoResourceFoundException). These tests lock the correct path on BOTH the GET
 * (list) and the POST (toggle).
 *
 * Also covers: empty list, toggle→reload, 403 (no membership) surfaced via a
 * re-throw, and 500 re-throw so the section can revert/own its error and never
 * silently lie that the toggle succeeded.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { httpGet, httpPost, logError } = vi.hoisted(() => ({
    httpGet: vi.fn(),
    httpPost: vi.fn(),
    logError: vi.fn(),
}))

vi.mock('@core/di/container', () => ({
    container: {
        get: (sym: symbol) => {
            if (sym === Symbol.for('HttpClient')) return { get: httpGet, post: httpPost }
            if (sym === Symbol.for('Logger')) {
                return { error: logError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
            }
            return {}
        },
    },
}))

import { useBiometricConsents } from '../useBiometricConsents'

const CONSENTS = [
    { id: 'c1', tenantId: 't-2', method: null, granted: true, grantedAt: '2026-05-01T00:00:00Z' },
]

const EXPECTED_PATH = '/identity/biometric/consents'
const DOUBLED_PATH = '/api/v1/identity/biometric/consents'

describe('useBiometricConsents', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        httpGet.mockResolvedValue({ data: CONSENTS })
        httpPost.mockResolvedValue({ data: {} })
    })

    it('loads consents from the BASE-RELATIVE path (regression: never /api/v1/api/v1)', async () => {
        const { result } = renderHook(() => useBiometricConsents())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(httpGet).toHaveBeenCalledWith(EXPECTED_PATH)
        expect(httpGet).not.toHaveBeenCalledWith(DOUBLED_PATH)
        expect(result.current.consents).toEqual(CONSENTS)
    })

    it('renders an EMPTY list cleanly when the backend returns none', async () => {
        httpGet.mockResolvedValue({ data: [] })
        const { result } = renderHook(() => useBiometricConsents())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.consents).toEqual([])
        expect(result.current.error).toBeNull()
    })

    it('tolerates a null/undefined body (data ?? [])', async () => {
        httpGet.mockResolvedValue({ data: undefined })
        const { result } = renderHook(() => useBiometricConsents())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.consents).toEqual([])
    })

    it('setConsent POSTs the BASE-RELATIVE path then reloads (granted=true)', async () => {
        const { result } = renderHook(() => useBiometricConsents())
        await waitFor(() => expect(result.current.loading).toBe(false))
        httpGet.mockClear()

        await act(async () => {
            await result.current.setConsent('t-2', true, null)
        })

        expect(httpPost).toHaveBeenCalledWith(EXPECTED_PATH, {
            tenantId: 't-2',
            method: null,
            granted: true,
        })
        expect(httpPost).not.toHaveBeenCalledWith(DOUBLED_PATH, expect.anything())
        // Reloads server state after a successful mutation.
        expect(httpGet).toHaveBeenCalledWith(EXPECTED_PATH)
    })

    it('setConsent revoke (granted=false) sends the right body', async () => {
        const { result } = renderHook(() => useBiometricConsents())
        await waitFor(() => expect(result.current.loading).toBe(false))
        await act(async () => {
            await result.current.setConsent('t-2', false, null)
        })
        expect(httpPost).toHaveBeenCalledWith(EXPECTED_PATH, {
            tenantId: 't-2',
            method: null,
            granted: false,
        })
    })

    it('toggling for a tenant with NO membership (403) RE-THROWS and does not reload', async () => {
        httpPost.mockRejectedValue({ response: { status: 403, data: { errorCode: 'FORBIDDEN' } } })
        const { result } = renderHook(() => useBiometricConsents())
        await waitFor(() => expect(result.current.loading).toBe(false))
        httpGet.mockClear()

        // Catch the rejection INSIDE act so React flushes the setError state
        // update before we assert on it.
        let threw = false
        await act(async () => {
            try {
                await result.current.setConsent('t-no-membership', true, null)
            } catch {
                threw = true
            }
        })
        expect(threw).toBe(true)

        // It must surface the error AND not pretend success by reloading.
        await waitFor(() => expect(result.current.error).toBeTruthy())
        expect(httpGet).not.toHaveBeenCalled()
        expect(logError).toHaveBeenCalled()
    })

    it('network 500 on toggle RE-THROWS (caller reverts / shows formatApiError)', async () => {
        httpPost.mockRejectedValue({ response: { status: 500 } })
        const { result } = renderHook(() => useBiometricConsents())
        await waitFor(() => expect(result.current.loading).toBe(false))
        await expect(
            act(async () => {
                await result.current.setConsent('t-2', false, null)
            }),
        ).rejects.toBeTruthy()
        expect(result.current.saving).toBe(false)
    })

    it('soft-records a load error without throwing (section can hide)', async () => {
        httpGet.mockRejectedValue({ response: { status: 500 } })
        const { result } = renderHook(() => useBiometricConsents())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBeTruthy()
        expect(result.current.consents).toEqual([])
    })
})
