import { Download, ExternalLink, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { openFile } from '@/api/client'
import * as E from '@/api/endpoints'
import type { FieldType, ItemState } from '@/api/types'
import { formatDate } from '@/lib/format'
import { StateBadge } from './badges'

interface DocBrief {
  id: number
  name: string
  is_file: boolean
  url?: string | null
}

/** A field's value as people read it (names for ids, links, chips, files). */
export function FieldValue({ fieldType, value, display }: { fieldType: FieldType; value: unknown; display: unknown }) {
  const { t } = useTranslation()
  const empty = <span className="text-muted-foreground/60">—</span>
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return empty

  switch (fieldType) {
    case 'boolean':
      return <span>{value ? t('common.yes') : t('common.no')}</span>
    case 'date':
      return <span>{formatDate(value as string)}</span>
    case 'link':
      return (
        <a href={value as string} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" dir="ltr">
          <span className="truncate">{String(value).replace(/^https?:\/\//, '')}</span>
          <ExternalLink className="size-3" />
        </a>
      )
    case 'status':
      return <StateBadge state={value as ItemState} />
    case 'parent':
      return <Link to={`/items/${value}`} className="text-primary hover:underline">{String(display)}</Link>
    case 'string':
    case 'serial_string':
      return <bdi className="mono text-[13px]" dir="ltr">{String(value)}</bdi>
    case 'managers':
      return (
        <div className="flex flex-wrap gap-1">
          {(display as string[]).map((name) => (
            <span key={name} className="rounded-md bg-subtle px-1.5 py-0.5 text-xs">{name}</span>
          ))}
        </div>
      )
    case 'files':
      return (
        <div className="flex flex-col gap-1">
          {(display as DocBrief[]).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => (d.is_file ? void openFile(E.documents.downloadPath(d.id)) : window.open(d.url ?? '', '_blank'))}
              className="inline-flex items-center gap-1.5 text-start text-primary hover:underline"
            >
              <FileText className="size-3.5 shrink-0" />
              <span className="truncate">{d.name}</span>
              <Download className="size-3 shrink-0 opacity-60" />
            </button>
          ))}
        </div>
      )
    case 'description':
      return <p className="whitespace-pre-line">{String(value)}</p>
    default:
      return <span>{String(display ?? value)}</span>
  }
}
