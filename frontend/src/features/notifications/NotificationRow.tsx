import { AlertTriangle, Bell, CheckCircle2, GitPullRequestArrow, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import * as E from '@/api/endpoints'
import { useAction } from '@/api/queries'
import type { Notification } from '@/api/types'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/format'

const ICONS: Record<string, { icon: typeof Bell; tone: string }> = {
  'change_request.submitted': { icon: GitPullRequestArrow, tone: 'bg-warning-soft text-[oklch(0.55_0.13_65)] dark:text-warning' },
  'change_request.approved': { icon: CheckCircle2, tone: 'bg-success-soft text-success' },
  'change_request.rejected': { icon: XCircle, tone: 'bg-danger-soft text-danger' },
  'inventory.low_stock': { icon: AlertTriangle, tone: 'bg-danger-soft text-danger' },
}

interface Component {
  template_id: number
  name: string
  card_type?: string | null
  available: number
  min_quantity: number
  shortfall: number
  link: string
}

export function NotificationRow({ n, compact, onNavigate }: { n: Notification; compact?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const mark = useAction((read: boolean) => E.notifications.mark(n.id, read))
  const meta = ICONS[n.type] ?? { icon: Bell, tone: 'bg-muted text-muted-foreground' }
  const components = (n.payload?.components as Component[] | undefined) ?? []

  const open = () => {
    if (!n.read) mark.mutate(true)
    if (n.link) {
      onNavigate?.()
      navigate(n.link)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      className={cn(
        'group flex cursor-pointer gap-3 border-b border-border/70 px-4 py-3 transition-colors last:border-0 hover:bg-muted/60',
        !n.read && 'bg-primary-soft/30',
      )}
    >
      <div className={cn('grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4', meta.tone)}>
        <meta.icon />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className={cn('flex-1 text-[13.5px] leading-snug', !n.read && 'font-semibold')}>{n.title}</div>
          {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
        </div>
        {components.length > 0 && !compact ? (
          <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-2.5 py-1.5 text-start font-medium">{t('notifications.component')}</th>
                  <th className="px-2.5 py-1.5 text-end font-medium">{t('inventory.available')}</th>
                  <th className="px-2.5 py-1.5 text-end font-medium">{t('inventory.minimum')}</th>
                </tr>
              </thead>
              <tbody>
                {components.map((c) => (
                  <tr key={c.template_id} className="border-t border-border">
                    <td className="px-2.5 py-1.5">{c.name}</td>
                    <td className="px-2.5 py-1.5 text-end font-semibold text-danger tabular-nums">{c.available}</td>
                    <td className="px-2.5 py-1.5 text-end tabular-nums">{c.min_quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={cn('mt-0.5 whitespace-pre-line text-[13px] text-muted-foreground', compact && 'line-clamp-2')}>{n.body}</p>
        )}
        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{timeAgo(n.created_at)}</span>
          {!compact && (
            <button
              className="opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                mark.mutate(!n.read)
              }}
            >
              {n.read ? t('notifications.markUnread') : t('notifications.markRead')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
