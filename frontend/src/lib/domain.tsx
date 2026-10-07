// How the domain looks: one place decides the icon and colour of every type,
// state and card type, so the whole app stays consistent.
import {
  AlignLeft, AtSign, Barcode, Box, Calendar, CaseSensitive, CheckSquare, CircuitBoard, Cpu,
  Factory, FileText, FolderKanban, Hash, Link2, List, ListChecks, MapPin, Network, Paperclip,
  Server, ShieldCheck, Sigma, ToggleLeft, Type, UserRound, Users,
  type LucideIcon,
} from 'lucide-react'
import type {
  CardType, ChangeAction, ChangeStatus, FieldMode, FieldType, ItemState, ItemType, StorageStatus, UserRole,
} from '@/api/types'
import type { BadgeTone } from '@/components/ui/badge'

export const ITEM_TYPES: ItemType[] = ['card', 'assembly', 'setup']
export const ITEM_STATES: ItemState[] = ['built', 'ok', 'faulty', 'destroyed']
export const LIVE_STATES = ['built', 'ok', 'faulty'] as const satisfies readonly ItemState[]
export const CARD_TYPES: CardType[] = ['house', 'copied', 'white', 'factory', 'commercial']
export const STORAGE: StorageStatus[] = ['desiccator', 'assembled', 'in_use']
export const ROLES: UserRole[] = ['viewer', 'editor', 'manager']
export const FIELD_MODES: FieldMode[] = ['fixed', 'choice', 'item']

export const TYPE_ICON: Record<ItemType, LucideIcon> = { setup: Server, assembly: Cpu, card: CircuitBoard }
export const TYPE_TONE: Record<ItemType, BadgeTone> = { setup: 'violet', assembly: 'teal', card: 'blue' }
/** Raw colours for canvases (graph, charts). */
export const TYPE_COLOR: Record<ItemType, string> = {
  setup: 'oklch(0.6 0.17 300)',
  assembly: 'oklch(0.62 0.11 185)',
  card: 'oklch(0.6 0.15 250)',
}

export const STATE_TONE: Record<ItemState, BadgeTone> = {
  built: 'info', ok: 'success', faulty: 'danger', destroyed: 'neutral',
}
export const STATE_COLOR: Record<ItemState, string> = {
  built: 'var(--info)', ok: 'var(--success)', faulty: 'var(--danger)', destroyed: 'var(--muted-foreground)',
}

export const CARD_TYPE_TONE: Record<CardType, BadgeTone> = {
  copied: 'orange', house: 'indigo', white: 'slate', factory: 'brown', commercial: 'teal',
}

export const STORAGE_TONE: Record<StorageStatus, BadgeTone> = {
  desiccator: 'info', assembled: 'violet', in_use: 'success',
}

export const ROLE_TONE: Record<UserRole, BadgeTone> = { viewer: 'slate', editor: 'orange', manager: 'violet' }

export const CHANGE_STATUS_TONE: Record<ChangeStatus, BadgeTone> = {
  pending: 'warning', approved: 'success', rejected: 'danger',
}

export const CHANGE_ACTION_ICON: Record<ChangeAction, LucideIcon> = {
  create: Box, update: Type, delete: Box, move: MapPin, link: Link2, unlink: Link2,
  state_change: ListChecks, template_create: FileText, template_update: FileText,
}

export const FIELD_ICON: Record<FieldType, LucideIcon> = {
  text: Type, description: AlignLeft, string: CaseSensitive, serial_string: Barcode, link: Link2,
  enum: List, letter: AtSign, date: Calendar, integer: Hash, decimal: Sigma, boolean: ToggleLeft,
  files: Paperclip, industry: Factory, project: FolderKanban, team: Users, managers: ShieldCheck,
  responsible: UserRound, location: MapPin, parent: Network, status: CheckSquare, quantity: Box,
}

export const FIELD_GROUPS: { group: string; types: FieldType[] }[] = [
  { group: 'text', types: ['text', 'description', 'string', 'serial_string', 'link', 'enum', 'letter'] },
  { group: 'number', types: ['integer', 'decimal', 'quantity', 'boolean', 'date'] },
  { group: 'catalog', types: ['industry', 'project', 'team'] },
  { group: 'people', types: ['managers', 'responsible'] },
  { group: 'physical', types: ['location', 'parent', 'status'] },
  { group: 'files', types: ['files'] },
]

export const SYSTEM_FIELDS: FieldType[] = [
  'industry', 'project', 'team', 'managers', 'responsible', 'location', 'parent', 'status', 'quantity',
]
export const PER_UNIT_FIELDS: FieldType[] = ['location', 'parent', 'status', 'quantity']
export const ACTION_ONLY_FIELDS: FieldType[] = ['location', 'parent', 'status']

/** Which modes a field type may use (mirrors the server's rules). */
export function allowedModes(ft: FieldType): FieldMode[] {
  if (ft === 'parent') return ['item']
  if (ft === 'files') return ['fixed', 'item']
  if (PER_UNIT_FIELDS.includes(ft)) return ['choice', 'item']
  if (ft === 'enum') return ['fixed', 'item']
  return ['fixed', 'choice', 'item']
}

export function forbiddenFor(type: ItemType, cardType: CardType | null | undefined): FieldType[] {
  const out: FieldType[] = []
  if (type === 'setup') out.push('parent', 'quantity')
  if (type === 'assembly') out.push('quantity')
  if (type === 'card' && cardType !== 'commercial') out.push('quantity')
  return out
}

export const CONTAINS: Record<ItemType, ItemType[]> = {
  setup: ['assembly', 'card'], assembly: ['card'], card: [],
}

