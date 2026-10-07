import { ArrowRightLeft, FileText, History, Link2, ListChecks, MapPin, Pencil, Plus, Trash2, Upload, UserCog, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { AuditEntry } from '@/api/types'
import { Avatar, EmptyState, Skeleton } from '@/components/ui/misc'
import { formatDateTime, timeAgo } from '@/lib/format'

const ICONS: Record<string, LucideIcon> = {
  create: Plus, update: Pencil, delete: Trash2, move: MapPin, link: Link2, unlink: Link2,
  state_change: ListChecks, contents: ArrowRightLeft, import: Upload,
}

function iconFor(action: string): LucideIcon {
  if (ICONS[action]) return ICONS[action]
  if (action.startsWith('user.')) return UserCog
  if (action.startsWith('template.') || action.startsWith('field_group.')) return FileText
  return History
}

export function auditActionLabel(t: (k: string) => string, action: string, exists: (k: string) => boolean) {
  const key = `audit.actions.${action.replace(/\./g, '_')}`
  return exists(key) ? t(key) : action
}

export function AuditList({ entries, loading }: { entries?: AuditEntry[]; loading?: boolean }) {
  const { t, i18n } = useTranslation()
  if (loading && !entries) return <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
  if (!entries?.length) return <EmptyState compact icon={<History />} title={t('audit.empty')} />
  return (
    <ul className="divide-y divide-border">
      {entries.map((e) => {
        const Icon = iconFor(e.action)
        return (
          <li key={e.id} className="flex gap-3 px-5 py-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm" dir="auto">{e.summary}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="rounded bg-subtle px-1.5 py-0.5 font-medium">
                  {auditActionLabel(t, e.action, (k) => i18n.exists(k))}
                </span>
                {e.user_name && <span className="inline-flex items-center gap-1.5"><Avatar name={e.user_name} size={16} /> {e.user_name}</span>}
                <span title={formatDateTime(e.created_at)}>{timeAgo(e.created_at)}</span>
                {e.item_id && e.subject && <Link to={`/items/${e.item_id}`} className="hover:text-primary"><bdi>{e.subject}</bdi></Link>}
                {!e.item_id && e.template_id && e.subject && <Link to={`/templates/${e.template_id}`} className="hover:text-primary">{e.subject}</Link>}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
