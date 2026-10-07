import { Compass } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'

export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={<Compass />}
      title={t('notFound.title')}
      description={t('notFound.text')}
      action={<Button asChild variant="primary"><Link to="/">{t('notFound.home')}</Link></Button>}
    />
  )
}
