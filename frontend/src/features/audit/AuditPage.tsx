import { Download, History, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as E from '@/api/endpoints'
import { useAudit } from '@/api/queries'
import type { AuditPeriod } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/controls'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/misc'
import { Select } from '@/components/ui/select'
import { useDebounced } from '@/lib/hooks'
import { AuditList } from './AuditList'

const PERIODS: AuditPeriod[] = ['day', 'week', 'month', 'half_year', 'year', 'all']
const ACTIONS = ['create', 'update', 'delete', 'move', 'link', 'unlink', 'contents', 'state_change', 'template.create', 'template.update',
  'template.delete', 'change_request.submit', 'change_request.approve', 'change_request.reject', 'import', 'user.create', 'user.update']

export default function AuditPage() {
  const { t, i18n } = useTranslation()
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const [period, setPeriod] = useState<AuditPeriod>('month')
  const [action, setAction] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(50)
  const q = useDebounced(search)
  const query = { mine: scope === 'mine', period, action: action ?? undefined, q: q || undefined }
  const audit = useAudit({ ...query, limit })
  const [exporting, setExporting] = useState(false)

  return (
    <div>
      <PageHeader
        title={t('nav.audit')}
        description={t('audit.description')}
        actions={<Button loading={exporting} onClick={async () => { setExporting(true); try { await E.audit.export(query) } finally { setExporting(false) } }}><Download /> {t('audit.export')}</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: t('audit.everything') }, { value: 'mine', label: t('audit.myItems') }]} />
        <Select className="w-44" value={period} onChange={(v) => setPeriod(v ?? 'all')} options={PERIODS.map((p) => ({ value: p, label: t(`audit.periods.${p}`) }))} />
        <Select className="w-52" value={action} onChange={setAction} noneLabel={t('audit.allActions')} placeholder={t('audit.allActions')}
          options={ACTIONS.map((a) => ({ value: a, label: i18n.exists(`audit.actions.${a.replace(/\./g, '_')}`) ? t(`audit.actions.${a.replace(/\./g, '_')}`) : a }))} />
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('audit.search')} />
        </div>
      </div>
      {scope === 'mine' && <p className="mb-3 text-[13px] text-muted-foreground"><History className="me-1 inline size-3.5" />{t('audit.myItemsHint')}</p>}
      <Card className="overflow-hidden">
        <AuditList entries={audit.data?.items} loading={audit.isPending} />
        {audit.data && audit.data.total > audit.data.items.length && (
          <div className="border-t border-border p-3 text-center">
            <Button variant="ghost" size="sm" loading={audit.isFetching} onClick={() => setLimit((l) => l + 50)}>
              {t('common.loadMore')} ({audit.data.items.length}/{audit.data.total})
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
