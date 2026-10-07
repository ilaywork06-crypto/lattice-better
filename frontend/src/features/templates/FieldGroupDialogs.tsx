import { Layers, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as E from '@/api/endpoints'
import { useAction, useFieldGroups } from '@/api/queries'
import type { FieldGroup } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/controls'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { EmptyState, Skeleton } from '@/components/ui/misc'
import { FIELD_ICON } from '@/lib/domain'
import { useDebounced } from '@/lib/hooks'
import { toFieldIn, type FieldRow } from './fieldRows'

/** Pick one or more field groups to copy into the template being edited. */
export function LoadGroupsDialog({ open, onOpenChange, onLoad }: {
  open: boolean; onOpenChange: (o: boolean) => void; onLoad: (groups: FieldGroup[]) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const groups = useFieldGroups(q || undefined)
  const [chosen, setChosen] = useState<number[]>([])
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setChosen([]) }}>
      <DialogContent size="lg" icon={<Layers />} title={t('groups.loadTitle')} description={t('groups.loadHint')}
        footer={<>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!chosen.length} onClick={() => {
            onLoad((groups.data ?? []).filter((g) => chosen.includes(g.id)))
            setChosen([])
            onOpenChange(false)
          }}>{t('groups.load', { count: chosen.length })}</Button>
        </>}>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('groups.search')} autoFocus />
        </div>
        {groups.isPending ? <Skeleton className="h-40" /> : !groups.data?.length ? (
          <EmptyState compact icon={<Layers />} title={t('groups.empty')} description={t('groups.emptyHint')} />
        ) : (
          <div className="flex flex-col gap-2">
            {groups.data.map((g) => (
              <label key={g.id} className="flex cursor-pointer gap-3 rounded-xl border border-border p-3 hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft/30">
                <Checkbox checked={chosen.includes(g.id)} onChange={(v) => setChosen(v ? [...chosen, g.id] : chosen.filter((x) => x !== g.id))} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{g.name}</div>
                  {g.description && <div className="text-xs text-muted-foreground">{g.description}</div>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.fields.map((f) => {
                      const Icon = FIELD_ICON[f.field_type]
                      return <span key={f.key} className="inline-flex items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5 text-xs"><Icon className="size-3" />{f.label}</span>
                    })}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Save the current field list as a reusable group. */
export function SaveGroupDialog({ open, onOpenChange, rows }: { open: boolean; onOpenChange: (o: boolean) => void; rows: FieldRow[] }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const save = useAction(() => E.fieldGroups.create({ name, description: description || null, fields: toFieldIn(rows, false) }), {
    success: t('groups.saved'), onSuccess: () => { onOpenChange(false); setName(''); setDescription('') },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" icon={<Layers />} title={t('groups.saveTitle')} description={t('groups.saveHint', { count: rows.length })}
        footer={<>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!name.trim()} loading={save.isPending} onClick={() => save.mutate(undefined)}>{t('common.save')}</Button>
        </>}>
        <div className="flex flex-col gap-4">
          <Field label={t('common.name')} required><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label={t('common.description')}><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        </div>
      </DialogContent>
    </Dialog>
  )
}
