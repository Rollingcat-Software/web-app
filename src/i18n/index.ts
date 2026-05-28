import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import tr from './locales/tr.json'

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        debug: false,
        resources: {
            en: { translation: en },
            tr: { translation: tr },
        },
        fallbackLng: 'en',
        supportedLngs: ['en', 'tr'],
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'fivucsas_language',
            caches: ['localStorage'],
        },
    })

/*
 * Cross-site launcher integration.
 *
 * The shared <fivucsas-launcher> web component (public/launcher.js) owns the
 * single global EN/TR toggle for the whole suite. It persists the choice to
 * localStorage['fivucsas-lang'] (hyphen) and dispatches a
 * `fivucsas:languagechange` CustomEvent whose detail.lang is 'en' | 'tr'.
 *
 * This module is the single i18n instance imported by BOTH the dashboard
 * (src/main.tsx) and the verify-app (src/verify-app/main.tsx), so wiring the
 * listener here makes the launcher the source of truth for every React
 * surface in one place.
 */
const LAUNCHER_LANG_KEY = 'fivucsas-lang'
const SUPPORTED_LANGS = ['en', 'tr'] as const
type SupportedLang = (typeof SUPPORTED_LANGS)[number]

const isSupportedLang = (lang: unknown): lang is SupportedLang =>
    typeof lang === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(lang)

if (typeof window !== 'undefined') {
    // React to the launcher's global toggle while the app is running.
    window.addEventListener('fivucsas:languagechange', (e: Event) => {
        const lang = (e as CustomEvent<{ lang?: string }>).detail?.lang
        if (isSupportedLang(lang) && i18n.language !== lang) {
            i18n.changeLanguage(lang)
        }
    })

    // Align with the launcher's persisted choice on initial load — the
    // launcher's hyphenated key wins over i18next's own detection so the FAB
    // and the React surfaces never disagree after a reload.
    try {
        const persisted = window.localStorage.getItem(LAUNCHER_LANG_KEY)
        if (isSupportedLang(persisted) && i18n.language !== persisted) {
            i18n.changeLanguage(persisted)
        }
    } catch {
        // localStorage may be unavailable (private mode / sandboxed iframe);
        // i18next's own detection remains the fallback.
    }
}

export default i18n
