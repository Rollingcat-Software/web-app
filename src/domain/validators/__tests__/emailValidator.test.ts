import { describe, it, expect } from 'vitest'
import { isLikelyValidEmail, EMAIL_REGEX } from '../emailValidator'

describe('isLikelyValidEmail', () => {
    it('accepts ordinary addresses', () => {
        for (const ok of [
            'ahabgu@gmail.com',
            'a@b.co',
            'first.last@sub.domain.co.uk',
            'user+tag@example.io',
            'name_123@my-company.dev',
            'STUDENT@marun.edu.tr',
            'x@y.museum',
        ]) {
            expect(isLikelyValidEmail(ok), ok).toBe(true)
        }
    })

    it('rejects the reported typo and other 1-char TLDs', () => {
        // The exact case the user reported on verify.fivucsas.
        expect(isLikelyValidEmail('ahabgu@gmail.x')).toBe(false)
        expect(isLikelyValidEmail('foo@bar.c')).toBe(false)
        expect(isLikelyValidEmail('a@b.c')).toBe(false)
    })

    it('rejects structurally broken input', () => {
        for (const bad of [
            '',
            '   ',
            'plainstring',
            'no-at-sign.com',
            'foo@bar',          // no dot / TLD
            'foo@bar.',         // empty TLD
            'foo@@bar.com',     // double @
            'foo @bar.com',     // space in local part
            'foo@ bar.com',     // space in domain
            'foo@bar .com',     // space before TLD
        ]) {
            expect(isLikelyValidEmail(bad), JSON.stringify(bad)).toBe(false)
        }
    })

    it('trims surrounding whitespace before validating', () => {
        expect(isLikelyValidEmail('  ahabgu@gmail.com  ')).toBe(true)
        expect(isLikelyValidEmail('\tahabgu@gmail.x\n')).toBe(false)
    })

    it('exposes the regex used (anchored)', () => {
        expect(EMAIL_REGEX.source.startsWith('^')).toBe(true)
        expect(EMAIL_REGEX.source.endsWith('$')).toBe(true)
    })
})
