import { Tabs as T } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const Tabs = T.Root
export const TabsContent = T.Content

export function TabsList({ className, ...props }: ComponentProps<typeof T.List>) {
  return (
    <T.List
      className={cn('flex items-center gap-1 overflow-x-auto border-b border-border', className)}
      {...props}
    />
  )
}

export function TabsTrigger({
  className,
  icon,
  count,
  children,
  ...props
}: ComponentProps<typeof T.Trigger> & { icon?: ReactNode; count?: number }) {
  return (
    <T.Trigger
      className={cn(
        'relative -mb-px flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 pb-2.5 pt-1 text-sm font-medium text-muted-foreground transition-colors',
        'hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground [&_svg]:size-4',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span className="rounded-full bg-subtle px-1.5 text-[11px] leading-5 text-muted-foreground">{count}</span>
      )}
    </T.Trigger>
  )
}
