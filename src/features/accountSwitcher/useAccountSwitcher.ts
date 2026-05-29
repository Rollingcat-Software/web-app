import { useCallback, useEffect, useState } from 'react'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import type { ILogger } from '@domain/interfaces/ILogger'
import type {
    IdentityMe,
    IdentityMembership,
} from '@features/linkedAccounts/useLinkedAccounts'

export type { IdentityMe, IdentityMembership } from '@features/linkedAccounts/useLinkedAccounts'

/**
 * The token payload returned by `POST /api/v1/auth/switch-membership`.
 *
 * <p>By contract (Identity & Account-Linking Phase 5) this is the SAME shape as
 * `POST /api/v1/auth/login`: an access + refresh token pair (+ optional
 * `expiresIn`). We reuse the EXACT login token-persistence path
 * ({@link ITokenService.storeTokens}) so the Axios interceptor / refresh loop
 * keeps working transparently after a switch.</p>
 */
export interface SwitchMembershipResponse {
    accessToken: string
    refreshToken: string
    expiresIn?: number
}

/**
 * Account/workspace switcher repository + state for Identity & Account-Linking
 * **Phase 5** (in-session membership switch). A LINKED person logs in ONCE and
 * then moves between ALL their memberships in the same session without
 * re-entering credentials — like a Google account switcher / Slack workspace
 * switcher.
 *
 * <p><b>Distinct from the SUPER_ADMIN data-switcher.</b> The existing
 * `X-Tenant-ID` switcher (`ActiveTenantProvider` / `core/api/activeTenant.ts`)
 * keeps you the SAME user and only re-scopes which tenant's DATA a SUPER_ADMIN
 * reads. THIS switcher changes WHO you are (a different membership / role /
 * tenant). The two are deliberately kept as separate components.</p>
 *
 * <p>Self-contained in its own feature folder (it only reuses the read model
 * from {@link useLinkedAccounts} and the canonical login token-persistence path)
 * so it does not collide with the SUPER_ADMIN tenant-switcher or the Phase-2/3
 * Profile work.</p>
 */
export function useAccountSwitcher() {
    const [data, setData] = useState<IdentityMe | null>(null)
    const [loading, setLoading] = useState(true)
    const [switching, setSwitching] = useState(false)

    const http = () => container.get<IHttpClient>(TYPES.HttpClient)
    const tokenService = () => container.get<ITokenService>(TYPES.TokenService)
    const log = () => container.get<ILogger>(TYPES.Logger)

    const refetch = useCallback(async () => {
        setLoading(true)
        try {
            const res = await http().get<IdentityMe>('/identity/me')
            setData(res.data)
        } catch (err) {
            // Soft-fail: a person with a single membership (the common case) or
            // a transient error should NOT surface an error in the TopBar — the
            // switcher simply stays hidden (memberships <= 1).
            log().error('Failed to load identity memberships for switcher', err)
            setData(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refetch()
    }, [refetch])

    /**
     * Switch the active membership.
     *
     * <p>Calls `POST /api/v1/auth/switch-membership { targetUserId }`, then
     * persists the returned tokens through the EXACT login path
     * ({@link ITokenService.storeTokens}) so refresh + interceptors keep
     * working. The caller is responsible for resetting app context afterwards
     * (re-fetch `/auth/me` via the auth store, or a full reload).</p>
     *
     * <p>Re-throws on failure so the caller can localize via
     * `formatApiError(err, t)` (403 = not yours, 409 = inactive).</p>
     */
    const switchMembership = useCallback(async (targetUserId: string) => {
        setSwitching(true)
        try {
            const res = await http().post<SwitchMembershipResponse>(
                '/auth/switch-membership',
                { targetUserId },
            )
            const { accessToken, refreshToken } = res.data
            // Reuse the canonical post-login token-persistence path so the
            // Axios auth interceptor + refresh loop keep working unchanged.
            await tokenService().storeTokens({ accessToken, refreshToken })
            log().info('Switched membership', { targetUserId })
        } catch (err) {
            log().error('Failed to switch membership', err)
            throw err
        } finally {
            setSwitching(false)
        }
    }, [])

    const memberships: IdentityMembership[] = data?.memberships ?? []
    /** Only show the switcher when the person actually has >1 membership. */
    const canSwitch = memberships.length > 1

    return { data, memberships, canSwitch, loading, switching, refetch, switchMembership }
}
