import React, { useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Permission, ROLE_PERMISSIONS, UserRole } from '@domain/models/Permission'
import { PermissionContext } from './PermissionContext'

/**
 * Permission Provider Props
 */
interface PermissionProviderProps {
    children: React.ReactNode
}

/**
 * Permission Provider Component
 * Provides permission checking capabilities throughout the app
 */
export function PermissionProvider({ children }: PermissionProviderProps) {
    const { user } = useAuth()

    const value = useMemo(() => {
        const role = (user?.role as UserRole) || null
        const permissions = role ? ROLE_PERMISSIONS[role] || [] : []

        return {
            permissions,
            role,
            // Platform tier is authoritative via user.isRoot() (userType-driven,
            // role fallback) — matches the backend isRoot gate. Guard the method
            // call: some call sites/tests supply a plain user object without the
            // User-class methods, in which case fall back to the role.
            isRoot: typeof user?.isRoot === 'function'
                ? user.isRoot()
                : role === UserRole.ROOT,
            isAdmin: role === UserRole.ROOT || role === UserRole.ADMIN || role === UserRole.TENANT_ADMIN,
            hasPermission: (permission: Permission) => permissions.includes(permission),
            hasAnyPermission: (perms: Permission[]) =>
                perms.some((p) => permissions.includes(p)),
            hasAllPermissions: (perms: Permission[]) =>
                perms.every((p) => permissions.includes(p)),
        }
    }, [user])

    return (
        <PermissionContext.Provider value={value}>
            {children}
        </PermissionContext.Provider>
    )
}
