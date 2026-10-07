import { ChevronDown, Copy, LayoutTemplate, Lock, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useTemplates } from '@/api/queries'
import type { ItemType } from '@/api/types'
import { useWorkflowMode } from '@/components/domain/ActionDialog'
import { CardTypeBadge, TypeIcon } from '@/components/domain/badges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/controls'
import { Input } from '@/components/ui/input'
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { ITEM_TYPES } from '@/lib/domain'
import { timeAgo } from '@/lib/format'
import { useUrlState } from '@/lib/hooks'
import { StateBar } from '@/features/items/StateBar'

export default function TemplatesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [type, setType] = useUrlState('type', 'all')
  const [search, setSearch] = useState('')
  const templates = useTemplates()
  const createMode = useWorkflowMode('write_templates', 'template_create')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (templates.data ?? []).filter(
      (tpl) => (type === 'all' || tpl.type === type) && (!q || tpl.name.toLowerCase().includes(q) || tpl.serial_prefix.toLowerCase().includes(q)),
    )
  }, [templates.data, type, search])
  const byType = (ty: ItemType) => (templates.data ?? []).filter((x) => x.type === ty).length

  return (
    <div>
      <PageHeader
        title={t('nav.templates')}
        description={t('templates.description')}
        actions={createMode !== 'none' && (
          <Button variant="primary" asChild>
            <Link to={`/templates/new${type !== 'all' ? `?type=${type}` : ''}`}><Plus /> {createMode === 'direct' ? t('templates.new') : t('templates.propose')}</Link>
          </Button>
        )}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('templates.search')} />
        </div>
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: `${t('common.all')} · ${templates.data?.length ?? 0}` },
            ...ITEM_TYPES.map((ty) => ({ value: ty, label: `${t(`enums.typePlural.${ty}`)} · ${byType(ty)}` })),
          ]}
        />
      </div>
      <Card className="overflow-hidden">
        {templates.isPending ? (
          <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<LayoutTemplate />} title={t('templates.empty')} description={t('templates.emptyHint')}
            action={createMode !== 'none' && <Button variant="primary" asChild><Link to="/templates/new"><Plus /> {t('templates.new')}</Link></Button>} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t('templates.name')}</TH>
                <TH>{t('templates.prefix')}</TH>
                <TH className="w-48">{t('templates.units_header')}</TH>
                <TH>{t('templates.fieldsHeader')}</TH>
                <TH>{t('templates.contents')}</TH>
                <TH className="text-end">{t('items.updated')}</TH>
                <TH className="w-12" />
              </TR>
            </THead>
            <TBody>
              {rows.map((tpl) => (
                <TR key={tpl.id} data-clickable onClick={() => navigate(`/templates/${tpl.id}`)}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <TypeIcon type={tpl.type} size="sm" />
                      <span className="font-medium">{tpl.name}</span>
                      <CardTypeBadge cardType={tpl.card_type} />
                    </div>
                  </TD>
                  <TD><span className="mono text-[13px]">{tpl.serial_prefix}</span></TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-end font-medium tabular-nums">{tpl.counts.total}</span>
                      <div className="flex-1"><StateBar counts={tpl.counts} /></div>
                    </div>
                  </TD>
                  <TD className="text-muted-foreground">{tpl.field_count}</TD>
                  <TD className="text-muted-foreground">
                    {tpl.type === 'card' ? <span className="inline-flex items-center gap-1 text-xs"><Lock className="size-3" />{t('templates.leaf')}</span> : t('templates.kinds', { count: tpl.child_template_ids.length })}
                  </TD>
                  <TD className="text-end text-xs text-muted-foreground">{timeAgo(tpl.updated_at)}</TD>
                  <TD onClick={(e) => e.stopPropagation()}>
                    {createMode !== 'none' && (
                      <Tooltip content={t('templates.duplicate')}>
                        <Button size="icon-sm" variant="ghost" asChild><Link to={`/templates/${tpl.id}/duplicate`}><Copy /></Link></Button>
                      </Tooltip>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><ChevronDown className="size-3" /> {t('templates.footerHint')}</p>
    </div>
  )
}
