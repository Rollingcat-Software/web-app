import { describe, it, expect } from 'vitest'
import { isValidE164, normalizeToE164, toE164OrNull } from '../phoneE164'

describe('phoneE164', () => {
    describe('isValidE164', () => {
        it.each([
            '+905551234567',
            '+12025551234',
            '+447911123456',
            '+8612345678901',
        ])('accepts %s', (phone) => {
            expect(isValidE164(phone)).toBe(true)
        })

        it.each([
            '5551234567',          // USER-BUG-4 root cause: bare TR mobile
            '05551234567',         // TR with leading 0
            '+0987654321',         // country code starting with 0
            '+1',                  // too short
            '+12345678901234567',  // too long (16 digits)
            '+90 555 123 4567',    // contains spaces
            '905551234567',        // missing +
            '',
            '   ',
            'abc',
            '+90555123456a',
        ])('rejects %s', (phone) => {
            expect(isValidE164(phone)).toBe(false)
        })

        it.each([null, undefined])('rejects %s', (phone) => {
            expect(isValidE164(phone)).toBe(false)
        })
    })

    describe('normalizeToE164', () => {
        it('keeps a valid E.164 string unchanged', () => {
            expect(normalizeToE164('+905551234567')).toBe('+905551234567')
        })

        it('strips spaces / dashes / parens after the +', () => {
            expect(normalizeToE164('+90 (555) 123-4567')).toBe('+905551234567')
        })

        it('auto-prefixes +90 for 10-digit TR mobile', () => {
            expect(normalizeToE164('5551234567')).toBe('+905551234567')
        })

        it('auto-prefixes +90 and drops leading 0 for 11-digit TR mobile', () => {
            expect(normalizeToE164('05551234567')).toBe('+905551234567')
        })

        it('strips formatting from a digits-only TR input', () => {
            expect(normalizeToE164('555 123 45 67')).toBe('+905551234567')
        })

        it('honors a non-default country code via the second arg', () => {
            expect(normalizeToE164('2025551234', '+1')).toBe('+12025551234')
        })

        it('returns null for null / undefined / empty / whitespace', () => {
            expect(normalizeToE164(null)).toBeNull()
            expect(normalizeToE164(undefined)).toBeNull()
            expect(normalizeToE164('')).toBeNull()
            expect(normalizeToE164('   ')).toBeNull()
        })

        it('returns null when input is just a + with no digits', () => {
            expect(normalizeToE164('+')).toBeNull()
            expect(normalizeToE164('+ ')).toBeNull()
        })
    })

    describe('toE164OrNull', () => {
        it('returns the normalized string when result is valid E.164', () => {
            expect(toE164OrNull('5551234567')).toBe('+905551234567')
            expect(toE164OrNull('+905551234567')).toBe('+905551234567')
        })

        it('returns null when normalization cannot produce valid E.164', () => {
            // Country code starting with 0 — normalize keeps the user's +,
            // but isValidE164 rejects it.
            expect(toE164OrNull('+0987654321')).toBeNull()
            // Way too short.
            expect(toE164OrNull('+1')).toBeNull()
            // Empty.
            expect(toE164OrNull('')).toBeNull()
        })
    })
})
