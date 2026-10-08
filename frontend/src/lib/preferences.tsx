import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Language } from '@/i18n'
import { store } from './storage'

export type ThemeMode = 'light' | 'dark' | 'system'
/** Classic black & white plus the pastel colour themes; palettes live in styles/index.css. */
export const ACCENTS = ['classic', 'periwinkle', 'lavender', 'blush', 'peach', 'butter', 'mint', 'sky'] as const
export type Accent = (typeof ACCENTS)[number]
/** Swatch for the picker: the theme's pastel and its deeper primary. */
export const ACCENT_SWATCH: Record<Accent, { soft: string; strong: string }> = {
  classic: { soft: 'oklch(0.97 0 0)', strong: 'oklch(0.22 0 0)' },
  periwinkle: { soft: 'oklch(0.86 0.07 268)', strong: 'oklch(0.57 0.13 268)' },
  lavender: { soft: 'oklch(0.86 0.07 302)', strong: 'oklch(0.57 0.13 302)' },
  blush: { soft: 'oklch(0.87 0.07 355)', strong: 'oklch(0.6 0.14 355)' },
  peach: { soft: 'oklch(0.88 0.07 45)', strong: 'oklch(0.62 0.13 45)' },
  butter: { soft: 'oklch(0.92 0.08 92)', strong: 'oklch(0.6 0.115 88)' },
  mint: { soft: 'oklch(0.88 0.06 168)', strong: 'oklch(0.58 0.1 168)' },
  sky: { soft: 'oklch(0.87 0.06 232)', strong: 'oklch(0.58 0.12 232)' },
}
/** Themes saved before the pastel palettes map to their nearest pastel. */
const LEGACY_ACCENT: Record<string, Accent> = { indigo: 'periwinkle', violet: 'lavender', rose: 'blush', amber: 'peach', teal: 'mint' }

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
    const a = store.get('accent') ?? ''
    return ACCENTS.includes(a as Accent) ? (a as Accent) : LEGACY_ACCENT[a] ?? 'periwinkle'
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
