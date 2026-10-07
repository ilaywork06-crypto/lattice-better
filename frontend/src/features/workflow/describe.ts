import { useTranslation } from 'react-i18next'
import { useLocations } from '@/api/queries'
import type { ChangeRequest } from '@/api/types'

/** Wrap a name in Unicode isolation marks so mixed Hebrew/English text keeps its order. */
export const isolate = (s: string | null | undefined) => `⁨${s ?? ''}⁩`

/**
 * The change, worded in the user's language. The server's English description
 * (also used in emails) is the fallback for anything not covered here.
 */
export function useDescribeChange() {
  const { t } = useTranslation()
  const locations = useLocations()
  return (cr: ChangeRequest): string => {
    const target = isolate(cr.target_name)
    const p = (cr.payload ?? {}) as Record<string, unknown>
    switch (cr.action) {
      case 'move': {
        const loc = locations.data?.find((l) => l.id === p.location_id)
        return loc ? t('describe.move', { target, location: isolate(loc.name) }) : cr.description
      }
      case 'state_change':
        return t('describe.state', { target, state: t(`enums.state.${String(p.state)}`) })
      case 'link':
        return t('describe.link', { target })
      case 'unlink':
        return t('describe.unlink', { target })
      case 'delete':
        return t('describe.delete', { target })
      case 'update':
        return t('describe.update', { target })
      case 'create':
        return cr.target_name ? t('describe.create', { template: target }) : cr.description
      case 'template_create':
        return t('describe.templateCreate', { name: isolate(String(p.name ?? '')) })
      case 'template_update':
        return t('describe.templateUpdate', { target })
      default:
        return cr.description
    }
  }
}
