import { useState, useCallback, useRef } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import { config as envConfig } from '@config/env'

interface VoiceSearchMatch {
    userId: string
    similarity: number
    userName?: string
    userEmail?: string
    /**
     * True iff the `GET /users/{userId}` hydration lookup resolved a live
     * owner record (mirrors `SearchResult.results[].userResolved` from
     * `useFaceSearch`). Undefined until the lookup runs; `false` for a
     * soft-deleted / missing owner so the UI shows the id + "unknown user".
     */
    userResolved?: boolean
}

interface VoiceSearchResult {
    found: boolean
    matches: VoiceSearchMatch[]
    topMatch: VoiceSearchMatch | null
}

interface UseVoiceSearchReturn {
    searching: boolean
    result: VoiceSearchResult | null
    error: string | null
    searchVoice: (audioBase64: string) => Promise<VoiceSearchResult | null>
    reset: () => void
}

/**
 * Hook for voice search (1:N speaker identification).
 *
 * Records voice audio, sends it to the biometric processor's voice search endpoint,
 * and returns matching user(s) from the enrolled voice database.
 *
 * The voice search payload only carries `user_id`, so after the 1:N search we
 * hydrate each match's human-readable name + email best-effort via
 * `GET /users/{userId}` (mirrors `useFaceSearch`), setting a `userResolved` flag.
 * Soft-deleted / missing users (404) resolve unresolved — the UI then falls back
 * to the raw id + "unknown user", never crashing.
 */
export function useVoiceSearch(): UseVoiceSearchReturn {
    const tokenService = useService<ITokenService>(TYPES.TokenService)
    const [searching, setSearching] = useState(false)
    const [result, setResult] = useState<VoiceSearchResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const searchingRef = useRef(false)

    const searchVoice = useCallback(async (
        audioBase64: string
    ): Promise<VoiceSearchResult | null> => {
        if (searchingRef.current) return null
        searchingRef.current = true
        setSearching(true)
        setError(null)

        try {
            const apiBaseUrl = envConfig.apiBaseUrl
            // Use TokenService for token retrieval — the legacy `fivucsas_token`
            // localStorage key is no longer populated (cleared by clearAuthState
            // on every login) and produced 401s on /biometric/voice/search.
            const token = (await tokenService.getAccessToken()) || ''
            const authHeader: Record<string, string> = token
                ? { Authorization: `Bearer ${token}` }
                : {}

            const res = await fetch(`${apiBaseUrl}/biometric/voice/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeader,
                },
                body: JSON.stringify({ voiceData: audioBase64 }),
            })

            const data = await res.json().catch(() => null)

            if (!res.ok) {
                throw new Error(data?.message || `Voice search failed (${res.status})`)
            }

            const matches: VoiceSearchMatch[] = (data?.matches || []).map(
                (m: { user_id: string; similarity: number }) => ({
                    userId: m.user_id,
                    similarity: m.similarity,
                })
            )

            // Resolve owner name/email for every match (best-effort). The search
            // payload only carries `user_id`; we look each one up so the UI shows
            // a human name instead of a raw UUID. Failures (soft-deleted / missing
            // user, network) leave name/email undefined → UI falls back to the id.
            await Promise.all(matches.map(async (match) => {
                try {
                    const userRes = await fetch(`${apiBaseUrl}/users/${match.userId}`, {
                        headers: authHeader,
                    })
                    if (userRes.ok) {
                        // Live owner record — hydrate name/email and mark resolved
                        // so the UI shows the human identity. A 200 with no name set
                        // still counts as resolved (we fall back to email, never the
                        // "unknown user" label, which is reserved for missing owners).
                        const user = await userRes.json()
                        const firstName = user.firstName || user.data?.firstName || ''
                        const lastName = user.lastName || user.data?.lastName || ''
                        match.userName = `${firstName} ${lastName}`.trim() || undefined
                        match.userEmail = user.email || user.data?.email || undefined
                        match.userResolved = true
                    } else {
                        // 404 (soft-deleted / missing owner) or other non-OK status —
                        // mirror UserRepository.findById's null-on-404 pattern: don't
                        // throw, just mark unresolved so the UI shows id + "unknown user".
                        match.userResolved = false
                    }
                } catch {
                    // Network / parse failure — best-effort, leave name/email
                    // undefined and flag unresolved so the UI degrades to the id.
                    match.userResolved = false
                }
            }))

            const searchResult: VoiceSearchResult = {
                found: matches.length > 0,
                matches,
                topMatch: matches.length > 0 ? matches[0] : null,
            }

            setResult(searchResult)
            return searchResult
        } catch (err) {
            // eslint-disable-next-line no-restricted-syntax -- hook surface; caller wraps with formatApiError + i18n where displayed
            const msg = err instanceof Error ? err.message : 'Voice search failed'
            setError(msg)
            return null
        } finally {
            setSearching(false)
            searchingRef.current = false
        }
    }, [tokenService])

    const reset = useCallback(() => {
        setResult(null)
        setError(null)
    }, [])

    return { searching, result, error, searchVoice, reset }
}
