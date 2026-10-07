import { Loader2 } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-lg bg-subtle', className)} {...props} />
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-muted-foreground', className)} />
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-sans text-[11px] font-medium text-muted-foreground', className)}>
      {children}
    </kbd>
  )
}

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return <div className={cn(vertical ? 'w-px self-stretch' : 'h-px w-full', 'bg-border', className)} />
}

const avatarHues = [265, 200, 155, 25, 330, 60, 290, 180]

export function Avatar({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  const hue = avatarHues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarHues.length]
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-semibold text-white', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, oklch(0.68 0.15 ${hue}), oklch(0.55 0.17 ${hue + 30}))`,
      }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  )
}

export function Progress({
  value,
  max = 100,
  tone = 'primary',
  className,
}: {
  value: number
  max?: number
  tone?: 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const colors = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-subtle', className)}>
      <div className={cn('h-full rounded-full transition-all', colors[tone])} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-16', className)}>
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-border bg-card text-muted-foreground shadow-soft [&_svg]:size-5">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Stat({
  label,
  value,
  icon,
  hint,
  tone = 'neutral',
  onClick,
}: {
  label: ReactNode
  value: ReactNode
  icon?: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  onClick?: () => void
}) {
  const tones = {
    neutral: 'bg-muted text-muted-foreground',
    primary: 'bg-primary-soft text-primary-soft-foreground',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-[oklch(0.55_0.13_65)] dark:text-warning',
    danger: 'bg-danger-soft text-danger',
    info: 'bg-info-soft text-info',
  }
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'card-surface flex flex-col gap-3 p-4 text-start',
        onClick && 'transition-all hover:-translate-y-px hover:shadow-pop',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {icon && <span className={cn('grid size-8 place-items-center rounded-lg [&_svg]:size-4', tones[tone])}>{icon}</span>}
      </div>
      <div className="text-[28px] font-semibold leading-none tracking-tight tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Comp>
  )
}
