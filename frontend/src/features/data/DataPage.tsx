import { CheckCircle2, Download, FileSpreadsheet, FileWarning, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, type Issue } from '@/api/client'
import * as E from '@/api/endpoints'
import { useRefreshAll, useTemplates } from '@/api/queries'
import type { ImportResult, ItemType } from '@/api/types'
import { TypeIcon } from '@/components/domain/badges'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { Field } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/misc'
import { Select } from '@/components/ui/select'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { cn } from '@/lib/cn'
import { ITEM_TYPES } from '@/lib/domain'
import { useSession } from '@/lib/session'

function Scope({ type, setType, templateId, setTemplateId }: {
  type: ItemType | null; setType: (v: ItemType | null) => void; templateId: number | null; setTemplateId: (v: number | null) => void
}) {
  const { t } = useTranslation()
  const templates = useTemplates(type ? { type } : undefined)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t('data.type')}>
        <Select value={type} onChange={(v) => { setType(v); setTemplateId(null) }} noneLabel={t('data.allTypes')} placeholder={t('data.allTypes')}
          options={ITEM_TYPES.map((ty) => ({ value: ty, label: t(`enums.typePlural.${ty}`) }))} />
      </Field>
      <Field label={t('data.template')}>
        <Combobox value={templateId} onChange={setTemplateId} placeholder={t('data.allTemplates')}
          options={(templates.data ?? []).map((tp) => ({ value: tp.id, label: tp.name, hint: tp.serial_prefix, icon: <TypeIcon type={tp.type} size="sm" /> }))} />
      </Field>
    </div>
  )
}

export default function DataPage() {
  const { t } = useTranslation()
  const { can } = useSession()
  const refresh = useRefreshAll()
  const input = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<ItemType | null>(null)
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errors, setErrors] = useState<{ message: string; issues: Issue[] } | null>(null)
  const scope = { template_id: templateId ?? undefined, type: type ?? undefined }

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    try { await fn() } finally { setBusy(null) }
  }
  const upload = async (file: File) => {
    setResult(null)
    setErrors(null)
    await run('import', async () => {
      try {
        setResult(await E.spreadsheets.import(file))
        await refresh()
      } catch (e) {
        if (e instanceof ApiError) setErrors({ message: e.message, issues: e.issues })
        else setErrors({ message: t('errors.generic'), issues: [] })
      }
    })
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) void upload(f)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t('nav.data')} description={t('data.description')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<FileSpreadsheet />} title={t('data.step1')} description={t('data.step1Hint')} />
          <CardBody className="flex flex-col gap-4">
            <Scope type={type} setType={setType} templateId={templateId} setTemplateId={setTemplateId} />
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" loading={busy === 'tpl'} onClick={() => void run('tpl', () => E.spreadsheets.importTemplate(scope))}>
                <Download /> {t('data.downloadImport')}
              </Button>
              <Button loading={busy === 'export'} onClick={() => void run('export', () => E.spreadsheets.export(scope))}>
                <Download /> {t('data.export')}
              </Button>
            </div>
            <ul className="list-disc space-y-1 ps-5 text-[13px] text-muted-foreground">
              <li>{t('data.tip1')}</li>
              <li>{t('data.tip2')}</li>
              <li>{t('data.tip3')}</li>
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Upload />} title={t('data.step2')} description={can('import_data') ? t('data.step2Hint') : t('data.managersOnly')} />
          <CardBody>
            <input ref={input} type="file" accept=".xlsx,.xlsm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
            <button
              type="button"
              disabled={!can('import_data') || busy === 'import'}
              onClick={() => input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-12 text-center transition-colors hover:border-input disabled:cursor-not-allowed disabled:opacity-50',
                dragging && 'border-primary bg-primary-soft/40',
              )}
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary-soft-foreground"><Upload className="size-5" /></span>
              <span className="font-medium">{busy === 'import' ? t('data.importing') : t('data.drop')}</span>
              <span className="text-xs text-muted-foreground">{t('data.allOrNothing')}</span>
            </button>
          </CardBody>
        </Card>
      </div>

      {result && (
        <Card className="mt-6 border-success/40">
          <CardHeader icon={<CheckCircle2 className="text-success" />} title={t('data.success', { count: result.created })} />
          <CardBody className="flex flex-wrap gap-2">
            {Object.entries(result.by_template).map(([name, n]) => (
              <span key={name} className="rounded-lg bg-success-soft px-2.5 py-1 text-sm text-success">{name}: <b>{n}</b></span>
            ))}
          </CardBody>
        </Card>
      )}
      {errors && (
        <Card className="mt-6 overflow-hidden border-danger/40">
          <CardHeader icon={<FileWarning className="text-danger" />} title={t('data.failed')} description={errors.message} />
          {errors.issues.length > 0 && (
            <Table>
              <THead><TR><TH>{t('data.sheet')}</TH><TH>{t('data.cell')}</TH><TH>{t('data.column')}</TH><TH>{t('data.problem')}</TH></TR></THead>
              <TBody>
                {errors.issues.map((i, n) => (
                  <TR key={n}>
                    <TD className="whitespace-nowrap">{i.sheet ?? '—'}</TD>
                    <TD><span className="mono rounded bg-danger-soft px-1.5 py-0.5 text-xs text-danger">{i.cell ?? (i.row ? `#${i.row}` : '—')}</span></TD>
                    <TD className="text-muted-foreground">{i.column ?? '—'}</TD>
                    <TD>{i.message}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  )
}
