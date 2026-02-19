import { useState, useEffect, useCallback } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IRoleService } from '@domain/interfaces/IRoleService'
import type { CreateRoleData, UpdateRoleData } from '@domain/interfaces/IRoleRepository'
import { Role } from '@domain/models/Role'
import { Permission } from '@domain/models/Permission'
import type { ErrorHandler } from '@core/errors'

interface UseRolesReturn {
    roles: Role[]
    permissions: Permission[]
    loading: boolean
    error: Error | null
    createRole: (data: CreateRoleData) => Promise<Role>
    updateRole: (id: string, data: UpdateRoleData) => Promise<Role>
    deleteRole: (id: string) => Promise<void>
    assignPermission: (roleId: string, permissionId: string) => Promise<void>
    revokePermission: (roleId: string, permissionId: string) => Promise<void>
    refetch: () => Promise<void>
}

export function useRoles(): UseRolesReturn {
    const roleService = useService<IRoleService>(TYPES.RoleService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [roles, setRoles] = useState<Role[]>([])
    const [permissions, setPermissions] = useState<Permission[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [rolesResult, perms] = await Promise.all([
                roleService.getRoles(),
                roleService.getPermissions(),
            ])
            setRoles(rolesResult.items)
            setPermissions(perms)
        } catch (err) {
            setError(err as Error)
            errorHandler.handle(err)
        } finally {
            setLoading(false)
        }
    }, [roleService, errorHandler])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const createRole = useCallback(
        async (data: CreateRoleData) => {
            const role = await roleService.createRole(data)
            await fetchData()
            return role
        },
        [roleService, fetchData]
    )

    const updateRole = useCallback(
        async (id: string, data: UpdateRoleData) => {
            const role = await roleService.updateRole(id, data)
            await fetchData()
            return role
        },
        [roleService, fetchData]
    )

    const deleteRole = useCallback(
        async (id: string) => {
            await roleService.deleteRole(id)
            await fetchData()
        },
        [roleService, fetchData]
    )

    const assignPermission = useCallback(
        async (roleId: string, permissionId: string) => {
            await roleService.assignPermission(roleId, permissionId)
            await fetchData()
        },
        [roleService, fetchData]
    )

    const revokePermission = useCallback(
        async (roleId: string, permissionId: string) => {
            await roleService.revokePermission(roleId, permissionId)
            await fetchData()
        },
        [roleService, fetchData]
    )

    return {
        roles,
        permissions,
        loading,
        error,
        createRole,
        updateRole,
        deleteRole,
        assignPermission,
        revokePermission,
        refetch: fetchData,
    }
}
