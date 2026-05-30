/**
 * login-config — fetch + normalize the tenant's Layer-1 login surface.
 *
 * Frozen contract (identity-core-api task #16 / PR #163):
 *   GET /api/v1/auth/login-config?tenantId=<uuid>   (unauthenticated, 200)
 *
 * The dashboard login calls this with no params (backend resolves the platform
 * / system tenant). The hosted login page only has the OAuth `client_id` in its
 * URL — until the API confirms whether login-config also accepts `clientId`
 * (or the public client meta exposes `tenantId`), the caller passes whichever
 * identifier it has and this helper forwards it as the matching query param.
 *
 * Mirrors the lightweight, DI-free style of `passkey-login.ts`: takes an
 * {@link IHttpClient} so both the hosted (verifyContainer) and dashboard DI
 * graphs can call it, and tests can inject a stub client.
 */

import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import {
    normalizeLoginConfig,
    type LoginConfig,
    type RawLoginConfig,
} from '@domain/models/LoginConfig'

export const LOGIN_CONFIG_ENDPOINT = '/auth/login-config'

export interface LoginConfigQuery {
    /** Resolved tenant UUID (the contract's primary key). */
    tenantId?: string
    /**
     * OAuth client_id — sent only as a fallback for the hosted surface, which
     * has no tenantId in its URL. The backend resolves the tenant from the
     * client if it supports the param; otherwise the call 404s and we fall back.
     */
    clientId?: string
}

/**
 * Fetch the login config for the given tenant (or the platform/system tenant
 * when no identifier is supplied).
 *
 * Returns `null` on ANY failure (404, network, malformed body) so callers can
 * gracefully fall back to the legacy email+password surface — this is never a
 * hard error for the user, and is what makes the feature reversible by the
 * `app.auth.config-driven-login` API flag with no web redeploy.
 */
export async function fetchLoginConfig(
    httpClient: IHttpClient,
    query?: LoginConfigQuery,
    signal?: AbortSignal,
): Promise<LoginConfig | null> {
    try {
        const params: Record<string, unknown> = {}
        if (query?.tenantId) params.tenantId = query.tenantId
        if (query?.clientId) params.clientId = query.clientId
        const res = await httpClient.get<RawLoginConfig>(LOGIN_CONFIG_ENDPOINT, {
            params,
            timeout: 10_000,
            ...(signal ? ({ signal } as unknown as { signal: AbortSignal }) : {}),
        })
        return normalizeLoginConfig(res.data)
    } catch {
        return null
    }
}
