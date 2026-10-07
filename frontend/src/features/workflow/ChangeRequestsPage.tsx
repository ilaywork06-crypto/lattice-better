import { Check, ChevronLeft, GitPullRequestArrow, Inbox, Quote, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import * as E from '@/api/endpoints'
import { useAction, useChangeRequest, useChangeRequests, useItem, useLocations, useTemplate } from '@/api/queries'
import type { ChangeRequest, ChangeStatus, ItemState } from '@/api/types'
import { StateBadge, TypeIcon } from '@/components/domain/badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/controls'
import { Textarea } from '@/components/ui/input'
import { Avatar, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import { CHANGE_ACTION_ICON, CHANGE_STATUS_TONE } from '@/lib/domain'
import { formatDateTime, timeAgo } from '@/lib/format'
import { useUrlState } from '@/lib/hooks'
import { useDescribeChange } from './describe'
import { useSession } from '@/lib/session'

function ItemName({ id }: { id: number }) {
  const item = useItem(id)
  return <Link to={`/items/${id}`} className="text-primary hover:underline">{item.data ? <bdi>{`${item.data.name} · ${item.data.serial}`}</bdi> : `#${id}`}</Link>
}

function TemplateName({ id }: { id: number }) {
  const tpl = useTemplate(id)
  return <Link to={`/templates/${id}`} className="text-primary hover:underline">{tpl.data?.name ?? `#${id}`}</Link>
}

function LocationName({ id }: { id: number }) {
  const locations = useLocations()
  return <span>{locations.data?.find((l) => l.id === id)?.name ?? `#${id}`}</span>
}

function PayloadValue({ name, value }: { name?: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground/60">—</span>
  if (name === 'state' && typeof value === 'string') return <StateBadge state={value as ItemState} />
  if (name === 'location_id' && typeof value === 'number') return <LocationName id={value} />
  if (name === 'parent_id' && typeof value === 'number') return <ItemName id={value} />
  if (name === 'template_id' && typeof value === 'number') return <TemplateName id={value} />
  if (name === 'child_ids' && Array.isArray(value)) return <div className="flex flex-col gap-1">{value.map((id) => <ItemName key={id} id={id} />)}</div>
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== 'object')) return <span>{value.join(', ')}</span>
    return (
      <div className="flex flex-col gap-1">
        {value.map((v, i) => (
          <div key={i} className="rounded-md bg-muted/60 px-2 py-1 text-xs">
            {typeof v === 'object' && v && 'label' in v ? <><b>{String((v as { label: string }).label)}</b> · {String((v as { field_type?: string }).field_type ?? '')}</> : <code className="mono">{JSON.stringify(v)}</code>}
          </div>
        ))}
      </div>
    )
  }
  if (typeof value === 'object') {
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="mono break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></div>
        ))}
      </dl>
    )
  }
  return <span>{String(value)}</span>
}

function Detail({ cr }: { cr: ChangeRequest }) {
  const { t } = useTranslation()
  const describe = useDescribeChange()
  const { can } = useSession()
  const [note, setNote] = useState('')
  const approve = useAction(() => E.changeRequests.approve(cr.id, note || undefined), { success: t('workflow.approved') })
  const reject = useAction(() => E.changeRequests.reject(cr.id, note || undefined), { success: t('workflow.rejected') })
  const Icon = CHANGE_ACTION_ICON[cr.action]
  const target = cr.item_id ? `/items/${cr.item_id}` : cr.template_id ? `/templates/${cr.template_id}` : null
  const entries = Object.entries(cr.payload ?? {}).filter(([, v]) => !(Array.isArray(v) && v.length === 0))

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground"><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={CHANGE_STATUS_TONE[cr.status]} dot>{t(`enums.changeStatus.${cr.status}`)}</Badge>
            <Badge tone="outline">{t(`enums.changeAction.${cr.action}`)}</Badge>
            <span className="text-xs text-muted-foreground">#{cr.id}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold leading-snug">{describe(cr)}</h2>
          {target && cr.target_name && (
            <Link to={target} className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              {cr.item_type && <TypeIcon type={cr.item_type} size="sm" />}<bdi>{cr.target_name}</bdi>
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Avatar name={cr.proposer.full_name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="text-sm"><b>{cr.proposer.full_name}</b> <span className="text-muted-foreground">· {formatDateTime(cr.created_at)}</span></div>
          <div className="mt-1.5 rounded-xl rounded-ss-sm border border-border bg-muted/50 px-4 py-3 text-sm">
            <Quote className="mb-1 size-3.5 text-muted-foreground" />
            <p dir="auto">{cr.reason}</p>
          </div>
        </div>
      </div>

      {entries.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('workflow.details')}</div>
          <dl className="divide-y divide-border rounded-xl border border-border">
            {entries.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[10rem_1fr] gap-3 px-4 py-2.5 text-sm">
                <dt className="text-muted-foreground">{t(`workflow.payload.${k}`, { defaultValue: k })}</dt>
                <dd className="min-w-0"><PayloadValue name={k} value={v} /></dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {cr.status !== 'pending' ? (
        <div className="flex items-start gap-3 rounded-xl border border-border p-4">
          {cr.reviewer && <Avatar name={cr.reviewer.full_name} size={28} />}
          <div className="text-sm">
            <div>
              {t(cr.status === 'approved' ? 'workflow.approvedBy' : 'workflow.rejectedBy', { name: cr.reviewer?.full_name ?? '—' })}
              <span className="text-muted-foreground"> · {formatDateTime(cr.reviewed_at)}</span>
            </div>
            {cr.review_note && <p className="mt-1 text-muted-foreground">{cr.review_note}</p>}
          </div>
        </div>
      ) : can('review_changes') ? (
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('workflow.notePlaceholder')} className="min-h-16" />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="danger-soft" loading={reject.isPending} onClick={() => reject.mutate(undefined)}><X /> {t('workflow.reject')}</Button>
            <Button variant="primary" loading={approve.isPending} onClick={() => approve.mutate(undefined)}><Check /> {t('workflow.approve')}</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t('workflow.approveHint')}</p>
        </div>
      ) : (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm">{t('workflow.waiting')}</p>
      )}
    </div>
  )
}

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

export default function ChangeRequestsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const { can } = useSession()
  const [filter, setFilter] = useUrlState('status', 'pending')
  const [mine, setMine] = useState(!can('review_changes'))
  const list = useChangeRequests({ status: filter === 'all' ? undefined : (filter as ChangeStatus), mine, limit: 100 })
  const selectedId = id ? Number(id) : null
  const selected = useChangeRequest(selectedId)
  const describe = useDescribeChange()

  return (
    <div>
      <PageHeader title={t('nav.changeRequests')} description={can('review_changes') ? t('workflow.descriptionReviewer') : t('workflow.description')} />
      <Card className="grid min-h-[600px] overflow-hidden lg:grid-cols-[400px_1fr]">
        <div className={cn('flex flex-col border-e border-border', selectedId && 'hidden lg:flex')}>
          <div className="border-b border-border px-4 pt-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList className="border-0">
                {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => (
                  <TabsTrigger key={f} value={f}>{f === 'all' ? t('common.all') : t(`enums.changeStatus.${f}`)}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <label className="flex items-center gap-2 border-b border-border px-4 py-2 text-[13px] text-muted-foreground">
            <Switch size="sm" checked={mine} onChange={setMine} /> {t('workflow.mineOnly')}
          </label>
          <div className="flex-1 overflow-y-auto">
            {list.isPending ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
              : !list.data?.items.length ? <EmptyState compact icon={<Inbox />} title={t('workflow.empty')} />
              : list.data.items.map((cr) => {
                const Icon = CHANGE_ACTION_ICON[cr.action]
                return (
                  <button key={cr.id} onClick={() => navigate(`/change-requests/${cr.id}?status=${filter}`)}
                    className={cn('flex w-full gap-3 border-b border-border/70 px-4 py-3 text-start transition-colors hover:bg-muted/60', cr.id === selectedId && 'bg-primary-soft/40')}>
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[13.5px] font-medium leading-snug">{describe(cr)}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{cr.proposer.full_name}</span>·<span className="shrink-0">{timeAgo(cr.created_at)}</span>
                      </div>
                    </div>
                    <Badge tone={CHANGE_STATUS_TONE[cr.status]} className="self-start">{t(`enums.changeStatus.${cr.status}`)}</Badge>
                  </button>
                )
              })}
          </div>
        </div>
        <div className={cn('min-w-0', !selectedId && 'hidden lg:block')}>
          {selectedId && (
            <button onClick={() => navigate('/change-requests')} className="flex items-center gap-1 px-6 pt-4 text-sm text-muted-foreground lg:hidden">
              <ChevronLeft className="size-4 rtl:rotate-180" /> {t('common.back')}
            </button>
          )}
          {!selectedId ? <EmptyState icon={<GitPullRequestArrow />} title={t('workflow.pick')} description={t('workflow.pickHint')} />
            : selected.isPending ? <Skeleton className="m-6 h-80" />
            : selected.data ? <Detail key={selected.data.id} cr={selected.data} />
            : <EmptyState title={t('workflow.notFound')} />}
        </div>
      </Card>
    </div>
  )
}
