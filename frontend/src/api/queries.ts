// React Query hooks — the one way components read server state. Keys are
// hierarchical ([resource, ...params]) so a mutation can refresh what it touched.
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from './client'
import * as E from './endpoints'
import type * as T from './types'

export const keys = {
  templates: (q?: E.TemplateQuery) => ['templates', q ?? {}] as const,
  template: (id: number) => ['template', id] as const,
  items: (q: E.ItemQuery) => ['items', q] as const,
  item: (id: number) => ['item', id] as const,
  itemTree: (id: number) => ['item-tree', id] as const,
  locations: ['locations'] as const,
  buildings: ['buildings'] as const,
  catalog: ['catalog'] as const,
  users: ['users'] as const,
  fieldGroups: (search?: string) => ['field-groups', search ?? ''] as const,
  changeRequests: (q: object) => ['change-requests', q] as const,
  changeRequest: (id: number) => ['change-request', id] as const,
  summary: ['summary'] as const,
  stock: (cardType?: T.CardType) => ['stock', cardType ?? null] as const,
  thresholds: ['thresholds'] as const,
  graphTemplates: (root?: number) => ['graph-templates', root ?? null] as const,
  graphItems: (templateId?: number) => ['graph-items', templateId ?? null] as const,
  audit: (q: E.AuditQuery) => ['audit', q] as const,
  notifications: (filter: string) => ['notifications', filter] as const,
  notificationCounts: ['notification-counts'] as const,
}

// ─────────────────────────── reads ───────────────────────────
export const useTemplates = (q?: E.TemplateQuery) =>
  useQuery({ queryKey: keys.templates(q), queryFn: () => E.templates.list(q) })

export const useTemplate = (id: number | null | undefined) =>
  useQuery({ queryKey: keys.template(id ?? 0), queryFn: () => E.templates.get(id!), enabled: !!id })

export const useItems = (q: E.ItemQuery, enabled = true) =>
  useQuery({
    queryKey: keys.items(q),
    queryFn: () => E.items.list(q),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useItem = (id: number) =>
  useQuery({ queryKey: keys.item(id), queryFn: () => E.items.get(id), enabled: !!id })

export const useItemTree = (id: number) =>
  useQuery({ queryKey: keys.itemTree(id), queryFn: () => E.items.tree(id) })

export const useLocations = () =>
  useQuery({ queryKey: keys.locations, queryFn: E.locations.list, staleTime: 60_000 })

export const useBuildings = () =>
  useQuery({ queryKey: keys.buildings, queryFn: E.locations.buildings, staleTime: 60_000 })

export const useCatalog = () =>
  useQuery({ queryKey: keys.catalog, queryFn: () => E.catalog.list(), staleTime: 60_000 })

export const useUsers = () =>
  useQuery({ queryKey: keys.users, queryFn: E.users.list, staleTime: 60_000 })

export const useFieldGroups = (search?: string) =>
  useQuery({ queryKey: keys.fieldGroups(search), queryFn: () => E.fieldGroups.list(search) })

export const useChangeRequests = (q: Parameters<typeof E.changeRequests.list>[0]) =>
  useQuery({
    queryKey: keys.changeRequests(q),
    queryFn: () => E.changeRequests.list(q),
    placeholderData: keepPreviousData,
  })

export const useChangeRequest = (id: number | null) =>
  useQuery({
    queryKey: keys.changeRequest(id ?? 0),
    queryFn: () => E.changeRequests.get(id!),
    enabled: !!id,
  })

export const useSummary = () => useQuery({ queryKey: keys.summary, queryFn: E.inventory.summary })

export const useStock = (cardType?: T.CardType) =>
  useQuery({ queryKey: keys.stock(cardType), queryFn: () => E.inventory.stock(cardType) })

export const useThresholds = () =>
  useQuery({ queryKey: keys.thresholds, queryFn: E.inventory.thresholds })

export const useTemplateGraph = (root?: number) =>
  useQuery({ queryKey: keys.graphTemplates(root), queryFn: () => E.graph.templates(root) })

export const useItemGraph = (templateId?: number) =>
  useQuery({
    queryKey: keys.graphItems(templateId),
    queryFn: () => E.graph.items(templateId),
    enabled: !!templateId,
  })

export const useAudit = (q: E.AuditQuery) =>
  useQuery({ queryKey: keys.audit(q), queryFn: () => E.audit.list(q), placeholderData: keepPreviousData })

export const useNotifications = (filter: 'all' | 'unread' | 'read', limit = 30) =>
  useQuery({
    queryKey: [...keys.notifications(filter), limit],
    queryFn: () => E.notifications.list(filter, limit),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })

export const useNotificationCounts = () =>
  useQuery({
    queryKey: keys.notificationCounts,
    queryFn: E.notifications.counts,
    refetchInterval: 30_000,
    retry: false,
  })

// ─────────────────────────── writes ───────────────────────────
/** Everything the server holds is related (an item move changes stock, counts,
 *  the audit log, even the signed-in user's own name…), so after a write every
 *  active query is refreshed. Inactive ones refresh when next shown. */
export function useRefreshAll() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}

/**
 * A mutation with the app's conventions: refresh data on success, toast the
 * outcome, and surface the API's error message (form-level issues stay on the
 * returned ``error`` for the form to show next to its fields).
 */
export function useAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  options: {
    success?: string | ((result: TResult, args: TArgs) => string)
    onSuccess?: (result: TResult, args: TArgs) => void
    /** Don't toast errors that carry field issues (the form shows them). */
    quietIssues?: boolean
  } = {},
) {
  const refresh = useRefreshAll()
  const { t } = useTranslation()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result, args) => {
      await refresh()
      const msg = typeof options.success === 'function' ? options.success(result, args) : options.success
      if (msg) toast.success(msg)
      options.onSuccess?.(result, args)
    },
    onError: (error) => {
      // A multi-step action (several uploads…) may have partly happened.
      void refresh()
      if (error instanceof ApiError && options.quietIssues && error.issues.length) return
      toast.error(error instanceof ApiError ? error.message : t('errors.generic'))
    },
  })
}

export function errorIssues(error: unknown) {
  return error instanceof ApiError ? error.issues : []
}
