import { Droplets, MapPin } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Building, Location } from '@/api/types'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/components/ui/tooltip'

type Rect = { x: number; y: number; width: number; height: number }
type Handle = 'nw' | 'ne' | 'sw' | 'se'
interface Drag {
  mode: 'draw' | 'move' | 'resize'
  id?: number
  handle?: Handle
  start: { x: number; y: number }
  orig?: Rect
}

const MIN = 4
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round = (v: number) => Math.round(v * 10) / 10

/**
 * The floor plan: a 100 × 100 plane with buildings drawn behind location
 * markers. Positions are percentages, so it is resolution-independent.
 *
 * * ``onPick`` — clicking the plane picks a point (placing a location).
 * * ``editing`` — drag on empty space to draw a building, drag one to move
 *   it, drag its corners to resize.
 */
export function FloorPlan({
  locations,
  buildings,
  selectedId,
  onSelect,
  highlight,
  onPick,
  pickPoint,
  editing,
  selectedBuildingId,
  onSelectBuilding,
  onBuildingDraw,
  onBuildingChange,
  className,
  compact,
}: {
  locations: Location[]
  buildings: Building[]
  selectedId?: number | null
  onSelect?: (id: number) => void
  highlight?: number[]
  onPick?: (p: { x: number; y: number }) => void
  pickPoint?: { x: number; y: number } | null
  editing?: boolean
  selectedBuildingId?: number | null
  onSelectBuilding?: (id: number | null) => void
  onBuildingDraw?: (r: Rect) => void
  onBuildingChange?: (id: number, r: Rect) => void
  className?: string
  compact?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [local, setLocal] = useState<Building[]>(buildings)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [draft, setDraft] = useState<Rect | null>(null)

  useEffect(() => {
    if (!drag) setLocal(buildings)
  }, [buildings, drag])

  const point = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect()
    return {
      x: clamp(((e.clientX - r.left) / r.width) * 100, 0, 100),
      y: clamp(((e.clientY - r.top) / r.height) * 100, 0, 100),
    }
  }

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!editing) return
    const target = e.target as HTMLElement
    const p = point(e)
    ref.current?.setPointerCapture(e.pointerId)
    const handle = target.dataset.handle as Handle | undefined
    const bid = target.closest<HTMLElement>('[data-building]')?.dataset.building
    if (handle && selectedBuildingId != null) {
      const b = local.find((x) => x.id === selectedBuildingId)
      if (b) setDrag({ mode: 'resize', id: b.id, handle, start: p, orig: { ...b } })
    } else if (bid) {
      const b = local.find((x) => x.id === Number(bid))
      onSelectBuilding?.(Number(bid))
      if (b) setDrag({ mode: 'move', id: b.id, start: p, orig: { ...b } })
    } else {
      onSelectBuilding?.(null)
      setDrag({ mode: 'draw', start: p })
      setDraft({ x: p.x, y: p.y, width: 0, height: 0 })
    }
  }

  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag) return
    const p = point(e)
    if (drag.mode === 'draw') {
      setDraft({
        x: Math.min(drag.start.x, p.x), y: Math.min(drag.start.y, p.y),
        width: Math.abs(p.x - drag.start.x), height: Math.abs(p.y - drag.start.y),
      })
      return
    }
    const o = drag.orig!
    setLocal((all) =>
      all.map((b) => {
        if (b.id !== drag.id) return b
        if (drag.mode === 'move') {
          return { ...b, x: clamp(o.x + p.x - drag.start.x, 0, 100 - o.width), y: clamp(o.y + p.y - drag.start.y, 0, 100 - o.height) }
        }
        const right = o.x + o.width
        const bottom = o.y + o.height
        const n = { ...b }
        if (drag.handle === 'se' || drag.handle === 'ne') n.width = clamp(p.x - o.x, MIN, 100 - o.x)
        if (drag.handle === 'se' || drag.handle === 'sw') n.height = clamp(p.y - o.y, MIN, 100 - o.y)
        if (drag.handle === 'nw' || drag.handle === 'sw') {
          n.x = clamp(p.x, 0, right - MIN)
          n.width = right - n.x
        }
        if (drag.handle === 'nw' || drag.handle === 'ne') {
          n.y = clamp(p.y, 0, bottom - MIN)
          n.height = bottom - n.y
        }
        return n
      }),
    )
  }

  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag) return
    ref.current?.releasePointerCapture(e.pointerId)
    if (drag.mode === 'draw' && draft && draft.width >= MIN && draft.height >= MIN) {
      onBuildingDraw?.({ x: round(draft.x), y: round(draft.y), width: round(draft.width), height: round(draft.height) })
    } else if (drag.mode !== 'draw') {
      const b = local.find((x) => x.id === drag.id)
      const o = drag.orig!
      if (b && (b.x !== o.x || b.y !== o.y || b.width !== o.width || b.height !== o.height)) {
        onBuildingChange?.(b.id, { x: round(b.x), y: round(b.y), width: round(b.width), height: round(b.height) })
      }
    }
    setDrag(null)
    setDraft(null)
  }

  return (
    <div
      ref={ref}
      dir="ltr"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onClick={(e) => {
        if (!editing && onPick && !(e.target as HTMLElement).closest('[data-marker]')) {
          const p = point(e)
          onPick({ x: round(p.x), y: round(p.y) })
        }
      }}
      className={cn(
        'grid-bg relative aspect-[16/10] w-full touch-none select-none overflow-hidden rounded-xl border border-border bg-muted/40',
        (onPick || editing) && 'cursor-crosshair',
        className,
      )}
    >
      {local.map((b) => {
        const color = b.color || 'var(--primary)'
        const selected = editing && b.id === selectedBuildingId
        return (
          <div
            key={b.id}
            data-building={b.id}
            className={cn('absolute rounded-lg border-2', editing && 'cursor-move', selected && 'ring-4 ring-ring')}
            style={{
              left: `${b.x}%`, top: `${b.y}%`, width: `${b.width}%`, height: `${b.height}%`,
              borderColor: `color-mix(in oklch, ${color} 55%, transparent)`,
              background: `color-mix(in oklch, ${color} 10%, transparent)`,
            }}
          >
            {!compact && (
              <span className="pointer-events-none absolute start-2 top-1.5 text-[11px] font-semibold" style={{ color: `color-mix(in oklch, ${color} 80%, var(--foreground))` }}>
                {b.name}
              </span>
            )}
            {selected &&
              (['nw', 'ne', 'sw', 'se'] as Handle[]).map((h) => (
                <span
                  key={h}
                  data-handle={h}
                  className="absolute size-3 rounded-sm border-2 border-primary bg-card"
                  style={{
                    left: h.includes('w') ? -6 : undefined, right: h.includes('e') ? -6 : undefined,
                    top: h.includes('n') ? -6 : undefined, bottom: h.includes('s') ? -6 : undefined,
                    cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize',
                  }}
                />
              ))}
          </div>
        )
      })}
      {draft && (
        <div className="absolute rounded-lg border-2 border-dashed border-primary bg-primary/10"
          style={{ left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.width}%`, height: `${draft.height}%` }} />
      )}
      {locations.map((l) => {
        const active = l.id === selectedId || highlight?.includes(l.id)
        return (
          <Tooltip key={l.id} content={`${l.name}${l.item_count ? ` · ${l.item_count}` : ''}`}>
            <button
              type="button"
              data-marker
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.(l.id)
              }}
              className={cn(
                'absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-card shadow-pop transition-transform hover:scale-110',
                compact ? 'size-5' : 'size-7',
                l.is_desiccator ? 'bg-info text-white' : 'bg-foreground/80 text-background',
                active && 'z-10 scale-125 bg-primary text-primary-foreground ring-4 ring-ring',
                editing && 'pointer-events-none opacity-60',
              )}
              style={{ left: `${l.x}%`, top: `${l.y}%` }}
            >
              {l.is_desiccator ? <Droplets className={compact ? 'size-2.5' : 'size-3.5'} /> : <MapPin className={compact ? 'size-2.5' : 'size-3.5'} />}
            </button>
          </Tooltip>
        )
      })}
      {pickPoint && (
        <span className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-white bg-primary shadow-pop"
          style={{ left: `${pickPoint.x}%`, top: `${pickPoint.y}%` }} />
      )}
    </div>
  )
}
