import {
  ArrowRightLeft, Check, ChevronRight, CircleAlert, Copy, FileText, GitBranch, History, LayoutTemplate,
  Link2, ListChecks, Lock, MapPin, MoreHorizontal, Package, Pencil, Plus, Trash2, Unlink, Users,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useAudit, useBuildings, useItem, useItemTree, useLocations } from '@/api/queries'
import type { ItemDetail } from '@/api/types'
import { useWorkflowMode } from '@/components/domain/ActionDialog'
import { CardTypeBadge, ItemLink, Serial, StateBadge, StorageBadge, TypeIcon } from '@/components/domain/badges'
import { FieldValue } from '@/components/domain/FieldValue'
import { FloorPlan } from '@/components/domain/FloorPlan'
import { HierarchyGraph } from '@/components/domain/HierarchyGraph'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { Avatar, EmptyState, Progress, Skeleton } from '@/components/ui/misc'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip } from '@/components/ui/tooltip'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/cn'
import { STATE_COLOR } from '@/lib/domain'
import { formatDateTime, timeAgo } from '@/lib/format'
import { useUrlState } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { AuditList } from '@/features/audit/AuditList'
import { DocumentsPanel } from './DocumentsPanel'
import { ExtrasPanel } from './ExtrasPanel'
import {
  ContentsDialog, DeleteItemDialog, MoveDialog, PlaceInsideDialog, StateDialog, TakeOutDialog,
} from './ItemActions'
import { ItemFormDialog } from './ItemFormDialog'

type DialogName = 'edit' | 'move' | 'state' | 'place' | 'takeout' | 'contents' | 'delete' | 'another' | null

const PLURAL_ROUTE = { card: '/cards', assembly: '/assemblies', setup: '/setups' } as const

function CopySerial({ serial }: { serial: string }) {
  const { t } = useTranslation()
  const [done, setDone] = useState(false)
  return (
    <Tooltip content={done ? t('common.copied') : t('common.copy')}>
      <button
        onClick={async () => {
          if (!(await copyText(serial))) return void toast.error(t('errors.generic'))
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        }}
        className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-muted"
      >
        <Serial value={serial} className="text-sm text-muted-foreground" />
        {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />}
      </button>
    </Tooltip>
  )
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground [&_svg]:size-3.5">
      {icon}
      {children}
    </span>
  )
}

function Overview({ item }: { item: ItemDetail }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const locations = useLocations()
  const buildings = useBuildings()
  const own = item.fields.filter((f) => f.mode !== 'fixed')
  const fixed = item.fields.filter((f) => f.mode === 'fixed')
  const fieldGrid = (fields: ItemDetail['fields']) => (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.field_id} className={cn('min-w-0', ['description', 'files'].includes(f.field_type) && 'sm:col-span-2')}>
          <dt className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {f.label}
            {f.mode === 'fixed' && <Lock className="size-3" />}
            {f.missing && <Badge tone="warning">{t('item.missing')}</Badge>}
          </dt>
          <dd className="text-sm">
            <FieldValue fieldType={f.field_type} value={f.value} display={f.display} />
          </dd>
        </div>
      ))}
    </dl>
  )
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title={t('item.details')} description={t('item.detailsHint')} />
          <CardBody>
            {own.length ? fieldGrid(own) : <p className="text-sm text-muted-foreground">{t('item.noOwnFields')}</p>}
          </CardBody>
        </Card>
        {fixed.length > 0 && (
          <Card>
            <CardHeader
              icon={<Lock />}
              title={t('item.fromTemplate')}
              description={t('item.fromTemplateHint')}
              actions={<Button size="sm" variant="ghost" asChild><Link to={`/templates/${item.template.id}`}>{t('item.openTemplate')}</Link></Button>}
            />
            <CardBody>{fieldGrid(fixed)}</CardBody>
          </Card>
        )}
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader icon={<MapPin />} title={t('item.whereabouts')} />
          <CardBody className="flex flex-col gap-3">
            {item.location ? (
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.location.name}</span>
                {item.location.is_desiccator && <Badge tone="info">{t('enums.storage.desiccator')}</Badge>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('item.noLocation')}</p>
            )}
            {item.location && locations.data && (
              <FloorPlan compact locations={locations.data} buildings={buildings.data ?? []} selectedId={item.location.id}
                onSelect={(id) => navigate(`/locations?selected=${id}`)} />
            )}
            {item.parent && (
              <p className="text-[13px] text-muted-foreground">{t('item.followsContainer')}</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Users />} title={t('item.people')} />
          <CardBody className="flex flex-col gap-3 text-sm">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t('item.managers')}</div>
              {item.managers.length ? (
                <div className="flex flex-col gap-1.5">
                  {item.managers.map((m) => (
                    <div key={m.id} className="flex items-center gap-2"><Avatar name={m.full_name} size={22} /> {m.full_name}</div>
                  ))}
                </div>
              ) : <span className="text-muted-foreground">—</span>}
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t('item.responsible')}</div>
              {item.responsible ? (
                <div className="flex items-center gap-2"><Avatar name={item.responsible.full_name} size={22} /> {item.responsible.full_name}</div>
              ) : <span className="text-muted-foreground">—</span>}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="grid grid-cols-2 gap-3 pt-4 text-xs">
            <div>
              <div className="text-muted-foreground">{t('item.created')}</div>
              <div className="mt-0.5 font-medium">{formatDateTime(item.created_at)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t('item.updated')}</div>
              <div className="mt-0.5 font-medium">{timeAgo(item.updated_at)}</div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Contents({ item, onEdit, canEdit }: { item: ItemDetail; onEdit: () => void; canEdit: boolean }) {
  const { t } = useTranslation()
  const tree = useItemTree(item.id)
  return (
    <div className="flex flex-col gap-6">
      {item.composition.length > 0 && (
        <Card>
          <CardHeader
            title={t('composition.title')}
            description={item.is_complete ? t('composition.complete') : t('composition.incomplete', { n: item.missing_children })}
            actions={canEdit && <Button size="sm" onClick={onEdit}><ArrowRightLeft /> {t('actions.editContents')}</Button>}
          />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            {item.composition.map((row) => {
              const target = row.max_count ?? Math.max(row.min_count, row.count, 1)
              return (
                <div key={row.template.id} className="rounded-xl border border-border p-3.5">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <Link to={`/templates/${row.template.id}`} className="truncate text-sm font-medium hover:text-primary">{row.template.name}</Link>
                    {row.missing > 0 ? <Badge tone="warning">{t('composition.missing', { n: row.missing })}</Badge>
                      : row.is_full ? <Badge tone="info">{t('composition.full')}</Badge>
                      : <Badge tone="success">{t('composition.ok')}</Badge>}
                  </div>
                  <Progress value={row.count} max={target} tone={row.missing ? 'warning' : 'success'} />
                  <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
                    <span>{t('composition.inside', { n: row.count })}</span>
                    <span>{row.max_count != null ? t('composition.range', { min: row.min_count, max: row.max_count }) : t('composition.atLeast', { min: row.min_count })}</span>
                  </div>
                </div>
              )
            })}
          </CardBody>
        </Card>
      )}
      <Card className="overflow-hidden">
        <CardHeader title={t('item.tree')} description={t('item.treeHint')} />
        {tree.data ? <HierarchyGraph graph={tree.data} mode="items" className="h-[420px] border-t border-border" />
          : <Skeleton className="m-5 h-80" />}
      </Card>
      {item.children.length > 0 && (
        <Card>
          <CardHeader title={t('item.children', { count: item.children.length })} />
          <CardBody className="flex flex-col divide-y divide-border">
            {item.children.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2">
                <ItemLink item={c} showType />
                <StateBadge state={c.state} />
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function StateHistory({ item }: { item: ItemDetail }) {
  const { t } = useTranslation()
  const entries = [...item.state_history].reverse()
  return (
    <Card>
      <CardHeader title={t('item.stateHistory')} />
      <CardBody>
        <ol className="relative ms-2 border-s border-border">
          {entries.map((h) => (
            <li key={h.id} className="mb-5 ms-5 last:mb-0">
              <span className="absolute -start-[7px] mt-1.5 size-3.5 rounded-full border-2 border-card" style={{ background: STATE_COLOR[h.state] }} />
              <div className="flex flex-wrap items-center gap-2">
                <StateBadge state={h.state} />
                <span className="text-xs text-muted-foreground">{formatDateTime(h.changed_at)}</span>
                {h.changed_by_name && <span className="text-xs text-muted-foreground">· {h.changed_by_name}</span>}
              </div>
              {h.note && <p className="mt-1.5 rounded-lg bg-muted/60 px-3 py-2 text-sm">{h.note}</p>}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  )
}

function Activity({ item }: { item: ItemDetail }) {
  const audit = useAudit({ item_id: item.id, limit: 100 })
  return <Card><AuditList entries={audit.data?.items} loading={audit.isPending} /></Card>
}

export default function ItemPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const item = useItem(Number(id))
  const { can } = useSession()
  const [dialog, setDialog] = useState<DialogName>(null)
  const [tab, setTab] = useUrlState('tab', 'overview')
  const editMode = useWorkflowMode('write_items', 'update')
  const moveMode = useWorkflowMode('write_items', 'move')
  const stateMode = useWorkflowMode('write_items', 'state_change')
  const linkMode = useWorkflowMode('write_items', 'link')

  if (item.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-28" />
        <Skeleton className="h-96" />
      </div>
    )
  }
  // Only when there's nothing to show: a failed background refetch (e.g. the item was
  // just deleted from this page) keeps the last data until we navigate away.
  if (!item.data) {
    return <EmptyState icon={<CircleAlert />} title={t('item.notFound')} description={t('item.notFoundHint')}
      action={<Button asChild><Link to="/cards">{t('nav.cards')}</Link></Button>} />
  }
  const it = item.data
  const isContainer = it.type !== 'card'
  const close = (o: boolean) => !o && setDialog(null)
  const ancestors = [...it.ancestors].reverse()
  const propose = (mode: string) => (mode === 'propose' ? ` ${t('workflow.proposeSuffix')}` : '')

  return (
    <div>
      {/* breadcrumbs */}
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
        <Link to={PLURAL_ROUTE[it.type]} className="hover:text-foreground">{t(`enums.typePlural.${it.type}`)}</Link>
        {ancestors.map((a) => (
          <span key={a.id} className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5 rtl:rotate-180" />
            <Link to={`/items/${a.id}`} className="hover:text-foreground">{a.name} <Serial value={a.serial} /></Link>
          </span>
        ))}
        <ChevronRight className="size-3.5 rtl:rotate-180" />
        <span className="text-foreground"><Serial value={it.serial} /></span>
      </nav>

      {/* header */}
      <div className="mb-6 flex flex-wrap items-start gap-5">
        <TypeIcon type={it.type} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">{it.name}</h1>
            <CopySerial serial={it.serial} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StateBadge state={it.state} />
            <CardTypeBadge cardType={it.card_type} />
            <StorageBadge storage={it.storage} />
            {!it.is_complete && <Badge tone="warning"><CircleAlert /> {t('items.incomplete')}</Badge>}
            {it.tracking === 'quantity' && <Badge tone="outline">{t('item.units', { count: it.quantity })}</Badge>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <Meta icon={<MapPin />}>{it.location?.name ?? t('item.noLocationShort')}</Meta>
            {it.parent && <Meta icon={<GitBranch />}>{t('item.inside')} <ItemLink item={it.parent} className="text-foreground" /></Meta>}
            <Meta icon={<LayoutTemplate />}><Link to={`/templates/${it.template.id}`} className="hover:text-foreground">{t('item.template')}: {it.template.name}</Link></Meta>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editMode !== 'none' && (
            <Button onClick={() => setDialog('edit')}><Pencil /> {t('item.edit')}{propose(editMode)}</Button>
          )}
          {stateMode !== 'none' && (
            <Button onClick={() => setDialog('state')}><ListChecks /> {t('actions.changeState')}{propose(stateMode)}</Button>
          )}
          {moveMode !== 'none' && (
            <Button variant="primary" onClick={() => setDialog('move')} disabled={!!it.parent}>
              <MapPin /> {t('actions.move')}{propose(moveMode)}
            </Button>
          )}
          {(can('write_items') || can('propose_changes')) && editMode !== 'none' && (
            <Menu>
              <MenuTrigger asChild>
                <Button size="icon" aria-label={t('common.more')}><MoreHorizontal /></Button>
              </MenuTrigger>
              <MenuContent>
                {linkMode !== 'none' && it.type !== 'setup' && (
                  <MenuItem icon={<Link2 />} onSelect={() => setDialog('place')}>
                    {it.parent ? t('actions.changeParent') : t('actions.placeInside')}
                  </MenuItem>
                )}
                {it.parent && <MenuItem icon={<Unlink />} onSelect={() => setDialog('takeout')}>{t('actions.takeOut')}</MenuItem>}
                {isContainer && it.composition.length > 0 && (
                  <MenuItem icon={<ArrowRightLeft />} onSelect={() => setDialog('contents')}>{t('actions.editContents')}</MenuItem>
                )}
                <MenuItem icon={<Plus />} onSelect={() => setDialog('another')}>{t('item.another')}</MenuItem>
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} danger onSelect={() => setDialog('delete')}>{t('common.delete')}</MenuItem>
              </MenuContent>
            </Menu>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview" icon={<Package />}>{t('item.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="hierarchy" icon={<GitBranch />} count={isContainer ? it.children.length : undefined}>{t('item.tabs.hierarchy')}</TabsTrigger>
          <TabsTrigger value="history" icon={<ListChecks />}>{t('item.tabs.history')}</TabsTrigger>
          <TabsTrigger value="documents" icon={<FileText />} count={it.documents.length || undefined}>{t('item.tabs.documents')}</TabsTrigger>
          {it.type === 'setup' && <TabsTrigger value="extras" icon={<Package />} count={it.extras.length || undefined}>{t('item.tabs.extras')}</TabsTrigger>}
          <TabsTrigger value="activity" icon={<History />}>{t('item.tabs.activity')}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview item={it} /></TabsContent>
        <TabsContent value="hierarchy"><Contents item={it} onEdit={() => setDialog('contents')} canEdit={editMode !== 'none'} /></TabsContent>
        <TabsContent value="history"><StateHistory item={it} /></TabsContent>
        <TabsContent value="documents"><DocumentsPanel item={it} /></TabsContent>
        {it.type === 'setup' && <TabsContent value="extras"><ExtrasPanel item={it} /></TabsContent>}
        <TabsContent value="activity"><Activity item={it} /></TabsContent>
      </Tabs>

      <ItemFormDialog open={dialog === 'edit'} onOpenChange={close} item={it} />
      <ItemFormDialog open={dialog === 'another'} onOpenChange={close} type={it.type} templateId={it.template.id} />
      <MoveDialog item={it} open={dialog === 'move'} onOpenChange={close} />
      <StateDialog item={it} open={dialog === 'state'} onOpenChange={close} />
      <PlaceInsideDialog item={it} open={dialog === 'place'} onOpenChange={close} />
      <TakeOutDialog item={it} open={dialog === 'takeout'} onOpenChange={close} />
      <ContentsDialog item={it} open={dialog === 'contents'} onOpenChange={close} />
      <DeleteItemDialog item={it} open={dialog === 'delete'} onOpenChange={close} />
    </div>
  )
}
