import { LayoutGrid, LayoutTemplate, List, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { useItems, useTemplates } from '@/api/queries'
import type { CardType, ItemState, ItemType, StorageStatus, TemplateSummary } from '@/api/types'
import { useWorkflowMode } from '@/components/domain/ActionDialog'
import { CardTypeBadge, TypeIcon } from '@/components/domain/badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Segmented, Switch } from '@/components/ui/controls'
import { Input } from '@/components/ui/input'
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import { CARD_TYPES, ITEM_STATES, STORAGE, TYPE_ICON } from '@/lib/domain'
import { useDebounced, useUrlState } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { BulkBar } from './BulkBar'
import { ItemFormDialog } from './ItemFormDialog'
import { ItemsTable } from './ItemsTable'
import { StateBar, StateLegend } from './StateBar'

const PAGE = 50

function TemplateTile({ tpl, onOpen }: { tpl: TemplateSummary; onOpen: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      onClick={onOpen}
      className="card-surface group flex flex-col gap-4 p-4 text-start transition-all hover:-translate-y-0.5 hover:shadow-pop"
    >
      <div className="flex items-start gap-3">
        <TypeIcon type={tpl.type} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold group-hover:text-primary">{tpl.name}</div>
          <div className="mono text-xs text-muted-foreground">{tpl.serial_prefix}</div>
        </div>
        <CardTypeBadge cardType={tpl.card_type} />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[26px] font-semibold leading-none tabular-nums">{tpl.counts.total}</div>
          <div className="mt-1 text-xs text-muted-foreground">{t('templates.unitsLabel')}</div>
        </div>
        {tpl.counts.faulty > 0 && <Badge tone="danger" dot>{t('items.faultyCount', { count: tpl.counts.faulty })}</Badge>}
      </div>
      <div className="flex flex-col gap-2">
        <StateBar counts={tpl.counts} />
        <StateLegend counts={tpl.counts} />
      </div>
    </button>
  )
}

export default function ItemsPage({ type }: { type: ItemType }) {
  const { t } = useTranslation()
  const { can } = useSession()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useUrlState('view', 'templates')
  const [templateParam, setTemplateParam] = useUrlState('template')
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [cardType, setCardType] = useState<CardType | null>(null)
  const [state, setState] = useState<ItemState | null>(null)
  const [storage, setStorage] = useState<StorageStatus | null>(null)
  const [showDestroyed, setShowDestroyed] = useState(false)
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<number[]>([])
  const [creating, setCreating] = useState(params.get('new') === '1')
  const createMode = useWorkflowMode('write_items', 'create')
  const templateId = templateParam ? Number(templateParam) : undefined
  const Icon = TYPE_ICON[type]

  useEffect(() => {
    setOffset(0)
    setSelected([])
  }, [type, q, cardType, state, storage, showDestroyed, templateId, view])

  useEffect(() => {
    if (params.get('new') === '1') {
      setCreating(true)
      setParams((p) => { p.delete('new'); return p }, { replace: true })
    }
  }, [params, setParams])

  const templates = useTemplates({ type, card_type: cardType ?? undefined })
  const showUnits = view === 'units' || !!templateId
  const items = useItems(
    {
      type, template_id: templateId, card_type: cardType ?? undefined, state: state ?? undefined,
      storage: storage ?? undefined, include_destroyed: showDestroyed || state === 'destroyed', q: q || undefined,
      limit: PAGE, offset,
    },
    showUnits,
  )
  const tiles = useMemo(
    () => (templates.data ?? []).filter((tpl) => !q || tpl.name.toLowerCase().includes(q.toLowerCase()) || tpl.serial_prefix.toLowerCase().includes(q.toLowerCase())),
    [templates.data, q],
  )
  const activeTemplate = templates.data?.find((tpl) => tpl.id === templateId)
  const total = (templates.data ?? []).reduce((a, tpl) => a + tpl.counts.total, 0)

  return (
    <div>
      <PageHeader
        title={t(`enums.typePlural.${type}`)}
        description={t(`items.description.${type}`, { count: total })}
        actions={
          createMode !== 'none' && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus /> {createMode === 'direct' ? t(`items.new.${type}`) : t(`items.propose.${type}`)}
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={showUnits ? t('items.searchUnits') : t('items.searchTemplates')} className="ps-9" />
        </div>
        {type === 'card' && (
          <Select size="md" className="w-40" value={cardType} onChange={setCardType} noneLabel={t('items.allCardTypes')} placeholder={t('items.allCardTypes')}
            options={CARD_TYPES.map((c) => ({ value: c, label: t(`enums.cardType.${c}`) }))} />
        )}
        {showUnits && (
          <>
            <Select className="w-36" value={state} onChange={setState} noneLabel={t('items.allStates')} placeholder={t('items.allStates')}
              options={ITEM_STATES.map((s) => ({ value: s, label: t(`enums.state.${s}`) }))} />
            {type === 'card' && (
              <Select className="w-40" value={storage} onChange={setStorage} noneLabel={t('items.anyStorage')} placeholder={t('items.anyStorage')}
                options={STORAGE.map((s) => ({ value: s, label: t(`enums.storage.${s}`) }))} />
            )}
            <label className="flex items-center gap-2 px-2 text-[13px] text-muted-foreground">
              <Switch size="sm" checked={showDestroyed} onChange={setShowDestroyed} /> {t('items.showDestroyed')}
            </label>
          </>
        )}
        <Segmented
          className="ms-auto"
          value={showUnits ? 'units' : 'templates'}
          onChange={(v) => {
            setView(v)
            if (v === 'templates') setTemplateParam('')
          }}
          options={[
            { value: 'templates', label: t('items.byTemplate'), icon: <LayoutGrid /> },
            { value: 'units', label: t('items.allUnits'), icon: <List /> },
          ]}
        />
      </div>

      {activeTemplate && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-soft">
          <TypeIcon type={activeTemplate.type} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{activeTemplate.name}</div>
            <StateLegend counts={activeTemplate.counts} />
          </div>
          <Button size="sm" variant="ghost" asChild>
            <Link to={`/templates/${activeTemplate.id}`}><LayoutTemplate /> {t('items.openTemplate')}</Link>
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setTemplateParam('')} aria-label={t('common.clear')}><X /></Button>
        </div>
      )}

      {!showUnits ? (
        templates.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : tiles.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icon />}
              title={t('items.noTemplates', { type: t(`enums.type.${type}`) })}
              description={t('items.noTemplatesHint')}
              action={(can('write_templates') || can('propose_changes')) && (
                <Button variant="primary" asChild><Link to={`/templates/new?type=${type}`}><Plus /> {t('templates.new')}</Link></Button>
              )}
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {tiles.map((tpl) => (
              <TemplateTile key={tpl.id} tpl={tpl} onOpen={() => { setTemplateParam(String(tpl.id)); setView('units') }} />
            ))}
          </div>
        )
      ) : (
        <Card className={cn('overflow-hidden', selected.length && 'mb-20')}>
          <ItemsTable
            page={items.data}
            loading={items.isPending}
            offset={offset}
            onOffset={setOffset}
            showStorage={type === 'card'}
            showTemplate={!templateId}
            selected={can('write_items') ? selected : undefined}
            onSelect={can('write_items') ? setSelected : undefined}
            empty={<EmptyState icon={<Icon />} title={t('items.empty')} description={t('items.emptyHint')} />}
          />
        </Card>
      )}

      <BulkBar ids={selected} onClear={() => setSelected([])} />
      <ItemFormDialog open={creating} onOpenChange={setCreating} type={type} templateId={templateId} />
    </div>
  )
}
