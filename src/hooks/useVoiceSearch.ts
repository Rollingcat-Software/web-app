import { useState, useCallback, useRef } from 'react'

interface VoiceSearchMatch {
    userId: string
    similarity: number
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
 */
export function useVoiceSearch(): UseVoiceSearchReturn {
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
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://auth.rollingcatsoftware.com/api/v1'

            const res = await fetch(`${apiBaseUrl}/biometric/voice/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

            const searchResult: VoiceSearchResult = {
                found: matches.length > 0,
                matches,
                topMatch: matches.length > 0 ? matches[0] : null,
            }

            setResult(searchResult)
            return searchResult
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Voice search failed'
            setError(msg)
            return null
        } finally {
            setSearching(false)
            searchingRef.current = false
        }
    }, [])

    const reset = useCallback(() => {
        setResult(null)
        setError(null)
    }, [])

    return { searching, result, error, searchVoice, reset }
}
