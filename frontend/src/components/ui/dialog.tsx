import { X } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const Dialog = D.Root
export const DialogTrigger = D.Trigger
export const DialogClose = D.Close

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function DialogContent({
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
  className,
  onOpenAutoFocus,
}: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: keyof typeof widths
  className?: string
  onOpenAutoFocus?: (e: Event) => void
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade" />
      <D.Content
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
          'rounded-2xl border border-border bg-popover shadow-pop animate-in outline-none',
          widths[size],
          className,
        )}
      >
        <div className="flex items-start gap-3 px-6 pt-5 pb-3">
          {icon && (
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground [&_svg]:size-[18px]">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <D.Title className="text-base font-semibold tracking-tight">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-[13px] text-muted-foreground">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === 'string' ? title : ''}</D.Description>
            )}
          </div>
          <D.Close className="-me-2 -mt-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </D.Close>
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-1">{children}</div>}
        {footer && (
          <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-border bg-muted/40 px-6 py-3">
            {footer}
          </div>
        )}
      </D.Content>
    </D.Portal>
  )
}
