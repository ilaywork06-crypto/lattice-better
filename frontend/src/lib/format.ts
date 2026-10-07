import i18n from '@/i18n'

const locale = () => (i18n.language === 'he' ? 'he-IL' : 'en-GB')

/** "YYYY-MM-DD" is a calendar day, not UTC midnight — read it as local. */
export function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const d = parseDay(value) ?? new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(locale(), {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function timeAgo(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  const seconds = Math.round((d.getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 45) return rtf.format(0, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), 'day')
  return formatDate(value)
}

export function formatNumber(n: number): string {
  return n.toLocaleString(locale())
}

export function formatBytes(bytes?: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** "XX-#####": # are typed digits, the rest is filled in. Mirrors the server. */
export function applyPattern(pattern: string, raw: string): string | null {
  const value = raw.trim()
  const re = new RegExp(
    '^' + [...pattern].map((c) => (c === '#' ? '\\d' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('') + '$',
  )
  if (re.test(value)) return value
  const digits = value.replace(/\s/g, '')
  const slots = [...pattern].filter((c) => c === '#').length
  if (!/^\d+$/.test(digits) || digits.length !== slots) return null
  let i = 0
  return [...pattern].map((c) => (c === '#' ? digits[i++] : c)).join('')
}
