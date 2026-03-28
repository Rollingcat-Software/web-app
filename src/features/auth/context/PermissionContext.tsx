import React, { createContext, useContext, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Permission, ROLE_PERMISSIONS, UserRole } from '@domain/models/Permission'

/**
 * Permission context value interface
 */
interface PermissionContextValue {
    permissions: Permission[]
    hasPermission: (permission: Permission) => boolean
    hasAnyPermission: (permissions: Permission[]) => boolean
    hasAllPermissions: (permissions: Permission[]) => boolean
    role: UserRole | null
    isSuperAdmin: boolean
    isAdmin: boolean
}

const PermissionContext = createContext<PermissionContextValue | null>(null)

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
            isSuperAdmin: role === 'SUPER_ADMIN',
            isAdmin: role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'TENANT_ADMIN',
            hasPermission: (permission: Permission) => permissions.includes(permission),
            hasAnyPermission: (perms: Permission[]) =>
                perms.some((p) => permissions.includes(p)),
            hasAllPermissions: (perms: Permission[]) =>
                perms.every((p) => permissions.includes(p)),
        }
    }, [user?.role])

    return (
        <PermissionContext.Provider value={value}>
            {children}
        </PermissionContext.Provider>
    )
}

/**
 * Hook to access permission context
 */
export function usePermissions(): PermissionContextValue {
    const context = useContext(PermissionContext)
    if (!context) {
        throw new Error('usePermissions must be used within PermissionProvider')
    }
    return context
}
