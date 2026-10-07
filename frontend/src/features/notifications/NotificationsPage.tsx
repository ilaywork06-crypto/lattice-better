import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as E from '@/api/endpoints'
import { useAction, useNotificationCounts, useNotifications } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NotificationRow } from './NotificationRow'

type Filter = 'all' | 'unread' | 'read'

export default function NotificationsPage() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>('all')
  const [limit, setLimit] = useState(30)
  const counts = useNotificationCounts()
  const list = useNotifications(filter, limit)
  const readAll = useAction(() => E.notifications.readAll(), { success: t('notifications.allRead') })

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('nav.notifications')}
        description={t('notifications.description')}
        actions={
          <Button onClick={() => readAll.mutate(undefined)} disabled={!counts.data?.unread} loading={readAll.isPending}>
            <CheckCheck /> {t('notifications.readAll')}
          </Button>
        }
      />
      <Tabs value={filter} onValueChange={(v) => { setFilter(v as Filter); setLimit(30) }}>
        <TabsList className="mb-4">
          <TabsTrigger value="all" count={counts.data?.total}>{t('notifications.all')}</TabsTrigger>
          <TabsTrigger value="unread" count={counts.data?.unread}>{t('notifications.unread')}</TabsTrigger>
          <TabsTrigger value="read" count={counts.data?.read}>{t('notifications.read')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card className="overflow-hidden">
        {list.isPending ? (
          <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : list.isError ? (
          <EmptyState icon={<Bell />} title={t('notifications.unavailable')} description={t('notifications.unavailableHint')} />
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<Bell />} title={t('notifications.empty')} description={t('notifications.emptyHint')} />
        ) : (
          <>
            {list.data.items.map((n) => <NotificationRow key={n.id} n={n} />)}
            {list.data.total > list.data.items.length && (
              <div className="border-t border-border p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 30)} loading={list.isFetching}>
                  {t('common.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
