import { LayoutTemplate, Network } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useItemGraph, useTemplateGraph, useTemplates } from '@/api/queries'
import { TypeIcon } from '@/components/domain/badges'
import { HierarchyGraph } from '@/components/domain/HierarchyGraph'
import { Card } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { Segmented } from '@/components/ui/controls'
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc'
import { TYPE_COLOR } from '@/lib/domain'
import { useUrlState } from '@/lib/hooks'

export default function HierarchyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [view, setView] = useUrlState('view', 'templates')
  const [root, setRoot] = useUrlState('template')
  const templates = useTemplates()
  const rootId = root ? Number(root) : undefined
  const templateGraph = useTemplateGraph(view === 'templates' ? rootId : undefined)
  const itemGraph = useItemGraph(view === 'units' ? rootId : undefined)
  const graph = view === 'templates' ? templateGraph : itemGraph
  const options = (templates.data ?? [])
    .filter((tp) => view === 'templates' || tp.counts.total > 0)
    .map((tp) => ({ value: tp.id, label: tp.name, hint: t('templates.units', { count: tp.counts.total }), icon: <TypeIcon type={tp.type} size="sm" />, group: t(`enums.typePlural.${tp.type}`) }))

  return (
    <div>
      <PageHeader title={t('nav.hierarchy')} description={t('hierarchy.description')} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={view} onChange={(v) => setView(v)} options={[
          { value: 'templates', label: t('hierarchy.byTemplates'), icon: <LayoutTemplate /> },
          { value: 'units', label: t('hierarchy.builtUnits'), icon: <Network /> },
        ]} />
        <Combobox className="w-72" value={rootId ?? null} onChange={(v) => setRoot(v ? String(v) : '')} options={options}
          placeholder={view === 'templates' ? t('hierarchy.allTemplates') : t('hierarchy.chooseTemplate')} clearable={view === 'templates'} />
        <div className="ms-auto flex items-center gap-3 text-xs text-muted-foreground">
          {(['setup', 'assembly', 'card'] as const).map((ty) => (
            <span key={ty} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded" style={{ background: TYPE_COLOR[ty] }} />{t(`enums.type.${ty}`)}</span>
          ))}
        </div>
      </div>
      <Card className="overflow-hidden">
        {view === 'units' && !rootId ? (
          <EmptyState icon={<Network />} title={t('hierarchy.pickTemplate')} description={t('hierarchy.pickTemplateHint')} />
        ) : graph.isPending ? (
          <Skeleton className="m-5 h-[560px]" />
        ) : !graph.data?.nodes.length ? (
          <EmptyState icon={<Network />} title={t('hierarchy.empty')} />
        ) : (
          <HierarchyGraph
            graph={graph.data}
            mode={view === 'templates' ? 'templates' : 'items'}
            minimap
            className="h-[calc(100dvh-260px)] min-h-[480px]"
            onNodeClick={(id) => {
              if (view === 'templates') { setView('units'); setRoot(String(id)) } else navigate(`/items/${id}`)
            }}
          />
        )}
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">{view === 'templates' ? t('hierarchy.tipTemplates') : t('hierarchy.tipUnits')}</p>
    </div>
  )
}
