import type { LabelHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[13px] font-medium text-foreground', className)} {...props} />
}

/** A labelled form row with optional hint and error. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
  aside,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  children: ReactNode
  className?: string
  htmlFor?: string
  aside?: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={htmlFor}>
            {label}
            {required && <span className="ms-0.5 text-danger">*</span>}
          </Label>
          {aside}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
