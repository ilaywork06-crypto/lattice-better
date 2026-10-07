import { Lock, PackagePlus, Pencil } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { Issue } from '@/api/client'
import * as E from '@/api/endpoints'
import { useTemplate, useTemplates } from '@/api/queries'
import type { FieldOut, ItemDetail, ItemType } from '@/api/types'
import { ActionDialog } from '@/components/domain/ActionDialog'
import { FieldInput, type Choice } from '@/components/domain/FieldInput'
import { FieldValue } from '@/components/domain/FieldValue'
import { ItemsMultiPicker } from '@/components/domain/pickers'
import { CardTypeBadge, TypeIcon } from '@/components/domain/badges'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/misc'
import { cn } from '@/lib/cn'
import { ACTION_ONLY_FIELDS } from '@/lib/domain'

type Values = Record<string, unknown>

function choicesOf(f: FieldOut): Choice[] | undefined {
  if (f.mode !== 'choice') return undefined
  const options = (f.config.options as unknown[]) ?? []
  return options.map((o, i) => ({ value: o, label: f.options_display[i] ?? String(o) }))
}

function isEmpty(v: unknown) {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
}

/** Create an item from a template, or edit one's own values. */
export function ItemFormDialog({
  open,
  onOpenChange,
  type,
  templateId: fixedTemplateId,
  item,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  type?: ItemType
  templateId?: number
  item?: ItemDetail
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const editing = !!item
  const [templateId, setTemplateId] = useState<number | null>(item?.template.id ?? fixedTemplateId ?? null)
  const templates = useTemplates(type ? { type } : undefined)
  const template = useTemplate(templateId)
  const [values, setValues] = useState<Values>({})
  const [serial, setSerial] = useState('')
  const [childIds, setChildIds] = useState<number[]>([])
  const [issues, setIssues] = useState<Issue[]>([])

  useEffect(() => {
    if (!open) return
    setTemplateId(item?.template.id ?? fixedTemplateId ?? null)
    setSerial(item?.serial ?? '')
    setChildIds([])
    setIssues([])
  }, [open, item, fixedTemplateId])

  // Initial values: the item's own values (editing) or each list's first entry (creating).
  useEffect(() => {
    if (!template.data) return
    const v: Values = {}
    for (const f of template.data.fields) {
      if (f.mode === 'fixed') continue
      if (item) v[f.key] = item.fields.find((x) => x.key === f.key)?.value ?? null
      else if (f.mode === 'choice') {
        const first = ((f.config.options as unknown[]) ?? [])[0]
        v[f.key] = f.field_type === 'managers' ? (first !== undefined ? [first] : []) : first ?? null
      } else v[f.key] = f.field_type === 'managers' || f.field_type === 'files' ? [] : null
    }
    setValues(v)
  }, [template.data, item])

  const tpl = template.data
  const editable = useMemo(
    () => (tpl?.fields ?? []).filter((f) => f.mode !== 'fixed' && !(editing && ACTION_ONLY_FIELDS.includes(f.field_type))),
    [tpl, editing],
  )
  const fixed = (tpl?.fields ?? []).filter((f) => f.mode === 'fixed')
  const missingRequired = editable.filter((f) => f.required && isEmpty(values[f.key]))

  const payload = () => {
    if (!tpl) return null
    if (editing) {
      const changed: Values = {}
      for (const f of editable) {
        const before = item!.fields.find((x) => x.key === f.key)?.value ?? null
        if (JSON.stringify(before) !== JSON.stringify(values[f.key] ?? null)) changed[f.key] = values[f.key] ?? null
      }
      return { values: changed, ...(serial && serial !== item!.serial ? { serial } : {}) }
    }
    const set: Values = {}
    for (const f of editable) if (!isEmpty(values[f.key])) set[f.key] = values[f.key]
    return { template_id: tpl.id, values: set, serial: serial.trim() || null, child_ids: childIds }
  }

  const issueFor = (key: string) => issues.find((i) => i.field === key)?.message
  const templateOptions = (templates.data ?? []).map((tp) => ({
    value: tp.id,
    label: tp.name,
    hint: `${tp.serial_prefix} · ${t('templates.units', { count: tp.counts.total })}`,
    icon: <TypeIcon type={tp.type} size="sm" />,
    group: t(`enums.typePlural.${tp.type}`),
  }))

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      icon={editing ? <Pencil /> : <PackagePlus />}
      title={editing ? t('itemForm.editTitle', { name: item!.name }) : t('itemForm.createTitle')}
      description={editing ? <bdi className="mono">{item!.serial}</bdi> : t('itemForm.createHint')}
      permission="write_items"
      action={editing ? 'update' : 'create'}
      itemId={item?.id}
      payload={payload}
      apply={() => {
        const p = payload()!
        return editing ? E.items.update(item!.id, p) : E.items.create(p as never)
      }}
      submitLabel={editing ? t('common.save') : t('itemForm.create')}
      successMessage={editing ? t('itemForm.saved') : t('itemForm.created')}
      disabled={!tpl || (!editing && missingRequired.length > 0)}
      onIssues={setIssues}
      onDone={(result) => {
        if (!editing && result && typeof result === 'object' && 'serial' in result) {
          navigate(`/items/${(result as ItemDetail).id}`)
        }
      }}
    >
      {!editing && !fixedTemplateId && (
        <Field label={t('itemForm.template')} required>
          <Combobox value={templateId} onChange={setTemplateId} options={templateOptions} clearable={false}
            placeholder={t('itemForm.chooseTemplate')} loading={templates.isPending}
            empty={t('itemForm.noTemplates')} />
        </Field>
      )}
      {templateId && !tpl && <Skeleton className="h-40" />}
      {tpl && (
        <>
          {!editing && fixedTemplateId && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
              <TypeIcon type={tpl.type} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{tpl.name}</div>
                <div className="text-xs text-muted-foreground">{tpl.description}</div>
              </div>
              <CardTypeBadge cardType={tpl.card_type} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {editable.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                required={f.required}
                error={issueFor(f.key)}
                className={cn(['description', 'files', 'managers'].includes(f.field_type) && 'sm:col-span-2')}
                aside={f.mode === 'choice' ? <Badge tone="outline">{t('enums.fieldMode.choice')}</Badge> : undefined}
              >
                <FieldInput
                  field={f}
                  value={values[f.key]}
                  onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                  choices={choicesOf(f)}
                  holdsTemplateId={tpl.id}
                  invalid={!!issueFor(f.key)}
                  initialFiles={item?.fields.find((x) => x.key === f.key)?.display as never}
                />
              </Field>
            ))}
            <Field
              label={t('itemForm.serial')}
              hint={editing ? t('itemForm.serialEditHint') : t('itemForm.serialHint', { next: tpl.next_serial })}
              error={issues.find((i) => !i.field && /serial/i.test(i.message))?.message}
            >
              <Input className="mono" dir="ltr" value={serial} placeholder={tpl.next_serial}
                onChange={(e) => setSerial(e.target.value.toUpperCase())} />
            </Field>
          </div>

          {!editing && tpl.children.length > 0 && (
            <Field label={t('itemForm.contents')} hint={t('itemForm.contentsHint', {
              names: tpl.children.map((c) => c.template.name).join(', '),
            })}>
              <ItemsMultiPicker value={childIds} onChange={setChildIds}
                query={{ fits_in_template: tpl.id, include_destroyed: false }} />
            </Field>
          )}

          {fixed.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Lock className="size-3.5" /> {t('itemForm.fromTemplate')}
              </div>
              <div className="grid gap-x-6 gap-y-2 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-2">
                {fixed.map((f) => (
                  <div key={f.key} className="min-w-0 text-sm">
                    <div className="text-xs text-muted-foreground">{f.label}</div>
                    <FieldValue fieldType={f.field_type} value={f.fixed_value ?? (f.files.length ? f.files : null)}
                      display={f.field_type === 'files' ? f.files : f.fixed_display} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {issues.filter((i) => !i.field).map((i) => (
            <p key={i.message} className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{i.message}</p>
          ))}
        </>
      )}
    </ActionDialog>
  )
}
