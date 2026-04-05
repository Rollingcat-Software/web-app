import { describe, it, expect } from 'vitest'
import { IdInfoSchema, validateIdInfo } from '../userEnrollmentValidator'

describe('userEnrollmentValidator', () => {
    // ── IdInfoSchema ───────────────────────────────────────────────────────

    describe('IdInfoSchema', () => {
        it('should accept valid ID info', () => {
            const result = IdInfoSchema.safeParse({
                nationalId: '12345678901',
                dateOfBirth: '1990-06-15',
                fullName: 'Ahmet Gultekin',
            })
            expect(result.success).toBe(true)
        })

        it('should reject empty nationalId', () => {
            const result = IdInfoSchema.safeParse({
                nationalId: '',
                dateOfBirth: '1990-06-15',
                fullName: 'Ahmet Gultekin',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                const messages = result.error.issues.map(i => i.message)
                expect(messages).toContain('National ID is required')
            }
        })

        it('should reject nationalId longer than 20 characters', () => {
            const result = IdInfoSchema.safeParse({
                nationalId: 'A'.repeat(21),
                dateOfBirth: '1990-06-15',
                fullName: 'Ahmet Gultekin',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                const messages = result.error.issues.map(i => i.message)
                expect(messages).toContain('National ID must be at most 20 characters')
            }
        })

        it('should reject nationalId with special characters (except hyphens)', () => {
            const result = IdInfoSchema.safeParse({
                nationalId: '1234@5678',
                dateOfBirth: '1990-06-15',
                fullName: 'Ahmet Gultekin',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                const messages = result.error.issues.map(i => i.message)
                expect(messages).toContain('National ID must contain only letters, numbers, and hyphens')
            }
        })

        it('should accept nationalId with hyphens', () => {
            const result = IdInfoSchema.safeParse({
                nationalId: 'AB-1234',
                dateOfBirth: '1990-06-15',
                fullName: 'Ahmet Gultekin',
            })
            expect(result.success).toBe(true)
        })

        it('should reject empty dateOfBirth', () => {
            const result = IdInfoSchema.safeParse({
                nationalId: '12345678901',
                dateOfBirth: '',
                fullName: 'Ahmet Gultekin',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                const messages = result.error.issues.map(i => i.message)
                expect(messages).toContain('Date of birth is required')
            }
        })

        it('should reject dateOfBirth in wrong format', () => {
            const result = IdInfoSchema.safeParse({
                nationalId: '12345678901',
                dateOfBirth: '15/06/1990',
                fullName: 'Ahmet Gultekin',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                const messages = result.error.issues.map(i => i.message)
                expect(messages).toContain('Date of birth must be in YYYY-MM-DD format')
            }
        })

        it('should accept dateOfBirth in YYYY-MM-DD format', () => {
            const result = IdInfoSchema.safeParse({
                nationalId: '12345678901',
                dateOfBirth: '2000-12-31',
                fullName: 'Ahmet Gultekin',
            })
            expect(result.success).toBe(true)
        })

        it('should reject fullName shorter than 2 characters', () => {
            const result = IdInfoSchema.safeParse({
                nationalId: '12345678901',
                dateOfBirth: '1990-06-15',
                fullName: 'A',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                const messages = result.error.issues.map(i => i.message)
                expect(messages).toContain('Full name must be at least 2 characters')
            }
        })

        it('should reject fullName longer than 200 characters', () => {
            const result = IdInfoSchema.safeParse({
                nationalId: '12345678901',
                dateOfBirth: '1990-06-15',
                fullName: 'A '.repeat(101),
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                const messages = result.error.issues.map(i => i.message)
                expect(messages).toContain('Full name must be at most 200 characters')
            }
        })

        it('should reject fullName with numbers', () => {
            const result = IdInfoSchema.safeParse({
                nationalId: '12345678901',
                dateOfBirth: '1990-06-15',
                fullName: 'Ahmet 123',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                const messages = result.error.issues.map(i => i.message)
                expect(messages).toContain("Full name must contain only letters, spaces, hyphens, and apostrophes")
            }
        })

        it('should accept fullName with Turkish characters', () => {
            const result = IdInfoSchema.safeParse({
                nationalId: '12345678901',
                dateOfBirth: '1990-06-15',
                fullName: 'Ahmet Gültekin',
            })
            expect(result.success).toBe(true)
        })

        it('should accept fullName with hyphens and apostrophes', () => {
            const result = IdInfoSchema.safeParse({
                nationalId: '12345678901',
                dateOfBirth: '1990-06-15',
                fullName: "Jean-Pierre O'Brien",
            })
            expect(result.success).toBe(true)
        })

        it('should reject missing fields', () => {
            const result = IdInfoSchema.safeParse({})
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues.length).toBeGreaterThanOrEqual(3)
            }
        })
    })

    // ── validateIdInfo ─────────────────────────────────────────────────────

    describe('validateIdInfo', () => {
        it('should return success for valid data', () => {
            const result = validateIdInfo({
                nationalId: '12345678901',
                dateOfBirth: '1990-06-15',
                fullName: 'Ahmet Gultekin',
            })
            expect(result.success).toBe(true)
        })

        it('should return errors for invalid data', () => {
            const result = validateIdInfo({
                nationalId: '',
                dateOfBirth: 'bad',
                fullName: '',
            })
            expect(result.success).toBe(false)
        })

        it('should validate unknown data shapes', () => {
            const result = validateIdInfo(null)
            expect(result.success).toBe(false)
        })

        it('should validate extra fields are ignored', () => {
            const result = validateIdInfo({
                nationalId: '12345678901',
                dateOfBirth: '1990-06-15',
                fullName: 'Ahmet Gultekin',
                extraField: 'should be stripped',
            })
            expect(result.success).toBe(true)
        })

        it('should validate non-object input', () => {
            const result = validateIdInfo('not an object')
            expect(result.success).toBe(false)
        })

        it('should validate number input', () => {
            const result = validateIdInfo(42)
            expect(result.success).toBe(false)
        })
    })
})
