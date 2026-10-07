import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import * as E from '@/api/endpoints'
import { useAction, useNotificationCounts, useNotifications } from '@/api/queries'
import { NotificationRow } from '@/features/notifications/NotificationRow'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function NotificationsPopover() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const counts = useNotificationCounts()
  const list = useNotifications('all', 8)
  const readAll = useAction(() => E.notifications.readAll())
  const unread = counts.data?.unread ?? 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t('nav.notifications')}>
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-background">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">{t('nav.notifications')}</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => readAll.mutate(undefined)} loading={readAll.isPending}>
              <CheckCheck /> {t('notifications.readAll')}
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {list.isError ? (
            <EmptyState compact icon={<Bell />} title={t('notifications.unavailable')} />
          ) : list.data?.items.length ? (
            list.data.items.map((n) => <NotificationRow key={n.id} n={n} compact onNavigate={() => setOpen(false)} />)
          ) : (
            <EmptyState compact icon={<Bell />} title={t('notifications.empty')} />
          )}
        </div>
        <Link
          to="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t border-border px-4 py-2.5 text-center text-[13px] font-medium text-primary hover:bg-muted"
        >
          {t('notifications.viewAll')}
        </Link>
      </PopoverContent>
    </Popover>
  )
}
