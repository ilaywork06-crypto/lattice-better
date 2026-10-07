import { ListChecks, MapPin, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as E from '@/api/endpoints'
import { useAction } from '@/api/queries'
import type { ItemState } from '@/api/types'
import { LocationPicker } from '@/components/domain/pickers'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ITEM_STATES } from '@/lib/domain'

/** Actions on the selected rows — one atomic request: all succeed or none do. */
export function BulkBar({ ids, onClear }: { ids: number[]; onClear: () => void }) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<'move' | 'state' | null>(null)
  const [locationId, setLocationId] = useState<number | null>(null)
  const [state, setState] = useState<ItemState | null>(null)
  const [note, setNote] = useState('')
  const bulk = useAction(E.items.bulk, {
    success: (r) => t('bulk.done', { count: r.processed }),
    onSuccess: () => {
      setDialog(null)
      onClear()
    },
  })
  if (!ids.length) return null
  return (
    <>
      <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-popover p-2 ps-4 shadow-pop animate-in">
          <span className="text-sm font-medium">{t('bulk.selected', { count: ids.length })}</span>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button size="sm" variant="ghost" onClick={() => setDialog('move')}><MapPin /> {t('actions.move')}</Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog('state')}><ListChecks /> {t('actions.changeState')}</Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            onClick={async () => {
              if (await confirm({ title: t('bulk.deleteTitle', { count: ids.length }), description: t('bulk.deleteHint'), danger: true, confirmLabel: t('common.delete') }))
                bulk.mutate({ action: 'delete', item_ids: ids })
            }}
          >
            <Trash2 /> {t('common.delete')}
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onClear} aria-label={t('common.clear')}><X /></Button>
        </div>
      </div>
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog && (
          <DialogContent
            size="sm"
            title={dialog === 'move' ? t('bulk.moveTitle', { count: ids.length }) : t('bulk.stateTitle', { count: ids.length })}
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialog(null)}>{t('common.cancel')}</Button>
                <Button
                  variant="primary"
                  loading={bulk.isPending}
                  disabled={dialog === 'move' ? !locationId : !state}
                  onClick={() =>
                    bulk.mutate(
                      dialog === 'move'
                        ? { action: 'move', item_ids: ids, location_id: locationId, note: note || null }
                        : { action: 'state_change', item_ids: ids, state, note: note || null },
                    )
                  }
                >
                  {t('common.apply')}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              {dialog === 'move' ? (
                <Field label={t('actions.newLocation')} required>
                  <LocationPicker value={locationId} onChange={setLocationId} />
                </Field>
              ) : (
                <Field label={t('actions.newState')} required>
                  <Select value={state} onChange={setState} options={ITEM_STATES.map((s) => ({ value: s, label: t(`enums.state.${s}`) }))} />
                </Field>
              )}
              <Field label={t('common.note')}>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
