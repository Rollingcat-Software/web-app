import React from 'react'
import { Navigate } from 'react-router-dom'
import { usePermissions } from '../context/PermissionContext'
import { Permission } from '@domain/models/Permission'

/**
 * HOC options for permission-based routing
 */
interface WithPermissionOptions {
    /** Single permission to check */
    permission?: Permission
    /** Multiple permissions to check */
    permissions?: Permission[]
    /** If true, requires all permissions; if false, requires any permission */
    requireAll?: boolean
    /** Path to redirect to if permission check fails */
    redirectTo?: string
}

/**
 * Higher-Order Component for permission-based page protection
 * Use this to protect entire pages/routes
 *
 * @example
 * const ProtectedUsersPage = withPermission(UsersPage, {
 *   permission: Permission.USERS_VIEW
 * })
 *
 * @example
 * const ProtectedAdminPage = withPermission(AdminPage, {
 *   permissions: [Permission.USERS_EDIT, Permission.TENANTS_EDIT],
 *   requireAll: true,
 *   redirectTo: '/unauthorized'
 * })
 */
export function withPermission<P extends object>(
    Component: React.ComponentType<P>,
    options: WithPermissionOptions
) {
    const WrappedComponent = (props: P) => {
        const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions()
        const {
            permission,
            permissions,
            requireAll = false,
            redirectTo = '/',
        } = options

        let hasAccess = false

        if (permission) {
            hasAccess = hasPermission(permission)
        } else if (permissions && permissions.length > 0) {
            hasAccess = requireAll
                ? hasAllPermissions(permissions)
                : hasAnyPermission(permissions)
        } else {
            hasAccess = true
        }

        if (!hasAccess) {
            return <Navigate to={redirectTo} replace />
        }

        return <Component {...props} />
    }

    // Preserve display name for debugging
    const displayName = Component.displayName || Component.name || 'Component'
    WrappedComponent.displayName = `withPermission(${displayName})`

    return WrappedComponent
}

export default withPermission
