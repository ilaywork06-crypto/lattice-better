import { Command } from 'cmdk'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

export interface ComboOption<V extends string | number = number> {
  value: V
  label: string
  hint?: string
  icon?: ReactNode
  keywords?: string[]
  group?: string
  disabled?: boolean
}

interface BaseProps<V extends string | number> {
  options: ComboOption<V>[]
  placeholder?: string
  searchPlaceholder?: string
  empty?: ReactNode
  disabled?: boolean
  className?: string
  loading?: boolean
  /** Server-side search: called with the typed text (options are not filtered locally). */
  onSearch?: (text: string) => void
  id?: string
}

function OptionList<V extends string | number>({
  options,
  isSelected,
  onPick,
  searchPlaceholder,
  empty,
  loading,
  onSearch,
}: BaseProps<V> & { isSelected: (v: V) => boolean; onPick: (v: V) => void }) {
  const { t } = useTranslation()
  const groups = useMemo(() => {
    const out = new Map<string, ComboOption<V>[]>()
    for (const o of options) {
      const g = o.group ?? ''
      if (!out.has(g)) out.set(g, [])
      out.get(g)!.push(o)
    }
    return [...out.entries()]
  }, [options])
  return (
    <Command shouldFilter={!onSearch} className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 text-muted-foreground" />
        <Command.Input
          autoFocus
          onValueChange={onSearch}
          placeholder={searchPlaceholder ?? t('common.search')}
          className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>
      <Command.List className="max-h-72 overflow-y-auto p-1">
        {loading ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : (
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
            {empty ?? t('common.noResults')}
          </Command.Empty>
        )}
        {groups.map(([group, opts]) => (
          <Command.Group
            key={group}
            heading={group || undefined}
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {opts.map((o) => (
              <Command.Item
                key={String(o.value)}
                value={`${o.label} ${o.hint ?? ''} ${(o.keywords ?? []).join(' ')} #${o.value}`}
                disabled={o.disabled}
                onSelect={() => onPick(o.value)}
                className="flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm outline-none data-[selected=true]:bg-muted data-[disabled=true]:opacity-50 [&_svg]:size-4"
              >
                {o.icon}
                <div className="min-w-0 flex-1">
                  <div className="truncate">{o.label}</div>
                  {o.hint && <div className="truncate text-xs text-muted-foreground">{o.hint}</div>}
                </div>
                {isSelected(o.value) && <Check className="text-primary" />}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command>
  )
}

const trigger =
  'flex min-h-9 w-full items-center gap-2 rounded-lg border border-input bg-card px-3 py-1 text-start text-sm outline-none transition-colors ' +
  'focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-60 aria-invalid:border-danger'

/** Searchable single select. */
export function Combobox<V extends string | number>({
  value,
  onChange,
  clearable = true,
  invalid,
  ...props
}: BaseProps<V> & {
  value: V | null | undefined
  onChange: (v: V | null) => void
  clearable?: boolean
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = props.options.find((o) => o.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={props.disabled}>
        <button type="button" id={props.id} aria-invalid={invalid || undefined} className={cn(trigger, props.className)}>
          {selected?.icon}
          <span className={cn('flex-1 truncate', !selected && 'text-muted-foreground/80')}>
            {selected ? selected.label : value != null ? `#${value}` : props.placeholder}
          </span>
          {clearable && value != null && !props.disabled ? (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronsUpDown className="size-4 opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[max(var(--radix-popover-trigger-width),18rem)] p-0">
        <OptionList
          {...props}
          isSelected={(v) => v === value}
          onPick={(v) => {
            onChange(v)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/** Searchable multi select, shown as removable chips. */
export function MultiCombobox<V extends string | number>({
  value,
  onChange,
  invalid,
  ...props
}: BaseProps<V> & { value: V[]; onChange: (v: V[]) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false)
  const chosen = value.map((v) => props.options.find((o) => o.value === v) ?? { value: v, label: `#${v}` })
  const toggle = (v: V) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={props.disabled}>
        <button type="button" id={props.id} aria-invalid={invalid || undefined} className={cn(trigger, 'flex-wrap py-1.5', props.className)}>
          {chosen.length === 0 && <span className="flex-1 text-muted-foreground/80">{props.placeholder}</span>}
          {chosen.map((o) => (
            <span key={String(o.value)} className="inline-flex items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5 text-xs">
              {o.label}
              {!props.disabled && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(o.value)
                  }}
                  className="rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </span>
              )}
            </span>
          ))}
          <ChevronsUpDown className="ms-auto size-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[max(var(--radix-popover-trigger-width),18rem)] p-0">
        <OptionList {...props} isSelected={(v) => value.includes(v)} onPick={toggle} />
      </PopoverContent>
    </Popover>
  )
}
