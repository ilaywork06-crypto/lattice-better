import { useTranslation } from 'react-i18next'
import { LIVE_STATES, STATE_COLOR } from '@/lib/domain'

/** A thin stacked bar of units per state. */
export function StateBar({ counts }: { counts: { built: number; ok: number; faulty: number; total: number } }) {
  const { t } = useTranslation()
  if (!counts.total) return <div className="h-1.5 rounded-full bg-subtle" />
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-subtle" title={LIVE_STATES.map((s) => `${t(`enums.state.${s}`)}: ${counts[s]}`).join(' · ')}>
      {LIVE_STATES.map((s) =>
        counts[s] ? <div key={s} style={{ width: `${(counts[s] / counts.total) * 100}%`, background: STATE_COLOR[s] }} /> : null,
      )}
    </div>
  )
}

export function StateLegend({ counts }: { counts: { built: number; ok: number; faulty: number } }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {LIVE_STATES.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ background: STATE_COLOR[s] }} />
          {t(`enums.state.${s}`)} <span className="font-medium text-foreground tabular-nums">{counts[s]}</span>
        </span>
      ))}
    </div>
  )
}
