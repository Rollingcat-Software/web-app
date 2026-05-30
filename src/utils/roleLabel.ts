import type { TFunction } from 'i18next'
import { UserRole } from '@domain/models/User'

/**
 * Human-readable, i18n-aware label for an RBAC role.
 *
 * The platform top tier renders as "Root" (EN) / a TR equivalent — the word
 * "SUPER ADMIN" must never appear in the UI (see
 * docs/IDENTITY_ROLE_UNIFICATION.md). Tolerates the legacy `SUPER_ADMIN`
 * spelling for tokens minted before the V69 backend rename.
 *
 * Falls back to a prettified version of any unknown role string
 * (`TENANT_ADMIN` → `Tenant Admin`) so new backend roles still render sanely.
 */
export function roleLabel(role: string | null | undefined, t: TFunction): string {
    if (!role) return ''
    const key = String(role).toUpperCase()

    const i18nKeys: Record<string, string> = {
        ROOT: 'roles.labels.root',
        SUPER_ADMIN: 'roles.labels.root', // legacy alias → Root
        ADMIN: 'roles.labels.admin',
        TENANT_ADMIN: 'roles.labels.tenantAdmin',
        USER: 'roles.labels.user',
    }

    const i18nKey = i18nKeys[key]
    if (i18nKey) {
        // Use the prettified fallback as the i18n default so a missing key
        // never surfaces the raw enum string.
        return t(i18nKey, { defaultValue: prettify(key) })
    }
    return prettify(key)
}

/** `TENANT_ADMIN` → `Tenant Admin`. */
function prettify(role: string): string {
    return role
        .toLowerCase()
        .split('_')
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ')
}

/** Convenience: label for a {@link UserRole} enum value. */
export function userRoleLabel(role: UserRole, t: TFunction): string {
    return roleLabel(role, t)
}
