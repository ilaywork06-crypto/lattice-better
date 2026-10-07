import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-5 whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'bg-subtle text-muted-foreground',
        primary: 'bg-primary-soft text-primary-soft-foreground',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-[oklch(0.5_0.12_65)] dark:text-warning',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
        outline: 'border border-border text-muted-foreground',
        violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-300',
        teal: 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
        blue: 'bg-blue-500/12 text-blue-600 dark:text-blue-300',
        orange: 'bg-orange-500/12 text-orange-700 dark:text-orange-300',
        brown: 'bg-amber-700/12 text-amber-800 dark:text-amber-300',
        slate: 'bg-slate-500/12 text-slate-600 dark:text-slate-300',
        indigo: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-300',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export function Badge({
  className,
  tone,
  dot,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {props.children}
    </span>
  )
}
