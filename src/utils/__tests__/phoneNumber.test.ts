/**
 * Unit tests for phoneNumber utility — locks in the contract that our
 * client-side normalizer always produces strings that pass the backend
 * @Pattern("^\\+[1-9]\\d{7,14}$") (api PR #48 / V54 CHECK constraint),
 * so a user typing `5551234567` never sees a 422 round-trip.
 *
 * USER-BUG-4 follow-up part 2.
 */
import { describe, it, expect } from 'vitest'
import { normalizePhoneInputE164, isValidE164 } from '@utils/phoneNumber'

describe('normalizePhoneInputE164', () => {
    it('auto-prepends +90 to a plain Turkish mobile', () => {
        expect(normalizePhoneInputE164('5551234567')).toBe('+905551234567')
    })

    it('preserves an already-prefixed Turkish number', () => {
        expect(normalizePhoneInputE164('+905551234567')).toBe('+905551234567')
    })

    it('preserves a foreign +CC prefix the user typed (US)', () => {
        expect(normalizePhoneInputE164('+12025550100')).toBe('+12025550100')
    })

    it('strips spaces and dashes from a formatted Turkish number', () => {
        expect(normalizePhoneInputE164('+90 555 123 45 67')).toBe('+905551234567')
    })

    it('strips parentheses and other punctuation', () => {
        expect(normalizePhoneInputE164('(555) 123-4567')).toBe('+905551234567')
    })

    it('returns "" for empty input', () => {
        expect(normalizePhoneInputE164('')).toBe('')
    })

    it('returns "" for whitespace-only input', () => {
        expect(normalizePhoneInputE164('   ')).toBe('')
    })

    it('returns "" for non-digit junk', () => {
        expect(normalizePhoneInputE164('abc')).toBe('')
    })

    it('returns "" for a bare "+"', () => {
        expect(normalizePhoneInputE164('+')).toBe('')
    })

    it('does not double-prepend when user typed CC digits without +', () => {
        // Power user pastes `905551234567` (no plus); we treat the leading
        // `90` as the country code instead of producing `+9090555...`.
        expect(normalizePhoneInputE164('905551234567')).toBe('+905551234567')
    })

    it('honours a custom default country code', () => {
        expect(normalizePhoneInputE164('2025550100', '+1')).toBe('+12025550100')
    })

    it('passes the default CC through even when given without +', () => {
        // Caller may forget the leading `+`, treat it the same.
        expect(normalizePhoneInputE164('5551234567', '90')).toBe('+905551234567')
    })

    it('keeps a typed leading `+` even with letters mixed in', () => {
        // `+5x55-12...` → `+555512...` (digits only after +)
        expect(normalizePhoneInputE164('+5x55-1234567')).toBe('+5551234567')
    })
})

describe('isValidE164', () => {
    it('accepts a valid Turkish mobile in E.164', () => {
        expect(isValidE164('+905551234567')).toBe(true)
    })

    it('accepts a valid US number in E.164', () => {
        expect(isValidE164('+12025550100')).toBe(true)
    })

    it('accepts the minimum-length E.164 (8 digits after +)', () => {
        expect(isValidE164('+12345678')).toBe(true)
    })

    it('accepts the maximum-length E.164 (15 digits after +)', () => {
        expect(isValidE164('+123456789012345')).toBe(true)
    })

    it('rejects empty string', () => {
        expect(isValidE164('')).toBe(false)
    })

    it('rejects a number without the leading +', () => {
        expect(isValidE164('905551234567')).toBe(false)
    })

    it('rejects a +0-prefixed number (E.164 forbids leading 0 in CC)', () => {
        expect(isValidE164('+0123456789')).toBe(false)
    })

    it('rejects too-short (7 digits after +)', () => {
        expect(isValidE164('+1234567')).toBe(false)
    })

    it('rejects too-long (16 digits after +)', () => {
        expect(isValidE164('+1234567890123456')).toBe(false)
    })

    it('rejects values with spaces', () => {
        expect(isValidE164('+90 555 123 45 67')).toBe(false)
    })

    it('rejects values with letters', () => {
        expect(isValidE164('+90555abc4567')).toBe(false)
    })
})
