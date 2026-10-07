import { ArrowLeft, GitPullRequestArrow, Info, Layers, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ApiError, type Issue } from '@/api/client'
import * as E from '@/api/endpoints'
import { useRefreshAll, useTemplate, useTemplates } from '@/api/queries'
import type { CardType, ChildSlotIn, FieldGroup, ItemType, TemplateDetail } from '@/api/types'
import { useWorkflowMode } from '@/components/domain/ActionDialog'
import { TypeIcon } from '@/components/domain/badges'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { EmptyState, Skeleton } from '@/components/ui/misc'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import { CARD_TYPES, CONTAINS, forbiddenFor, ITEM_TYPES, SYSTEM_FIELDS } from '@/lib/domain'
import { useSession } from '@/lib/session'
import { LoadGroupsDialog, SaveGroupDialog } from './FieldGroupDialogs'
import { FieldListEditor } from './FieldListEditor'
import { rowsFromGroup, rowsFromTemplate, toFieldIn, type FieldRow } from './fieldRows'

type Mode = 'create' | 'edit' | 'duplicate'

interface Draft {
  type: ItemType
  name: string
  card_type: CardType | null
  serial_prefix: string
  description: string
  fields: FieldRow[]
  children: ChildSlotIn[]
}

const emptyDraft = (type: ItemType): Draft => ({
  type, name: '', card_type: type === 'card' ? 'house' : null, serial_prefix: '', description: '', fields: [], children: [],
})

function fromTemplate(tpl: TemplateDetail, mode: Mode, copyName: string): Draft {
  return {
    type: tpl.type,
    name: mode === 'duplicate' ? copyName : tpl.name,
    card_type: tpl.card_type ?? null,
    serial_prefix: mode === 'duplicate' ? '' : tpl.serial_prefix,
    description: tpl.description ?? '',
    fields: rowsFromTemplate(tpl.fields, mode === 'duplicate'),
    children: tpl.children.map((c) => ({ template_id: c.template.id, min_count: c.min_count, max_count: c.max_count })),
  }
}

function ChildrenEditor({ draft, setDraft, selfId, issues }: {
  draft: Draft; setDraft: (d: Draft) => void; selfId?: number; issues: Record<number, string>
}) {
  const { t } = useTranslation()
  const templates = useTemplates()
  const allowed = CONTAINS[draft.type]
  const options = (templates.data ?? [])
    .filter((tp) => allowed.includes(tp.type) && tp.id !== selfId)
    .map((tp) => ({ value: tp.id, label: tp.name, hint: tp.serial_prefix, icon: <TypeIcon type={tp.type} size="sm" />, group: t(`enums.typePlural.${tp.type}`),
      disabled: draft.children.some((c) => c.template_id === tp.id) }))
  const update = (i: number, patch: Partial<ChildSlotIn>) =>
    setDraft({ ...draft, children: draft.children.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  return (
    <div className="flex flex-col gap-2">
      {draft.children.length === 0 && <p className="text-[13px] text-muted-foreground">{t('editor.noChildren')}</p>}
      {draft.children.map((c, i) => (
        <div key={i} className={cn('rounded-xl border p-3', issues[i] ? 'border-danger/60' : 'border-border')}>
          <div className="flex gap-2">
            <Combobox className="flex-1" value={c.template_id || null} clearable={false} onChange={(v) => v && update(i, { template_id: v })}
              options={options} placeholder={t('editor.chooseChild')} loading={templates.isPending} />
            <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-danger" onClick={() => setDraft({ ...draft, children: draft.children.filter((_, j) => j !== i) })}>
              <Trash2 />
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label={t('editor.min')}>
              <Input type="number" min={0} value={c.min_count ?? 0} onChange={(e) => update(i, { min_count: Math.max(0, Number(e.target.value)) })} />
            </Field>
            <Field label={t('editor.max')}>
              <Input type="number" min={1} placeholder="∞" value={c.max_count ?? ''} onChange={(e) => update(i, { max_count: e.target.value === '' ? null : Number(e.target.value) })} />
            </Field>
          </div>
          {issues[i] && <p className="mt-1.5 text-xs text-danger">{issues[i]}</p>}
        </div>
      ))}
      <Button variant="outline" className="border-dashed text-muted-foreground" onClick={() => setDraft({ ...draft, children: [...draft.children, { template_id: 0, min_count: 0, max_count: null }] })}>
        <Plus /> {t('editor.addChild')}
      </Button>
    </div>
  )
}

export default function TemplateEditorPage({ mode }: { mode: Mode }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const refresh = useRefreshAll()
  const { can } = useSession()
  const { id } = useParams()
  const [params] = useSearchParams()
  const source = useTemplate(mode === 'create' ? null : Number(id))
  const initialType = (params.get('type') as ItemType) || 'card'
  const [draft, setDraft] = useState<Draft | null>(mode === 'create' ? emptyDraft(initialType) : null)
  const [issues, setIssues] = useState<Issue[]>([])
  const [busy, setBusy] = useState(false)
  const [loadOpen, setLoadOpen] = useState(false)
  const [saveGroupOpen, setSaveGroupOpen] = useState(false)
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reason, setReason] = useState('')
  const workflow = useWorkflowMode('write_templates', mode === 'edit' ? 'template_update' : 'template_create')

  useEffect(() => {
    if (source.data && !draft) setDraft(fromTemplate(source.data, mode, t('editor.copyOf', { name: source.data.name })))
  }, [source.data, draft, mode, t])

  const fieldIssues = useMemo(() => {
    const out: Record<number, string> = {}
    for (const i of issues) {
      const m = /^fields\.(\d+)/.exec(i.field ?? '')
      if (m) out[Number(m[1])] = i.message
    }
    return out
  }, [issues])
  const childIssues = useMemo(() => {
    const out: Record<number, string> = {}
    for (const i of issues) {
      const m = /^children\.(\d+)/.exec(i.field ?? '')
      if (m) out[Number(m[1])] = i.message
    }
    return out
  }, [issues])
  const general = issues.filter((i) => !/^(fields|children)\./.test(i.field ?? ''))

  if (mode !== 'create' && source.isPending) return <Skeleton className="h-[70vh]" />
  if (workflow === 'none') return <EmptyState icon={<Info />} title={t('workflow.notAllowed')} />
  if (!draft) return null

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const payload = () => {
    const children = draft.children.filter((c) => c.template_id)
    if (mode === 'edit') {
      return {
        name: draft.name, serial_prefix: draft.serial_prefix, description: draft.description || null,
        ...(draft.type === 'card' ? { card_type: draft.card_type } : {}),
        fields: toFieldIn(draft.fields), children,
      }
    }
    return {
      type: draft.type, name: draft.name, card_type: draft.type === 'card' ? draft.card_type : null,
      serial_prefix: draft.serial_prefix, description: draft.description || null,
      fields: toFieldIn(draft.fields, false), children,
      ...(mode === 'duplicate' ? { source_template_id: Number(id) } : {}),
    }
  }

  const submit = async () => {
    setBusy(true)
    setIssues([])
    try {
      if (workflow === 'direct') {
        const out = mode === 'edit'
          ? await E.templates.update(Number(id), payload())
          : await E.templates.create(payload() as never)
        await refresh()
        toast.success(mode === 'edit' ? t('editor.saved') : t('editor.created'))
        navigate(`/templates/${out.id}`)
      } else {
        const cr = await E.changeRequests.submit({
          action: mode === 'edit' ? 'template_update' : 'template_create',
          template_id: mode === 'edit' ? Number(id) : null,
          payload: payload(),
          reason,
        })
        await refresh()
        toast.success(t('workflow.submitted'), { description: cr.description })
        navigate(`/change-requests/${cr.id}`)
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setIssues(e.issues.length ? e.issues : [{ message: e.message }])
        setReasonOpen(false)
        toast.error(e.message)
      } else toast.error(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  const loadGroups = (groups: FieldGroup[]) => {
    const forbidden = forbiddenFor(draft.type, draft.card_type)
    const labels = new Set(draft.fields.map((f) => f.label.trim().toLowerCase()))
    const system = new Set(draft.fields.map((f) => f.field_type).filter((ft) => SYSTEM_FIELDS.includes(ft)))
    const added: FieldRow[] = []
    let skipped = 0
    for (const row of groups.flatMap((g) => rowsFromGroup(g.fields))) {
      const label = row.label.trim().toLowerCase()
      if (labels.has(label) || forbidden.includes(row.field_type) || (SYSTEM_FIELDS.includes(row.field_type) && system.has(row.field_type))) {
        skipped++
        continue
      }
      labels.add(label)
      if (SYSTEM_FIELDS.includes(row.field_type)) system.add(row.field_type)
      added.push(row)
    }
    set({ fields: [...draft.fields, ...added] })
    toast.success(t('groups.loaded', { count: added.length }), skipped ? { description: t('groups.skipped', { count: skipped }) } : undefined)
  }

  const title = mode === 'edit' ? t('editor.editTitle', { name: source.data?.name }) : mode === 'duplicate' ? t('editor.duplicateTitle') : t('editor.createTitle')
  const valid = draft.name.trim() && /^[A-Za-z]{3}$/.test(draft.serial_prefix) && draft.fields.every((f) => f.label.trim())

  return (
    <div className="pb-24">
      <Link to={mode === 'create' ? '/templates' : `/templates/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5 rtl:rotate-180" /> {t('common.back')}
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <TypeIcon type={draft.type} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('editor.subtitle')}</p>
        </div>
      </div>

      {general.length > 0 && (
        <div className="mb-6 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          {general.map((g) => <p key={g.message}>{g.message}</p>)}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={t('editor.basics')} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label={t('editor.type')} required>
                <Select value={draft.type} disabled={mode !== 'create'}
                  onChange={(v) => v && set({ type: v, card_type: v === 'card' ? draft.card_type ?? 'house' : null, children: [] })}
                  options={ITEM_TYPES.map((ty) => ({ value: ty, label: t(`enums.type.${ty}`), icon: <TypeIcon type={ty} size="sm" /> }))} />
              </Field>
              {draft.type === 'card' && (
                <Field label={t('editor.cardType')} required hint={draft.card_type === 'commercial' ? t('editor.commercialHint') : t('editor.serialHint')}>
                  <Select value={draft.card_type} onChange={(v) => set({ card_type: v })}
                    options={CARD_TYPES.map((c) => ({ value: c, label: t(`enums.cardType.${c}`) }))} />
                </Field>
              )}
              <Field label={t('editor.name')} required className={draft.type === 'card' ? '' : 'sm:col-span-1'}>
                <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('editor.namePlaceholder')} />
              </Field>
              <Field label={t('editor.prefix')} required hint={t('editor.prefixHint', { example: `${draft.type === 'card' ? 'C' : draft.type === 'assembly' ? 'A' : 'S'}-${draft.serial_prefix.toUpperCase() || 'XXX'}-001` })}>
                <Input className="mono uppercase" dir="ltr" maxLength={3} value={draft.serial_prefix}
                  onChange={(e) => set({ serial_prefix: e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase() })} placeholder="PRB" />
              </Field>
              <Field label={t('common.description')} className="sm:col-span-2">
                <Textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} className="min-h-16" />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('editor.fields')}
              description={t('editor.fieldsHint')}
              actions={<>
                <Button size="sm" variant="ghost" onClick={() => setLoadOpen(true)}><Layers /> {t('groups.loadButton')}</Button>
                {can('write_field_groups') && draft.fields.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setSaveGroupOpen(true)}><Save /> {t('groups.saveButton')}</Button>
                )}
              </>}
            />
            <CardBody>
              <FieldListEditor rows={draft.fields} onChange={(fields) => set({ fields })} itemType={draft.type}
                cardType={draft.card_type} issues={fieldIssues} templateExists={mode === 'edit'} />
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6 xl:sticky xl:top-0 xl:self-start">
          {draft.type !== 'card' && (
            <Card>
              <CardHeader title={t('editor.contents')} description={t('editor.contentsHint', { types: CONTAINS[draft.type].map((x) => t(`enums.typePlural.${x}`)).join(t('common.and')) })} />
              <CardBody>
                <ChildrenEditor draft={draft} setDraft={setDraft} selfId={mode === 'edit' ? Number(id) : undefined} issues={childIssues} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader icon={<Info />} title={t('editor.legendTitle')} />
            <CardBody className="flex flex-col gap-3 text-[13px]">
              {(['fixed', 'choice', 'item'] as const).map((m) => (
                <div key={m} className="flex gap-3">
                  <span className={cn('mt-0.5 h-5 w-8 shrink-0 rounded-md border', m === 'item' ? 'border-transparent bg-subtle' : 'border-border bg-card')} />
                  <div>
                    <div className="font-medium">{t(`enums.fieldMode.${m}`)}</div>
                    <div className="text-muted-foreground">{t(`editor.modeHint.${m}`)}</div>
                  </div>
                </div>
              ))}
              {mode === 'edit' && <p className="rounded-lg bg-warning-soft px-3 py-2">{t('editor.propagates')}</p>}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/85 backdrop-blur-md lg:start-auto">
        <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-2 px-4 py-3 lg:px-8">
          {workflow === 'propose' && <span className="me-auto hidden text-[13px] text-muted-foreground sm:block">{t('workflow.proposeHint')}</span>}
          <Button variant="ghost" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
          {workflow === 'direct' ? (
            <Button variant="primary" loading={busy} disabled={!valid} onClick={() => void submit()}>
              <Save /> {mode === 'edit' ? t('common.save') : t('editor.create')}
            </Button>
          ) : (
            <Button variant="primary" disabled={!valid} onClick={() => setReasonOpen(true)}>
              <GitPullRequestArrow /> {t('workflow.submitForApproval')}
            </Button>
          )}
        </div>
      </div>

      <LoadGroupsDialog open={loadOpen} onOpenChange={setLoadOpen} onLoad={loadGroups} />
      <SaveGroupDialog open={saveGroupOpen} onOpenChange={setSaveGroupOpen} rows={draft.fields} />
      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent size="sm" icon={<GitPullRequestArrow />} title={t('workflow.submitForApproval')} description={t('workflow.proposeHint')}
          footer={<>
            <Button variant="ghost" onClick={() => setReasonOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" loading={busy} disabled={!reason.trim()} onClick={() => void submit()}>{t('workflow.submit')}</Button>
          </>}>
          <Field label={t('workflow.reason')} required>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('workflow.reasonPlaceholder')} autoFocus />
          </Field>
        </DialogContent>
      </Dialog>
    </div>
  )
}
