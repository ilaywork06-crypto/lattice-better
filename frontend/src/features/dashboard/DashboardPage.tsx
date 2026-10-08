import {
  AlertTriangle, ArrowRight, CheckCircle2, Circle, CircuitBoard, Cpu, FileSpreadsheet, GitPullRequestArrow,
  LayoutTemplate, Plus, Server, ShieldAlert, Warehouse,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import {
  useAudit, useCatalog, useChangeRequests, useLocations, useStock, useSummary, useTemplates, useThresholds, useUsers,
} from '@/api/queries'
import { useWorkflowMode } from '@/components/domain/ActionDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState, Progress, Skeleton, Stat } from '@/components/ui/misc'
import { cn } from '@/lib/cn'
import { CHANGE_STATUS_TONE } from '@/lib/domain'
import { formatNumber, timeAgo } from '@/lib/format'
import { useSession } from '@/lib/session'
import { AuditList } from '@/features/audit/AuditList'
import { useDescribeChange } from '@/features/workflow/describe'

function greeting(t: (k: string) => string) {
  const h = new Date().getHours()
  return h < 12 ? t('dashboard.morning') : h < 18 ? t('dashboard.afternoon') : t('dashboard.evening')
}

function SetupGuide() {
  const { t } = useTranslation()
  const { can } = useSession()
  const users = useUsers()
  const catalog = useCatalog()
  const locations = useLocations()
  const templates = useTemplates()
  const summary = useSummary()
  const thresholds = useThresholds()
  const has = (type: string) => (templates.data ?? []).some((x) => x.type === type)
  const steps = [
    { done: (users.data?.length ?? 0) > 1, label: t('guide.users'), to: '/admin/users', show: can('manage_users') },
    { done: (catalog.data?.length ?? 0) > 0, label: t('guide.catalog'), to: '/admin/catalog', show: can('manage_catalog') },
    { done: (locations.data?.length ?? 0) > 0, label: t('guide.locations'), to: '/locations', show: true },
    { done: (locations.data ?? []).some((l) => l.is_desiccator), label: t('guide.desiccator'), to: '/admin/catalog?tab=desiccator', show: can('manage_desiccator') },
    { done: has('card'), label: t('guide.cardTemplates'), to: '/templates/new?type=card', show: true },
    { done: has('assembly') || has('setup'), label: t('guide.containers'), to: '/templates/new?type=assembly', show: true },
    { done: (summary.data?.cards ?? 0) + (summary.data?.assemblies ?? 0) + (summary.data?.setups ?? 0) > 0, label: t('guide.items'), to: '/cards?new=1', show: true },
    { done: (thresholds.data?.length ?? 0) > 0, label: t('guide.thresholds'), to: '/inventory', show: true },
  ].filter((s) => s.show)
  const done = steps.filter((s) => s.done).length
  if (done === steps.length) return null
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-primary opacity-[0.08] blur-2xl" />
      <CardHeader title={t('guide.title')} description={t('guide.description', { done, total: steps.length })} />
      <CardBody>
        <Progress value={done} max={steps.length} className="mb-4" />
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.label}>
              <Link to={s.to} className={cn('flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-muted', s.done && 'text-muted-foreground')}>
                {s.done ? <CheckCircle2 className="size-[18px] text-success" /> : <Circle className="size-[18px] text-muted-foreground/50" />}
                <span className={cn('flex-1', s.done && 'line-through')}>{i + 1}. {s.label}</span>
                {!s.done && <ArrowRight className="size-3.5 text-muted-foreground rtl:rotate-180" />}
              </Link>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  )
}

function StockChart() {
  const { t } = useTranslation()
  const stock = useStock()
  const rows = [...(stock.data ?? [])].sort((a, b) => b.total - a.total).slice(0, 8)
  const max = Math.max(1, ...rows.map((r) => r.total))
  const parts = [
    { key: 'available', color: 'color-mix(in oklch, var(--success) 80%, var(--card))' },
    { key: 'desiccatorOther', color: 'color-mix(in oklch, var(--info) 60%, transparent)' },
    { key: 'assembled', color: 'oklch(0.72 0.11 300)' },
    { key: 'in_use', color: 'var(--input)' },
  ] as const
  return (
    <Card>
      <CardHeader icon={<Warehouse />} title={t('dashboard.stockTitle')} description={t('dashboard.stockHint')}
        actions={<Button size="sm" variant="ghost" asChild><Link to="/inventory">{t('common.viewAll')}</Link></Button>} />
      <CardBody>
        {stock.isPending ? <Skeleton className="h-48" /> : rows.length === 0 ? (
          <EmptyState compact icon={<CircuitBoard />} title={t('dashboard.noStock')} />
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((r) => {
              const values = { available: r.available, desiccatorOther: r.desiccator - r.available, assembled: r.assembled, in_use: r.in_use }
              return (
                <Link key={r.template_id} to={`/templates/${r.template_id}`} className="group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
                  <span className="truncate text-[13px] group-hover:text-primary">{r.name}</span>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-subtle" style={{ width: `${Math.max(8, (r.total / max) * 100)}%` }}>
                    {parts.map((p) => values[p.key] > 0 && (
                      <div key={p.key} style={{ width: `${(values[p.key] / Math.max(1, r.total)) * 100}%`, background: p.color }} />
                    ))}
                  </div>
                  <span className="w-12 text-end text-xs tabular-nums text-muted-foreground">
                    <span className={cn('font-semibold', r.is_low ? 'text-danger' : 'text-foreground')}>{r.available}</span>/{r.total}
                  </span>
                </Link>
              )
            })}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {parts.map((p) => (
                <span key={p.key} className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: p.color }} /> {t(`dashboard.legend.${p.key}`)}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function Attention() {
  const { t } = useTranslation()
  const { can } = useSession()
  const thresholds = useThresholds()
  const pending = useChangeRequests({ status: 'pending', limit: 5, mine: !can('review_changes') })
  const describe = useDescribeChange()
  const low = (thresholds.data ?? []).filter((x) => x.is_low)
  return (
    <Card>
      <CardHeader icon={<ShieldAlert />} title={t('dashboard.attention')} />
      <CardBody className="flex flex-col gap-5">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{t('dashboard.lowStock')}</span>
            {low.length > 0 && <Badge tone="danger">{low.length}</Badge>}
          </div>
          {low.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" /> {t('dashboard.stockOk')}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {low.slice(0, 5).map((x) => (
                <Link key={x.id} to={`/templates/${x.template_id}`} className="group">
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className="group-hover:text-primary">{x.name}</span>
                    <span className="tabular-nums text-muted-foreground"><span className="font-semibold text-danger">{x.available}</span> / {x.min_quantity}</span>
                  </div>
                  <Progress value={x.available} max={Math.max(x.min_quantity, 1)} tone="danger" />
                </Link>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{can('review_changes') ? t('dashboard.awaiting') : t('dashboard.myPending')}</span>
            {!!pending.data?.total && <Badge tone="warning">{pending.data.total}</Badge>}
          </div>
          {!pending.data?.items.length ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" /> {t('dashboard.nothingPending')}</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {pending.data.items.map((cr) => (
                <Link key={cr.id} to={`/change-requests/${cr.id}`} className="flex items-center gap-3 py-2 hover:text-primary">
                  <GitPullRequestArrow className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{describe(cr)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(cr.created_at)}</span>
                  <Badge tone={CHANGE_STATUS_TONE[cr.status]}>{t(`enums.changeStatus.${cr.status}`)}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, can } = useSession()
  const summary = useSummary()
  const audit = useAudit({ limit: 8 })
  const createMode = useWorkflowMode('write_items', 'create')
  const s = summary.data
  const first = user?.full_name.split(' ')[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{greeting(t)}, {first}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('import_data') && <Button asChild><Link to="/data"><FileSpreadsheet /> {t('dashboard.import')}</Link></Button>}
          {(can('write_templates') || can('propose_changes')) && <Button asChild><Link to="/templates/new"><LayoutTemplate /> {t('templates.new')}</Link></Button>}
          {createMode !== 'none' && <Button variant="primary" asChild><Link to="/cards?new=1"><Plus /> {t('dashboard.newItem')}</Link></Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {!s ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[118px] rounded-xl" />) : (
          <>
            <Stat label={t('dashboard.available')} value={formatNumber(s.cards_available)} icon={<Warehouse />} tone="success"
              hint={s.low_stock ? t('dashboard.lowCount', { count: s.low_stock }) : t('dashboard.ofCards', { count: s.cards })}
              onClick={() => navigate('/inventory')} />
            <Stat label={t('enums.typePlural.card')} value={formatNumber(s.cards)} icon={<CircuitBoard />} tone="info"
              hint={t('dashboard.inUse', { count: s.cards_in_use })} onClick={() => navigate('/cards')} />
            <Stat label={t('enums.typePlural.assembly')} value={formatNumber(s.assemblies)} icon={<Cpu />} tone="primary" onClick={() => navigate('/assemblies')} />
            <Stat label={t('enums.typePlural.setup')} value={formatNumber(s.setups)} icon={<Server />} tone="primary" onClick={() => navigate('/setups')} />
            <Stat label={t('dashboard.faulty')} value={formatNumber(s.faulty_items)} icon={<AlertTriangle />} tone={s.faulty_items ? 'danger' : 'neutral'}
              onClick={() => navigate('/cards?view=units&state=faulty')} />
            <Stat label={t('dashboard.pending')} value={formatNumber(s.pending_change_requests)} icon={<GitPullRequestArrow />}
              tone={s.pending_change_requests ? 'warning' : 'neutral'}
              onClick={() => navigate('/change-requests')} />
          </>
        )}
      </div>

      <SetupGuide />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <StockChart />
        <Attention />
      </div>

      <Card>
        <CardHeader title={t('dashboard.activity')} actions={<Button size="sm" variant="ghost" asChild><Link to="/audit">{t('common.viewAll')}</Link></Button>} />
        <AuditList entries={audit.data?.items} loading={audit.isPending} />
      </Card>
    </div>
  )
}
