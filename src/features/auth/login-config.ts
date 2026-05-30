/**
 * login-config — fetch + normalize the tenant's Layer-1 login surface.
 *
 * The hosted login page calls this on mount with the OAuth `client_id`; the
 * dashboard login calls it without one (the backend resolves the platform
 * tenant). The returned {@link LoginConfig} drives which Layer-1 controls
 * render (password field, usernameless shortcuts, identifier box).
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

/**
 * Fetch the login config for the given OAuth client (or the default platform
 * tenant when `clientId` is omitted).
 *
 * Returns `null` on ANY failure (404, network, malformed body) so callers can
 * gracefully fall back to the legacy email+password surface — this is never a
 * hard error for the user.
 */
export async function fetchLoginConfig(
    httpClient: IHttpClient,
    clientId?: string,
    signal?: AbortSignal,
): Promise<LoginConfig | null> {
    try {
        const params: Record<string, unknown> = {}
        if (clientId) params.clientId = clientId
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
