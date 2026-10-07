import { Popover as P } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export const Popover = P.Root
export const PopoverTrigger = P.Trigger
export const PopoverAnchor = P.Anchor
export const PopoverClose = P.Close

export function PopoverContent({ className, align = 'start', ...props }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={6}
        align={align}
        className={cn('z-50 rounded-xl border border-border bg-popover p-3 shadow-pop outline-none animate-in', className)}
        {...props}
      />
    </P.Portal>
  )
}
