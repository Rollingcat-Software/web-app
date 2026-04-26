import { describe, expect, it } from 'vitest'
import { AUTH_METHOD_REGISTRY, listAuthMethods } from '../authMethodRegistry'
import en from '@/i18n/locales/en.json'
import tr from '@/i18n/locales/tr.json'

type NestedRecord = Record<string, unknown>

/**
 * Resolve a dotted `a.b.c` key against a nested object — returns `null` if
 * any segment is missing. Mirrors i18next lookup.
 */
function resolveKey(obj: NestedRecord, key: string): unknown {
    return key
        .split('.')
        .reduce<unknown>((acc, seg) => {
            if (acc && typeof acc === 'object' && seg in (acc as NestedRecord)) {
                return (acc as NestedRecord)[seg]
            }
            return null
        }, obj)
}

describe('authMethodRegistry', () => {
    const methods = listAuthMethods()

    it('registers at least the nine existing step components', () => {
        // Sanity check — if this drops below 9 we've accidentally dropped one.
        expect(methods.length).toBeGreaterThanOrEqual(9)
    })

    it('registry keys match method ids', () => {
        for (const [key, method] of Object.entries(AUTH_METHOD_REGISTRY)) {
            if (!method) continue
            expect(method.id).toBe(key)
        }
    })

    describe.each(methods)('$id', (method) => {
        it('has a non-null component', () => {
            expect(method.component).toBeTruthy()
            expect(typeof method.component).toBe('function')
        })

        it('declares at least one platform', () => {
            expect(method.platforms.length).toBeGreaterThan(0)
        })

        it('has title + description translations in en.json and tr.json', () => {
            for (const [label, locale] of [
                ['en', en as NestedRecord],
                ['tr', tr as NestedRecord],
            ] as const) {
                const title = resolveKey(locale, `${method.i18nKey}.title`)
                const description = resolveKey(
                    locale,
                    `${method.i18nKey}.description`,
                )
                expect(
                    title,
                    `${method.i18nKey}.title missing in ${label}.json`,
                ).toBeTruthy()
                expect(typeof title).toBe('string')
                expect(
                    description,
                    `${method.i18nKey}.description missing in ${label}.json`,
                ).toBeTruthy()
                expect(typeof description).toBe('string')
            }
        })
    })

    it('all shared namespace keys resolve in en.json and tr.json', () => {
        const requiredKeys = [
            'authMethodsTesting.pageTitle',
            'authMethodsTesting.pageSubtitle',
            'authMethodsTesting.tryButton',
            'authMethodsTesting.closeButton',
            'authMethodsTesting.tryAgainButton',
            'authMethodsTesting.previewLabel',
            'authMethodsTesting.platformLabel',
            'authMethodsTesting.requiresEnrollment',
            'authMethodsTesting.stubbedOnly',
            'authMethodsTesting.successMessage',
            'authMethodsTesting.errorMessage',
            'authMethodsTesting.difficulty.beginner',
            'authMethodsTesting.difficulty.intermediate',
            'authMethodsTesting.difficulty.advanced',
            'authMethodsTesting.platforms.web',
            'authMethodsTesting.platforms.android',
            'authMethodsTesting.platforms.ios',
            'authMethodsTesting.platforms.desktop',
        ]

        for (const key of requiredKeys) {
            for (const [label, locale] of [
                ['en', en as NestedRecord],
                ['tr', tr as NestedRecord],
            ] as const) {
                const value = resolveKey(locale, key)
                expect(value, `${key} missing in ${label}.json`).toBeTruthy()
                expect(typeof value).toBe('string')
            }
        }
    })
})
