import {
  ChevronDown, CircleAlert, Copy, Download, FileSpreadsheet, FileText, Lock, MoreHorizontal, Pencil, Plus, Trash2, Upload,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { openFile } from '@/api/client'
import * as E from '@/api/endpoints'
import { useAction, useAudit, useItems, useTemplate, useTemplateGraph } from '@/api/queries'
import type { FieldOut } from '@/api/types'
import { useWorkflowMode } from '@/components/domain/ActionDialog'
import { CardTypeBadge, TypeIcon } from '@/components/domain/badges'
import { FieldValue } from '@/components/domain/FieldValue'
import { HierarchyGraph } from '@/components/domain/HierarchyGraph'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { EmptyState, Skeleton, Stat } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import { FIELD_ICON } from '@/lib/domain'
import { formatBytes } from '@/lib/format'
import { useUrlState } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { AuditList } from '@/features/audit/AuditList'
import { ItemFormDialog } from '@/features/items/ItemFormDialog'
import { ItemsTable } from '@/features/items/ItemsTable'

function TemplateFiles({ templateId, field }: { templateId: number; field: FieldOut }) {
  const { t } = useTranslation()
  const { can } = useSession()
  const input = useRef<HTMLInputElement>(null)
  const upload = useAction((f: File) => E.templates.uploadFile(templateId, field.id, f), { success: t('documents.uploaded', { count: 1 }) })
  const remove = useAction((docId: number) => E.templates.removeFile(templateId, docId))
  return (
    <div className="flex flex-col gap-1.5">
      {field.files.map((d) => (
        <div key={d.id} className="flex items-center gap-2 text-sm">
          <FileText className="size-3.5 text-muted-foreground" />
          <button className="truncate text-primary hover:underline" onClick={() => void openFile(E.documents.downloadPath(d.id))}>{d.name}</button>
          <span className="text-xs text-muted-foreground">{formatBytes(d.size_bytes)}</span>
          {can('write_templates') && (
            <button className="text-muted-foreground hover:text-danger" onClick={() => remove.mutate(d.id)}><Trash2 className="size-3.5" /></button>
          )}
        </div>
      ))}
      {can('write_templates') && (
        <>
          <input ref={input} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = '' }} />
          <Button size="sm" variant="outline" className="self-start" loading={upload.isPending} onClick={() => input.current?.click()}><Upload /> {t('documents.upload')}</Button>
        </>
      )}
    </div>
  )
}

export default function TemplatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { id } = useParams()
  const templateId = Number(id)
  const tpl = useTemplate(templateId)
  const [tab, setTab] = useUrlState('tab', 'units')
  const [offset, setOffset] = useState(0)
  const [creating, setCreating] = useState(false)
  const units = useItems({ template_id: templateId, limit: 50, offset })
  const graph = useTemplateGraph(templateId)
  const audit = useAudit({ template_id: templateId, limit: 50 })
  const { can } = useSession()
  const editMode = useWorkflowMode('write_templates', 'template_update')
  const createItemMode = useWorkflowMode('write_items', 'create')
  const remove = useAction(() => E.templates.remove(templateId), { success: t('templates.deleted'), onSuccess: () => navigate('/templates') })

  if (tpl.isPending) return <div className="flex flex-col gap-6"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>
  if (!tpl.data) return <EmptyState icon={<CircleAlert />} title={t('templates.notFound')} />
  const d = tpl.data
  const route = d.type === 'card' ? 'cards' : d.type === 'assembly' ? 'assemblies' : 'setups'

  return (
    <div>
      <Link to="/templates" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        {t('nav.templates')}
      </Link>
      <div className="mb-6 flex flex-wrap items-start gap-5">
        <TypeIcon type={d.type} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">{d.name}</h1>
            <span className="mono rounded-md bg-subtle px-2 py-0.5 text-sm">{d.serial_prefix}</span>
            <CardTypeBadge cardType={d.card_type} />
            {d.tracking && <Badge tone="outline">{t(`enums.tracking.${d.tracking}`)}</Badge>}
          </div>
          {d.description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{d.description}</p>}
          <p className="mt-2 text-xs text-muted-foreground">{t('templates.nextSerial')}: <bdi className="mono">{d.next_serial}</bdi></p>
        </div>
        <div className="flex flex-wrap gap-2">
          {createItemMode !== 'none' && (
            <Button variant="primary" onClick={() => setCreating(true)}><Plus /> {t(`items.new.${d.type}`)}</Button>
          )}
          {editMode !== 'none' && (
            <Button asChild><Link to={`/templates/${d.id}/edit`}><Pencil /> {editMode === 'direct' ? t('common.edit') : t('templates.proposeEdit')}</Link></Button>
          )}
          <Menu>
            <MenuTrigger asChild><Button size="icon"><MoreHorizontal /></Button></MenuTrigger>
            <MenuContent>
              {editMode !== 'none' && <MenuItem icon={<Copy />} onSelect={() => navigate(`/templates/${d.id}/duplicate`)}>{t('templates.duplicate')}</MenuItem>}
              <MenuItem icon={<FileSpreadsheet />} onSelect={() => void E.spreadsheets.importTemplate({ template_id: d.id })}>{t('data.downloadImport')}</MenuItem>
              <MenuItem icon={<Download />} onSelect={() => void E.spreadsheets.export({ template_id: d.id })}>{t('data.export')}</MenuItem>
              {can('write_templates') && (
                <>
                  <MenuSeparator />
                  <MenuItem icon={<Trash2 />} danger disabled={d.counts.total + d.counts.destroyed > 0}
                    onSelect={async () => { if (await confirm({ title: t('templates.deleteTitle', { name: d.name }), description: t('templates.deleteHint'), danger: true, confirmLabel: t('common.delete') })) remove.mutate(undefined) }}>
                    {t('common.delete')}
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t('templates.unitsLabel')} value={d.counts.total} onClick={() => navigate(`/${route}?template=${d.id}&view=units`)} />
        <Stat label={t('enums.state.built')} value={d.counts.built} tone="info" />
        <Stat label={t('enums.state.ok')} value={d.counts.ok} tone="success" />
        <Stat label={t('enums.state.faulty')} value={d.counts.faulty} tone="danger" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="units" count={units.data?.total}>{t('templates.tabs.units')}</TabsTrigger>
          <TabsTrigger value="fields" count={d.fields.length}>{t('templates.tabs.fields')}</TabsTrigger>
          <TabsTrigger value="structure">{t('templates.tabs.structure')}</TabsTrigger>
          <TabsTrigger value="activity">{t('templates.tabs.activity')}</TabsTrigger>
        </TabsList>
        <TabsContent value="units">
          <Card className="overflow-hidden">
            <ItemsTable page={units.data} loading={units.isPending} offset={offset} onOffset={setOffset} showTemplate={false} showStorage={d.type === 'card'} />
          </Card>
        </TabsContent>
        <TabsContent value="fields">
          <Card className="overflow-hidden">
            {d.fields.length === 0 ? <EmptyState compact title={t('templates.noFields')} /> : (
              <Table>
                <THead><TR><TH>{t('editor.label')}</TH><TH>{t('editor.typeHeader')}</TH><TH>{t('editor.mode')}</TH><TH>{t('templates.valueOrList')}</TH></TR></THead>
                <TBody>
                  {d.fields.map((f) => {
                    const Icon = FIELD_ICON[f.field_type]
                    return (
                      <TR key={f.id}>
                        <TD><span className="font-medium">{f.label}</span>{f.required && <span className="ms-0.5 text-danger">*</span>}</TD>
                        <TD><span className="inline-flex items-center gap-1.5 text-muted-foreground"><Icon className="size-3.5" />{t(`enums.fieldType.${f.field_type}`)}</span></TD>
                        <TD>
                          <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground', f.mode === 'item' ? 'border-transparent bg-subtle' : 'border-border bg-card')}>
                            {f.mode === 'fixed' && <Lock className="size-3" />}{f.mode === 'choice' && <ChevronDown className="size-3" />}{t(`enums.fieldMode.${f.mode}`)}
                          </span>
                        </TD>
                        <TD className="max-w-md">
                          {f.mode === 'fixed' && f.field_type === 'files' ? <TemplateFiles templateId={d.id} field={f} />
                            : f.mode === 'fixed' ? <FieldValue fieldType={f.field_type} value={f.fixed_value} display={f.fixed_display} />
                            : f.options_display.length ? <span className="text-muted-foreground">{f.options_display.join(' · ')}</span>
                            : (f.config.pattern as string) ? <span className="mono text-muted-foreground">{String(f.config.pattern)}</span>
                            : <span className="text-muted-foreground/60">—</span>}
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="structure">
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader title={t('templates.holds')} />
                <CardBody className="flex flex-col gap-2">
                  {d.children.length === 0 ? <p className="text-sm text-muted-foreground">{t('templates.holdsNothing')}</p> : d.children.map((c) => (
                    <Link key={c.template.id} to={`/templates/${c.template.id}`} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 hover:bg-muted">
                      <TypeIcon type={c.template.type} size="sm" />
                      <span className="flex-1 truncate text-sm">{c.template.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{c.min_count}–{c.max_count ?? '∞'}</span>
                    </Link>
                  ))}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t('templates.usedIn')} />
                <CardBody className="flex flex-col gap-2">
                  {d.parents.length === 0 ? <p className="text-sm text-muted-foreground">{t('templates.usedNowhere')}</p> : d.parents.map((p) => (
                    <Link key={p.id} to={`/templates/${p.id}`} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 hover:bg-muted">
                      <TypeIcon type={p.type} size="sm" /><span className="truncate text-sm">{p.name}</span>
                    </Link>
                  ))}
                </CardBody>
              </Card>
            </div>
            <Card className="overflow-hidden">
              {graph.data ? <HierarchyGraph graph={graph.data} mode="templates" onNodeClick={(nid) => navigate(`/templates/${nid}`)} className="h-[460px]" /> : <Skeleton className="m-5 h-96" />}
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="activity">
          <Card><AuditList entries={audit.data?.items} loading={audit.isPending} /></Card>
        </TabsContent>
      </Tabs>
      <ItemFormDialog open={creating} onOpenChange={setCreating} type={d.type} templateId={d.id} />
    </div>
  )
}
