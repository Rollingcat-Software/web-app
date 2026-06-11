import { useCallback, useEffect, useState } from 'react'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'

/**
 * A single per-tenant biometric consent row (Model A, Phase 3). Mirrors the
 * api's BiometricConsentResponse.
 */
export interface BiometricConsent {
    id: string
    tenantId: string
    tenantName?: string | null
    method: string | null
    granted: boolean
    grantedAt?: string | null
    revokedAt?: string | null
}

// The HttpClient base URL already includes /api/v1 (VITE_API_BASE_URL), so the
// path must be relative to it — a leading /api/v1 here doubles to /api/v1/api/v1
// and 404s (NoResourceFoundException). Match the sibling identity hooks.
const CONSENTS_URL = '/identity/biometric/consents'

/**
 * Loads + mutates the caller's per-tenant biometric consents. Self-contained
 * (own DI resolution, own state) so it can be dropped into Profile without
 * touching shared enrollment hooks — minimizes merge surface with the concurrent
 * Phase 2 "Linked accounts" work.
 */
export function useBiometricConsents() {
    const [consents, setConsents] = useState<BiometricConsent[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<unknown>(null)

    const fetchConsents = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
            const res = await httpClient.get<BiometricConsent[]>(CONSENTS_URL)
            // `?? []` only guards null/undefined; a malformed (non-array) body would
            // still be stored and crash consumers (consents.some/.filter/.find). Pin to an array.
            setConsents(Array.isArray(res.data) ? res.data : [])
        } catch (e) {
            const logger = container.get<ILogger>(TYPES.Logger)
            logger.error('Failed to load biometric consents', e)
            setError(e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void fetchConsents()
    }, [fetchConsents])

    /**
     * Grant or revoke consent for one (tenant, method). method=null = all
     * biometric methods. Refetches on success so the UI reflects server state.
     */
    const setConsent = useCallback(
        async (tenantId: string, granted: boolean, method: string | null = null) => {
            setSaving(true)
            setError(null)
            try {
                const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                await httpClient.post(CONSENTS_URL, { tenantId, method, granted })
                await fetchConsents()
            } catch (e) {
                const logger = container.get<ILogger>(TYPES.Logger)
                logger.error('Failed to update biometric consent', e)
                setError(e)
                throw e
            } finally {
                setSaving(false)
            }
        },
        [fetchConsents],
    )

    return { consents, loading, saving, error, setConsent, refetch: fetchConsents }
}
