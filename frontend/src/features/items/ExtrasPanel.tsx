import { Package, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as E from '@/api/endpoints'
import { useAction } from '@/api/queries'
import type { ExtraIn, ItemDetail } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useSession } from '@/lib/session'

const blank: ExtraIn = { name: '', company_part_number: '', serial: '', signed_by: '' }

export function ExtrasPanel({ item }: { item: ItemDetail }) {
  const { t } = useTranslation()
  const { can } = useSession()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ExtraIn>(blank)
  const add = useAction(() => E.items.addExtra(item.id, form), {
    success: t('extras.added'), onSuccess: () => { setOpen(false); setForm(blank) },
  })
  const remove = useAction((id: number) => E.items.removeExtra(item.id, id))
  const set = (k: keyof ExtraIn) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  return (
    <Card className="overflow-hidden">
      <CardHeader title={t('extras.title')} description={t('extras.hint')}
        actions={can('write_items') && <Button size="sm" onClick={() => setOpen(true)}><Plus /> {t('extras.add')}</Button>} />
      {item.extras.length === 0 ? <EmptyState compact icon={<Package />} title={t('extras.empty')} /> : (
        <Table>
          <THead><TR><TH>{t('common.name')}</TH><TH>{t('extras.partNumber')}</TH><TH>{t('extras.serial')}</TH><TH>{t('extras.signedBy')}</TH><TH /></TR></THead>
          <TBody>
            {item.extras.map((x) => (
              <TR key={x.id}>
                <TD className="font-medium">{x.name}</TD>
                <TD className="mono">{x.company_part_number ?? '—'}</TD>
                <TD className="mono">{x.serial ?? '—'}</TD>
                <TD>{x.signed_by ?? '—'}</TD>
                <TD className="text-end">{can('write_items') && <Button size="icon-sm" variant="ghost" className="text-danger" onClick={() => remove.mutate(x.id)}><Trash2 /></Button>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm" title={t('extras.add')} icon={<Package />}
          footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!form.name} loading={add.isPending} onClick={() => add.mutate(undefined)}>{t('common.add')}</Button></>}>
          <div className="grid gap-4">
            <Field label={t('common.name')} required><Input value={form.name} onChange={set('name')} /></Field>
            <Field label={t('extras.partNumber')}><Input value={form.company_part_number ?? ''} onChange={set('company_part_number')} /></Field>
            <Field label={t('extras.serial')}><Input value={form.serial ?? ''} onChange={set('serial')} /></Field>
            <Field label={t('extras.signedBy')}><Input value={form.signed_by ?? ''} onChange={set('signed_by')} /></Field>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
