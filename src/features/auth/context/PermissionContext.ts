import { createContext, useContext } from 'react'
import { Permission, UserRole } from '@domain/models/Permission'

/**
 * Permission context value interface
 */
export interface PermissionContextValue {
    permissions: Permission[]
    hasPermission: (permission: Permission) => boolean
    hasAnyPermission: (permissions: Permission[]) => boolean
    hasAllPermissions: (permissions: Permission[]) => boolean
    role: UserRole | null
    isSuperAdmin: boolean
    isAdmin: boolean
}

export const PermissionContext = createContext<PermissionContextValue | null>(null)

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
