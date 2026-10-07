import { Building2, Crosshair, Droplets, MapPin, PencilRuler, Plus, Save, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import * as E from '@/api/endpoints'
import { useAction, useBuildings, useItems, useLocations } from '@/api/queries'
import type { Building, Location } from '@/api/types'
import { FloorPlan } from '@/components/domain/FloorPlan'
import { ItemLink, StateBadge } from '@/components/domain/badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { Switch } from '@/components/ui/controls'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc'
import { cn } from '@/lib/cn'
import { useUrlState } from '@/lib/hooks'
import { useSession } from '@/lib/session'

type Draft = { name: string; building: string; room: string; x: number; y: number; notes: string; is_desiccator: boolean }
const blank: Draft = { name: '', building: '', room: '', x: 50, y: 50, notes: '', is_desiccator: false }
const COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#0ea5e9', '#ec4899', '#84cc16', '#a855f7', '#64748b']

function LocationEditor({ location, pick, onDone }: {
  location: Location | null; pick: { x: number; y: number } | null; onDone: (id?: number) => void
}) {
  const { t } = useTranslation()
  const { can } = useSession()
  const confirm = useConfirm()
  const [d, setD] = useState<Draft>(blank)
  useEffect(() => {
    setD(location ? { name: location.name, building: location.building ?? '', room: location.room ?? '', x: location.x, y: location.y, notes: location.notes ?? '', is_desiccator: location.is_desiccator } : blank)
    // Only when another location is opened — not on every background refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.id])
  useEffect(() => {
    if (pick) setD((x) => ({ ...x, ...pick }))
  }, [pick])
  const body = { ...d, building: d.building || null, room: d.room || null, notes: d.notes || null }
  const save = useAction(() => (location ? E.locations.update(location.id, body) : E.locations.create(body)), {
    success: location ? t('locations.saved') : t('locations.created'), onSuccess: (l) => onDone(l.id),
  })
  const remove = useAction(() => E.locations.remove(location!.id), { success: t('locations.deleted'), onSuccess: () => onDone() })
  const writable = can('write_locations')
  return (
    <div className="flex flex-col gap-3">
      <Field label={t('common.name')} required><Input value={d.name} disabled={!writable} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('locations.building')}><Input value={d.building} disabled={!writable} onChange={(e) => setD({ ...d, building: e.target.value })} /></Field>
        <Field label={t('locations.room')}><Input value={d.room} disabled={!writable} onChange={(e) => setD({ ...d, room: e.target.value })} /></Field>
        <Field label="X"><Input type="number" min={0} max={100} value={d.x} disabled={!writable} onChange={(e) => setD({ ...d, x: Number(e.target.value) })} /></Field>
        <Field label="Y"><Input type="number" min={0} max={100} value={d.y} disabled={!writable} onChange={(e) => setD({ ...d, y: Number(e.target.value) })} /></Field>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Crosshair className="size-3.5" /> {t('locations.pickHint')}</p>
      <Field label={t('common.notes')}><Textarea value={d.notes} disabled={!writable} onChange={(e) => setD({ ...d, notes: e.target.value })} className="min-h-14" /></Field>
      <label className={cn('flex items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm', !can('manage_desiccator') && 'opacity-60')}>
        <Switch checked={d.is_desiccator} disabled={!can('manage_desiccator')} onChange={(v) => setD({ ...d, is_desiccator: v })} />
        <Droplets className="size-4 text-info" />
        <span className="flex-1">{t('locations.partOfDesiccator')}</span>
      </label>
      {writable && (
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" loading={save.isPending} disabled={!d.name.trim()} onClick={() => save.mutate(undefined)}>
            <Save /> {location ? t('common.save') : t('locations.create')}
          </Button>
          {location && can('delete_locations') && (
            <Button variant="danger-soft" loading={remove.isPending}
              onClick={async () => { if (await confirm({ title: t('locations.deleteTitle', { name: location.name }), danger: true, confirmLabel: t('common.delete') })) remove.mutate(undefined) }}>
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function BuildingEditor({ building, onDone }: { building: Building; onDone: () => void }) {
  const { t } = useTranslation()
  const { can } = useSession()
  const [name, setName] = useState(building.name)
  useEffect(() => setName(building.name), [building])
  const update = useAction((patch: Partial<Building>) => E.locations.updateBuilding(building.id, patch))
  const remove = useAction(() => E.locations.removeBuilding(building.id), { onSuccess: onDone })
  return (
    <div className="flex flex-col gap-3">
      <Field label={t('locations.buildingName')}>
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== building.name && update.mutate({ name })} />
      </Field>
      <div>
        <div className="mb-1.5 text-[13px] font-medium">{t('locations.color')}</div>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button key={c} onClick={() => update.mutate({ color: c })} className={cn('size-7 rounded-full ring-offset-2 ring-offset-card', building.color === c && 'ring-2 ring-foreground')} style={{ background: c }} />
          ))}
        </div>
      </div>
      {can('delete_map') && <Button variant="danger-soft" onClick={() => remove.mutate(undefined)}><Trash2 /> {t('locations.deleteBuilding')}</Button>}
    </div>
  )
}

function ItemsHere({ location }: { location: Location }) {
  const { t } = useTranslation()
  const items = useItems({ location_id: location.id, top_level: true, include_destroyed: false, limit: 50 })
  if (items.isPending) return <Skeleton className="h-20" />
  if (!items.data?.items.length) return <p className="text-sm text-muted-foreground">{t('locations.nothingHere')}</p>
  return (
    <div className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto">
      {items.data.items.map((i) => (
        <div key={i.id} className="flex items-center justify-between gap-2 py-1.5">
          <ItemLink item={i} showType className="text-sm" />
          <StateBadge state={i.state} />
        </div>
      ))}
    </div>
  )
}

export default function LocationsPage() {
  const { t } = useTranslation()
  const { can } = useSession()
  const locations = useLocations()
  const buildings = useBuildings()
  const [selectedParam, setSelectedParam] = useUrlState('selected')
  const [creating, setCreating] = useState(false)
  const [editingMap, setEditingMap] = useState(false)
  const [buildingId, setBuildingId] = useState<number | null>(null)
  const [pick, setPick] = useState<{ x: number; y: number } | null>(null)
  const [search, setSearch] = useState('')
  const selectedId = selectedParam ? Number(selectedParam) : null
  const selected = locations.data?.find((l) => l.id === selectedId) ?? null
  const createBuilding = useAction(E.locations.createBuilding, { onSuccess: (b) => setBuildingId(b.id) })
  const changeBuilding = useAction(({ id, r }: { id: number; r: Partial<Building> }) => E.locations.updateBuilding(id, r))

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (locations.data ?? []).filter((l) => !q || [l.name, l.building, l.room].some((v) => v?.toLowerCase().includes(q)))
  }, [locations.data, search])
  const editorOpen = creating || !!selected
  const building = buildings.data?.find((b) => b.id === buildingId)

  return (
    <div>
      <PageHeader
        title={t('nav.locations')}
        description={t('locations.description')}
        actions={<>
          {can('write_map') && (
            <Button variant={editingMap ? 'soft' : 'secondary'} onClick={() => { setEditingMap(!editingMap); setBuildingId(null) }}>
              <PencilRuler /> {editingMap ? t('locations.doneEditing') : t('locations.editMap')}
            </Button>
          )}
          {can('write_locations') && <Button variant="primary" onClick={() => { setCreating(true); setSelectedParam('') }}><Plus /> {t('locations.new')}</Button>}
        </>}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-3">
          {locations.isPending ? <Skeleton className="aspect-[16/10]" /> : (
            <FloorPlan
              locations={locations.data ?? []}
              buildings={buildings.data ?? []}
              selectedId={selectedId}
              onSelect={(id) => { setCreating(false); setPick(null); setSelectedParam(String(id)) }}
              onPick={editorOpen && can('write_locations') ? setPick : undefined}
              pickPoint={editorOpen ? pick : null}
              editing={editingMap}
              selectedBuildingId={buildingId}
              onSelectBuilding={setBuildingId}
              onBuildingDraw={(r) => createBuilding.mutate({ name: t('locations.newBuilding'), ...r, color: COLORS[(buildings.data?.length ?? 0) % COLORS.length], sort_order: 0 })}
              onBuildingChange={(id, r) => changeBuilding.mutate({ id, r })}
            />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-4 px-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="grid size-4 place-items-center rounded-full bg-foreground/80"><MapPin className="size-2.5 text-background" /></span>{t('locations.legendLocation')}</span>
            <span className="inline-flex items-center gap-1.5"><span className="grid size-4 place-items-center rounded-full bg-info"><Droplets className="size-2.5 text-white" /></span>{t('locations.desiccator')}</span>
            {editingMap && <span className="ms-auto inline-flex items-center gap-1.5 text-primary"><Building2 className="size-3.5" />{t('locations.drawHint')}</span>}
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          {editingMap && building ? (
            <Card>
              <CardHeader icon={<Building2 />} title={t('locations.buildingTitle')} />
              <CardBody><BuildingEditor building={building} onDone={() => setBuildingId(null)} /></CardBody>
            </Card>
          ) : editorOpen ? (
            <>
              <Card>
                <CardHeader icon={<MapPin />} title={selected ? selected.name : t('locations.new')}
                  actions={<Button size="sm" variant="ghost" onClick={() => { setCreating(false); setSelectedParam('') }}>{t('common.close')}</Button>} />
                <CardBody>
                  <LocationEditor location={creating ? null : selected} pick={pick}
                    onDone={(id) => { setCreating(false); setPick(null); setSelectedParam(id ? String(id) : '') }} />
                </CardBody>
              </Card>
              {selected && (
                <Card>
                  <CardHeader title={t('locations.itemsHere', { count: selected.item_count })}
                    actions={<Button size="sm" variant="ghost" asChild><Link to={`/cards?view=units`}>{t('common.viewAll')}</Link></Button>} />
                  <CardBody><ItemsHere location={selected} /></CardBody>
                </Card>
              )}
            </>
          ) : (
            <Card className="overflow-hidden">
              <div className="border-b border-border p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="ps-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('locations.search')} />
                </div>
              </div>
              {list.length === 0 ? <EmptyState compact icon={<MapPin />} title={t('locations.empty')} description={t('locations.emptyHint')} /> : (
                <div className="max-h-[560px] divide-y divide-border overflow-y-auto">
                  {list.map((l) => (
                    <button key={l.id} onClick={() => setSelectedParam(String(l.id))} className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-muted/60">
                      <span className={cn('grid size-8 place-items-center rounded-lg', l.is_desiccator ? 'bg-info-soft text-info' : 'bg-muted text-muted-foreground')}>
                        {l.is_desiccator ? <Droplets className="size-4" /> : <MapPin className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{l.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{[l.building, l.room].filter(Boolean).join(' · ') || '—'}</div>
                      </div>
                      {l.item_count > 0 && <Badge>{l.item_count}</Badge>}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
