/**
 * PermissionProvider — userType-vs-role authority edge cases.
 *
 * The provider derives `isRoot` from `user.isRoot()` (which is userType-driven
 * with a role fallback), NOT from the RBAC `role` alone. These tests pin the
 * boundary the backend gate cares about (docs/IDENTITY_ROLE_UNIFICATION.md):
 *
 *  - role ROOT + userType TENANT_ADMIN  → isRoot FALSE (userType wins) but
 *    isAdmin TRUE (ROLE_PERMISSIONS for ROOT still apply — the in-tenant role
 *    is authoritative for *permissions*, only the platform-tier gate flips).
 *  - role TENANT_ADMIN + userType ROOT  → isRoot TRUE (userType wins).
 *  - a plain-object user lacking the isRoot() method → falls back to role.
 *
 * The complementary "isRoot matches role" cases live in PermissionContext.test.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { PermissionProvider } from '../PermissionProvider'
import { usePermissions } from '../PermissionContext'
import { User } from '@domain/models/User'

const mockUseAuth = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}))

function wrapper({ children }: { children: React.ReactNode }) {
    return <PermissionProvider>{children}</PermissionProvider>
}

function renderWithUser(user: unknown) {
    mockUseAuth.mockReturnValue({ user, isAuthenticated: !!user, loading: false })
    return renderHook(() => usePermissions(), { wrapper })
}

function makeUser(over: Record<string, unknown>) {
    return User.fromJSON({
        id: '1',
        email: 't@example.com',
        firstName: 'T',
        lastName: 'U',
        status: 'ACTIVE',
        tenantId: '00000000-0000-0000-0000-000000000000',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...over,
    })
}

describe('PermissionProvider — userType authority', () => {
    it('role ROOT but userType TENANT_ADMIN → isRoot FALSE, isAdmin TRUE', () => {
        const { result } = renderWithUser(makeUser({ role: 'ROOT', userType: 'TENANT_ADMIN' }))
        expect(result.current.isRoot).toBe(false)
        expect(result.current.isAdmin).toBe(true)
        expect(result.current.role).toBe('ROOT')
    })

    it('role TENANT_ADMIN but userType ROOT → isRoot TRUE', () => {
        const { result } = renderWithUser(makeUser({ role: 'TENANT_ADMIN', userType: 'ROOT' }))
        expect(result.current.isRoot).toBe(true)
        expect(result.current.isAdmin).toBe(true)
    })

    it('role ROOT with no userType (older token) → isRoot TRUE via role fallback', () => {
        const { result } = renderWithUser(makeUser({ role: 'ROOT' }))
        expect(result.current.isRoot).toBe(true)
    })

    it('userType GUEST + role USER → isRoot FALSE, isAdmin FALSE', () => {
        const { result } = renderWithUser(makeUser({ role: 'USER', userType: 'GUEST' }))
        expect(result.current.isRoot).toBe(false)
        expect(result.current.isAdmin).toBe(false)
    })

    it('plain-object user WITHOUT isRoot() method falls back to role (ROOT → true)', () => {
        // Some call sites/tests supply a bare object; the provider guards the
        // method call and falls back to `role === ROOT`.
        const { result } = renderWithUser({ role: 'ROOT' })
        expect(result.current.isRoot).toBe(true)
    })

    it('plain-object non-ROOT user without isRoot() → isRoot false', () => {
        const { result } = renderWithUser({ role: 'TENANT_ADMIN' })
        expect(result.current.isRoot).toBe(false)
        expect(result.current.isAdmin).toBe(true)
    })
})
