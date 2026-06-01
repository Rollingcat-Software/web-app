import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { SearchResult } from '@core/services/BiometricService'

// ── Module mocks (must be declared before importing the hook) ───────────────

// 1) BiometricService.searchFace — returns the identity-opaque 1:N match list.
const mockSearchFace = vi.fn()
vi.mock('@core/services/BiometricService', () => ({
    getBiometricService: () => ({
        searchFace: mockSearchFace,
    }),
}))

// 2) DI: the hook resolves a TokenService for the Bearer header.
const mockGetAccessToken = vi.fn()
vi.mock('@app/providers', () => ({
    useService: () => ({
        getAccessToken: mockGetAccessToken,
    }),
}))

// 3) Pin the API base URL so the name-lookup fetch URL is deterministic.
vi.mock('@config/env', () => ({
    config: { apiBaseUrl: 'http://api.test/api/v1' },
}))

// Import after mocks are set up.
import { useFaceSearch } from '../useFaceSearch'

/** Build a minimal search payload with the given user ids. */
function searchResultWith(...userIds: string[]): SearchResult {
    return {
        found: userIds.length > 0,
        userId: userIds[0] ?? null,
        confidence: 0.91,
        distance: 0.12,
        results: userIds.map((userId, i) => ({
            userId,
            distance: 0.12 + i * 0.01,
            confidence: 0.91 - i * 0.05,
        })),
    }
}

describe('useFaceSearch — name resolution', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetAccessToken.mockResolvedValue('test-jwt')
        // Default: every /users/{id} lookup returns a named, live user.
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }),
        }))
    })

    it('hydrates name + email + resolved flag for a live owner', async () => {
        mockSearchFace.mockResolvedValue(searchResultWith('u-1'))

        const { result } = renderHook(() => useFaceSearch())

        await act(async () => {
            await result.current.searchFace('data:image/jpeg;base64,AAAA', 'tenant-1')
        })

        const match = result.current.result!.results[0]
        expect(match.userName).toBe('Ada Lovelace')
        expect(match.userEmail).toBe('ada@example.com')
        expect(match.userResolved).toBe(true)
        // Bearer token forwarded to the name lookup.
        expect(fetch).toHaveBeenCalledWith(
            'http://api.test/api/v1/users/u-1',
            { headers: { Authorization: 'Bearer test-jwt' } },
        )
    })

    it('reads firstName/lastName/email from a {data:{...}} envelope shape', async () => {
        mockSearchFace.mockResolvedValue(searchResultWith('u-2'))
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' } }),
        }))

        const { result } = renderHook(() => useFaceSearch())
        await act(async () => {
            await result.current.searchFace('img', 'tenant-1')
        })

        const match = result.current.result!.results[0]
        expect(match.userName).toBe('Grace Hopper')
        expect(match.userEmail).toBe('grace@example.com')
        expect(match.userResolved).toBe(true)
    })

    it('marks a soft-deleted / missing owner (404) unresolved without crashing', async () => {
        mockSearchFace.mockResolvedValue(searchResultWith('gone'))
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({}),
        }))

        const { result } = renderHook(() => useFaceSearch())
        await act(async () => {
            await result.current.searchFace('img', 'tenant-1')
        })

        const match = result.current.result!.results[0]
        expect(match.userName).toBeUndefined()
        expect(match.userEmail).toBeUndefined()
        expect(match.userResolved).toBe(false)
        // Raw id still available for the UI fallback.
        expect(match.userId).toBe('gone')
        expect(result.current.error).toBeNull()
    })

    it('marks the match unresolved when the lookup throws (network error)', async () => {
        mockSearchFace.mockResolvedValue(searchResultWith('u-3'))
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

        const { result } = renderHook(() => useFaceSearch())
        await act(async () => {
            await result.current.searchFace('img', 'tenant-1')
        })

        const match = result.current.result!.results[0]
        expect(match.userResolved).toBe(false)
        expect(match.userName).toBeUndefined()
        // A failed name lookup must NOT fail the whole search.
        expect(result.current.error).toBeNull()
        expect(result.current.result!.found).toBe(true)
    })

    it('resolves a live owner with no name set as resolved (email fallback, not "unknown")', async () => {
        mockSearchFace.mockResolvedValue(searchResultWith('u-4'))
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ email: 'noname@example.com' }),
        }))

        const { result } = renderHook(() => useFaceSearch())
        await act(async () => {
            await result.current.searchFace('img', 'tenant-1')
        })

        const match = result.current.result!.results[0]
        expect(match.userName).toBeUndefined()
        expect(match.userEmail).toBe('noname@example.com')
        expect(match.userResolved).toBe(true)
    })

    it('resolves all matches in parallel (one lookup per match, bounded by maxResults)', async () => {
        mockSearchFace.mockResolvedValue(searchResultWith('u-a', 'u-b', 'u-c'))
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ firstName: 'X', lastName: 'Y', email: 'x@y.z' }),
        })
        vi.stubGlobal('fetch', fetchMock)

        const { result } = renderHook(() => useFaceSearch())
        await act(async () => {
            await result.current.searchFace('img', 'tenant-1')
        })

        // Exactly one name lookup per match — no extra requests.
        expect(fetchMock).toHaveBeenCalledTimes(3)
        expect(result.current.result!.results.every((m) => m.userResolved)).toBe(true)
    })

    it('surfaces search errors and resolves no names when the search itself fails', async () => {
        mockSearchFace.mockRejectedValue(new Error('search 422'))
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)

        const { result } = renderHook(() => useFaceSearch())
        await act(async () => {
            await result.current.searchFace('img', 'tenant-1')
        })

        expect(result.current.result).toBeNull()
        expect(result.current.error).toBe('search 422')
        // No name lookups when there are no matches.
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
