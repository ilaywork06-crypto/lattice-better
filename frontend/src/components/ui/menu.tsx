import { Check, ChevronRight } from 'lucide-react'
import { DropdownMenu as M } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const Menu = M.Root
export const MenuTrigger = M.Trigger
export const MenuSub = M.Sub

const panel =
  'z-50 min-w-48 overflow-hidden rounded-xl border border-border bg-popover p-1 text-sm shadow-pop animate-in'

export function MenuContent({ className, align = 'end', ...props }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content sideOffset={6} align={align} className={cn(panel, className)} {...props} />
    </M.Portal>
  )
}

export function MenuItem({
  className,
  icon,
  danger,
  shortcut,
  children,
  ...props
}: ComponentProps<typeof M.Item> & { icon?: ReactNode; danger?: boolean; shortcut?: string }) {
  return (
    <M.Item
      className={cn(
        'flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 outline-none',
        'data-[highlighted]:bg-muted data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground',
        danger && 'text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-xs text-muted-foreground">{shortcut}</span>}
    </M.Item>
  )
}

export function MenuCheckItem({ checked, children, ...props }: ComponentProps<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem
      checked={checked}
      className="flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 outline-none data-[highlighted]:bg-muted"
      {...props}
    >
      <span className="grid size-4 place-items-center">{checked ? <Check className="size-4" /> : null}</span>
      {children}
    </M.CheckboxItem>
  )
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof M.Label>) {
  return <M.Label className={cn('px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground', className)} {...props} />
}

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px bg-border" />
}

export function MenuSubTrigger({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <M.SubTrigger className="flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 outline-none data-[highlighted]:bg-muted data-[state=open]:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground">
      {icon}
      <span className="flex-1">{children}</span>
      <ChevronRight className="rtl:rotate-180" />
    </M.SubTrigger>
  )
}

export function MenuSubContent(props: ComponentProps<typeof M.SubContent>) {
  return (
    <M.Portal>
      <M.SubContent sideOffset={6} className={panel} {...props} />
    </M.Portal>
  )
}
