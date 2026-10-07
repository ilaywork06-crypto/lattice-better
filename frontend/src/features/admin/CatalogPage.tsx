import { Droplets, FolderKanban, Layers, Link2, Pencil, Plus, Factory, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as E from '@/api/endpoints'
import { useAction, useCatalog, useFieldGroups, useLocations } from '@/api/queries'
import type { CatalogCategory, CatalogOption, FieldGroup } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { MultiCombobox } from '@/components/ui/combobox'
import { useConfirm } from '@/components/ui/confirm'
import { Checkbox, Switch } from '@/components/ui/controls'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FIELD_ICON } from '@/lib/domain'
import { useUrlState } from '@/lib/hooks'
import { FieldListEditor } from '@/features/templates/FieldListEditor'
import { rowsFromGroup, toFieldIn, type FieldRow } from '@/features/templates/fieldRows'

const CATEGORIES: { value: CatalogCategory; icon: typeof Users }[] = [
  { value: 'project', icon: FolderKanban },
  { value: 'industry', icon: Factory },
  { value: 'team', icon: Users },
]

function OptionDialog({ category, option, open, onOpenChange }: {
  category: CatalogCategory; option: CatalogOption | null; open: boolean; onOpenChange: (o: boolean) => void
}) {
  const { t } = useTranslation()
  const catalog = useCatalog()
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)
  const [links, setLinks] = useState<Record<string, number[]>>({})
  const others = CATEGORIES.filter((c) => c.value !== category)

  useEffect(() => {
    if (!open) return
    setValue(option?.value ?? '')
    setDescription(option?.description ?? '')
    setActive(option?.active ?? true)
    const byCat: Record<string, number[]> = {}
    for (const c of others) byCat[c.value] = (option?.linked_ids ?? []).filter((id) => catalog.data?.find((o) => o.id === id)?.category === c.value)
    setLinks(byCat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, option])

  const save = useAction(async () => {
    const saved = option
      ? await E.catalog.update(option.id, { value, description: description || null, active })
      : await E.catalog.create({ category, value, description: description || null, active, sort_order: 0 })
    for (const c of others) {
      const before = (option?.linked_ids ?? []).filter((id) => catalog.data?.find((o) => o.id === id)?.category === c.value)
      if (JSON.stringify([...before].sort()) !== JSON.stringify([...(links[c.value] ?? [])].sort()))
        await E.catalog.setLinks(saved.id, c.value, links[c.value] ?? [])
    }
    return saved
  }, { success: t('catalog.saved'), onSuccess: () => onOpenChange(false) })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" title={option ? t('catalog.editTitle', { value: option.value }) : t(`catalog.new.${category}`)}
        footer={<>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!value.trim()} loading={save.isPending} onClick={() => save.mutate(undefined)}>{t('common.save')}</Button>
        </>}>
        <div className="flex flex-col gap-4">
          <Field label={t('catalog.value')} required><Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus /></Field>
          <Field label={t('common.description')}><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-14" /></Field>
          <label className="flex items-center gap-2.5 text-sm"><Switch checked={active} onChange={setActive} /> {t('catalog.active')}
            <span className="text-xs text-muted-foreground">— {t('catalog.activeHint')}</span></label>
          <div className="rounded-xl border border-border p-3.5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Link2 className="size-4" /> {t('catalog.links')}</div>
            <p className="mb-3 text-xs text-muted-foreground">{t('catalog.linksHint')}</p>
            <div className="flex flex-col gap-3">
              {others.map((c) => (
                <Field key={c.value} label={t(`catalog.categories.${c.value}`)}>
                  <MultiCombobox value={links[c.value] ?? []} onChange={(v) => setLinks({ ...links, [c.value]: v })}
                    options={(catalog.data ?? []).filter((o) => o.category === c.value).map((o) => ({ value: o.id, label: o.value }))}
                    placeholder={t('catalog.noLinks')} />
                </Field>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CategoryTab({ category }: { category: CatalogCategory }) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const catalog = useCatalog()
  const [editing, setEditing] = useState<CatalogOption | null>(null)
  const [open, setOpen] = useState(false)
  const remove = useAction((id: number) => E.catalog.remove(id), { success: t('catalog.deleted') })
  const toggle = useAction((o: CatalogOption) => E.catalog.update(o.id, { active: !o.active }))
  const rows = (catalog.data ?? []).filter((o) => o.category === category)
  const nameOf = (id: number) => catalog.data?.find((o) => o.id === id)
  return (
    <Card className="overflow-hidden">
      <CardHeader title={t(`catalog.categories.${category}`)} description={t(`catalog.hints.${category}`)}
        actions={<Button size="sm" variant="primary" onClick={() => { setEditing(null); setOpen(true) }}><Plus /> {t(`catalog.new.${category}`)}</Button>} />
      {catalog.isPending ? <Skeleton className="m-5 h-40" /> : rows.length === 0 ? <EmptyState compact title={t('catalog.empty')} /> : (
        <Table>
          <THead><TR><TH>{t('catalog.value')}</TH><TH>{t('catalog.links')}</TH><TH className="text-end">{t('catalog.usage')}</TH><TH>{t('catalog.active')}</TH><TH /></TR></THead>
          <TBody>
            {rows.map((o) => (
              <TR key={o.id}>
                <TD>
                  <div className="font-medium">{o.value}</div>
                  {o.description && <div className="text-xs text-muted-foreground">{o.description}</div>}
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {o.linked_ids.map((id) => nameOf(id)).filter(Boolean).map((x) => (
                      <Badge key={x!.id} tone="outline">{x!.value}</Badge>
                    ))}
                    {o.linked_ids.length === 0 && <span className="text-muted-foreground/60">—</span>}
                  </div>
                </TD>
                <TD className="text-end tabular-nums">{o.usage_count}</TD>
                <TD><Switch size="sm" checked={o.active} onChange={() => toggle.mutate(o)} /></TD>
                <TD className="text-end">
                  <Button size="icon-sm" variant="ghost" onClick={() => { setEditing(o); setOpen(true) }}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-danger" disabled={o.usage_count > 0}
                    onClick={async () => { if (await confirm({ title: t('catalog.deleteTitle', { value: o.value }), description: t('catalog.deleteHint'), danger: true, confirmLabel: t('common.delete') })) remove.mutate(o.id) }}>
                    <Trash2 />
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <OptionDialog category={category} option={editing} open={open} onOpenChange={setOpen} />
    </Card>
  )
}

function DesiccatorTab() {
  const { t } = useTranslation()
  const locations = useLocations()
  const [chosen, setChosen] = useState<number[] | null>(null)
  const current = (locations.data ?? []).filter((l) => l.is_desiccator).map((l) => l.id)
  const value = chosen ?? current
  const save = useAction(() => E.locations.setDesiccator(value), { success: t('catalog.desiccatorSaved'), onSuccess: () => setChosen(null) })
  return (
    <Card>
      <CardHeader icon={<Droplets />} title={t('catalog.desiccatorTitle')} description={t('catalog.desiccatorHint')}
        actions={<Button size="sm" variant="primary" disabled={!chosen} loading={save.isPending} onClick={() => save.mutate(undefined)}>{t('common.save')}</Button>} />
      <CardBody>
        {!locations.data?.length ? <EmptyState compact title={t('locations.empty')} /> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {locations.data.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted/50 has-[[data-state=checked]]:border-info has-[[data-state=checked]]:bg-info-soft/40">
                <Checkbox checked={value.includes(l.id)} onChange={(v) => setChosen(v ? [...value, l.id] : value.filter((x) => x !== l.id))} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{[l.building, l.room].filter(Boolean).join(' · ') || '—'} · {t('locations.itemsCount', { count: l.item_count })}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function GroupDialog({ group, open, onOpenChange }: { group: FieldGroup | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<FieldRow[]>([])
  useEffect(() => {
    if (!open) return
    setName(group?.name ?? '')
    setDescription(group?.description ?? '')
    setRows(group ? rowsFromGroup(group.fields) : [])
  }, [open, group])
  const save = useAction(() => {
    const body = { name, description: description || null, fields: toFieldIn(rows, false) }
    return group ? E.fieldGroups.update(group.id, body) : E.fieldGroups.create(body)
  }, { success: t('groups.saved'), onSuccess: () => onOpenChange(false) })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" icon={<Layers />} title={group ? t('groups.editTitle', { name: group.name }) : t('groups.newTitle')} description={t('groups.copyHint')}
        footer={<>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!name.trim() || !rows.length || rows.some((r) => !r.label.trim())} loading={save.isPending} onClick={() => save.mutate(undefined)}>{t('common.save')}</Button>
        </>}>
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('common.name')} required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label={t('common.description')}><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          </div>
          <FieldListEditor rows={rows} onChange={setRows} itemType="card" cardType="commercial" />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GroupsTab() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const groups = useFieldGroups()
  const [editing, setEditing] = useState<FieldGroup | null>(null)
  const [open, setOpen] = useState(false)
  const remove = useAction((id: number) => E.fieldGroups.remove(id), { success: t('groups.deleted') })
  return (
    <Card>
      <CardHeader icon={<Layers />} title={t('groups.title')} description={t('groups.description')}
        actions={<Button size="sm" variant="primary" onClick={() => { setEditing(null); setOpen(true) }}><Plus /> {t('groups.new')}</Button>} />
      <CardBody>
        {groups.isPending ? <Skeleton className="h-32" /> : !groups.data?.length ? <EmptyState compact icon={<Layers />} title={t('groups.empty')} description={t('groups.emptyHint')} /> : (
          <div className="grid gap-3 md:grid-cols-2">
            {groups.data.map((g) => (
              <div key={g.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{g.name}</div>
                    {g.description && <div className="text-xs text-muted-foreground">{g.description}</div>}
                  </div>
                  <Button size="icon-sm" variant="ghost" onClick={() => { setEditing(g); setOpen(true) }}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-danger"
                    onClick={async () => { if (await confirm({ title: t('groups.deleteTitle', { name: g.name }), description: t('groups.deleteHint'), danger: true, confirmLabel: t('common.delete') })) remove.mutate(g.id) }}>
                    <Trash2 />
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {g.fields.map((f) => {
                    const Icon = FIELD_ICON[f.field_type]
                    return <span key={f.key} className="inline-flex items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5 text-xs"><Icon className="size-3" />{f.label}</span>
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
      <GroupDialog group={editing} open={open} onOpenChange={setOpen} />
    </Card>
  )
}

export default function CatalogPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useUrlState('tab', 'project')
  return (
    <div>
      <PageHeader title={t('nav.catalog')} description={t('catalog.description')} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          {CATEGORIES.map((c) => <TabsTrigger key={c.value} value={c.value} icon={<c.icon />}>{t(`catalog.categories.${c.value}`)}</TabsTrigger>)}
          <TabsTrigger value="desiccator" icon={<Droplets />}>{t('locations.desiccator')}</TabsTrigger>
          <TabsTrigger value="groups" icon={<Layers />}>{t('groups.title')}</TabsTrigger>
        </TabsList>
        {CATEGORIES.map((c) => <TabsContent key={c.value} value={c.value}><CategoryTab category={c.value} /></TabsContent>)}
        <TabsContent value="desiccator"><DesiccatorTab /></TabsContent>
        <TabsContent value="groups"><GroupsTab /></TabsContent>
      </Tabs>
    </div>
  )
}
