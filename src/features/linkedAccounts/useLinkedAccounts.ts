import { useCallback, useEffect, useState } from 'react'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'

/**
 * One verified email controlled by the person (identity).
 */
export interface IdentityEmail {
    email: string
    verified: boolean
}

/**
 * One tenant membership (users row) the person holds.
 */
export interface IdentityMembership {
    userId: string
    tenantId: string | null
    tenantName: string | null
    role: string | null
    isActive: boolean
}

/**
 * The "person view" returned by GET /identity/me (Phase-2 account linking).
 */
export interface IdentityMe {
    identityId: string
    emails: IdentityEmail[]
    memberships: IdentityMembership[]
}

/**
 * Thin repository methods + state for Phase-2 account linking, talking to the
 * identity-core-api `/api/v1/identity/*` endpoints through the DI HttpClient.
 *
 * <p>Kept self-contained in its own feature folder (no shared-file edits beyond
 * i18n + the Profile mount point) so it does not collide with the concurrent
 * Phase-3 consent work that also touches Profile.</p>
 */
export function useLinkedAccounts() {
    const [data, setData] = useState<IdentityMe | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const http = () => container.get<IHttpClient>(TYPES.HttpClient)
    const log = () => container.get<ILogger>(TYPES.Logger)

    const refetch = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await http().get<IdentityMe>('/identity/me')
            setData(res.data)
        } catch (err) {
            log().error('Failed to load linked accounts', err)
            setError('loadError')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refetch()
    }, [refetch])

    /** POST /identity/link/initiate — sends an OTP to the target email. */
    const initiateLink = useCallback(async (email: string) => {
        await http().post('/identity/link/initiate', { email })
    }, [])

    /** POST /identity/link/confirm — verifies OTP + step-up password, links. */
    const confirmLink = useCallback(
        async (email: string, otp: string, password: string) => {
            await http().post('/identity/link/confirm', { email, otp, password })
        },
        []
    )

    /** POST /identity/unlink — splits a membership back into its own identity. */
    const unlink = useCallback(async (membershipUserId: string) => {
        await http().post('/identity/unlink', { membershipUserId })
    }, [])

    return { data, loading, error, refetch, initiateLink, confirmLink, unlink }
}
