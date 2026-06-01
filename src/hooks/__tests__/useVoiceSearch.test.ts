import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Module mocks (must be declared before importing the hook) ───────────────

// 1) DI: the hook resolves a TokenService for the Bearer header.
const mockGetAccessToken = vi.fn()
vi.mock('@app/providers', () => ({
    useService: () => ({
        getAccessToken: mockGetAccessToken,
    }),
}))

// 2) Pin the API base URL so the search + name-lookup fetch URLs are deterministic.
vi.mock('@config/env', () => ({
    config: { apiBaseUrl: 'http://api.test/api/v1' },
}))

// Import after mocks are set up.
import { useVoiceSearch } from '../useVoiceSearch'

const SEARCH_URL = 'http://api.test/api/v1/biometric/voice/search'

/** A response object shaped like the global `fetch` Response we care about. */
type StubResponse = { ok: boolean; status?: number; json: () => Promise<unknown> }

/**
 * Build a `fetch` mock that routes by URL: the `/biometric/voice/search` POST
 * returns the 1:N match list (carrying only `user_id`), and every
 * `/users/{id}` GET returns whatever `userLookup` resolves for that id. This
 * mirrors useFaceSearch.test's name-lookup stub but adds the search leg the
 * voice hook owns directly (face search goes through BiometricService).
 */
function routedFetch(
    userIds: string[],
    userLookup: (id: string) => StubResponse,
) {
    return vi.fn((url: string): Promise<StubResponse> => {
        if (url === SEARCH_URL) {
            return Promise.resolve({
                ok: true,
                json: async () => ({
                    matches: userIds.map((userId, i) => ({
                        user_id: userId,
                        similarity: 0.91 - i * 0.05,
                    })),
                }),
            })
        }
        // /users/{id} name lookup — strip the prefix to get the raw id.
        const id = url.replace('http://api.test/api/v1/users/', '')
        return Promise.resolve(userLookup(id))
    })
}

/** Default name lookup: a named, live user. */
const namedUser: StubResponse = {
    ok: true,
    json: async () => ({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }),
}

describe('useVoiceSearch — name resolution', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetAccessToken.mockResolvedValue('test-jwt')
        // Default: search returns one match, whose /users lookup is a named user.
        vi.stubGlobal('fetch', routedFetch(['u-1'], () => namedUser))
    })

    it('hydrates name + email + resolved flag for a live owner', async () => {
        const { result } = renderHook(() => useVoiceSearch())

        await act(async () => {
            await result.current.searchVoice('AAAA')
        })

        const match = result.current.result!.matches[0]
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
        vi.stubGlobal('fetch', routedFetch(['u-2'], () => ({
            ok: true,
            json: async () => ({ data: { firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' } }),
        })))

        const { result } = renderHook(() => useVoiceSearch())
        await act(async () => {
            await result.current.searchVoice('AAAA')
        })

        const match = result.current.result!.matches[0]
        expect(match.userName).toBe('Grace Hopper')
        expect(match.userEmail).toBe('grace@example.com')
        expect(match.userResolved).toBe(true)
    })

    it('marks a soft-deleted / missing owner (404) unresolved without crashing', async () => {
        vi.stubGlobal('fetch', routedFetch(['gone'], () => ({
            ok: false,
            status: 404,
            json: async () => ({}),
        })))

        const { result } = renderHook(() => useVoiceSearch())
        await act(async () => {
            await result.current.searchVoice('AAAA')
        })

        const match = result.current.result!.matches[0]
        expect(match.userName).toBeUndefined()
        expect(match.userEmail).toBeUndefined()
        expect(match.userResolved).toBe(false)
        // Raw id still available for the UI fallback.
        expect(match.userId).toBe('gone')
        expect(result.current.error).toBeNull()
    })

    it('marks the match unresolved when the lookup throws (network error)', async () => {
        vi.stubGlobal('fetch', vi.fn((url: string): Promise<StubResponse> => {
            if (url === SEARCH_URL) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ matches: [{ user_id: 'u-3', similarity: 0.88 }] }),
                })
            }
            return Promise.reject(new Error('network down'))
        }))

        const { result } = renderHook(() => useVoiceSearch())
        await act(async () => {
            await result.current.searchVoice('AAAA')
        })

        const match = result.current.result!.matches[0]
        expect(match.userResolved).toBe(false)
        expect(match.userName).toBeUndefined()
        // A failed name lookup must NOT fail the whole search.
        expect(result.current.error).toBeNull()
        expect(result.current.result!.found).toBe(true)
    })

    it('resolves a live owner with no name set as resolved (email fallback, not "unknown")', async () => {
        vi.stubGlobal('fetch', routedFetch(['u-4'], () => ({
            ok: true,
            json: async () => ({ email: 'noname@example.com' }),
        })))

        const { result } = renderHook(() => useVoiceSearch())
        await act(async () => {
            await result.current.searchVoice('AAAA')
        })

        const match = result.current.result!.matches[0]
        expect(match.userName).toBeUndefined()
        expect(match.userEmail).toBe('noname@example.com')
        expect(match.userResolved).toBe(true)
    })

    it('resolves all matches in parallel (one lookup per match)', async () => {
        const fetchMock = routedFetch(['u-a', 'u-b', 'u-c'], () => namedUser)
        vi.stubGlobal('fetch', fetchMock)

        const { result } = renderHook(() => useVoiceSearch())
        await act(async () => {
            await result.current.searchVoice('AAAA')
        })

        // One search + exactly one name lookup per match — no extra requests.
        expect(fetchMock).toHaveBeenCalledTimes(4)
        expect(result.current.result!.matches.every((m) => m.userResolved)).toBe(true)
    })

    it('surfaces search errors and resolves no names when the search itself fails', async () => {
        const fetchMock = vi.fn((url: string): Promise<StubResponse> => {
            if (url === SEARCH_URL) {
                return Promise.resolve({
                    ok: false,
                    status: 422,
                    json: async () => ({ message: 'voice search 422' }),
                })
            }
            // A name lookup here would mean the hook kept going after a failed search.
            return Promise.resolve(namedUser)
        })
        vi.stubGlobal('fetch', fetchMock)

        const { result } = renderHook(() => useVoiceSearch())
        await act(async () => {
            await result.current.searchVoice('AAAA')
        })

        expect(result.current.result).toBeNull()
        expect(result.current.error).toBe('voice search 422')
        // No name lookups when the search itself failed (only the search call).
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})
