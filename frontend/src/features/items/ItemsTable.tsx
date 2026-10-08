import { ChevronLeft, ChevronRight, PackageOpen } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { ItemRow, Page } from '@/api/types'
import { CardTypeBadge, Serial, StateBadge, StorageBadge, TypeIcon } from '@/components/domain/badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/controls'
import { EmptyState, Skeleton } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { timeAgo } from '@/lib/format'

export function ItemsTable({
  page,
  loading,
  selected,
  onSelect,
  offset,
  onOffset,
  showTemplate = true,
  showStorage,
  empty,
}: {
  page?: Page<ItemRow>
  loading: boolean
  selected?: number[]
  onSelect?: (ids: number[]) => void
  offset: number
  onOffset: (o: number) => void
  showTemplate?: boolean
  showStorage?: boolean
  empty?: React.ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const rows = page?.items ?? []
  const selectable = !!onSelect
  const allChecked = rows.length > 0 && rows.every((r) => selected?.includes(r.id))
  const someChecked = rows.some((r) => selected?.includes(r.id))
  const showQty = rows.some((r) => r.quantity > 1)

  // Rows deleted or moved out of the filter can leave us past the last page; step back.
  useEffect(() => {
    if (page && !page.items.length && offset > 0) {
      onOffset(page.total ? Math.floor((page.total - 1) / page.limit) * page.limit : 0)
    }
  }, [page, offset, onOffset])

  if (loading && !page) {
    return <div className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
  }
  if (!rows.length) return <>{empty ?? <EmptyState icon={<PackageOpen />} title={t('items.empty')} />}</>

  return (
    <>
      <Table>
        <THead>
          <TR>
            {selectable && (
              <TH className="w-10">
                <Checkbox
                  checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                  onChange={(v) => onSelect!(v ? [...new Set([...(selected ?? []), ...rows.map((r) => r.id)])] : (selected ?? []).filter((id) => !rows.some((r) => r.id === id)))}
                />
              </TH>
            )}
            <TH>{showTemplate ? t('items.item') : t('items.serial')}</TH>
            <TH>{t('items.state')}</TH>
            {showStorage && <TH>{t('items.storage')}</TH>}
            <TH>{t('items.location')}</TH>
            <TH>{t('items.inside')}</TH>
            <TH>{t('items.project')}</TH>
            {showQty && <TH className="text-end">{t('items.quantity')}</TH>}
            <TH className="text-end">{t('items.updated')}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.id} data-clickable onClick={() => navigate(`/items/${r.id}`)} className={selected?.includes(r.id) ? 'bg-primary-soft/40' : ''}>
              {selectable && (
                <TD onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={!!selected?.includes(r.id)}
                    onChange={(v) => onSelect!(v ? [...(selected ?? []), r.id] : (selected ?? []).filter((id) => id !== r.id))}
                  />
                </TD>
              )}
              <TD>
                <div className="flex min-w-0 items-center gap-3">
                  {showTemplate && <TypeIcon type={r.type} size="sm" />}
                  <div className="min-w-0">
                    {showTemplate && <div dir="auto" className="truncate text-start font-medium">{r.name}</div>}
                    <Serial value={r.serial} className={showTemplate ? 'text-muted-foreground' : 'font-medium'} />
                  </div>
                  {showTemplate && <CardTypeBadge cardType={r.card_type} />}
                  {r.missing_children > 0 && (
                    <Tooltip content={t('items.incompleteHint', { n: r.missing_children })}>
                      <Badge tone="warning">{t('items.incomplete')}</Badge>
                    </Tooltip>
                  )}
                </div>
              </TD>
              <TD><StateBadge state={r.state} /></TD>
              {showStorage && <TD><StorageBadge storage={r.storage} /></TD>}
              <TD className="text-muted-foreground">
                {r.location ? <span className={r.location.is_desiccator ? 'text-info' : ''}>{r.location.name}</span> : '—'}
              </TD>
              <TD className="text-muted-foreground">{r.parent ? <Serial value={r.parent.serial} /> : '—'}</TD>
              <TD className="text-muted-foreground">{r.project?.value ?? '—'}</TD>
              {showQty && <TD className="text-end tabular-nums">{r.quantity}</TD>}
              <TD className="text-end text-xs whitespace-nowrap text-muted-foreground">{timeAgo(r.updated_at)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {page && page.total > page.limit && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
          <span>{t('common.range', { from: offset + 1, to: Math.min(offset + page.limit, page.total), total: page.total })}</span>
          <div className="flex gap-1">
            <Button size="icon-sm" variant="ghost" disabled={offset === 0} onClick={() => onOffset(Math.max(0, offset - page.limit))}>
              <ChevronLeft className="rtl:rotate-180" />
            </Button>
            <Button size="icon-sm" variant="ghost" disabled={offset + page.limit >= page.total} onClick={() => onOffset(offset + page.limit)}>
              <ChevronRight className="rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
