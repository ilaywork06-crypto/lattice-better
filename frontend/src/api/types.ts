// Friendly names for the generated API types (src/api/generated, `npm run gen:api`).
import type { components as Core } from './generated/core'
import type { components as Notify } from './generated/notifications'

type S = Core['schemas']

export type ItemType = S['ItemType']
export type CardType = S['CardType']
export type CardTracking = S['CardTracking']
export type ItemState = S['ItemState']
export type StorageStatus = S['StorageStatus']
export type UserRole = S['UserRole']
export type ChangeAction = S['ChangeAction']
export type ChangeStatus = S['ChangeStatus']
export type CatalogCategory = S['CatalogCategory']
export type FieldMode = S['FieldMode']
export type FieldType = S['FieldType']
export type Permission = S['Permission']
export type AuditPeriod = 'day' | 'week' | 'month' | 'half_year' | 'year' | 'all'

export type Me = S['Me']
export type TokenOut = S['TokenOut']
export type LoginHint = S['LoginHint']
export type User = S['UserOut']
export type UserRef = S['UserRef']
export type UserCreate = S['UserCreate']
export type UserUpdate = S['UserUpdate']

export type CatalogOption = S['CatalogOptionOut']
export type CatalogOptionCreate = S['CatalogOptionCreate']
export type CatalogOptionUpdate = S['CatalogOptionUpdate']

export type Location = S['LocationOut']
export type LocationRef = S['LocationRef']
export type LocationCreate = S['LocationCreate']
export type LocationUpdate = S['LocationUpdate']
export type Building = S['BuildingOut']
export type BuildingIn = S['BuildingIn']
export type BuildingUpdate = S['BuildingUpdate']

export type TemplateRef = S['TemplateRef']
export type TemplateSummary = S['TemplateSummary']
export type TemplateDetail = S['TemplateDetail']
export type TemplateCreate = S['TemplateCreate']
export type TemplateUpdate = S['TemplateUpdate']
export type FieldIn = S['FieldIn']
export type FieldOut = S['FieldOut']
export type ChildSlotIn = S['ChildSlotIn']
export type FieldGroup = S['FieldGroupOut']
export type FieldGroupField = S['FieldGroupFieldOut']
export type FieldGroupCreate = S['FieldGroupCreate']

export type ItemRef = S['ItemRef']
export type ItemRow = S['ItemRow']
export type ItemDetail = S['ItemDetail']
export type ItemField = S['ItemFieldOut']
export type ItemCreate = S['ItemCreate']
export type ItemUpdate = S['ItemUpdate']
export type CompositionRow = S['CompositionRow']
export type DocumentOut = S['DocumentOut']
export type Extra = S['ExtraOut']
export type ExtraIn = S['ExtraIn']
export type BulkCommand = S['BulkCommand']

export type ChangeRequest = S['ChangeRequestOut']
export type ChangeRequestCreate = S['ChangeRequestCreate']
export type AuditEntry = S['AuditOut']

export type StockRow = S['StockRow']
export type Threshold = S['ThresholdOut']
export type Summary = S['Summary']

export type GraphOut = S['GraphOut']
export type GraphNode = S['GraphNode']
export type SearchResults = S['SearchResults']
export type SearchHit = S['SearchHit']
export type ImportResult = S['ImportResult']

export type Notification = Notify['schemas']['NotificationOut']
export type NotificationCounts = Notify['schemas']['CountsOut']

export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}
