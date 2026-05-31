import { describe, it, expect } from 'vitest'
import {
    AuthMethodType,
    DEFAULT_AUTH_METHODS,
    isUsernamelessCapable,
    mapAuthMethodResponseToModel,
    type AuthMethodApiResponse,
} from '../AuthMethod'

describe('DEFAULT_AUTH_METHODS', () => {
    it('includes all 13 method types incl. PASSKEY + APPROVE_LOGIN', () => {
        // Regression: the builder previously shipped only 11 defaults, dropping
        // PASSKEY + APPROVE_LOGIN so prod /auth-methods entries for them mapped
        // to null and only 9 of 11 active LOGIN methods rendered.
        expect(DEFAULT_AUTH_METHODS).toHaveLength(13)

        const types = DEFAULT_AUTH_METHODS.map((m) => m.type)
        expect(types).toContain(AuthMethodType.PASSKEY)
        expect(types).toContain(AuthMethodType.APPROVE_LOGIN)
    })

    it('marks PASSKEY usernameless and APPROVE_LOGIN identifier-first', () => {
        const passkey = DEFAULT_AUTH_METHODS.find((m) => m.type === AuthMethodType.PASSKEY)
        const approve = DEFAULT_AUTH_METHODS.find((m) => m.type === AuthMethodType.APPROVE_LOGIN)

        expect(passkey?.supportsUsernameless).toBe(true)
        expect(approve?.supportsUsernameless).toBe(false)
        expect(isUsernamelessCapable(AuthMethodType.PASSKEY)).toBe(true)
        expect(isUsernamelessCapable(AuthMethodType.APPROVE_LOGIN)).toBe(false)
    })

    it('gives PASSKEY + APPROVE_LOGIN non-empty fallback names', () => {
        for (const type of [AuthMethodType.PASSKEY, AuthMethodType.APPROVE_LOGIN]) {
            const method = DEFAULT_AUTH_METHODS.find((m) => m.type === type)
            expect(method?.name?.trim().length).toBeGreaterThan(0)
        }
    })
})

describe('mapAuthMethodResponseToModel', () => {
    const base: AuthMethodApiResponse = {
        id: 'x',
        type: AuthMethodType.PASSKEY,
        name: '',
        description: '',
        category: 'ENTERPRISE',
        platforms: ['web'],
        requiresEnrollment: false,
        isActive: true,
    }

    it('maps a PASSKEY API method instead of dropping it', () => {
        const model = mapAuthMethodResponseToModel({ ...base, type: AuthMethodType.PASSKEY })
        expect(model).not.toBeNull()
        expect(model?.type).toBe(AuthMethodType.PASSKEY)
        expect(model?.supportsUsernameless).toBe(true)
    })

    it('maps an APPROVE_LOGIN API method instead of dropping it', () => {
        const model = mapAuthMethodResponseToModel({ ...base, type: AuthMethodType.APPROVE_LOGIN })
        expect(model).not.toBeNull()
        expect(model?.type).toBe(AuthMethodType.APPROVE_LOGIN)
        expect(model?.supportsUsernameless).toBe(false)
    })

    it('falls back to the catalog name when the API omits it', () => {
        const model = mapAuthMethodResponseToModel({ ...base, type: AuthMethodType.PASSKEY, name: '' })
        const fallback = DEFAULT_AUTH_METHODS.find((m) => m.type === AuthMethodType.PASSKEY)
        expect(model?.name).toBe(fallback?.name)
    })

    it('returns null for an unknown method type', () => {
        const model = mapAuthMethodResponseToModel({ ...base, type: 'TOTALLY_UNKNOWN' })
        expect(model).toBeNull()
    })
})
