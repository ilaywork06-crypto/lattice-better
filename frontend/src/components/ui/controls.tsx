import { Check, Minus } from 'lucide-react'
import { Checkbox as C, Switch as S, ToggleGroup as TG } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Switch({
  checked,
  onChange,
  disabled,
  id,
  size = 'md',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  id?: string
  size?: 'sm' | 'md'
}) {
  return (
    <S.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full bg-input transition-colors data-[state=checked]:bg-primary disabled:opacity-50',
        size === 'sm' ? 'h-4 w-7' : 'h-5 w-9',
      )}
    >
      <S.Thumb
        className={cn(
          'block rounded-full bg-white shadow transition-transform',
          size === 'sm'
            ? 'size-3 translate-x-0.5 data-[state=checked]:translate-x-3.5 rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-3.5'
            : 'size-4 translate-x-0.5 data-[state=checked]:translate-x-[18px] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[18px]',
        )}
      />
    </S.Root>
  )
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  id,
  className,
}: {
  checked: boolean | 'indeterminate'
  onChange: (v: boolean) => void
  disabled?: boolean
  id?: string
  className?: string
}) {
  return (
    <C.Root
      id={id}
      checked={checked}
      onCheckedChange={(v) => onChange(v === true)}
      disabled={disabled}
      className={cn(
        'grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-input bg-card transition-colors',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <C.Indicator>
        {checked === 'indeterminate' ? <Minus className="size-3.5" /> : <Check className="size-3.5" strokeWidth={3} />}
      </C.Indicator>
    </C.Root>
  )
}

/** A segmented control (one of a few options). */
export function Segmented<V extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: {
  value: V
  onChange: (v: V) => void
  options: { value: V; label: ReactNode; icon?: ReactNode }[]
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <TG.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as V)}
      className={cn('inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5', className)}
    >
      {options.map((o) => (
        <TG.Item
          key={o.value}
          value={o.value}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 font-medium text-muted-foreground transition-all [&_svg]:size-3.5',
            'hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-soft',
            size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
          )}
        >
          {o.icon}
          {o.label}
        </TG.Item>
      ))}
    </TG.Root>
  )
}
