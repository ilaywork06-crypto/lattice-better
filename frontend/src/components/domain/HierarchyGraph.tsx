import dagre from '@dagrejs/dagre'
import {
  Background, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider, useReactFlow,
  type Edge, type Node, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { GraphOut, ItemState, ItemType } from '@/api/types'
import { cn } from '@/lib/cn'
import { STATE_COLOR, TYPE_COLOR, TYPE_ICON } from '@/lib/domain'

interface NodeData extends Record<string, unknown> {
  label: string
  type: ItemType
  serial?: string | null
  state?: ItemState | null
  count?: number | null
  focus: boolean
  mode: 'items' | 'templates'
}

const W = 220
const H = 64

function GraphNode({ data }: NodeProps<Node<NodeData>>) {
  const { t } = useTranslation()
  const Icon = TYPE_ICON[data.type]
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2 shadow-soft transition-shadow hover:shadow-pop',
        data.focus ? 'border-primary ring-4 ring-ring' : 'border-border',
        data.state === 'destroyed' && 'opacity-55',
      )}
      style={{ width: W, height: H }}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-0 !bg-input" />
      <span
        className="grid size-9 shrink-0 place-items-center rounded-lg text-white [&_svg]:size-4"
        style={{ background: TYPE_COLOR[data.type] }}
      >
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold leading-tight">{data.label}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {data.mode === 'items' ? (
            <>
              {data.state && <span className="size-1.5 rounded-full" style={{ background: STATE_COLOR[data.state] }} />}
              <bdi className="mono">{data.serial}</bdi>
            </>
          ) : (
            <>
              <bdi className="mono">{data.serial}</bdi>
              <span>·</span>
              <span>{t('templates.units', { count: data.count ?? 0 })}</span>
            </>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-0 !bg-input" />
    </div>
  )
}

const nodeTypes = { lattice: GraphNode }

function layout(graph: GraphOut, mode: 'items' | 'templates'): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 28, ranksep: 64, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of graph.nodes) g.setNode(String(n.id), { width: W, height: H })
  for (const e of graph.edges) g.setEdge(String(e.source), String(e.target))
  dagre.layout(g)
  const nodes = graph.nodes.map((n) => {
    const p = g.node(String(n.id))
    return {
      id: String(n.id),
      type: 'lattice',
      position: { x: p.x - W / 2, y: p.y - H / 2 },
      data: {
        label: n.label, type: n.type, serial: n.serial, state: n.state, count: n.count,
        focus: graph.focus === n.id, mode,
      },
    }
  })
  const edges = graph.edges.map((e) => ({
    id: `${e.source}-${e.target}`,
    source: String(e.source),
    target: String(e.target),
    type: 'smoothstep',
    label:
      mode === 'templates' && (e.min_count || e.max_count != null)
        ? `${e.min_count ?? 0}–${e.max_count ?? '∞'}`
        : undefined,
    labelStyle: { fontSize: 11, fill: 'var(--muted-foreground)' },
    labelBgStyle: { fill: 'var(--card)' },
    style: { strokeWidth: 1.5 },
  }))
  return { nodes, edges }
}

function Inner({ graph, mode, onNodeClick, minimap }: Props) {
  const { nodes, edges } = useMemo(() => layout(graph, mode), [graph, mode])
  const flow = useReactFlow()
  useEffect(() => {
    const id = setTimeout(() => flow.fitView({ padding: 0.2, maxZoom: 1.1, duration: 250 }), 30)
    return () => clearTimeout(id)
  }, [nodes, flow])
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
      minZoom={0.2}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_, n) => onNodeClick?.(Number(n.id))}
      dir="ltr"
    >
      <Background gap={20} size={1} color="var(--border)" />
      <Controls showInteractive={false} />
      {minimap && nodes.length > 12 && (
        <MiniMap pannable zoomable nodeColor={(n) => TYPE_COLOR[(n.data as NodeData).type]} maskColor="color-mix(in oklch, var(--background) 70%, transparent)" />
      )}
    </ReactFlow>
  )
}

interface Props {
  graph: GraphOut
  mode: 'items' | 'templates'
  onNodeClick?: (id: number) => void
  minimap?: boolean
}

export function HierarchyGraph(props: Props & { className?: string }) {
  return (
    <div className={cn('h-[480px] w-full', props.className)}>
      <ReactFlowProvider>
        <Inner {...props} />
      </ReactFlowProvider>
    </div>
  )
}
