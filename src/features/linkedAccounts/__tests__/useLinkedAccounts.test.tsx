/**
 * useLinkedAccounts — Phase-2 account-linking data hook (edge cases).
 *
 * Locks in the wire contract that the LinkedAccountsSection / LinkAccountDialog
 * depend on, and — crucially — that every path is BASE-RELATIVE (the DI
 * HttpClient base URL already carries `/api/v1`, so a leading `/api/v1` here
 * would double to `/api/v1/api/v1` and 404). Also guards the SOFT-FAIL on a
 * `/identity/me` load error: the hook must surface `error: 'loadError'` and
 * never throw (the Profile section hides itself, it does not crash).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { httpGet, httpPost, logError } = vi.hoisted(() => ({
    httpGet: vi.fn(),
    httpPost: vi.fn(),
    logError: vi.fn(),
}))

// Route DI resolution by the global Symbol.for identifiers (same pattern as the
// sibling useAccountSwitcher test) so we never import the real container graph.
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

import { useLinkedAccounts } from '../useLinkedAccounts'

const ME = {
    identityId: 'id-1',
    emails: [{ email: 'me@fivucsas.com', verified: true }],
    memberships: [
        { userId: 'u-self', tenantId: 't-1', tenantName: 'Fivucsas', role: 'TENANT_ADMIN', isActive: true },
    ],
}

describe('useLinkedAccounts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        httpGet.mockResolvedValue({ data: ME })
        httpPost.mockResolvedValue({ data: {} })
    })

    it('loads /identity/me on mount with a BASE-RELATIVE path (no /api/v1 doubling)', async () => {
        const { result } = renderHook(() => useLinkedAccounts())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(httpGet).toHaveBeenCalledWith('/identity/me')
        // Regression guard: never the doubled path.
        expect(httpGet).not.toHaveBeenCalledWith('/api/v1/identity/me')
        expect(result.current.data).toEqual(ME)
        expect(result.current.error).toBeNull()
    })

    it('handles ZERO memberships without error (section will render empty)', async () => {
        httpGet.mockResolvedValue({ data: { ...ME, memberships: [] } })
        const { result } = renderHook(() => useLinkedAccounts())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.data?.memberships).toEqual([])
        expect(result.current.error).toBeNull()
    })

    it('soft-fails on a /identity/me load error: error="loadError", no throw', async () => {
        httpGet.mockRejectedValue({ response: { status: 500 } })
        const { result } = renderHook(() => useLinkedAccounts())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBe('loadError')
        expect(result.current.data).toBeNull()
        expect(logError).toHaveBeenCalled()
    })

    it('initiateLink POSTs the OTP-initiate with a base-relative path', async () => {
        const { result } = renderHook(() => useLinkedAccounts())
        await waitFor(() => expect(result.current.loading).toBe(false))
        await act(async () => {
            await result.current.initiateLink('new@acme.test')
        })
        expect(httpPost).toHaveBeenCalledWith('/identity/link/initiate', { email: 'new@acme.test' })
        expect(httpPost).not.toHaveBeenCalledWith('/api/v1/identity/link/initiate', expect.anything())
    })

    it('confirmLink POSTs email+otp+password (step-up) base-relative', async () => {
        const { result } = renderHook(() => useLinkedAccounts())
        await waitFor(() => expect(result.current.loading).toBe(false))
        await act(async () => {
            await result.current.confirmLink('new@acme.test', '123456', 'pw')
        })
        expect(httpPost).toHaveBeenCalledWith('/identity/link/confirm', {
            email: 'new@acme.test',
            otp: '123456',
            password: 'pw',
        })
    })

    it('confirmLink REJECTS (propagates) on wrong-OTP 422 so the dialog can show the error', async () => {
        httpPost.mockRejectedValue({ response: { status: 422, data: { errorCode: 'INVALID_OTP' } } })
        const { result } = renderHook(() => useLinkedAccounts())
        await waitFor(() => expect(result.current.loading).toBe(false))
        await expect(
            act(async () => {
                await result.current.confirmLink('e', 'wrong', 'pw')
            }),
        ).rejects.toBeTruthy()
    })

    it('confirmLink REJECTS on step-up wrong-password 401', async () => {
        httpPost.mockRejectedValue({ response: { status: 401 } })
        const { result } = renderHook(() => useLinkedAccounts())
        await waitFor(() => expect(result.current.loading).toBe(false))
        await expect(
            act(async () => {
                await result.current.confirmLink('e', '123456', 'badpw')
            }),
        ).rejects.toBeTruthy()
    })

    it('unlink POSTs the membership user-id base-relative', async () => {
        const { result } = renderHook(() => useLinkedAccounts())
        await waitFor(() => expect(result.current.loading).toBe(false))
        await act(async () => {
            await result.current.unlink('u-other')
        })
        expect(httpPost).toHaveBeenCalledWith('/identity/unlink', { membershipUserId: 'u-other' })
    })

    it('refetch clears a previous error on a subsequent success', async () => {
        httpGet.mockRejectedValueOnce({ response: { status: 503 } })
        const { result } = renderHook(() => useLinkedAccounts())
        await waitFor(() => expect(result.current.error).toBe('loadError'))
        httpGet.mockResolvedValue({ data: ME })
        await act(async () => {
            await result.current.refetch()
        })
        expect(result.current.error).toBeNull()
        expect(result.current.data).toEqual(ME)
    })
})
