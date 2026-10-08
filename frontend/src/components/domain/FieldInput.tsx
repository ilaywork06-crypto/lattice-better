import { File as FileIcon, Paperclip, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as E from '@/api/endpoints'
import type { DocumentOut, FieldType, ItemState } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/controls'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ITEM_STATES } from '@/lib/domain'
import { applyPattern, formatBytes } from '@/lib/format'
import { CatalogPicker, ItemPicker, LocationPicker, ManagersPicker, UserPicker } from './pickers'

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))

export interface FieldShape {
  field_type: FieldType
  config?: Record<string, unknown>
}

export interface Choice {
  value: unknown
  label: string
}

/**
 * The input for one field value, whatever its type. ``choices`` (a template's
 * list) turns it into a pick-from-the-list control; otherwise each type gets
 * its natural editor. Values are what the API stores (ids for references).
 */
export function FieldInput({
  field,
  value,
  onChange,
  choices,
  holdsTemplateId,
  invalid,
  id,
  disabled,
  initialFiles,
  required,
}: {
  required?: boolean
  field: FieldShape
  value: unknown
  onChange: (v: unknown) => void
  choices?: Choice[]
  holdsTemplateId?: number
  invalid?: boolean
  id?: string
  disabled?: boolean
  initialFiles?: DocumentOut[]
}) {
  const { t } = useTranslation()
  const config = field.config ?? {}
  const ft = field.field_type
  const common = { id, disabled, 'aria-invalid': invalid || undefined }

  if (choices) {
    if (ft === 'managers') {
      const only = choices.map((c) => c.value as number)
      return <ManagersPicker value={(value as number[]) ?? []} onChange={onChange} only={only} invalid={invalid} disabled={disabled} />
    }
    return (
      <Select
        id={id}
        value={choices.findIndex((c) => c.value === value) >= 0 ? String(choices.findIndex((c) => c.value === value)) : null}
        onChange={(i) => onChange(i === null ? null : choices[Number(i)].value)}
        options={choices.map((c, i) => ({ value: String(i), label: c.label }))}
        placeholder={t('fieldInput.choose')}
        disabled={disabled}
      />
    )
  }

  switch (ft) {
    case 'text':
      return <Input {...common} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'description': {
      const min = Number(config.min_length ?? 8)
      const visible = String(value ?? '').replace(/\s/g, '').length
      return (
        <div className="relative">
          <Textarea {...common} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
          <span className={`absolute bottom-2 end-3 text-[11px] tabular-nums ${visible && visible < min ? 'text-danger' : 'text-muted-foreground'}`}>
            {visible}/{min}
          </span>
        </div>
      )
    }
    case 'string':
    case 'serial_string': {
      const pattern = config.pattern as string | undefined
      const text = (value as string) ?? ''
      const formatted = pattern && text ? applyPattern(pattern, text) : null
      return (
        <div>
          <Input {...common} className="mono" dir="ltr" value={text} placeholder={pattern ?? ''}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => formatted && formatted !== text && onChange(formatted)} />
          {pattern && text && !formatted && (
            <p className="mt-1 text-xs text-danger">{t('fieldInput.pattern', { pattern })}</p>
          )}
        </div>
      )
    }
    case 'link':
      return <Input {...common} type="url" dir="ltr" placeholder="https://" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'enum':
      return (
        <Select id={id} value={(value as string) ?? null} onChange={onChange} disabled={disabled}
          noneLabel={required ? undefined : t('common.none')} placeholder={t('fieldInput.choose')}
          options={((config.options as string[]) ?? []).map((o) => ({ value: o, label: o }))} />
      )
    case 'letter':
      return (
        <Select id={id} value={(value as string) ?? null} onChange={onChange} disabled={disabled}
          noneLabel={required ? undefined : t('common.none')} placeholder={t('fieldInput.choose')}
          options={LETTERS.map((l) => ({ value: l, label: l }))} />
      )
    case 'date':
      return <Input {...common} type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />
    case 'integer':
    case 'quantity':
      return (
        <Input {...common} type="number" step={1} min={ft === 'quantity' ? 1 : undefined} className="tabular-nums"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
      )
    case 'decimal':
      return (
        <Input {...common} type="number" step="any" className="tabular-nums"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
      )
    case 'boolean':
      return (
        <Segmented
          value={value === true ? 'yes' : value === false ? 'no' : 'none'}
          onChange={(v) => onChange(v === 'yes' ? true : v === 'no' ? false : null)}
          options={[
            { value: 'yes', label: t('common.yes') },
            { value: 'no', label: t('common.no') },
            { value: 'none', label: '—' },
          ]}
        />
      )
    case 'industry':
    case 'project':
    case 'team':
      return <CatalogPicker id={id} category={ft} value={value as number} onChange={onChange} invalid={invalid} disabled={disabled} />
    case 'managers':
      return <ManagersPicker value={(value as number[]) ?? []} onChange={onChange} invalid={invalid} disabled={disabled} />
    case 'responsible':
      return <UserPicker id={id} value={value as number} onChange={onChange} invalid={invalid} disabled={disabled} />
    case 'location':
      return <LocationPicker id={id} value={value as number} onChange={onChange} invalid={invalid} disabled={disabled} />
    case 'parent':
      return (
        <ItemPicker id={id} value={value as number} onChange={onChange} invalid={invalid} disabled={disabled}
          query={holdsTemplateId ? { holds_template: holdsTemplateId } : {}} placeholder={t('pickers.container')} />
      )
    case 'status':
      return (
        <Select id={id} value={(value as ItemState) ?? null} onChange={onChange} disabled={disabled}
          options={ITEM_STATES.map((s) => ({ value: s, label: t(`enums.state.${s}`) }))} />
      )
    case 'files':
      return <FilesInput value={(value as number[]) ?? []} onChange={onChange} initial={initialFiles} disabled={disabled} />
  }
}

/** Upload files now (staged on the server) and keep their ids as the value. */
export function FilesInput({ value, onChange, initial, disabled }: {
  value: number[]; onChange: (v: number[]) => void; initial?: DocumentOut[]; disabled?: boolean
}) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const latest = useRef(value)
  latest.current = value
  const [docs, setDocs] = useState<Map<number, { name: string; size?: number | null }>>(
    () => new Map((initial ?? []).map((d) => [d.id, { name: d.name, size: d.size_bytes }])),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    const uploaded: DocumentOut[] = []
    try {
      for (const f of Array.from(files)) uploaded.push(await E.uploads.stage(f))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      // Keep whatever did upload, added to the value as it is *now* (a chip may
      // have been removed while the upload ran).
      if (uploaded.length) {
        setDocs((m) => new Map([...m, ...uploaded.map((d) => [d.id, { name: d.name, size: d.size_bytes }] as const)]))
        onChange([...latest.current, ...uploaded.map((d) => d.id)])
      }
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span key={id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-xs">
              <FileIcon className="size-3.5 text-muted-foreground" />
              {docs.get(id)?.name ?? `#${id}`}
              {docs.get(id)?.size != null && <span className="text-muted-foreground">{formatBytes(docs.get(id)!.size)}</span>}
              {!disabled && (
                <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} className="text-muted-foreground hover:text-danger">
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <input ref={input} type="file" multiple hidden onChange={(e) => void add(e.target.files)} />
      <Button type="button" size="sm" variant="outline" className="self-start" disabled={disabled} loading={busy} onClick={() => input.current?.click()}>
        {value.length ? <Paperclip /> : <Upload />} {t('fieldInput.attach')}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
