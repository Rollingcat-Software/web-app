import React from 'react'
import { usePermissions } from '../context/PermissionContext'
import { Permission } from '@domain/models/Permission'

/**
 * Permission Guard Props
 */
interface PermissionGuardProps {
    /** Single permission to check */
    permission?: Permission
    /** Multiple permissions to check */
    permissions?: Permission[]
    /** If true, requires all permissions; if false, requires any permission */
    requireAll?: boolean
    /** Content to render if permission check fails */
    fallback?: React.ReactNode
    /** Content to render if permission check passes */
    children: React.ReactNode
}

/**
 * Permission Guard Component
 * Conditionally renders children based on user permissions
 *
 * @example
 * // Single permission
 * <PermissionGuard permission={Permission.USERS_CREATE}>
 *   <Button>Add User</Button>
 * </PermissionGuard>
 *
 * @example
 * // Multiple permissions (any)
 * <PermissionGuard permissions={[Permission.USERS_EDIT, Permission.USERS_DELETE]}>
 *   <ActionsMenu />
 * </PermissionGuard>
 *
 * @example
 * // Multiple permissions (all required)
 * <PermissionGuard permissions={[Permission.TENANTS_VIEW, Permission.TENANTS_EDIT]} requireAll>
 *   <TenantEditor />
 * </PermissionGuard>
 */
export function PermissionGuard({
    permission,
    permissions,
    requireAll = false,
    fallback = null,
    children,
}: PermissionGuardProps) {
    const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions()

    let hasAccess = false

    if (permission) {
        hasAccess = hasPermission(permission)
    } else if (permissions && permissions.length > 0) {
        hasAccess = requireAll
            ? hasAllPermissions(permissions)
            : hasAnyPermission(permissions)
    } else {
        // No permission specified, allow access
        hasAccess = true
    }

    if (!hasAccess) {
        return <>{fallback}</>
    }

    return <>{children}</>
}

export default PermissionGuard
