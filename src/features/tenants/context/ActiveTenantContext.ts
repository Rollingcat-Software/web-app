import { createContext, useContext } from 'react'
import type { Tenant } from '@domain/models/Tenant'

/**
 * Active-tenant context value.
 *
 * For SUPER_ADMIN operators this exposes the platform-wide tenant list plus
 * the currently-selected ("active") tenant that scopes admin data. For every
 * other role the list is empty and `activeTenantId` equals the user's home
 * tenant — switching is a no-op.
 */
export interface ActiveTenantContextValue {
    /** True only for SUPER_ADMIN — gates the top-bar tenant switcher. */
    canSwitch: boolean
    /** All tenants (SUPER_ADMIN only); empty otherwise. */
    tenants: Tenant[]
    /** Loading state for the tenant list. */
    loading: boolean
    /** The operator's home tenant id (from the auth payload). */
    homeTenantId: string | null
    /** The currently-active tenant id (home tenant unless switched). */
    activeTenantId: string | null
    /** The currently-active tenant name, resolved from the list when known. */
    activeTenantName: string | null
    /** Switch the active tenant (SUPER_ADMIN only). */
    setActiveTenantId: (tenantId: string) => void
}

export const ActiveTenantContext = createContext<ActiveTenantContextValue | null>(null)

/**
 * Access the active-tenant context. Safe to call from any authenticated
 * surface; returns a sensible non-switching default when no provider is
 * mounted (e.g. in isolated unit tests).
 */
export function useActiveTenant(): ActiveTenantContextValue {
    const ctx = useContext(ActiveTenantContext)
    if (!ctx) {
        return {
            canSwitch: false,
            tenants: [],
            loading: false,
            homeTenantId: null,
            activeTenantId: null,
            activeTenantName: null,
            setActiveTenantId: () => {},
        }
    }
    return ctx
}
