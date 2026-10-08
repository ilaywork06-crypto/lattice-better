import {
  Check, ChevronsLeft, Languages, LogOut, Menu as MenuIcon, Monitor, Moon, Palette, Search, Sun,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useNotificationCounts, useSummary } from '@/api/queries'
import { Logo } from '@/components/domain/Logo'
import { RoleBadge } from '@/components/domain/badges'
import { Button } from '@/components/ui/button'
import {
  Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger,
} from '@/components/ui/menu'
import { Avatar, Kbd } from '@/components/ui/misc'
import { Tooltip } from '@/components/ui/tooltip'
import { LANGUAGES } from '@/i18n'
import { cn } from '@/lib/cn'
import { ACCENT_SWATCH, ACCENTS, usePreferences, type ThemeMode } from '@/lib/preferences'
import { useSession } from '@/lib/session'
import { CommandPalette } from './CommandPalette'
import { NAV } from './nav'
import { NotificationsPopover } from './NotificationsPopover'

function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { can } = useSession()
  const summary = useSummary()
  const counts = useNotificationCounts()
  const badgeValue = (b?: 'pending' | 'unread') =>
    b === 'pending' && can('review_changes') ? summary.data?.pending_change_requests
      : b === 'unread' ? counts.data?.unread : undefined

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.permission || can(i.permission))
        if (!items.length) return null
        return (
          <div key={group.label}>
            {!collapsed && (
              <div className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t(group.label)}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const badge = badgeValue(item.badge)
                const link = (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors',
                        'hover:bg-subtle/70 hover:text-foreground',
                        isActive && 'bg-card text-foreground shadow-soft ring-1 ring-border',
                        collapsed && 'justify-center px-0',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={cn('size-[18px] shrink-0', isActive && 'text-primary')} />
                        {!collapsed && <span className="flex-1 truncate">{t(item.label)}</span>}
                        {!!badge && (
                          <span
                            className={cn(
                              'rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-[18px] text-primary-foreground',
                              collapsed && 'absolute -top-0.5 end-0.5 px-1 text-[10px] leading-4',
                            )}
                          >
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                )
                return collapsed ? (
                  <Tooltip key={item.to} content={t(item.label)} side="right">
                    {link}
                  </Tooltip>
                ) : (
                  link
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function UserMenu() {
  const { t } = useTranslation()
  const { user, signOut } = useSession()
  const { theme, setTheme, accent, setAccent, language, setLanguage } = usePreferences()
  if (!user) return null
  const themes: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: t('prefs.light') },
    { value: 'dark', icon: Moon, label: t('prefs.dark') },
    { value: 'system', icon: Monitor, label: t('prefs.system') },
  ]
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full p-0.5 pe-2 hover:bg-muted" aria-label={t('prefs.account')}>
          <Avatar name={user.full_name} size={30} />
          <span dir="auto" className="hidden max-w-32 truncate text-[13px] font-medium md:block">{user.full_name}</span>
        </button>
      </MenuTrigger>
      <MenuContent className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={user.full_name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user.full_name}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
        <div className="px-2.5 pb-2">
          <RoleBadge role={user.role} />
        </div>
        <MenuSeparator />
        <MenuLabel>{t('prefs.theme')}</MenuLabel>
        <div className="grid grid-cols-3 gap-1 px-1.5 pb-1.5">
          {themes.map((th) => (
            <button
              key={th.value}
              onClick={() => setTheme(th.value)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border border-transparent py-2 text-xs text-muted-foreground hover:bg-muted',
                theme === th.value && 'border-border bg-muted text-foreground',
              )}
            >
              <th.icon className="size-4" />
              {th.label}
            </button>
          ))}
        </div>
        <MenuLabel className="flex items-center gap-2">
          <Palette className="size-3.5" /> {t('prefs.accent')}
        </MenuLabel>
        <div className="grid grid-cols-8 gap-1 px-2.5 pb-1 pt-1">
          {ACCENTS.map((a) => (
            <Tooltip key={a} content={t(`prefs.accents.${a}`)}>
              <button
                onClick={() => setAccent(a)}
                aria-label={t(`prefs.accents.${a}`)}
                aria-pressed={accent === a}
                className="grid size-6 place-items-center rounded-full transition-transform hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT_SWATCH[a].soft} 45%, ${ACCENT_SWATCH[a].strong})`,
                  boxShadow: accent === a ? `0 0 0 2px var(--popover), 0 0 0 4px ${ACCENT_SWATCH[a].strong}` : 'inset 0 0 0 1px oklch(0 0 0 / 0.06)',
                }}
              >
                {accent === a && <Check className="size-3.5" style={{ color: ACCENT_SWATCH[a].strong }} strokeWidth={3} />}
              </button>
            </Tooltip>
          ))}
        </div>
        <div className="px-2.5 pb-2.5 text-xs text-muted-foreground">{t(`prefs.accents.${accent}`)}</div>
        <MenuSeparator />
        <MenuLabel className="flex items-center gap-2">
          <Languages className="size-3.5" /> {t('prefs.language')}
        </MenuLabel>
        {LANGUAGES.map((l) => (
          <MenuItem key={l.code} onSelect={() => setLanguage(l.code)} icon={<span className="w-4 text-center text-xs">{l.code.toUpperCase()}</span>}>
            {l.label} {language === l.code && <Check className="ms-auto inline size-4 text-primary" />}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem icon={<LogOut />} onSelect={signOut}>
          {t('auth.signOut')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

const WIDE_PAGES = ['/locations']

export function AppShell() {
  const { t } = useTranslation()
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferences()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    document.querySelector('main')?.scrollTo({ top: 0 })
  }, [location.pathname])

  const brand = (collapsed: boolean) => (
    <div className={cn('flex h-14 shrink-0 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
      <Logo size={28} />
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">Lattice</div>
          <div className="text-[11px] text-muted-foreground">{t('app.tagline')}</div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-e border-border bg-sidebar transition-[width] duration-200 lg:flex',
          sidebarCollapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        {brand(sidebarCollapsed)}
        <Sidebar collapsed={sidebarCollapsed} />
        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            className={cn('w-full justify-start text-muted-foreground', sidebarCollapsed && 'justify-center')}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <ChevronsLeft className={cn('transition-transform rtl:rotate-180', sidebarCollapsed && 'rotate-180 rtl:rotate-0')} />
            {!sidebarCollapsed && t('nav.collapse')}
          </Button>
        </div>
      </aside>

      {/* mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40 animate-fade" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 start-0 flex w-72 flex-col border-e border-border bg-sidebar shadow-pop animate-in">
            {brand(false)}
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label={t('nav.menu')}>
            <MenuIcon />
          </Button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground shadow-soft transition-colors hover:border-input"
          >
            <Search className="size-4" />
            <span className="flex-1 truncate text-start">{t('search.placeholder')}</span>
            <span className="hidden items-center gap-0.5 sm:flex">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="ms-auto flex items-center gap-1.5">
            <NotificationsPopover />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {/* The floor plan gets the whole width; reading pages stay comfortably narrow. */}
          <div className={cn('mx-auto w-full px-4 py-6 lg:px-8 lg:py-8', !WIDE_PAGES.includes(location.pathname) && 'max-w-[1400px]')}>
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
