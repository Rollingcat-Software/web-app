/**
 * Sidebar permission/role matrix — single source of truth for which menu
 * entries are visible per UserRole.
 *
 * Design rules (from 2026-04-24 session — Rule 2, "hide what's not allowed"):
 *   - Every entry declares `visibleToRoles: UserRole[]`. No role in the list
 *     means the entry is hidden for that role — no 403 probe, no empty page.
 *   - `requiredPermissions` is an optional finer-grain gate used when the
 *     backend surfaces a permission that is not strictly 1:1 with role.
 *   - Test specs (`Sidebar.test.tsx`) import this module and assert the
 *     matrix per role so regressions show up as unit-test failures, not as
 *     console 403 spam in prod.
 *
 * Role semantics:
 *   - SUPER_ADMIN  — platform owner (us). Sees everything.
 *   - ADMIN        — legacy "global admin" (treated like SUPER_ADMIN for
 *                    read-only surfaces). Still can't see Tenants list
 *                    (that's a platform-owner concept).
 *   - TENANT_ADMIN — admin of one tenant (e.g. Marmara). Tenant-scoped
 *                    views only.
 *   - USER         — end-user. Sees only personal surfaces.
 */

import { UserRole } from '@domain/models/User'

/**
 * Keep in sync with Sidebar.tsx — visual grouping in the drawer.
 */
export type SidebarGroup = 'overview' | 'access' | 'security' | 'biometrics' | 'personal'

export interface SidebarEntry {
    /** i18n key under `nav.*`. */
    labelKey: string
    /** Route path this entry navigates to. */
    path: string
    /** Visual grouping header. */
    group: SidebarGroup
    /** Roles that should see this entry. Any role not in this list is hidden. */
    visibleToRoles: UserRole[]
    /**
     * Optional permission strings (e.g. `"tenants:view"`). When present, the
     * user must have at least one of these in addition to having a role in
     * `visibleToRoles`. Used by Settings/Permissions gates that are flipped
     * at runtime.
     */
    requiredPermissions?: string[]
}

// Convenience role buckets — keep them here so changing the role hierarchy
// in one place updates every sidebar row.
export const PLATFORM_OWNER_ROLES: UserRole[] = [UserRole.SUPER_ADMIN]
export const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TENANT_ADMIN]
export const AUTHENTICATED_ROLES: UserRole[] = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.TENANT_ADMIN,
    UserRole.USER,
]

/**
 * Canonical matrix. Order here is the render order in the drawer — do not
 * reorder without updating the Sidebar test (it asserts the top-to-bottom
 * sequence for one role).
 */
export const SIDEBAR_ENTRIES: SidebarEntry[] = [
    // Overview
    { labelKey: 'nav.dashboard',              path: '/',                       group: 'overview',   visibleToRoles: AUTHENTICATED_ROLES },
    { labelKey: 'nav.analytics',              path: '/analytics',              group: 'overview',   visibleToRoles: PLATFORM_OWNER_ROLES },

    // Access & Tenancy
    { labelKey: 'nav.users',                  path: '/users',                  group: 'access',     visibleToRoles: ADMIN_ROLES },
    { labelKey: 'nav.guests',                 path: '/guests',                 group: 'access',     visibleToRoles: ADMIN_ROLES },
    { labelKey: 'nav.tenants',                path: '/tenants',                group: 'access',     visibleToRoles: PLATFORM_OWNER_ROLES },
    // Roles/Permissions list is a platform-owner surface — a tenant admin
    // doesn't define RBAC, they consume it.
    { labelKey: 'nav.roles',                  path: '/roles',                  group: 'access',     visibleToRoles: PLATFORM_OWNER_ROLES },

    // Security
    { labelKey: 'nav.authFlows',              path: '/auth-flows',             group: 'security',   visibleToRoles: ADMIN_ROLES },
    { labelKey: 'nav.authSessions',           path: '/auth-sessions',          group: 'security',   visibleToRoles: ADMIN_ROLES },
    { labelKey: 'nav.devices',                path: '/devices',                group: 'security',   visibleToRoles: ADMIN_ROLES },
    // Audit logs list is tenant-scoped on the backend after #24, but the
    // full cross-tenant view only renders for platform owners.
    { labelKey: 'nav.auditLogs',              path: '/audit-logs',             group: 'security',   visibleToRoles: PLATFORM_OWNER_ROLES },
    { labelKey: 'nav.verificationFlows',      path: '/verification-flows',     group: 'security',   visibleToRoles: ADMIN_ROLES },
    { labelKey: 'nav.verificationDashboard',  path: '/verification-dashboard', group: 'security',   visibleToRoles: ADMIN_ROLES },

    // Biometrics
    { labelKey: 'nav.enrollments',            path: '/enrollments',            group: 'biometrics', visibleToRoles: ADMIN_ROLES },
    { labelKey: 'nav.biometricEnrollment',    path: '/enrollment',             group: 'biometrics', visibleToRoles: AUTHENTICATED_ROLES },
    { labelKey: 'nav.biometricTools',         path: '/biometric-tools',        group: 'biometrics', visibleToRoles: AUTHENTICATED_ROLES },
    { labelKey: 'nav.biometricPuzzles',       path: '/biometric-puzzles',      group: 'biometrics', visibleToRoles: AUTHENTICATED_ROLES },
    { labelKey: 'nav.authMethodsTesting',     path: '/auth-methods-testing',   group: 'biometrics', visibleToRoles: AUTHENTICATED_ROLES },

    // Personal
    { labelKey: 'nav.myProfile',              path: '/my-profile',             group: 'personal',   visibleToRoles: AUTHENTICATED_ROLES },
    { labelKey: 'nav.settings',               path: '/settings',               group: 'personal',   visibleToRoles: AUTHENTICATED_ROLES },
]

/**
 * Pure function — filter the matrix for a given role + permission set.
 * Exported so route-guards (RoleRoute) can share the same source of truth.
 */
export function filterSidebarForRole(
    role: UserRole | undefined | null,
    permissions?: readonly string[],
): SidebarEntry[] {
    if (!role) return []
    return SIDEBAR_ENTRIES.filter((entry) => {
        if (!entry.visibleToRoles.includes(role)) return false
        if (entry.requiredPermissions && entry.requiredPermissions.length > 0) {
            if (!permissions || permissions.length === 0) return false
            return entry.requiredPermissions.some((p) => permissions.includes(p))
        }
        return true
    })
}

/**
 * Return true if the given role is allowed to visit `path`.
 * Used by RoleRoute to decide between render vs redirect-to-dashboard.
 *
 * Paths not in the matrix (e.g. `/users/:id/edit`) inherit the gate of the
 * closest matching prefix — users/create is gated by `/users` visibility.
 */
export function canRoleAccessPath(
    role: UserRole | undefined | null,
    path: string,
    permissions?: readonly string[],
): boolean {
    if (!role) return false
    const entries = filterSidebarForRole(role, permissions)
    // Exact or prefix match — longest match wins so `/users/42/edit` hits
    // `/users` not `/`.
    const match = entries
        .filter((e) => e.path === '/' ? path === '/' : path === e.path || path.startsWith(`${e.path}/`))
        .sort((a, b) => b.path.length - a.path.length)[0]
    return Boolean(match)
}
