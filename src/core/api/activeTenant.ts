/**
 * Active-tenant header bridge.
 *
 * SUPER_ADMIN operators may scope all admin data to a single tenant by
 * sending an `X-Active-Tenant: <tenantUuid>` header. The selection lives in
 * React state (see `ActiveTenantContext`), but the axios request interceptor
 * runs outside React, so this module-level holder bridges the two: the
 * context writes the currently-selected tenant id here, and the interceptor
 * reads it on every request.
 *
 * The value is the *override* tenant id — i.e. only set to a non-null value
 * when a SUPER_ADMIN has switched away from their home tenant. When it is
 * null (the common case, and always for non-super-admins) no header is sent
 * and the backend falls back to the caller's own tenant.
 */

export const ACTIVE_TENANT_HEADER = 'X-Active-Tenant'

let activeTenantId: string | null = null

/**
 * Set (or clear, with `null`) the active-tenant override that the axios
 * interceptor attaches to outgoing requests.
 */
export function setActiveTenantHeader(tenantId: string | null): void {
    activeTenantId = tenantId
}

/**
 * Read the current active-tenant override. Returns `null` when no override is
 * active (no header should be sent).
 */
export function getActiveTenantHeader(): string | null {
    return activeTenantId
}
