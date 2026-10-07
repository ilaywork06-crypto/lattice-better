import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Language } from '@/i18n'
import { store } from './storage'

export type ThemeMode = 'light' | 'dark' | 'system'
export const ACCENTS = ['indigo', 'violet', 'sky', 'teal', 'amber', 'rose'] as const
export type Accent = (typeof ACCENTS)[number]
export const ACCENT_SWATCH: Record<Accent, string> = {
  indigo: 'oklch(0.52 0.21 275)',
  violet: 'oklch(0.54 0.22 300)',
  sky: 'oklch(0.59 0.16 240)',
  teal: 'oklch(0.56 0.11 190)',
  amber: 'oklch(0.66 0.16 60)',
  rose: 'oklch(0.58 0.2 10)',
}

interface Preferences {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
  isDark: boolean
  accent: Accent
  setAccent: (a: Accent) => void
  language: Language
  setLanguage: (l: Language) => void
  dir: 'ltr' | 'rtl'
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
}

const Ctx = createContext<Preferences | null>(null)

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const [theme, setThemeState] = useState<ThemeMode>(() => (store.get('theme') as ThemeMode) || 'system')
  const [systemDark, setSystemDark] = useState(() => media().matches)
  const [accent, setAccentState] = useState<Accent>(() => {
    const a = store.get('accent') as Accent
    return ACCENTS.includes(a) ? a : 'indigo'
  })
  const [sidebarCollapsed, setCollapsed] = useState(() => store.get('sidebar') === 'collapsed')

  useEffect(() => {
    const m = media()
    const onChange = () => setSystemDark(m.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])

  const isDark = theme === 'dark' || (theme === 'system' && systemDark)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])
  useEffect(() => {
    document.documentElement.dataset.accent = accent
  }, [accent])

  const setTheme = useCallback((t: ThemeMode) => {
    store.set('theme', t)
    setThemeState(t)
  }, [])
  const setAccent = useCallback((a: Accent) => {
    store.set('accent', a)
    setAccentState(a)
  }, [])
  const setSidebarCollapsed = useCallback((v: boolean) => {
    store.set('sidebar', v ? 'collapsed' : null)
    setCollapsed(v)
  }, [])
  const language = (i18n.language === 'he' ? 'he' : 'en') as Language

  return (
    <Ctx.Provider
      value={{
        theme, setTheme, isDark, accent, setAccent,
        language, setLanguage: (l) => void i18n.changeLanguage(l),
        dir: language === 'he' ? 'rtl' : 'ltr',
        sidebarCollapsed, setSidebarCollapsed,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function usePreferences() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePreferences outside PreferencesProvider')
  return ctx
}
