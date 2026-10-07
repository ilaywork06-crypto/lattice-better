// Every HTTP call the app makes, grouped by resource. Components never build
// URLs themselves — they call these (usually through the hooks in queries.ts).
import { api, download } from './client'
import type * as T from './types'

const form = (file: File, extra: Record<string, string | null | undefined> = {}) => {
  const f = new FormData()
  f.set('file', file)
  for (const [k, v] of Object.entries(extra)) if (v) f.set(k, v)
  return f
}

export const auth = {
  signIn: (email: string, password: string) =>
    api<T.TokenOut>('/auth/token', {
      method: 'POST',
      form: new URLSearchParams({ username: email, password }),
    }),
  me: () => api<T.Me>('/auth/me'),
  loginHints: () => api<T.LoginHint[]>('/auth/login-hints'),
}

export const users = {
  list: () => api<T.User[]>('/users'),
  create: (body: T.UserCreate) => api<T.User>('/users', { method: 'POST', json: body }),
  update: (id: number, body: T.UserUpdate) =>
    api<T.User>(`/users/${id}`, { method: 'PATCH', json: body }),
  remove: (id: number) => api<void>(`/users/${id}`, { method: 'DELETE' }),
}

export const catalog = {
  list: (category?: T.CatalogCategory, activeOnly = false) =>
    api<T.CatalogOption[]>('/catalog', { query: { category, active_only: activeOnly } }),
  create: (body: T.CatalogOptionCreate) =>
    api<T.CatalogOption>('/catalog', { method: 'POST', json: body }),
  update: (id: number, body: T.CatalogOptionUpdate) =>
    api<T.CatalogOption>(`/catalog/${id}`, { method: 'PATCH', json: body }),
  remove: (id: number) => api<void>(`/catalog/${id}`, { method: 'DELETE' }),
  setLinks: (id: number, category: T.CatalogCategory, optionIds: number[]) =>
    api<T.CatalogOption>(`/catalog/${id}/links`, {
      method: 'PUT', json: { category, option_ids: optionIds },
    }),
}

export const locations = {
  list: () => api<T.Location[]>('/locations'),
  create: (body: T.LocationCreate) =>
    api<T.Location>('/locations', { method: 'POST', json: body }),
  update: (id: number, body: T.LocationUpdate) =>
    api<T.Location>(`/locations/${id}`, { method: 'PATCH', json: body }),
  remove: (id: number) => api<void>(`/locations/${id}`, { method: 'DELETE' }),
  setDesiccator: (ids: number[]) =>
    api<T.Location[]>('/locations/desiccator', { method: 'PUT', json: { location_ids: ids } }),
  buildings: () => api<T.Building[]>('/map/buildings'),
  createBuilding: (body: T.BuildingIn) =>
    api<T.Building>('/map/buildings', { method: 'POST', json: body }),
  updateBuilding: (id: number, body: T.BuildingUpdate) =>
    api<T.Building>(`/map/buildings/${id}`, { method: 'PATCH', json: body }),
  removeBuilding: (id: number) => api<void>(`/map/buildings/${id}`, { method: 'DELETE' }),
}

export interface TemplateQuery {
  type?: T.ItemType
  card_type?: T.CardType
  search?: string
}

export const templates = {
  list: (q: TemplateQuery = {}) => api<T.TemplateSummary[]>('/templates', { query: { ...q } }),
  get: (id: number) => api<T.TemplateDetail>(`/templates/${id}`),
  create: (body: T.TemplateCreate) =>
    api<T.TemplateDetail>('/templates', { method: 'POST', json: body }),
  update: (id: number, body: T.TemplateUpdate) =>
    api<T.TemplateDetail>(`/templates/${id}`, { method: 'PATCH', json: body }),
  remove: (id: number) => api<void>(`/templates/${id}`, { method: 'DELETE' }),
  uploadFile: (id: number, fieldId: number, file: File) =>
    api<T.DocumentOut>(`/templates/${id}/fields/${fieldId}/files`, {
      method: 'POST', form: form(file),
    }),
  removeFile: (id: number, docId: number) =>
    api<void>(`/templates/${id}/files/${docId}`, { method: 'DELETE' }),
}

export const fieldGroups = {
  list: (search?: string) => api<T.FieldGroup[]>('/field-groups', { query: { search } }),
  create: (body: T.FieldGroupCreate) =>
    api<T.FieldGroup>('/field-groups', { method: 'POST', json: body }),
  update: (id: number, body: Partial<T.FieldGroupCreate>) =>
    api<T.FieldGroup>(`/field-groups/${id}`, { method: 'PATCH', json: body }),
  remove: (id: number) => api<void>(`/field-groups/${id}`, { method: 'DELETE' }),
}

export interface ItemQuery {
  type?: T.ItemType
  template_id?: number
  state?: T.ItemState
  card_type?: T.CardType
  storage?: T.StorageStatus
  location_id?: number
  parent_id?: number
  top_level?: boolean
  include_destroyed?: boolean
  fits_in_template?: number
  holds_template?: number
  q?: string
  limit?: number
  offset?: number
}

export const items = {
  list: (q: ItemQuery = {}) => api<T.Page<T.ItemRow>>('/items', { query: { ...q } }),
  get: (id: number) => api<T.ItemDetail>(`/items/${id}`),
  tree: (id: number) => api<T.GraphOut>(`/items/${id}/tree`),
  create: (body: T.ItemCreate) => api<T.ItemDetail>('/items', { method: 'POST', json: body }),
  update: (id: number, body: T.ItemUpdate) =>
    api<T.ItemDetail>(`/items/${id}`, { method: 'PATCH', json: body }),
  remove: (id: number) => api<void>(`/items/${id}`, { method: 'DELETE' }),
  bulk: (body: T.BulkCommand) =>
    api<{ processed: number }>('/items/bulk', { method: 'POST', json: body }),
  move: (id: number, locationId: number, note?: string) =>
    api<T.ItemDetail>(`/items/${id}/move`, {
      method: 'POST', json: { location_id: locationId, note },
    }),
  link: (id: number, parentId: number) =>
    api<T.ItemDetail>(`/items/${id}/link`, { method: 'POST', json: { parent_id: parentId } }),
  unlink: (id: number, locationId?: number | null) =>
    api<T.ItemDetail>(`/items/${id}/unlink`, {
      method: 'POST', json: { location_id: locationId ?? null },
    }),
  setChildren: (id: number, childIds: number[]) =>
    api<T.ItemDetail>(`/items/${id}/children`, { method: 'PUT', json: { child_ids: childIds } }),
  changeState: (id: number, state: T.ItemState, note?: string) =>
    api<T.ItemDetail>(`/items/${id}/state`, { method: 'POST', json: { state, note } }),
  uploadDocument: (id: number, file: File, docType?: string) =>
    api<T.DocumentOut>(`/items/${id}/documents`, {
      method: 'POST', form: form(file, { doc_type: docType }),
    }),
  linkDocument: (id: number, body: { name: string; url: string; doc_type?: string }) =>
    api<T.DocumentOut>(`/items/${id}/links`, { method: 'POST', json: body }),
  removeDocument: (id: number, docId: number) =>
    api<void>(`/items/${id}/documents/${docId}`, { method: 'DELETE' }),
  addExtra: (id: number, body: T.ExtraIn) =>
    api<T.Extra>(`/items/${id}/extras`, { method: 'POST', json: body }),
  removeExtra: (id: number, extraId: number) =>
    api<void>(`/items/${id}/extras/${extraId}`, { method: 'DELETE' }),
}

export const uploads = {
  stage: (file: File) => api<T.DocumentOut>('/uploads', { method: 'POST', form: form(file) }),
}

export const documents = {
  downloadPath: (id: number) => `/documents/${id}/download`,
}

export const changeRequests = {
  list: (q: { status?: T.ChangeStatus; mine?: boolean; limit?: number; offset?: number }) =>
    api<T.Page<T.ChangeRequest>>('/change-requests', { query: { ...q } }),
  get: (id: number) => api<T.ChangeRequest>(`/change-requests/${id}`),
  submit: (body: T.ChangeRequestCreate) =>
    api<T.ChangeRequest>('/change-requests', { method: 'POST', json: body }),
  approve: (id: number, note?: string) =>
    api<T.ChangeRequest>(`/change-requests/${id}/approve`, { method: 'POST', json: { note } }),
  reject: (id: number, note?: string) =>
    api<T.ChangeRequest>(`/change-requests/${id}/reject`, { method: 'POST', json: { note } }),
}

export const inventory = {
  summary: () => api<T.Summary>('/inventory/summary'),
  stock: (cardType?: T.CardType) =>
    api<T.StockRow[]>('/inventory/stock', { query: { card_type: cardType } }),
  thresholds: () => api<T.Threshold[]>('/inventory/thresholds'),
  setThreshold: (templateId: number, minQuantity: number, notifyEmail?: string | null) =>
    api<T.Threshold>(`/inventory/thresholds/${templateId}`, {
      method: 'PUT', json: { min_quantity: minQuantity, notify_email: notifyEmail || null },
    }),
  removeThreshold: (templateId: number) =>
    api<void>(`/inventory/thresholds/${templateId}`, { method: 'DELETE' }),
}

export const graph = {
  templates: (rootTemplateId?: number) =>
    api<T.GraphOut>('/graph/templates', { query: { root_template_id: rootTemplateId } }),
  items: (templateId?: number) =>
    api<T.GraphOut>('/graph/items', { query: { template_id: templateId } }),
}

export const search = {
  query: (q: string, signal?: AbortSignal) =>
    api<T.SearchResults>('/search', { query: { q }, signal }),
}

export interface AuditQuery {
  item_id?: number
  template_id?: number
  period?: T.AuditPeriod
  mine?: boolean
  action?: string
  q?: string
  limit?: number
  offset?: number
}

export const audit = {
  list: (q: AuditQuery) => api<T.Page<T.AuditEntry>>('/audit', { query: { ...q } }),
  export: (q: AuditQuery) => download('/audit/export', { ...q }, 'lattice_audit.xlsx'),
}

export const spreadsheets = {
  importTemplate: (q: { template_id?: number; type?: T.ItemType }) =>
    download('/spreadsheets/import-template', q, 'lattice_import.xlsx'),
  export: (q: { template_id?: number; type?: T.ItemType }) =>
    download('/spreadsheets/export', q, 'lattice_export.xlsx'),
  import: (file: File) =>
    api<T.ImportResult>('/spreadsheets/import', { method: 'POST', form: form(file) }),
}

export const notifications = {
  list: (filter: 'all' | 'unread' | 'read', limit = 30, offset = 0) =>
    api<T.Page<T.Notification>>('/notifications', { query: { filter, limit, offset } }),
  counts: () => api<T.NotificationCounts>('/notifications/counts'),
  mark: (id: number, read = true) =>
    api<void>(`/notifications/${id}/read`, { method: 'PUT', json: { read } }),
  readAll: () => api<void>('/notifications/read-all', { method: 'POST' }),
}
