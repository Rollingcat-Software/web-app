import { describe, it, expect } from 'vitest'
import {
    AuthMethodType,
    DEFAULT_AUTH_METHODS,
    isLoginMethodType,
    isUsernamelessCapable,
    mapAuthMethodResponseToModel,
    type AuthMethodApiResponse,
} from '../AuthMethod'

describe('DEFAULT_AUTH_METHODS', () => {
    it('includes the 12 canonical LOGIN methods incl. PASSKEY + APPROVE_LOGIN', () => {
        // Regression: the builder previously shipped only 11 defaults, dropping
        // PASSKEY + APPROVE_LOGIN so prod /auth-methods entries for them mapped
        // to null and only 9 of 11 active LOGIN methods rendered. GESTURE_LIVENESS
        // was also seeded (13 total) but is NOT a login factor — it has been
        // removed from the catalog (12 = the canonical login methods).
        expect(DEFAULT_AUTH_METHODS).toHaveLength(12)

        const types = DEFAULT_AUTH_METHODS.map((m) => m.type)
        expect(types).toContain(AuthMethodType.PASSKEY)
        expect(types).toContain(AuthMethodType.APPROVE_LOGIN)
    })

    it('does NOT seed GESTURE_LIVENESS (FACE liveness sub-component, not a login factor)', () => {
        const types = DEFAULT_AUTH_METHODS.map((m) => m.type)
        expect(types).not.toContain(AuthMethodType.GESTURE_LIVENESS)
    })

    it('only seeds real login-method types', () => {
        for (const m of DEFAULT_AUTH_METHODS) {
            expect(isLoginMethodType(m.type)).toBe(true)
        }
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

    it('returns null for GESTURE_LIVENESS (not a login factor, even if the API returns it)', () => {
        const model = mapAuthMethodResponseToModel({ ...base, type: AuthMethodType.GESTURE_LIVENESS })
        expect(model).toBeNull()
    })
})

describe('isLoginMethodType', () => {
    it('accepts the canonical 12 login methods', () => {
        const login = [
            AuthMethodType.PASSWORD, AuthMethodType.EMAIL_OTP, AuthMethodType.SMS_OTP,
            AuthMethodType.TOTP, AuthMethodType.FACE, AuthMethodType.VOICE,
            AuthMethodType.FINGERPRINT, AuthMethodType.HARDWARE_KEY, AuthMethodType.QR_CODE,
            AuthMethodType.NFC_DOCUMENT, AuthMethodType.PASSKEY, AuthMethodType.APPROVE_LOGIN,
        ]
        for (const t of login) expect(isLoginMethodType(t)).toBe(true)
    })

    it('rejects GESTURE_LIVENESS', () => {
        expect(isLoginMethodType(AuthMethodType.GESTURE_LIVENESS)).toBe(false)
    })
})
