import { ArrowRightLeft, Link2, ListChecks, MapPin, Trash2, Unlink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import * as E from '@/api/endpoints'
import type { ItemDetail, ItemState } from '@/api/types'
import { ActionDialog } from '@/components/domain/ActionDialog'
import { ItemPicker, ItemsMultiPicker, LocationPicker } from '@/components/domain/pickers'
import { StateBadge } from '@/components/domain/badges'
import { Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { cn } from '@/lib/cn'
import { ITEM_STATES, STATE_COLOR } from '@/lib/domain'

interface Base {
  item: ItemDetail
  open: boolean
  onOpenChange: (o: boolean) => void
}

const label = (item: ItemDetail) => `${item.name} · ${item.serial}`

export function MoveDialog({ item, open, onOpenChange }: Base) {
  const { t } = useTranslation()
  const [locationId, setLocationId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  useEffect(() => {
    if (open) {
      setLocationId(null)
      setNote('')
    }
  }, [open])
  const locked = !!item.parent
  return (
    <ActionDialog
      open={open} onOpenChange={onOpenChange} icon={<MapPin />}
      title={t('actions.moveTitle')} description={label(item)}
      permission="write_items" action="move" itemId={item.id}
      payload={() => (locationId ? { location_id: locationId, note: note || null } : null)}
      apply={() => E.items.move(item.id, locationId!, note || undefined)}
      submitLabel={t('actions.move')} successMessage={t('actions.moved')}
      disabled={!locationId || locked} reasonDefault={note}
    >
      {locked ? (
        <p className="rounded-lg bg-warning-soft px-3 py-2.5 text-sm">
          {t('actions.moveLocked', { parent: `${item.parent!.name} · ${item.parent!.serial}` })}
        </p>
      ) : (
        <>
          {item.children_count > 0 && <p className="text-sm text-muted-foreground">{t('actions.moveCascade', { n: item.children_count })}</p>}
          <Field label={t('actions.newLocation')} required>
            <LocationPicker value={locationId} onChange={setLocationId} exclude={item.location ? [item.location.id] : []} />
          </Field>
          <Field label={t('common.note')}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('actions.notePlaceholder')} />
          </Field>
        </>
      )}
    </ActionDialog>
  )
}

export function StateDialog({ item, open, onOpenChange }: Base) {
  const { t } = useTranslation()
  const [state, setState] = useState<ItemState>(item.state)
  const [note, setNote] = useState('')
  useEffect(() => {
    if (open) {
      setState(item.state)
      setNote('')
    }
  }, [open, item.state])
  const noteRequired = state !== item.state && (state === 'faulty' || item.state === 'faulty')
  return (
    <ActionDialog
      open={open} onOpenChange={onOpenChange} icon={<ListChecks />}
      title={t('actions.stateTitle')} description={label(item)}
      permission="write_items" action="state_change" itemId={item.id}
      payload={() => ({ state, note: note || null })}
      apply={() => E.items.changeState(item.id, state, note || undefined)}
      submitLabel={t('actions.changeState')} successMessage={t('actions.stateChanged')}
      disabled={state === item.state || (noteRequired && !note.trim())} reasonDefault={note}
    >
      <div className="grid grid-cols-2 gap-2">
        {ITEM_STATES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setState(s)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-start transition-all hover:border-input',
              state === s && 'border-primary ring-3 ring-ring',
            )}
          >
            <span className="size-2.5 rounded-full" style={{ background: STATE_COLOR[s] }} />
            <span className="flex-1 text-sm font-medium">{t(`enums.state.${s}`)}</span>
            {item.state === s && <span className="text-[11px] text-muted-foreground">{t('actions.current')}</span>}
          </button>
        ))}
      </div>
      <Field label={t('common.note')} required={noteRequired} hint={noteRequired ? t('actions.faultNote') : undefined}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('actions.notePlaceholder')} />
      </Field>
    </ActionDialog>
  )
}

export function PlaceInsideDialog({ item, open, onOpenChange }: Base) {
  const { t } = useTranslation()
  const [parentId, setParentId] = useState<number | null>(null)
  useEffect(() => {
    if (open) setParentId(null)
  }, [open])
  const noTemplates = item.allowed_parent_templates.length === 0
  return (
    <ActionDialog
      open={open} onOpenChange={onOpenChange} icon={<Link2 />}
      title={item.parent ? t('actions.changeParentTitle') : t('actions.placeTitle')} description={label(item)}
      permission="write_items" action="link" itemId={item.id}
      payload={() => (parentId ? { parent_id: parentId } : null)}
      apply={() => E.items.link(item.id, parentId!)}
      submitLabel={t('actions.place')} successMessage={t('actions.placed')}
      disabled={!parentId}
    >
      {noTemplates ? (
        <p className="rounded-lg bg-warning-soft px-3 py-2.5 text-sm">{t('actions.noContainers', { name: item.name })}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t('actions.placeHint', { names: item.allowed_parent_templates.map((p) => p.name).join(', ') })}
          </p>
          <Field label={t('actions.container')} required>
            <ItemPicker value={parentId} onChange={setParentId}
              query={{ holds_template: item.template.id, include_destroyed: false }}
              exclude={[item.id, ...(item.parent ? [item.parent.id] : [])]} />
          </Field>
        </>
      )}
    </ActionDialog>
  )
}

export function TakeOutDialog({ item, open, onOpenChange }: Base) {
  const { t } = useTranslation()
  const [locationId, setLocationId] = useState<number | null>(null)
  useEffect(() => {
    if (open) setLocationId(null)
  }, [open])
  return (
    <ActionDialog
      open={open} onOpenChange={onOpenChange} icon={<Unlink />}
      title={t('actions.takeOutTitle')} description={label(item)}
      permission="write_items" action="unlink" itemId={item.id}
      payload={() => ({ location_id: locationId })}
      apply={() => E.items.unlink(item.id, locationId)}
      submitLabel={t('actions.takeOut')} successMessage={t('actions.takenOut')}
    >
      <p className="text-sm text-muted-foreground">
        {t('actions.takeOutHint', { parent: item.parent ? `${item.parent.name} · ${item.parent.serial}` : '', location: item.location?.name ?? '—' })}
      </p>
      <Field label={t('actions.nowAt')} hint={t('actions.nowAtHint')}>
        <LocationPicker value={locationId} onChange={setLocationId} />
      </Field>
    </ActionDialog>
  )
}

export function ContentsDialog({ item, open, onOpenChange }: Base) {
  const { t } = useTranslation()
  const [ids, setIds] = useState<number[]>([])
  useEffect(() => {
    if (open) setIds(item.children.map((c) => c.id))
  }, [open, item.children])
  return (
    <ActionDialog
      open={open} onOpenChange={onOpenChange} icon={<ArrowRightLeft />} size="lg"
      title={t('actions.contentsTitle')} description={label(item)}
      permission="write_items" action="update" itemId={item.id}
      payload={() => ({ child_ids: ids })}
      apply={() => E.items.setChildren(item.id, ids)}
      submitLabel={t('common.save')} successMessage={t('actions.contentsSaved')}
    >
      <p className="text-sm text-muted-foreground">{t('actions.contentsHint')}</p>
      <ItemsMultiPicker value={ids} onChange={setIds} seed={item.children}
        query={{ fits_in_template: item.template.id, include_destroyed: false }} exclude={[item.id]} />
      <div className="grid gap-1.5">
        {item.composition.map((row) => (
          <div key={row.template.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-[13px]">
            <span>{row.template.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {row.max_count != null ? t('composition.range', { min: row.min_count, max: row.max_count }) : t('composition.atLeast', { min: row.min_count })}
            </span>
          </div>
        ))}
      </div>
    </ActionDialog>
  )
}

export function DeleteItemDialog({ item, open, onOpenChange }: Base) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <ActionDialog
      open={open} onOpenChange={onOpenChange} icon={<Trash2 />} danger
      title={t('actions.deleteTitle')} description={label(item)}
      permission="write_items" action="delete" itemId={item.id}
      payload={() => ({})}
      apply={() => E.items.remove(item.id)}
      submitLabel={t('common.delete')} successMessage={t('actions.deleted')}
      onDone={(r) => r === undefined && navigate(`/${item.type === 'card' ? 'cards' : item.type === 'assembly' ? 'assemblies' : 'setups'}`)}
    >
      <p className="text-sm text-muted-foreground">
        {item.children_count ? t('actions.deleteWithChildren', { n: item.children_count }) : t('actions.deleteHint')}
      </p>
      <div className="flex items-center gap-2 text-sm">
        <StateBadge state={item.state} /> <span>{item.name}</span>
      </div>
    </ActionDialog>
  )
}
