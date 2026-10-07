import {
  Bell, CircuitBoard, Cpu, FileSpreadsheet, GitPullRequestArrow, History,
  LayoutDashboard, LayoutTemplate, MapPinned, Network, Server, Tags, Users, Warehouse,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '@/api/types'

export interface NavItem {
  to: string
  label: string // i18n key
  icon: LucideIcon
  permission?: Permission
  badge?: 'pending' | 'unread'
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    label: 'nav.groups.overview',
    items: [{ to: '/', label: 'nav.dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'nav.groups.assets',
    items: [
      { to: '/cards', label: 'nav.cards', icon: CircuitBoard },
      { to: '/assemblies', label: 'nav.assemblies', icon: Cpu },
      { to: '/setups', label: 'nav.setups', icon: Server },
      { to: '/templates', label: 'nav.templates', icon: LayoutTemplate },
    ],
  },
  {
    label: 'nav.groups.stock',
    items: [
      { to: '/inventory', label: 'nav.inventory', icon: Warehouse },
      { to: '/locations', label: 'nav.locations', icon: MapPinned },
      { to: '/hierarchy', label: 'nav.hierarchy', icon: Network },
    ],
  },
  {
    label: 'nav.groups.activity',
    items: [
      { to: '/change-requests', label: 'nav.changeRequests', icon: GitPullRequestArrow, badge: 'pending' },
      { to: '/notifications', label: 'nav.notifications', icon: Bell, badge: 'unread' },
      { to: '/audit', label: 'nav.audit', icon: History },
      { to: '/data', label: 'nav.data', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'nav.groups.admin',
    items: [
      { to: '/admin/catalog', label: 'nav.catalog', icon: Tags, permission: 'manage_catalog' },
      { to: '/admin/users', label: 'nav.users', icon: Users, permission: 'manage_users' },
    ],
  },
]

