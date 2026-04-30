import type { Locale } from 'date-fns'
import { tr, enUS } from 'date-fns/locale'

/**
 * Resolve a date-fns `Locale` from an i18next language tag.
 *
 * Returns the Turkish locale for any tag whose primary subtag is `tr`
 * (e.g. `tr`, `tr-TR`, `tr_CY`). Otherwise falls back to `enUS`.
 *
 * Use as: `format(date, 'PP', { locale: dateFnsLocale(i18n.language) })`
 */
export function dateFnsLocale(lang: string | undefined | null): Locale {
    if (!lang) return enUS
    return lang.toLowerCase().startsWith('tr') ? tr : enUS
}
