import { Check, ChevronDown } from 'lucide-react'
import { Select as S } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface Option<V extends string | number = string> {
  value: V
  label: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

const EMPTY = '__none__'

/** A styled single select. ``value === null`` shows the placeholder (or "none"). */
export function Select<V extends string | number>({
  value,
  onChange,
  options,
  placeholder,
  noneLabel,
  className,
  disabled,
  size = 'md',
  id,
}: {
  value: V | null | undefined
  onChange: (value: V | null) => void
  options: Option<V>[]
  placeholder?: string
  noneLabel?: string
  className?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  id?: string
}) {
  const key = (v: V) => String(v)
  const current = value === null || value === undefined ? (noneLabel ? EMPTY : '') : key(value)
  return (
    <S.Root
      value={current}
      disabled={disabled}
      onValueChange={(raw) => {
        if (raw === EMPTY) return onChange(null)
        const opt = options.find((o) => key(o.value) === raw)
        onChange(opt ? opt.value : null)
      }}
    >
      <S.Trigger
        id={id}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-start text-sm outline-none transition-colors',
          'focus:border-primary focus:ring-3 focus:ring-ring disabled:opacity-60 data-[placeholder]:text-muted-foreground/80 [&>span]:truncate',
          size === 'sm' ? 'h-8 text-[13px]' : 'h-9',
          className,
        )}
      >
        <S.Value placeholder={placeholder} />
        <S.Icon>
          <ChevronDown className="size-4 opacity-60" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          className="z-[60] max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-pop animate-in"
        >
          <S.Viewport>
            {noneLabel && <Item value={EMPTY} label={<span className="text-muted-foreground">{noneLabel}</span>} />}
            {options.map((o) => (
              <Item key={key(o.value)} value={key(o.value)} label={o.label} hint={o.hint} icon={o.icon} disabled={o.disabled} />
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  )
}

function Item({ value, label, hint, icon, disabled }: { value: string; label: ReactNode; hint?: ReactNode; icon?: ReactNode; disabled?: boolean }) {
  return (
    <S.Item
      value={value}
      disabled={disabled}
      className="relative flex cursor-default select-none items-center gap-2 rounded-lg py-1.5 pe-8 ps-2.5 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50 [&_svg]:size-4"
    >
      {icon}
      <div className="min-w-0">
        <S.ItemText>{label}</S.ItemText>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <S.ItemIndicator className="absolute end-2">
        <Check className="size-4 text-primary" />
      </S.ItemIndicator>
    </S.Item>
  )
}
