import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { CornerDownLeft, LayoutTemplate, MapPin, Plus, Search, UserRound } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import * as E from '@/api/endpoints'
import type { SearchHit } from '@/api/types'
import { StateBadge, TypeIcon } from '@/components/domain/badges'
import { Kbd, Spinner } from '@/components/ui/misc'
import { useDebounced } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { NAV } from './nav'

const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/70'

function Row({ icon, title, subtitle, aside, onSelect, value }: {
  icon: ReactNode; title: ReactNode; subtitle?: ReactNode; aside?: ReactNode; onSelect: () => void; value: string
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="group flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none data-[selected=true]:bg-muted"
    >
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {aside}
      <CornerDownLeft className="size-3.5 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100 rtl:-scale-x-100" />
    </Command.Item>
  )
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = useSession()
  const [text, setText] = useState('')
  const q = useDebounced(text.trim(), 200)
  const results = useQuery({
    queryKey: ['search', q],
    queryFn: ({ signal }) => E.search.query(q, signal),
    enabled: open && q.length > 0,
    staleTime: 10_000,
  })

  useEffect(() => {
    if (!open) setText('')
  }, [open])

  const go = (to: string) => {
    onOpenChange(false)
    navigate(to)
  }

  const hits = (list: SearchHit[] | undefined, icon: (h: SearchHit) => ReactNode, heading: string) =>
    list && list.length > 0 ? (
      <Command.Group heading={heading} className={groupClass}>
        {list.map((h) => (
          <Row
            key={`${h.kind}-${h.id}`}
            value={`${h.kind}-${h.id}-${h.title}`}
            icon={icon(h)}
            title={<bdi>{h.title}</bdi>}
            subtitle={h.subtitle}
            aside={h.state ? <StateBadge state={h.state} /> : null}
            onSelect={() => go(h.link)}
          />
        ))}
      </Command.Group>
    ) : null

  const iconBox = (node: ReactNode) => (
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">{node}</span>
  )

  const pages = NAV.flatMap((g) => g.items).filter((i) => !i.permission || can(i.permission))

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-pop animate-in outline-none">
          <D.Title className="sr-only">{t('search.title')}</D.Title>
          <D.Description className="sr-only">{t('search.placeholder')}</D.Description>
          <Command shouldFilter={!q} loop>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-[18px] text-muted-foreground" />
              <Command.Input
                value={text}
                onValueChange={setText}
                placeholder={t('search.placeholder')}
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
              />
              {results.isFetching && <Spinner className="size-4" />}
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
                {q && results.isFetching ? t('common.loading') : t('search.empty')}
              </Command.Empty>
              {!q && (
                <>
                  <Command.Group heading={t('search.actions')} className={groupClass}>
                    {can('write_items') || can('propose_changes') ? (
                      <Row value="new-item" icon={iconBox(<Plus />)} title={t('search.newItem')} onSelect={() => go('/cards?new=1')} />
                    ) : null}
                    {(can('write_templates') || can('propose_changes')) && (
                      <Row value="new-template" icon={iconBox(<LayoutTemplate />)} title={t('search.newTemplate')} onSelect={() => go('/templates/new')} />
                    )}
                  </Command.Group>
                  <Command.Group heading={t('search.pages')} className={groupClass}>
                    {pages.map((p) => (
                      <Row key={p.to} value={`page-${p.to}-${t(p.label)}`} icon={iconBox(<p.icon />)} title={t(p.label)} onSelect={() => go(p.to)} />
                    ))}
                  </Command.Group>
                </>
              )}
              {q && results.data && (
                <>
                  {hits(results.data.items, (h) => <TypeIcon type={(h.badge as 'card') ?? 'card'} />, t('search.items'))}
                  {hits(results.data.templates, () => iconBox(<LayoutTemplate />), t('search.templates'))}
                  {hits(results.data.locations, () => iconBox(<MapPin />), t('search.locations'))}
                  {hits(results.data.users, () => iconBox(<UserRound />), t('search.users'))}
                </>
              )}
            </Command.List>
            <div className="flex items-center gap-4 border-t border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> {t('search.navigate')}</span>
              <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> {t('search.open')}</span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
