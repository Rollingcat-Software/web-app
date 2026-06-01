import { useState, useCallback, useRef } from 'react'
import { getBiometricService, type SearchResult } from '@core/services/BiometricService'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import { config as envConfig } from '@config/env'

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
 *
 * The biometric-processor search payload only carries `user_id`, so after the
 * 1:N search we hydrate each match's human-readable name + email best-effort via
 * `GET /users/{userId}` (mirrors `useVoiceSearch`). Soft-deleted / missing users
 * resolve to no name — the UI then falls back to the raw id, never crashing.
 */
export function useFaceSearch(): UseFaceSearchReturn {
    const tokenService = useService<ITokenService>(TYPES.TokenService)
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

            // Resolve owner name/email for every match (best-effort). The search
            // payload only carries `user_id`; we look each one up so the UI shows
            // a human name instead of a raw UUID. Failures (soft-deleted / missing
            // user, network) leave name/email undefined → UI falls back to the id.
            const apiBaseUrl = envConfig.apiBaseUrl
            const token = (await tokenService.getAccessToken()) || ''
            const authHeader: Record<string, string> = token
                ? { Authorization: `Bearer ${token}` }
                : {}
            await Promise.all(searchResult.results.map(async (match) => {
                try {
                    const userRes = await fetch(`${apiBaseUrl}/users/${match.userId}`, {
                        headers: authHeader,
                    })
                    if (userRes.ok) {
                        const user = await userRes.json()
                        const firstName = user.firstName || user.data?.firstName || ''
                        const lastName = user.lastName || user.data?.lastName || ''
                        match.userName = `${firstName} ${lastName}`.trim() || undefined
                        match.userEmail = user.email || user.data?.email || undefined
                    }
                } catch { /* best-effort — leave name/email undefined, UI shows id */ }
            }))

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
    }, [tokenService])

    const reset = useCallback(() => {
        setResult(null)
        setError(null)
    }, [])

    return { searching, result, error, searchFace, reset }
}
