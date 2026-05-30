/**
 * roleLabel — i18n-aware RBAC role label (docs/IDENTITY_ROLE_UNIFICATION.md).
 *
 * The top tier renders "Root"; the legacy `SUPER_ADMIN` spelling must STILL
 * render "Root" (never the words "Super Admin") for tokens minted before the
 * V69 rename. Unknown roles fall back to a prettified Title-Case form so a new
 * backend role never surfaces the raw SCREAMING_SNAKE enum.
 */
import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { roleLabel, userRoleLabel } from '../roleLabel'
import { UserRole } from '@domain/models/User'

// Translator that returns the configured value for a known key, otherwise the
// provided defaultValue (mirroring i18next's `defaultValue` contract).
const KNOWN: Record<string, string> = {
    'roles.labels.root': 'Root',
    'roles.labels.admin': 'Admin',
    'roles.labels.tenantAdmin': 'Tenant Admin',
    'roles.labels.user': 'User',
}
const t = ((key: string, opts?: { defaultValue?: string }) => {
    if (key in KNOWN) return KNOWN[key]
    return opts?.defaultValue ?? key
}) as unknown as TFunction

describe('roleLabel', () => {
    it('renders "Root" for ROOT', () => {
        expect(roleLabel('ROOT', t)).toBe('Root')
    })

    it('renders "Root" for the legacy SUPER_ADMIN spelling (never "Super Admin")', () => {
        expect(roleLabel('SUPER_ADMIN', t)).toBe('Root')
        expect(roleLabel('SUPER_ADMIN', t)).not.toMatch(/super/i)
    })

    it('is case-insensitive on the input', () => {
        expect(roleLabel('root', t)).toBe('Root')
        expect(roleLabel('super_admin', t)).toBe('Root')
    })

    it('renders Admin / Tenant Admin / User', () => {
        expect(roleLabel('ADMIN', t)).toBe('Admin')
        expect(roleLabel('TENANT_ADMIN', t)).toBe('Tenant Admin')
        expect(roleLabel('USER', t)).toBe('User')
    })

    it('prettifies an UNKNOWN role to Title Case rather than leaking the enum', () => {
        expect(roleLabel('SOME_NEW_ROLE', t)).toBe('Some New Role')
    })

    it('falls back to the prettified form when the i18n key is missing', () => {
        // A translator that knows none of the keys must still avoid the raw enum.
        const noKeys = ((_key: string, opts?: { defaultValue?: string }) =>
            opts?.defaultValue ?? _key) as unknown as TFunction
        expect(roleLabel('TENANT_ADMIN', noKeys)).toBe('Tenant Admin')
    })

    it('returns empty string for null / undefined / empty', () => {
        expect(roleLabel(null, t)).toBe('')
        expect(roleLabel(undefined, t)).toBe('')
        expect(roleLabel('', t)).toBe('')
    })

    it('userRoleLabel delegates to roleLabel for the enum value', () => {
        expect(userRoleLabel(UserRole.ROOT, t)).toBe('Root')
        expect(userRoleLabel(UserRole.TENANT_ADMIN, t)).toBe('Tenant Admin')
    })
})
