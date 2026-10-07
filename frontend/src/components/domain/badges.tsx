import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { CardType, ItemRef, ItemState, ItemType, StorageStatus, UserRole } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import {
  CARD_TYPE_TONE, ROLE_TONE, STATE_TONE, STORAGE_TONE, TYPE_ICON, TYPE_TONE,
} from '@/lib/domain'

export function StateBadge({ state, className }: { state: ItemState; className?: string }) {
  const { t } = useTranslation()
  return (
    <Badge tone={STATE_TONE[state]} dot className={className}>
      {t(`enums.state.${state}`)}
    </Badge>
  )
}

export function TypeBadge({ type, className }: { type: ItemType; className?: string }) {
  const { t } = useTranslation()
  const Icon = TYPE_ICON[type]
  return (
    <Badge tone={TYPE_TONE[type]} className={className}>
      <Icon />
      {t(`enums.type.${type}`)}
    </Badge>
  )
}

export function CardTypeBadge({ cardType }: { cardType?: CardType | null }) {
  const { t } = useTranslation()
  if (!cardType) return null
  return <Badge tone={CARD_TYPE_TONE[cardType]}>{t(`enums.cardType.${cardType}`)}</Badge>
}

export function StorageBadge({ storage }: { storage?: StorageStatus | null }) {
  const { t } = useTranslation()
  if (!storage) return null
  return <Badge tone={STORAGE_TONE[storage]}>{t(`enums.storage.${storage}`)}</Badge>
}

export function RoleBadge({ role }: { role: UserRole }) {
  const { t } = useTranslation()
  return <Badge tone={ROLE_TONE[role]}>{t(`enums.role.${role}`)}</Badge>
}

/** A coloured square with the item type's icon. */
export function TypeIcon({ type, size = 'md', className }: { type: ItemType; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const Icon = TYPE_ICON[type]
  const sizes = { sm: 'size-6 rounded-md [&_svg]:size-3.5', md: 'size-8 rounded-lg [&_svg]:size-4', lg: 'size-11 rounded-xl [&_svg]:size-5' }
  const tones = {
    setup: 'bg-violet-500/12 text-violet-600 dark:text-violet-300',
    assembly: 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
    card: 'bg-blue-500/12 text-blue-600 dark:text-blue-300',
  }
  return (
    <span className={cn('grid shrink-0 place-items-center', sizes[size], tones[type], className)}>
      <Icon />
    </span>
  )
}

/** "Template name · C-PRB-001" linking to the item. */
export function ItemLink({ item, showType, className }: { item: Pick<ItemRef, 'id' | 'name' | 'serial' | 'type'>; showType?: boolean; className?: string }) {
  return (
    <Link to={`/items/${item.id}`} className={cn('group inline-flex min-w-0 items-center gap-2 hover:text-primary', className)}>
      {showType && <TypeIcon type={item.type} size="sm" />}
      <span className="truncate">{item.name}</span>
      <Serial value={item.serial} className="text-muted-foreground group-hover:text-primary" />
    </Link>
  )
}

export function Serial({ value, className }: { value: string; className?: string }) {
  return (
    <bdi className={cn('mono text-[12.5px] whitespace-nowrap', className)} dir="ltr">
      {value}
    </bdi>
  )
}
