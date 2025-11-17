import { useState, useEffect, useCallback } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { ITenantService, TenantFilters } from '@domain/interfaces/ITenantService'
import type { CreateTenantData, UpdateTenantData } from '@domain/interfaces/ITenantRepository'
import { Tenant } from '@domain/models/Tenant'
import type { ErrorHandler } from '@core/errors'

/**
 * Tenants state
 */
interface TenantsState {
    tenants: Tenant[]
    total: number
    loading: boolean
    error: Error | null
}

/**
 * Use tenants hook return type
 */
interface UseTenantsReturn extends TenantsState {
    refetch: (filters?: TenantFilters) => Promise<void>
    createTenant: (data: CreateTenantData) => Promise<Tenant>
    updateTenant: (id: number, data: UpdateTenantData) => Promise<Tenant>
    deleteTenant: (id: number) => Promise<void>
}

/**
 * Custom hook for tenants management
 * Provides access to tenant list and CRUD operations
 *
 * @example
 * const { tenants, loading, createTenant, deleteTenant } = useTenants()
 */
export function useTenants(initialFilters?: TenantFilters): UseTenantsReturn {
    const tenantService = useService<ITenantService>(TYPES.TenantService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<TenantsState>({
        tenants: [],
        total: 0,
        loading: true,
        error: null,
    })

    /**
     * Fetch tenants
     */
    const fetchTenants = useCallback(
        async (filters?: TenantFilters) => {
            setState((prev) => ({ ...prev, loading: true, error: null }))

            try {
                const result = await tenantService.getTenants(filters)

                setState({
                    tenants: result.items,
                    total: result.total,
                    loading: false,
                    error: null,
                })
            } catch (error) {
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: error as Error,
                }))
                errorHandler.handle(error)
            }
        },
        [tenantService, errorHandler]
    )

    /**
     * Load tenants on mount and when filters change
     */
    useEffect(() => {
        fetchTenants(initialFilters)
    }, [fetchTenants, initialFilters])

    /**
     * Create tenant
     */
    const createTenant = useCallback(
        async (data: CreateTenantData): Promise<Tenant> => {
            try {
                const tenant = await tenantService.createTenant(data)

                // Refresh list after creation
                await fetchTenants(initialFilters)

                return tenant
            } catch (error) {
                errorHandler.handle(error)
                throw error
            }
        },
        [tenantService, errorHandler, fetchTenants, initialFilters]
    )

    /**
     * Update tenant
     */
    const updateTenant = useCallback(
        async (id: number, data: UpdateTenantData): Promise<Tenant> => {
            try {
                const tenant = await tenantService.updateTenant(id, data)

                // Refresh list after update
                await fetchTenants(initialFilters)

                return tenant
            } catch (error) {
                errorHandler.handle(error)
                throw error
            }
        },
        [tenantService, errorHandler, fetchTenants, initialFilters]
    )

    /**
     * Delete tenant
     */
    const deleteTenant = useCallback(
        async (id: number): Promise<void> => {
            try {
                await tenantService.deleteTenant(id)

                // Refresh list after deletion
                await fetchTenants(initialFilters)
            } catch (error) {
                errorHandler.handle(error)
                throw error
            }
        },
        [tenantService, errorHandler, fetchTenants, initialFilters]
    )

    return {
        ...state,
        refetch: fetchTenants,
        createTenant,
        updateTenant,
        deleteTenant,
    }
}

/**
 * Hook to get a single tenant by ID
 */
export function useTenant(id: number) {
    const tenantService = useService<ITenantService>(TYPES.TenantService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<{
        tenant: Tenant | null
        loading: boolean
        error: Error | null
    }>({
        tenant: null,
        loading: true,
        error: null,
    })

    useEffect(() => {
        let mounted = true

        const fetchTenant = async () => {
            try {
                const tenant = await tenantService.getTenantById(id)
                if (mounted) {
                    setState({ tenant, loading: false, error: null })
                }
            } catch (error) {
                if (mounted) {
                    setState({ tenant: null, loading: false, error: error as Error })
                    errorHandler.handle(error)
                }
            }
        }

        fetchTenant()

        return () => {
            mounted = false
        }
    }, [id, tenantService, errorHandler])

    return state
}
