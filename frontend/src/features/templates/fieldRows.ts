// Field definitions as edited in the UI, and conversions to and from the API.
import type { FieldGroupField, FieldIn, FieldOut, FieldType } from '@/api/types'

export interface FieldRow extends FieldIn {
  config: Record<string, unknown>
  required: boolean
  mode: NonNullable<FieldIn['mode']>
  uid: number
  expanded: boolean
  /** Files already on an existing fixed files field (edit mode). */
  files?: FieldOut['files']
  /** Readable names of list options / the fixed value (from the server). */
  optionsDisplay?: string[]
  fixedDisplay?: unknown
}

let uid = 0
const copy = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T))

export function newRow(ft: FieldType, label: string): FieldRow {
  return {
    uid: ++uid, expanded: true, id: null, key: null, label, field_type: ft, mode: 'item', required: false,
    config: ft === 'description' ? { min_length: 8 } : {}, fixed_value: null,
  }
}

export function rowsFromTemplate(fields: FieldOut[], asNew = false): FieldRow[] {
  return fields.map((f) => ({
    uid: ++uid, expanded: false, id: asNew ? null : f.id, key: f.key, label: f.label,
    field_type: f.field_type, mode: f.mode, required: f.required, config: copy(f.config ?? {}),
    fixed_value: copy(f.fixed_value ?? null), files: f.files,
    optionsDisplay: f.options_display, fixedDisplay: f.fixed_display,
    copy_files_from: asNew && f.field_type === 'files' && f.mode === 'fixed' && f.files.length ? f.id : null,
  }))
}

export function rowsFromGroup(fields: FieldGroupField[]): FieldRow[] {
  return fields.map((f) => ({
    uid: ++uid, expanded: false, id: null, key: f.key, label: f.label, field_type: f.field_type,
    mode: f.mode, required: f.required, config: copy(f.config ?? {}), fixed_value: copy(f.fixed_value ?? null),
    optionsDisplay: f.options_display, fixedDisplay: f.fixed_display,
  }))
}

export function toFieldIn(rows: FieldRow[], keepIds = true): FieldIn[] {
  return rows.map((f) => ({
    id: keepIds ? (f.id ?? null) : null,
    key: f.key ?? null,
    label: f.label.trim(),
    field_type: f.field_type,
    mode: f.mode,
    required: f.required,
    config: f.config,
    fixed_value: f.mode === 'fixed' ? f.fixed_value : null,
    ...(f.copy_files_from ? { copy_files_from: f.copy_files_from } : {}),
  }))
}
