import { describe, it, expect } from 'vitest'
import { AuthMethodType } from '../AuthMethod'
import {
    normalizeLoginConfig,
    hasPasswordLayer1,
    hasUsernamelessPasskey,
    hasUsernamelessQr,
    hasUsernamelessApprove,
    needsIdentifier,
    selectPuzzleConfig,
    type RawLoginConfig,
} from '../LoginConfig'

describe('normalizeLoginConfig', () => {
    it('returns null for null / empty / no-layer1 input', () => {
        expect(normalizeLoginConfig(null)).toBeNull()
        expect(normalizeLoginConfig(undefined)).toBeNull()
        expect(normalizeLoginConfig({})).toBeNull()
        expect(normalizeLoginConfig({ layer1: { methods: [] } })).toBeNull()
    })

    it('normalizes camelCase + tolerates methodType / supportsUsernameless aliases', () => {
        const raw: RawLoginConfig = {
            tenantId: 't1',
            tenantName: 'Acme',
            layer1: {
                identifierRequired: true,
                methods: [
                    { type: 'PASSWORD', requiresEnrollment: false },
                    { methodType: 'HARDWARE_KEY', supportsUsernameless: true },
                ],
            },
            totalSteps: 2,
            laterSteps: [{ order: 2, methods: [{ type: 'EMAIL_OTP' }, { type: 'TOTP' }] }],
        }
        const cfg = normalizeLoginConfig(raw)!
        expect(cfg.tenantName).toBe('Acme')
        expect(cfg.layer1.identifierRequired).toBe(true)
        expect(cfg.layer1.methods).toEqual([
            { type: AuthMethodType.PASSWORD, usernameless: false, requiresEnrollment: false },
            { type: AuthMethodType.HARDWARE_KEY, usernameless: true, requiresEnrollment: false },
        ])
        expect(cfg.laterSteps).toEqual([
            { order: 2, methods: [AuthMethodType.EMAIL_OTP, AuthMethodType.TOTP] },
        ])
        expect(cfg.totalSteps).toBe(2)
    })

    it('drops unknown method types and derives totalSteps when absent', () => {
        const cfg = normalizeLoginConfig({
            layer1: { methods: [{ type: 'PASSWORD' }, { type: 'NONSENSE' }] },
            laterSteps: [{ order: 2, methods: [{ type: 'EMAIL_OTP' }] }],
        })!
        expect(cfg.layer1.methods.map((m) => m.type)).toEqual([AuthMethodType.PASSWORD])
        // 1 (layer 1) + 1 later step
        expect(cfg.totalSteps).toBe(2)
    })
})

describe('LoginConfig classification helpers', () => {
    const passwordConfig = normalizeLoginConfig({
        layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
    })!
    const passkeyConfig = normalizeLoginConfig({
        layer1: {
            identifierRequired: false,
            methods: [
                { type: 'HARDWARE_KEY', usernameless: true },
                { type: 'QR_CODE', usernameless: true },
            ],
        },
    })!
    const otpFirstConfig = normalizeLoginConfig({
        layer1: { identifierRequired: true, methods: [{ type: 'EMAIL_OTP' }] },
    })!

    it('hasPasswordLayer1', () => {
        expect(hasPasswordLayer1(passwordConfig)).toBe(true)
        expect(hasPasswordLayer1(passkeyConfig)).toBe(false)
    })

    it('hasUsernamelessPasskey only for usernameless HARDWARE_KEY/FINGERPRINT', () => {
        expect(hasUsernamelessPasskey(passkeyConfig)).toBe(true)
        expect(hasUsernamelessPasskey(passwordConfig)).toBe(false)
        // A NON-usernameless hardware key does NOT enable the shortcut.
        const nonUsernameless = normalizeLoginConfig({
            layer1: { methods: [{ type: 'HARDWARE_KEY', usernameless: false }] },
        })!
        expect(hasUsernamelessPasskey(nonUsernameless)).toBe(false)
    })

    it('hasUsernamelessQr / hasUsernamelessApprove', () => {
        expect(hasUsernamelessQr(passkeyConfig)).toBe(true)
        expect(hasUsernamelessApprove(passkeyConfig)).toBe(true)
        expect(hasUsernamelessQr(passwordConfig)).toBe(false)
    })

    it('recognizes the dedicated PASSKEY + APPROVE_LOGIN types (frozen contract)', () => {
        const dedicated = normalizeLoginConfig({
            layer1: {
                identifierRequired: false,
                methods: [
                    { type: 'PASSKEY', usernameless: true },
                    { type: 'APPROVE_LOGIN', usernameless: true },
                ],
            },
        })!
        expect(hasUsernamelessPasskey(dedicated)).toBe(true)
        expect(hasUsernamelessApprove(dedicated)).toBe(true)
        expect(needsIdentifier(dedicated)).toBe(false)
    })

    it('needsIdentifier: true when flag set OR password present', () => {
        expect(needsIdentifier(passwordConfig)).toBe(true)
        expect(needsIdentifier(otpFirstConfig)).toBe(true)
        expect(needsIdentifier(passkeyConfig)).toBe(false)
    })
})

describe('PUZZLE step config (Phase-5 identity binding)', () => {
    it('parses an inline puzzleConfig on a later-step PUZZLE method', () => {
        const cfg = normalizeLoginConfig({
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
            laterSteps: [
                {
                    order: 2,
                    methods: [{ type: 'PUZZLE' }],
                    puzzleConfig: {
                        allowedChallengeTypes: ['FACE_BLINK', 'FACE_SMILE'],
                        count: 2,
                        difficulty: 'hard',
                        alsoMatchFaceIdentity: true,
                    },
                },
            ],
        })!
        expect(cfg.laterSteps[0].puzzleConfig).toEqual({
            allowedChallengeTypes: ['FACE_BLINK', 'FACE_SMILE'],
            count: 2,
            difficulty: 'hard',
            alsoMatchFaceIdentity: true,
        })
    })

    it('parses a nested stepConfig.puzzleConfig (Phase 2.4 envelope)', () => {
        const cfg = normalizeLoginConfig({
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
            laterSteps: [
                {
                    order: 2,
                    methods: [{ type: 'PUZZLE' }],
                    stepConfig: {
                        puzzleConfig: { count: 3, difficulty: 'easy', alsoMatchFaceIdentity: false },
                    },
                },
            ],
        })!
        expect(cfg.laterSteps[0].puzzleConfig).toEqual({
            allowedChallengeTypes: [],
            count: 3,
            difficulty: 'easy',
            alsoMatchFaceIdentity: false,
        })
    })

    it('defaults alsoMatchFaceIdentity to TRUE and difficulty to medium when omitted', () => {
        const cfg = normalizeLoginConfig({
            layer1: {
                identifierRequired: false,
                methods: [{ type: 'PUZZLE', puzzleConfig: {} }],
            },
        })!
        expect(cfg.layer1.methods[0].puzzleConfig).toEqual({
            allowedChallengeTypes: [],
            count: 1,
            difficulty: 'medium',
            alsoMatchFaceIdentity: true,
        })
    })

    it('leaves non-PUZZLE methods without a puzzleConfig field', () => {
        const cfg = normalizeLoginConfig({
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
        })!
        expect(cfg.layer1.methods[0]).not.toHaveProperty('puzzleConfig')
    })

    it('selectPuzzleConfig returns the layer-1 PUZZLE config for a PUZZLE method', () => {
        const cfg = normalizeLoginConfig({
            layer1: {
                identifierRequired: false,
                methods: [{ type: 'PUZZLE', puzzleConfig: { alsoMatchFaceIdentity: true } }],
            },
        })!
        expect(selectPuzzleConfig(cfg, AuthMethodType.PUZZLE)?.alsoMatchFaceIdentity).toBe(true)
    })

    it('selectPuzzleConfig returns a later-step PUZZLE config for a PUZZLE method', () => {
        const cfg = normalizeLoginConfig({
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
            laterSteps: [
                { order: 2, methods: [{ type: 'PUZZLE' }], puzzleConfig: { alsoMatchFaceIdentity: false } },
            ],
        })!
        expect(selectPuzzleConfig(cfg, AuthMethodType.PUZZLE)?.alsoMatchFaceIdentity).toBe(false)
    })

    it('selectPuzzleConfig no-ops for non-PUZZLE methods, null config, or no PUZZLE layer', () => {
        const cfg = normalizeLoginConfig({
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
            laterSteps: [{ order: 2, methods: [{ type: 'PUZZLE' }], puzzleConfig: { count: 1 } }],
        })!
        // Wrong method → undefined even though a PUZZLE layer exists.
        expect(selectPuzzleConfig(cfg, AuthMethodType.FACE)).toBeUndefined()
        // Null config → undefined.
        expect(selectPuzzleConfig(null, AuthMethodType.PUZZLE)).toBeUndefined()
        // No PUZZLE layer at all → undefined.
        const noPuzzle = normalizeLoginConfig({
            layer1: { identifierRequired: true, methods: [{ type: 'PASSWORD' }] },
        })!
        expect(selectPuzzleConfig(noPuzzle, AuthMethodType.PUZZLE)).toBeUndefined()
    })
})
