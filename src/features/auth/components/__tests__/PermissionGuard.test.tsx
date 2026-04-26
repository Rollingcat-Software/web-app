import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { PermissionGuard } from '../PermissionGuard'
import { PermissionProvider } from '../../context/PermissionProvider'
import { Permission } from '@domain/models/Permission'

// Mock useAuth with different roles
const mockUseAuth = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}))

const renderWithProvider = (
    ui: React.ReactElement,
    userRole: string | undefined = 'ADMIN'
) => {
    mockUseAuth.mockReturnValue({
        user: userRole ? { id: 1, role: userRole } : null,
        isAuthenticated: !!userRole,
        loading: false,
    })

    return render(<PermissionProvider>{ui}</PermissionProvider>)
}

describe('PermissionGuard', () => {
    describe('with single permission', () => {
        it('should render children when user has permission', () => {
            renderWithProvider(
                <PermissionGuard permission={Permission.USERS_VIEW}>
                    <div>Protected Content</div>
                </PermissionGuard>,
                'ADMIN'
            )

            expect(screen.getByText('Protected Content')).toBeInTheDocument()
        })

        it('should not render children when user lacks permission', () => {
            renderWithProvider(
                <PermissionGuard permission={Permission.TENANTS_DELETE}>
                    <div>Protected Content</div>
                </PermissionGuard>,
                'USER'
            )

            expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
        })

        it('should render fallback when user lacks permission', () => {
            renderWithProvider(
                <PermissionGuard
                    permission={Permission.TENANTS_DELETE}
                    fallback={<div>Access Denied</div>}
                >
                    <div>Protected Content</div>
                </PermissionGuard>,
                'USER'
            )

            expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
            expect(screen.getByText('Access Denied')).toBeInTheDocument()
        })
    })

    describe('with multiple permissions (any)', () => {
        it('should render when user has any of the permissions', () => {
            renderWithProvider(
                <PermissionGuard
                    permissions={[Permission.USERS_EDIT, Permission.USERS_DELETE]}
                >
                    <div>Protected Content</div>
                </PermissionGuard>,
                'ADMIN'
            )

            expect(screen.getByText('Protected Content')).toBeInTheDocument()
        })

        it('should not render when user has none of the permissions', () => {
            renderWithProvider(
                <PermissionGuard
                    permissions={[Permission.TENANTS_CREATE, Permission.TENANTS_DELETE]}
                >
                    <div>Protected Content</div>
                </PermissionGuard>,
                'USER'
            )

            expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
        })
    })

    describe('with multiple permissions (all required)', () => {
        it('should render when user has all permissions', () => {
            renderWithProvider(
                <PermissionGuard
                    permissions={[Permission.USERS_VIEW, Permission.DASHBOARD_VIEW]}
                    requireAll
                >
                    <div>Protected Content</div>
                </PermissionGuard>,
                'ADMIN'
            )

            expect(screen.getByText('Protected Content')).toBeInTheDocument()
        })

        it('should not render when user lacks some permissions', () => {
            renderWithProvider(
                <PermissionGuard
                    permissions={[Permission.USERS_VIEW, Permission.TENANTS_CREATE]}
                    requireAll
                >
                    <div>Protected Content</div>
                </PermissionGuard>,
                'USER'
            )

            expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
        })
    })

    describe('super admin access', () => {
        it('should allow super admin access to all permissions', () => {
            renderWithProvider(
                <PermissionGuard permission={Permission.TENANTS_DELETE}>
                    <div>Protected Content</div>
                </PermissionGuard>,
                'SUPER_ADMIN'
            )

            expect(screen.getByText('Protected Content')).toBeInTheDocument()
        })
    })

    describe('no permission specified', () => {
        it('should render children when no permission is specified', () => {
            renderWithProvider(
                <PermissionGuard>
                    <div>Protected Content</div>
                </PermissionGuard>,
                'USER'
            )

            expect(screen.getByText('Protected Content')).toBeInTheDocument()
        })
    })
})
