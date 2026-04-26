import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { PermissionProvider } from '../PermissionProvider'
import { usePermissions } from '../PermissionContext'
import { Permission } from '@domain/models/Permission'

// Mock useAuth
const mockUseAuth = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}))

function createWrapper() {
    return ({ children }: { children: React.ReactNode }) => (
        <PermissionProvider>{children}</PermissionProvider>
    )
}

function renderPermissions(role: string | undefined) {
    mockUseAuth.mockReturnValue({
        user: role ? { id: '1', role } : null,
        isAuthenticated: !!role,
        loading: false,
    })
    return renderHook(() => usePermissions(), { wrapper: createWrapper() })
}

describe('PermissionContext', () => {
    describe('ROLE_PERMISSIONS mapping', () => {
        it('should give SUPER_ADMIN all 16 permissions', () => {
            const { result } = renderPermissions('SUPER_ADMIN')
            expect(result.current.permissions).toHaveLength(16)
        })

        it('should give ADMIN 10 permissions', () => {
            const { result } = renderPermissions('ADMIN')
            expect(result.current.permissions).toHaveLength(10)
        })

        it('should give TENANT_ADMIN 7 permissions', () => {
            const { result } = renderPermissions('TENANT_ADMIN')
            expect(result.current.permissions).toHaveLength(7)
        })

        it('should give USER only DASHBOARD_VIEW', () => {
            const { result } = renderPermissions('USER')
            expect(result.current.permissions).toHaveLength(1)
            expect(result.current.permissions).toContain(Permission.DASHBOARD_VIEW)
        })

        it('should give empty permissions when user is null', () => {
            const { result } = renderPermissions(undefined)
            expect(result.current.permissions).toHaveLength(0)
        })
    })

    describe('role flags', () => {
        it('should identify SUPER_ADMIN role', () => {
            const { result } = renderPermissions('SUPER_ADMIN')
            expect(result.current.isSuperAdmin).toBe(true)
            expect(result.current.isAdmin).toBe(true)
            expect(result.current.role).toBe('SUPER_ADMIN')
        })

        it('should identify ADMIN role', () => {
            const { result } = renderPermissions('ADMIN')
            expect(result.current.isSuperAdmin).toBe(false)
            expect(result.current.isAdmin).toBe(true)
            expect(result.current.role).toBe('ADMIN')
        })

        it('should not flag USER as admin', () => {
            const { result } = renderPermissions('USER')
            expect(result.current.isSuperAdmin).toBe(false)
            expect(result.current.isAdmin).toBe(false)
        })

        it('should return null role when unauthenticated', () => {
            const { result } = renderPermissions(undefined)
            expect(result.current.role).toBeNull()
            expect(result.current.isSuperAdmin).toBe(false)
            expect(result.current.isAdmin).toBe(false)
        })
    })

    describe('hasPermission', () => {
        it('should return true for granted permission', () => {
            const { result } = renderPermissions('ADMIN')
            expect(result.current.hasPermission(Permission.USERS_VIEW)).toBe(true)
        })

        it('should return false for non-granted permission', () => {
            const { result } = renderPermissions('USER')
            expect(result.current.hasPermission(Permission.USERS_VIEW)).toBe(false)
        })

        it('should return true for SUPER_ADMIN on any permission', () => {
            const { result } = renderPermissions('SUPER_ADMIN')
            expect(result.current.hasPermission(Permission.TENANTS_DELETE)).toBe(true)
            expect(result.current.hasPermission(Permission.ROLES_MANAGE)).toBe(true)
        })
    })

    describe('hasAnyPermission', () => {
        it('should return true when user has at least one', () => {
            const { result } = renderPermissions('USER')
            expect(
                result.current.hasAnyPermission([Permission.USERS_VIEW, Permission.DASHBOARD_VIEW])
            ).toBe(true)
        })

        it('should return false when user has none', () => {
            const { result } = renderPermissions('USER')
            expect(
                result.current.hasAnyPermission([Permission.USERS_VIEW, Permission.TENANTS_DELETE])
            ).toBe(false)
        })
    })

    describe('hasAllPermissions', () => {
        it('should return true when user has all', () => {
            const { result } = renderPermissions('ADMIN')
            expect(
                result.current.hasAllPermissions([Permission.USERS_VIEW, Permission.DASHBOARD_VIEW])
            ).toBe(true)
        })

        it('should return false when user lacks one', () => {
            const { result } = renderPermissions('ADMIN')
            expect(
                result.current.hasAllPermissions([Permission.USERS_VIEW, Permission.TENANTS_DELETE])
            ).toBe(false)
        })
    })

    describe('ADMIN should not have tenant management', () => {
        it('should not have TENANTS_CREATE', () => {
            const { result } = renderPermissions('ADMIN')
            expect(result.current.hasPermission(Permission.TENANTS_CREATE)).toBe(false)
        })

        it('should not have TENANTS_DELETE', () => {
            const { result } = renderPermissions('ADMIN')
            expect(result.current.hasPermission(Permission.TENANTS_DELETE)).toBe(false)
        })

        it('should not have ROLES_MANAGE', () => {
            const { result } = renderPermissions('ADMIN')
            expect(result.current.hasPermission(Permission.ROLES_MANAGE)).toBe(false)
        })
    })

    describe('TENANT_ADMIN permission boundaries', () => {
        it('should have user management but not delete', () => {
            const { result } = renderPermissions('TENANT_ADMIN')
            expect(result.current.hasPermission(Permission.USERS_VIEW)).toBe(true)
            expect(result.current.hasPermission(Permission.USERS_CREATE)).toBe(true)
            expect(result.current.hasPermission(Permission.USERS_EDIT)).toBe(true)
            expect(result.current.hasPermission(Permission.USERS_DELETE)).toBe(false)
        })

        it('should not have audit or roles', () => {
            const { result } = renderPermissions('TENANT_ADMIN')
            expect(result.current.hasPermission(Permission.AUDIT_VIEW)).toBe(false)
            expect(result.current.hasPermission(Permission.ROLES_VIEW)).toBe(false)
        })
    })

    describe('usePermissions outside provider', () => {
        it('should throw when used outside PermissionProvider', () => {
            expect(() => {
                renderHook(() => usePermissions())
            }).toThrow('usePermissions must be used within PermissionProvider')
        })
    })
})
