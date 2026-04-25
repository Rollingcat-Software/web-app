import { useState, useCallback, useRef } from 'react'
import { getBiometricService, type SearchResult } from '@core/services/BiometricService'

interface UseFaceSearchReturn {
    searching: boolean
    result: SearchResult | null
    error: string | null
    searchFace: (imageBase64: string, tenantId?: string) => Promise<SearchResult | null>
    reset: () => void
}

/**
 * Hook for face search (1:N identification).
 *
 * Captures a face image, sends it to the biometric processor's search endpoint,
 * and returns matching user(s) from the enrolled database.
 */
export function useFaceSearch(): UseFaceSearchReturn {
    const [searching, setSearching] = useState(false)
    const [result, setResult] = useState<SearchResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const searchingRef = useRef(false)

    const searchFace = useCallback(async (
        imageBase64: string,
        tenantId?: string
    ): Promise<SearchResult | null> => {
        if (searchingRef.current) return null
        searchingRef.current = true
        setSearching(true)
        setError(null)

        try {
            const biometricService = getBiometricService()
            const searchResult = await biometricService.searchFace(imageBase64, tenantId)
            setResult(searchResult)
            return searchResult
        } catch (err) {
            // eslint-disable-next-line no-restricted-syntax -- hook surface; caller wraps with formatApiError + i18n where displayed
            const msg = err instanceof Error ? err.message : 'Face search failed'
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

    return { searching, result, error, searchFace, reset }
}
