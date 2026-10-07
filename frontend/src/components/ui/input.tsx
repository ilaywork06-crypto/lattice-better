import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const field =
  'w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-[inset_0_1px_1px_rgb(0_0_0/0.02)] ' +
  'placeholder:text-muted-foreground/70 transition-colors outline-none ' +
  'focus:border-primary focus:ring-3 focus:ring-ring disabled:opacity-60 disabled:bg-muted ' +
  'aria-invalid:border-danger aria-invalid:ring-danger/20'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(field, 'h-9', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(field, 'min-h-20 py-2 leading-relaxed', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

export const fieldClass = field
