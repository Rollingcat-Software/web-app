/**
 * useAccountSwitcher — Phase 5 hook. Verifies it loads memberships from
 * /identity/me and that switchMembership() POSTs to /auth/switch-membership and
 * persists the returned tokens through the SAME path the login flow uses
 * (ITokenService.storeTokens) so refresh + interceptors keep working.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { httpGet, httpPost, storeTokens } = vi.hoisted(() => ({
    httpGet: vi.fn(),
    httpPost: vi.fn(),
    storeTokens: vi.fn().mockResolvedValue(undefined),
}))

// Use the REAL DI type symbols (Symbol.for is global) so the container mock can
// route by identifier without referencing a hoisted local TYPES object.
vi.mock('@core/di/container', () => ({
    container: {
        get: (sym: symbol) => {
            if (sym === Symbol.for('HttpClient')) return { get: httpGet, post: httpPost }
            if (sym === Symbol.for('TokenService')) return { storeTokens }
            if (sym === Symbol.for('Logger')) {
                return { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
            }
            return {}
        },
    },
}))

import { useAccountSwitcher } from '../useAccountSwitcher'

const ME = {
    identityId: 'id-1',
    emails: [{ email: 'me@fivucsas.com', verified: true }],
    memberships: [
        { userId: 'u-self', tenantId: 't-1', tenantName: 'Fivucsas', role: 'TENANT_ADMIN', isActive: true },
        { userId: 'u-other', tenantId: 't-2', tenantName: 'Marmara', role: 'TENANT_MEMBER', isActive: true },
    ],
}

describe('useAccountSwitcher', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        httpGet.mockResolvedValue({ data: ME })
    })

    it('loads memberships from /identity/me and exposes canSwitch when >1', async () => {
        const { result } = renderHook(() => useAccountSwitcher())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(httpGet).toHaveBeenCalledWith('/identity/me')
        expect(result.current.memberships).toHaveLength(2)
        expect(result.current.canSwitch).toBe(true)
    })

    it('POSTs switch-membership and swaps tokens via the login persistence path', async () => {
        httpPost.mockResolvedValue({
            data: { accessToken: 'NEW_ACCESS', refreshToken: 'NEW_REFRESH', expiresIn: 900 },
        })
        const { result } = renderHook(() => useAccountSwitcher())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.switchMembership('u-other')
        })

        expect(httpPost).toHaveBeenCalledWith('/auth/switch-membership', { targetUserId: 'u-other' })
        // EXACT login token-persistence path is reused.
        expect(storeTokens).toHaveBeenCalledWith({
            accessToken: 'NEW_ACCESS',
            refreshToken: 'NEW_REFRESH',
        })
    })

    it('re-throws on failure and does not persist tokens', async () => {
        httpPost.mockRejectedValue(new Error('403'))
        const { result } = renderHook(() => useAccountSwitcher())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await expect(
            act(async () => {
                await result.current.switchMembership('u-other')
            }),
        ).rejects.toThrow()
        expect(storeTokens).not.toHaveBeenCalled()
    })

    it('soft-hides (canSwitch false) when /identity/me has a single membership', async () => {
        httpGet.mockResolvedValue({ data: { ...ME, memberships: [ME.memberships[0]] } })
        const { result } = renderHook(() => useAccountSwitcher())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.canSwitch).toBe(false)
    })
})
