import { describe, it, expect } from 'vitest'
import { User, UserRole } from '../User'

/**
 * Role/user_type unification (docs/IDENTITY_ROLE_UNIFICATION.md):
 * the platform tier is authoritative via `userType`; the top tier is "Root";
 * the legacy `SUPER_ADMIN` spelling maps to ROOT for back-compat.
 */
function makeJSON(over: Record<string, unknown> = {}) {
    return {
        id: 'u1',
        email: 'u@example.com',
        firstName: 'U',
        lastName: 'One',
        status: 'ACTIVE',
        tenantId: '00000000-0000-0000-0000-000000000000',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...over,
    }
}

describe('User — role/userType unification', () => {
    it('userType "ROOT" → isRoot() === true', () => {
        const u = User.fromJSON(makeJSON({ role: 'ROOT', userType: 'ROOT' }))
        expect(u.userType).toBe('ROOT')
        expect(u.role).toBe(UserRole.ROOT)
        expect(u.isRoot()).toBe(true)
        expect(u.isAdmin()).toBe(true)
    })

    it('TENANT_ADMIN by role + userType "TENANT_ADMIN" → isRoot() false, isAdmin() true', () => {
        const u = User.fromJSON(makeJSON({ role: 'TENANT_ADMIN', userType: 'TENANT_ADMIN' }))
        expect(u.userType).toBe('TENANT_ADMIN')
        expect(u.role).toBe(UserRole.TENANT_ADMIN)
        expect(u.isRoot()).toBe(false)
        expect(u.isAdmin()).toBe(true)
    })

    it('userType is authoritative: role ROOT but userType TENANT_ADMIN → isRoot() false', () => {
        // The exact ahabgu-style mismatch the spec calls out. The backend gates
        // on userType, so the UI must too.
        const u = User.fromJSON(makeJSON({ role: 'ROOT', userType: 'TENANT_ADMIN' }))
        expect(u.isRoot()).toBe(false)
        // still admin (ROOT role)
        expect(u.isAdmin()).toBe(true)
    })

    it('back-compat: role "SUPER_ADMIN" with no userType → isRoot() === true', () => {
        const u = User.fromJSON(makeJSON({ role: 'SUPER_ADMIN' }))
        expect(u.role).toBe(UserRole.ROOT) // normalized
        expect(u.userType).toBeUndefined()
        expect(u.isRoot()).toBe(true)
    })

    it('back-compat: userType "SUPER_ADMIN" is normalized to ROOT', () => {
        const u = User.fromJSON(makeJSON({ role: 'ROOT', userType: 'SUPER_ADMIN' }))
        expect(u.userType).toBe('ROOT')
        expect(u.isRoot()).toBe(true)
    })

    it('role ROOT with no userType (older token) → isRoot() falls back to role', () => {
        const u = User.fromJSON(makeJSON({ role: 'ROOT' }))
        expect(u.userType).toBeUndefined()
        expect(u.isRoot()).toBe(true)
    })

    it('plain USER → isRoot() false, isAdmin() false', () => {
        const u = User.fromJSON(makeJSON({ role: 'USER', userType: 'TENANT_MEMBER' }))
        expect(u.isRoot()).toBe(false)
        expect(u.isAdmin()).toBe(false)
    })

    it('GUEST userType → isRoot() false', () => {
        const u = User.fromJSON(makeJSON({ role: 'USER', userType: 'GUEST' }))
        expect(u.userType).toBe('GUEST')
        expect(u.isRoot()).toBe(false)
    })

    it('unknown/absent userType is dropped (undefined), not coerced', () => {
        const u = User.fromJSON(makeJSON({ role: 'USER', userType: 'WHATEVER' }))
        expect(u.userType).toBeUndefined()
    })

    it('toJSON round-trips userType', () => {
        const u = User.fromJSON(makeJSON({ role: 'ROOT', userType: 'ROOT' }))
        expect(u.toJSON().userType).toBe('ROOT')
    })
})
