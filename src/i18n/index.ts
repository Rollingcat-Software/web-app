import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import tr from './locales/tr.json'

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
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

export default i18n
