import { useQuery } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as E from '@/api/endpoints'
import { useCatalog, useLocations, useUsers } from '@/api/queries'
import type { CatalogCategory, ItemRef, ItemRow } from '@/api/types'
import { Combobox, MultiCombobox, type ComboOption } from '@/components/ui/combobox'
import { useDebounced } from '@/lib/hooks'
import { TypeIcon } from './badges'

interface PickerProps {
  value: number | null | undefined
  onChange: (v: number | null) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  id?: string
  /** Restrict to these ids (a template's list). */
  only?: number[]
}

export function LocationPicker({ value, onChange, placeholder, disabled, invalid, id, only, exclude }: PickerProps & { exclude?: number[] }) {
  const { t } = useTranslation()
  const locations = useLocations()
  const options: ComboOption<number>[] = (locations.data ?? [])
    .filter((l) => (!only || only.includes(l.id)) && !exclude?.includes(l.id))
    .map((l) => ({
      value: l.id,
      label: l.name,
      hint: [l.building, l.room].filter(Boolean).join(' · ') || undefined,
      icon: <MapPin className={l.is_desiccator ? 'text-info' : 'text-muted-foreground'} />,
      group: l.is_desiccator ? t('locations.desiccator') : t('locations.other'),
    }))
  return (
    <Combobox id={id} value={value} onChange={onChange} options={options} loading={locations.isPending}
      placeholder={placeholder ?? t('pickers.location')} disabled={disabled} invalid={invalid} />
  )
}

export function CatalogPicker({ category, value, onChange, placeholder, disabled, invalid, id, only }: PickerProps & { category: CatalogCategory }) {
  const { t } = useTranslation()
  const catalog = useCatalog()
  const options = (catalog.data ?? [])
    .filter((o) => o.category === category && (o.active || o.id === value) && (!only || only.includes(o.id)))
    .map((o) => ({ value: o.id, label: o.value, hint: o.description ?? undefined }))
  return (
    <Combobox id={id} value={value} onChange={onChange} options={options} loading={catalog.isPending}
      placeholder={placeholder ?? t(`pickers.${category}`)} disabled={disabled} invalid={invalid} />
  )
}

export function UserPicker({ value, onChange, placeholder, disabled, invalid, id, only, managersOnly }: PickerProps & { managersOnly?: boolean }) {
  const { t } = useTranslation()
  const users = useUsers()
  const options = (users.data ?? [])
    .filter((u) => (u.is_active || u.id === value) && (!managersOnly || u.role === 'manager') && (!only || only.includes(u.id)))
    .map((u) => ({ value: u.id, label: u.full_name, hint: u.email }))
  return (
    <Combobox id={id} value={value} onChange={onChange} options={options} loading={users.isPending}
      placeholder={placeholder ?? t('pickers.user')} disabled={disabled} invalid={invalid} />
  )
}

export function ManagersPicker({ value, onChange, disabled, invalid, only }: {
  value: number[]; onChange: (v: number[]) => void; disabled?: boolean; invalid?: boolean; only?: number[]
}) {
  const { t } = useTranslation()
  const users = useUsers()
  const options = (users.data ?? [])
    .filter((u) => u.role === 'manager' && (u.is_active || value.includes(u.id)) && (!only || only.includes(u.id)))
    .map((u) => ({ value: u.id, label: u.full_name, hint: u.email }))
  return <MultiCombobox value={value} onChange={onChange} options={options} placeholder={t('pickers.managers')}
    disabled={disabled} invalid={invalid} loading={users.isPending} />
}

function itemOption(i: ItemRow): ComboOption<number> {
  return {
    value: i.id,
    label: `${i.name} · ${i.serial}`,
    hint: [i.location?.name, i.parent ? `⊂ ${i.parent.serial}` : null].filter(Boolean).join(' · ') || undefined,
    icon: <TypeIcon type={i.type} size="sm" />,
  }
}

/** Search items on the server (by name or serial), within a filter. */
export function ItemPicker({ value, onChange, query, placeholder, disabled, invalid, exclude, id }: PickerProps & {
  query: E.ItemQuery
  exclude?: number[]
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const q = useDebounced(text, 200)
  const results = useQuery({
    queryKey: ['item-picker', query, q],
    queryFn: () => E.items.list({ ...query, q: q || undefined, limit: 30 }),
  })
  const current = useQuery({
    queryKey: ['item', value],
    queryFn: () => E.items.get(value!),
    enabled: !!value && !results.data?.items.some((i) => i.id === value),
  })
  const options = useMemo(() => {
    const list = (results.data?.items ?? []).filter((i) => !exclude?.includes(i.id)).map(itemOption)
    if (value && current.data && !list.some((o) => o.value === value)) list.unshift(itemOption(current.data))
    return list
  }, [results.data, current.data, value, exclude])
  return (
    <Combobox id={id} value={value} onChange={onChange} options={options} onSearch={setText} loading={results.isPending}
      placeholder={placeholder ?? t('pickers.item')} disabled={disabled} invalid={invalid}
      searchPlaceholder={t('pickers.searchItems')} />
  )
}

/** Choose several items (e.g. a container's contents). */
export function ItemsMultiPicker({ value, onChange, query, exclude, seed }: {
  value: number[]; onChange: (v: number[]) => void; query: E.ItemQuery; exclude?: number[]
  /** Items already chosen, so their chips have names before any search. */
  seed?: ItemRef[]
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const q = useDebounced(text, 200)
  const results = useQuery({
    queryKey: ['item-picker', query, q],
    queryFn: () => E.items.list({ ...query, q: q || undefined, limit: 50 }),
  })
  const [known, setKnown] = useState<Map<number, ComboOption<number>>>(
    () => new Map((seed ?? []).map((i) => [i.id, {
      value: i.id, label: `${i.name} · ${i.serial}`, icon: <TypeIcon type={i.type} size="sm" />,
    }])),
  )
  const options = useMemo(() => {
    const map = new Map(known)
    for (const i of results.data?.items ?? []) if (!exclude?.includes(i.id)) map.set(i.id, itemOption(i))
    return [...map.values()]
  }, [results.data, known, exclude])
  return (
    <MultiCombobox
      value={value}
      onChange={(v) => {
        setKnown(new Map(options.filter((o) => v.includes(o.value)).map((o) => [o.value, o])))
        onChange(v)
      }}
      options={options}
      onSearch={setText}
      loading={results.isPending}
      placeholder={t('pickers.items')}
      searchPlaceholder={t('pickers.searchItems')}
    />
  )
}
