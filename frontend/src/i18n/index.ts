import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { store } from '@/lib/storage'
import en from './en'
import he from './he'

export type Language = 'en' | 'he'

export const LANGUAGES: { code: Language; label: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'he', label: 'עברית', dir: 'rtl' },
]

const saved = store.get('lang')
const initial: Language = saved === 'he' || saved === 'en' ? saved : 'en'

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, he: { translation: he } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
})

export function applyLanguage(lng: Language) {
  const dir = LANGUAGES.find((l) => l.code === lng)?.dir ?? 'ltr'
  document.documentElement.lang = lng
  document.documentElement.dir = dir
}

applyLanguage(initial)
i18n.on('languageChanged', (lng) => {
  store.set('lang', lng)
  applyLanguage(lng as Language)
})

export default i18n
