import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { ITenantRepository } from '@domain/interfaces/ITenantRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import { Tenant } from '@domain/models/Tenant'
import { useAuth } from '@features/auth/hooks/useAuth'
import { setActiveTenantHeader } from '@core/api/activeTenant'
import { ActiveTenantContext, type ActiveTenantContextValue } from './ActiveTenantContext'

const STORAGE_KEY = 'active_tenant_id'

/**
 * Provides the active-tenant selection to the dashboard.
 *
 * - For SUPER_ADMIN it loads the platform tenant list and lets the operator
 *   switch the active tenant; the choice persists in sessionStorage and is
 *   bridged to the axios interceptor so all admin requests carry the
 *   `X-Active-Tenant` header when scoped to a non-home tenant.
 * - For every other role it is inert (home tenant only, no switching).
 *
 * Must be mounted inside `AuthProvider` (it reads the current user) and inside
 * `DependencyProvider` (it resolves the tenant repository).
 */
export function ActiveTenantProvider({ children }: { children: ReactNode }) {
    const { user, isAuthenticated } = useAuth()
    const tenantRepo = useService<ITenantRepository>(TYPES.TenantRepository)
    const logger = useService<ILogger>(TYPES.Logger)

    const canSwitch = !!user?.isRoot()
    const homeTenantId = user?.tenantId ?? null

    const [tenants, setTenants] = useState<Tenant[]>([])
    const [loading, setLoading] = useState(false)
    const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null)

    // Resolve the persisted/home selection once the user is known.
    useEffect(() => {
        if (!isAuthenticated || !homeTenantId) {
            setActiveTenantIdState(null)
            return
        }
        if (!canSwitch) {
            // Non-super-admins always operate on their home tenant.
            setActiveTenantIdState(homeTenantId)
            return
        }
        let stored: string | null = null
        try {
            stored = sessionStorage.getItem(STORAGE_KEY)
        } catch {
            stored = null
        }
        setActiveTenantIdState(stored || homeTenantId)
    }, [isAuthenticated, canSwitch, homeTenantId])

    // Load the tenant list for SUPER_ADMIN.
    useEffect(() => {
        if (!canSwitch || !isAuthenticated) {
            setTenants([])
            return
        }
        let mounted = true
        setLoading(true)
        tenantRepo
            .findAll({ page: 0, pageSize: 200 })
            .then((result) => {
                if (mounted) setTenants(result.items)
            })
            .catch((err) => {
                logger.error('Failed to load tenants for switcher', err)
                if (mounted) setTenants([])
            })
            .finally(() => {
                if (mounted) setLoading(false)
            })
        return () => {
            mounted = false
        }
    }, [canSwitch, isAuthenticated, tenantRepo, logger])

    // Bridge the selection to the axios interceptor. For a SUPER_ADMIN we ALWAYS
    // send the selected tenant (which initializes to their home tenant), so the
    // default view is the home tenant and switching narrows to the chosen one —
    // matching the "switcher defaults to home" product decision. Non-super-admins
    // never send the header (the backend would ignore it anyway).
    useEffect(() => {
        if (canSwitch && activeTenantId) {
            setActiveTenantHeader(activeTenantId)
        } else {
            setActiveTenantHeader(null)
        }
        return () => {
            setActiveTenantHeader(null)
        }
    }, [canSwitch, activeTenantId])

    const setActiveTenantId = useCallback(
        (tenantId: string) => {
            if (!canSwitch) return
            setActiveTenantIdState(tenantId)
            try {
                sessionStorage.setItem(STORAGE_KEY, tenantId)
            } catch {
                // sessionStorage unavailable — selection still applies for this session.
            }
        },
        [canSwitch]
    )

    const activeTenantName = useMemo(() => {
        if (!activeTenantId) return null
        const match = tenants.find((tnt) => tnt.id === activeTenantId)
        if (match) return match.name
        // Fall back to the user-carried tenant name for the home tenant.
        if (activeTenantId === homeTenantId && user?.tenantName) return user.tenantName
        return null
    }, [activeTenantId, tenants, homeTenantId, user?.tenantName])

    const value = useMemo<ActiveTenantContextValue>(
        () => ({
            canSwitch,
            tenants,
            loading,
            homeTenantId,
            activeTenantId,
            activeTenantName,
            setActiveTenantId,
        }),
        [canSwitch, tenants, loading, homeTenantId, activeTenantId, activeTenantName, setActiveTenantId]
    )

    return <ActiveTenantContext.Provider value={value}>{children}</ActiveTenantContext.Provider>
}
