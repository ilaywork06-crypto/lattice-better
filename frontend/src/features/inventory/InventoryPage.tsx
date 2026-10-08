import { AlertTriangle, BellRing, Droplets, Pencil, Search, Trash2, Warehouse } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import * as E from '@/api/endpoints'
import { useAction, useLocations, useStock, useThresholds } from '@/api/queries'
import type { CardType, StockRow } from '@/api/types'
import { CardTypeBadge } from '@/components/domain/badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { Switch } from '@/components/ui/controls'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { EmptyState, PageHeader, Progress, Skeleton, Stat } from '@/components/ui/misc'
import { Select } from '@/components/ui/select'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { CARD_TYPES } from '@/lib/domain'
import { useSession } from '@/lib/session'

function ThresholdDialog({ row, onClose }: { row: StockRow | null; onClose: () => void }) {
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      {/* Keyed and mounted per opening, so it always starts from the saved threshold. */}
      {row && <ThresholdForm key={row.template_id} row={row} onClose={onClose} />}
    </Dialog>
  )
}

function ThresholdForm({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const { t } = useTranslation()
  const thresholds = useThresholds()
  const saved = thresholds.data?.find((x) => x.template_id === row.template_id)
  const [min, setMin] = useState(row.min_quantity ?? 0)
  const [email, setEmail] = useState<string | null>(null) // null = untouched → show the saved one
  const shownEmail = email ?? saved?.notify_email ?? ''
  const save = useAction(() => E.inventory.setThreshold(row.template_id, min, shownEmail || null), {
    success: t('inventory.thresholdSaved'), onSuccess: onClose,
  })
  return (
    <DialogContent size="sm" icon={<BellRing />} title={t('inventory.thresholdTitle')} description={row.name}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" loading={save.isPending} disabled={thresholds.isPending} onClick={() => save.mutate(undefined)}>{t('common.save')}</Button></>}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t('inventory.thresholdHint', { available: row.available })}</p>
        <Field label={t('inventory.minimum')} required>
          <Input type="number" min={0} value={min} onChange={(e) => setMin(Math.max(0, Number(e.target.value)))} />
        </Field>
        <Field label={t('inventory.notifyEmail')} hint={t('inventory.notifyEmailHint')}>
          <Input type="email" dir="ltr" value={shownEmail} onChange={(e) => setEmail(e.target.value)} placeholder="stock@company.com" />
        </Field>
      </div>
    </DialogContent>
  )
}

export default function InventoryPage() {
  const { t } = useTranslation()
  const { can } = useSession()
  const confirm = useConfirm()
  const [cardType, setCardType] = useState<CardType | null>(null)
  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [editing, setEditing] = useState<StockRow | null>(null)
  const stock = useStock(cardType ?? undefined)
  const locations = useLocations()
  const removeThreshold = useAction((templateId: number) => E.inventory.removeThreshold(templateId), { success: t('inventory.thresholdRemoved') })
  const desiccator = (locations.data ?? []).filter((l) => l.is_desiccator)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (stock.data ?? []).filter((r) => (!q || r.name.toLowerCase().includes(q) || r.serial_prefix.toLowerCase().includes(q)) && (!lowOnly || r.is_low))
  }, [stock.data, search, lowOnly])
  const totals = (stock.data ?? []).reduce(
    (a, r) => ({ total: a.total + r.total, available: a.available + r.available, desiccator: a.desiccator + r.desiccator, low: a.low + (r.is_low ? 1 : 0) }),
    { total: 0, available: 0, desiccator: 0, low: 0 },
  )

  return (
    <div>
      <PageHeader title={t('nav.inventory')} description={t('inventory.description')} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t('inventory.available')} value={totals.available} tone="success" icon={<Warehouse />} hint={t('inventory.availableHint')} />
        <Stat label={t('inventory.inDesiccator')} value={totals.desiccator} tone="info" icon={<Droplets />}
          hint={desiccator.length ? desiccator.map((l) => l.name).join(', ') : t('inventory.noDesiccator')} />
        <Stat label={t('inventory.totalCards')} value={totals.total} />
        <Stat label={t('inventory.lowStock')} value={totals.low} tone={totals.low ? 'danger' : 'neutral'} icon={<AlertTriangle />} onClick={() => setLowOnly(true)} />
      </div>

      {desiccator.length === 0 && !locations.isPending && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
          <Droplets className="size-4 shrink-0" />
          <span className="flex-1">{t('inventory.defineDesiccator')}</span>
          {can('manage_desiccator') && <Button size="sm" asChild><Link to="/admin/catalog?tab=desiccator">{t('inventory.define')}</Link></Button>}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('inventory.search')} />
        </div>
        <Select className="w-44" value={cardType} onChange={setCardType} noneLabel={t('items.allCardTypes')} placeholder={t('items.allCardTypes')}
          options={CARD_TYPES.map((c) => ({ value: c, label: t(`enums.cardType.${c}`) }))} />
        <label className="flex items-center gap-2 px-2 text-[13px] text-muted-foreground">
          <Switch size="sm" checked={lowOnly} onChange={setLowOnly} /> {t('inventory.lowOnly')}
        </label>
      </div>

      <Card className="overflow-hidden">
        {stock.isPending ? <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          : rows.length === 0 ? <EmptyState icon={<Warehouse />} title={t('inventory.empty')} description={t('inventory.emptyHint')} />
          : (
            <Table>
              <THead>
                <TR>
                  <TH>{t('inventory.component')}</TH>
                  <TH className="w-56">{t('inventory.available')}</TH>
                  <TH className="text-end">{t('inventory.inDesiccator')}</TH>
                  <TH className="text-end">{t('enums.storage.in_use')}</TH>
                  <TH className="text-end">{t('enums.storage.assembled')}</TH>
                  <TH className="text-end">{t('enums.state.faulty')}</TH>
                  <TH className="text-end">{t('inventory.total')}</TH>
                  <TH className="text-end">{t('inventory.minimum')}</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.template_id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Link to={`/templates/${r.template_id}`} className="font-medium hover:text-primary">{r.name}</Link>
                        <CardTypeBadge cardType={r.card_type} />
                        {r.is_low && <Badge tone="danger"><AlertTriangle /> {t('inventory.low')}</Badge>}
                      </div>
                    </TD>
                    <TD>
                      <Tooltip content={r.available_serials.length ? r.available_serials.slice(0, 20).join(', ') : undefined}>
                        <div className="flex items-center gap-3">
                          <span className={`w-8 text-end font-semibold tabular-nums ${r.is_low ? 'text-danger' : ''}`}>{r.available}</span>
                          <Progress className="flex-1" value={r.available} max={Math.max(r.min_quantity ?? 0, r.total, 1)} tone={r.is_low ? 'danger' : 'success'} />
                        </div>
                      </Tooltip>
                    </TD>
                    <TD className="text-end tabular-nums">
                      {r.desiccator}
                      {r.assembled_in_desiccator > 0 && <span className="ms-1 text-xs text-muted-foreground">({t('inventory.ofWhichAssembled', { n: r.assembled_in_desiccator })})</span>}
                    </TD>
                    <TD className="text-end tabular-nums text-muted-foreground">{r.in_use}</TD>
                    <TD className="text-end tabular-nums text-muted-foreground">{r.assembled}</TD>
                    <TD className="text-end tabular-nums text-muted-foreground">{r.faulty || '—'}</TD>
                    <TD className="text-end font-medium tabular-nums">{r.total}</TD>
                    <TD className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <span className="tabular-nums">{r.min_quantity ?? '—'}</span>
                        {can('write_thresholds') && (
                          <Button size="icon-sm" variant="ghost" onClick={() => setEditing(r)} aria-label={t('inventory.thresholdTitle')}><Pencil /></Button>
                        )}
                        {can('delete_thresholds') && r.min_quantity != null && (
                          <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-danger"
                            onClick={async () => { if (await confirm({ title: t('inventory.removeThreshold'), description: r.name, danger: true })) removeThreshold.mutate(r.template_id) }}>
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
      </Card>
      <ThresholdDialog row={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
