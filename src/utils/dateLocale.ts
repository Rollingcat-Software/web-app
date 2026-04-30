import { format, type Locale } from 'date-fns'
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

/**
 * Locale-aware date formatting using date-fns **skeletons** (not literal patterns).
 *
 * Literal patterns like `'MMM dd, yyyy'` only translate the month name; the
 * comma + ordering stay English-shaped even with `{ locale: tr }`. Skeletons
 * defer to the locale's own `formatLong` ordering, so a Turkish locale produces
 * `15 Eki 2026` (no comma) while US English produces `Oct 15, 2026`.
 *
 * Available skeletons (date-fns standard):
 *   - `'P'`    short date    (US `10/15/2026`, TR `15.10.2026`)
 *   - `'PP'`   medium date   (US `Oct 15, 2026`, TR `15 Eki 2026`)
 *   - `'PPP'`  long date     (US `October 15th, 2026`, TR `15 Ekim 2026`)
 *   - `'PPPP'` full date     (with weekday)
 *   - `'p'`    short time    (US `10:30 AM`, TR `10:30`)
 *   - `'pp'`   medium time   (US `10:30:45 AM`, TR `10:30:45`)
 *   - `'Pp'`   short date+time
 *   - `'PPp'`  medium date + short time     (typical list cell)
 *   - `'PPpp'` medium date + medium time    (typical "last activity")
 *
 * @param date     Date instance, ISO string, or epoch ms.
 * @param lang     i18next language tag (e.g. `i18n.language`).
 * @param skeleton date-fns skeleton (default `'PP'` — medium date, no time).
 */
export function formatLocale(
    date: Date | string | number,
    lang: string | undefined | null,
    skeleton: string = 'PP'
): string {
    const d = date instanceof Date ? date : new Date(date)
    return format(d, skeleton, { locale: dateFnsLocale(lang) })
}
