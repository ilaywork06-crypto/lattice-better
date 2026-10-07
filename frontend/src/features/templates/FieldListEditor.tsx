import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, GripVertical, Lock, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCatalog, useLocations, useUsers } from '@/api/queries'
import type { CardType, FieldMode, FieldType, ItemType } from '@/api/types'
import { FieldInput } from '@/components/domain/FieldInput'
import { FieldValue } from '@/components/domain/FieldValue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented, Switch } from '@/components/ui/controls'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { cn } from '@/lib/cn'
import { allowedModes, FIELD_GROUPS, FIELD_ICON, forbiddenFor, SYSTEM_FIELDS } from '@/lib/domain'
import { newRow, type FieldRow } from './fieldRows'

const MODE_TONE: Record<FieldMode, string> = {
  fixed: 'border-border bg-card',
  choice: 'border-border bg-card',
  item: 'border-transparent bg-subtle',
}

function ModeBadge({ mode }: { mode: FieldMode }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground', MODE_TONE[mode])}>
      {mode === 'fixed' && <Lock className="size-3" />}
      {mode === 'choice' && <ChevronDown className="size-3" />}
      {t(`enums.fieldMode.${mode}`)}
    </span>
  )
}

/** Editor for a list of values (enum options or a list field's choices). */
function OptionsEditor({ row, onChange }: { row: FieldRow; onChange: (options: unknown[]) => void }) {
  const { t } = useTranslation()
  const options = (row.config.options as unknown[]) ?? []
  const [draft, setDraft] = useState<unknown>(row.field_type === 'managers' ? [] : null)
  const [text, setText] = useState('')
  const free = row.field_type === 'enum' || ['text', 'string', 'serial_string', 'letter', 'link', 'description'].includes(row.field_type)
  const label = (o: unknown, i: number) =>
    row.optionsDisplay?.[i] && JSON.stringify((row.config.options as unknown[])[i]) === JSON.stringify(o) ? row.optionsDisplay[i] : String(o)

  const add = (v: unknown) => {
    const values = Array.isArray(v) ? v : [v]
    const next = [...options]
    for (const x of values) if (x !== null && x !== '' && !next.some((o) => JSON.stringify(o) === JSON.stringify(x))) next.push(x)
    onChange(next)
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {options.length === 0 && <span className="text-xs text-muted-foreground">{t('editor.noOptions')}</span>}
        {options.map((o, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs">
            {i === 0 && row.mode === 'choice' && <Badge tone="primary" className="px-1.5 py-0 text-[10px]">{t('editor.default')}</Badge>}
            <OptionLabel row={row} value={o} fallback={label(o, i)} />
            <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger">
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      {free ? (
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('editor.addOption')}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(text.trim()); setText('') } }} />
          <Button type="button" size="md" onClick={() => { add(text.trim()); setText('') }} disabled={!text.trim()}><Plus /></Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex-1">
            <FieldInput field={{ field_type: row.field_type, config: row.config }} value={draft} onChange={setDraft} />
          </div>
          <Button type="button" onClick={() => { add(draft); setDraft(row.field_type === 'managers' ? [] : null) }}
            disabled={draft === null || (Array.isArray(draft) && !draft.length)}><Plus /></Button>
        </div>
      )}
    </div>
  )
}

/** Shows a stored option by name (looks the id up through the same pickers' data). */
function OptionLabel({ row, value, fallback }: { row: FieldRow; value: unknown; fallback: string }) {
  if (['industry', 'project', 'team', 'managers', 'responsible', 'location'].includes(row.field_type)) {
    return <LookupLabel fieldType={row.field_type} id={value as number} fallback={fallback} />
  }
  if (row.field_type === 'status') return <FieldValue fieldType="status" value={value} display={value} />
  return <span>{fallback}</span>
}


function LookupLabel({ fieldType, id, fallback }: { fieldType: FieldType; id: number; fallback: string }) {
  const catalog = useCatalog()
  const users = useUsers()
  const locations = useLocations()
  let name: string | undefined
  if (['industry', 'project', 'team'].includes(fieldType)) name = catalog.data?.find((o) => o.id === id)?.value
  else if (fieldType === 'location') name = locations.data?.find((l) => l.id === id)?.name
  else name = users.data?.find((u) => u.id === id)?.full_name
  return <span>{name ?? fallback}</span>
}

function RowEditor({
  row,
  index,
  onChange,
  onRemove,
  error,
  itemType,
  templateExists,
}: {
  row: FieldRow
  index: number
  onChange: (r: FieldRow) => void
  onRemove: () => void
  error?: string
  itemType: ItemType
  templateExists: boolean
}) {
  const { t } = useTranslation()
  const sortable = useSortable({ id: row.uid })
  const Icon = FIELD_ICON[row.field_type]
  const modes = allowedModes(row.field_type)
  const set = (patch: Partial<FieldRow>) => onChange({ ...row, ...patch })
  const setConfig = (patch: Record<string, unknown>) => set({ config: { ...row.config, ...patch } })

  return (
    <div
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className={cn(
        'rounded-xl border bg-card transition-shadow',
        error ? 'border-danger/60' : 'border-border',
        sortable.isDragging && 'relative z-10 shadow-pop',
      )}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <button type="button" {...sortable.attributes} {...sortable.listeners} className="cursor-grab rounded p-1 text-muted-foreground/60 hover:bg-muted active:cursor-grabbing" aria-label={t('editor.reorder')}>
          <GripVertical className="size-4" />
        </button>
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-3.5" /></span>
        <button type="button" onClick={() => set({ expanded: !row.expanded })} className="flex min-w-0 flex-1 items-center gap-2 text-start">
          <span className="truncate text-sm font-medium">{row.label || <span className="text-muted-foreground">{t('editor.untitled')}</span>}</span>
          {row.required && <span className="text-danger">*</span>}
          <span className="hidden text-xs text-muted-foreground sm:inline">{t(`enums.fieldType.${row.field_type}`)}</span>
          <span className="ms-auto"><ModeBadge mode={row.mode} /></span>
        </button>
        <span className="w-6 text-center text-xs text-muted-foreground tabular-nums">{index + 1}</span>
        <Button type="button" size="icon-sm" variant="ghost" onClick={() => set({ expanded: !row.expanded })} aria-label={t('common.edit')}>
          <ChevronDown className={cn('transition-transform', row.expanded && 'rotate-180')} />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-danger" onClick={onRemove} aria-label={t('common.remove')}>
          <Trash2 />
        </Button>
      </div>
      {error && <p className="px-4 pb-2 text-xs text-danger">{error}</p>}
      {row.expanded && (
        <div className="grid gap-4 border-t border-border px-4 py-4 sm:grid-cols-2">
          <Field label={t('editor.label')} required>
            <Input value={row.label} onChange={(e) => set({ label: e.target.value })} autoFocus={!row.label} />
          </Field>
          <Field label={t('editor.mode')} hint={t(`editor.modeHint.${row.mode}`)}>
            <Segmented
              value={row.mode}
              onChange={(mode) => set({ mode, fixed_value: mode === 'fixed' ? row.fixed_value : null })}
              options={modes.map((m) => ({ value: m, label: t(`enums.fieldMode.${m}`) }))}
            />
          </Field>
          <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
            <Switch checked={row.required} onChange={(v) => set({ required: v })} />
            {t('editor.required')}
            <span className="text-xs text-muted-foreground">— {t(`editor.requiredHint.${row.mode}`)}</span>
          </label>

          {(row.field_type === 'string' || row.field_type === 'serial_string') && (
            <Field label={t('editor.pattern')} hint={t('editor.patternHint')}>
              <Input className="mono" dir="ltr" value={(row.config.pattern as string) ?? ''} placeholder="XX-#####"
                onChange={(e) => setConfig({ pattern: e.target.value || undefined })} />
            </Field>
          )}
          {row.field_type === 'description' && (
            <Field label={t('editor.minLength')}>
              <Input type="number" min={1} value={String(row.config.min_length ?? 8)} onChange={(e) => setConfig({ min_length: Number(e.target.value) })} />
            </Field>
          )}
          {(row.field_type === 'enum' || row.mode === 'choice') && (
            <Field className="sm:col-span-2" label={row.field_type === 'enum' ? t('editor.enumValues') : t('editor.choiceValues')}
              hint={row.mode === 'choice' ? t('editor.choiceHint') : undefined}>
              <OptionsEditor row={row} onChange={(options) => setConfig({ options })} />
            </Field>
          )}
          {row.mode === 'fixed' && row.field_type !== 'files' && (
            <Field className="sm:col-span-2" label={t('editor.fixedValue')} hint={t('editor.fixedHint')} required={row.required}>
              <FieldInput field={{ field_type: row.field_type, config: row.config }} value={row.fixed_value} onChange={(v) => set({ fixed_value: v })} />
            </Field>
          )}
          {row.mode === 'fixed' && row.field_type === 'files' && (
            <p className="rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground sm:col-span-2">
              {templateExists && row.id ? t('editor.filesOnTemplate') : t('editor.filesAfterSave')}
              {row.copy_files_from ? ` ${t('editor.filesCopied', { count: row.files?.length ?? 0 })}` : ''}
            </p>
          )}
          {row.field_type === 'parent' && itemType !== 'setup' && (
            <p className="rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground sm:col-span-2">{t('editor.parentHint')}</p>
          )}
        </div>
      )}
    </div>
  )
}

export function FieldListEditor({
  rows,
  onChange,
  itemType,
  cardType,
  issues,
  templateExists = false,
}: {
  rows: FieldRow[]
  onChange: (rows: FieldRow[]) => void
  itemType: ItemType
  cardType?: CardType | null
  issues?: Record<number, string>
  templateExists?: boolean
}) {
  const { t } = useTranslation()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const forbidden = forbiddenFor(itemType, cardType)
  const usedSystem = new Set(rows.map((r) => r.field_type).filter((ft) => SYSTEM_FIELDS.includes(ft)))

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = rows.findIndex((r) => r.uid === e.active.id)
    const to = rows.findIndex((r) => r.uid === e.over!.id)
    onChange(arrayMove(rows, from, to))
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
          {rows.map((row, i) => (
            <RowEditor
              key={row.uid}
              row={row}
              index={i}
              itemType={itemType}
              templateExists={templateExists}
              error={issues?.[i]}
              onChange={(r) => onChange(rows.map((x) => (x.uid === r.uid ? r : x)))}
              onRemove={() => onChange(rows.filter((x) => x.uid !== row.uid))}
            />
          ))}
        </SortableContext>
      </DndContext>
      <Menu>
        <MenuTrigger asChild>
          <Button type="button" variant="outline" className="h-11 border-dashed text-muted-foreground"><Plus /> {t('editor.addField')}</Button>
        </MenuTrigger>
        <MenuContent align="start" className="max-h-[60vh] w-64 overflow-y-auto">
          {FIELD_GROUPS.map((g, gi) => (
            <div key={g.group}>
              {gi > 0 && <MenuSeparator />}
              <MenuLabel>{t(`editor.groups.${g.group}`)}</MenuLabel>
              {g.types.map((ft) => {
                const Icon = FIELD_ICON[ft]
                const disabled = forbidden.includes(ft) || usedSystem.has(ft)
                return (
                  <MenuItem key={ft} icon={<Icon />} disabled={disabled}
                    onSelect={() => onChange([...rows.map((r) => ({ ...r, expanded: false })), newRow(ft, SYSTEM_FIELDS.includes(ft) ? t(`enums.fieldType.${ft}`) : '')])}>
                    {t(`enums.fieldType.${ft}`)}
                  </MenuItem>
                )
              })}
            </div>
          ))}
        </MenuContent>
      </Menu>
    </div>
  )
}
