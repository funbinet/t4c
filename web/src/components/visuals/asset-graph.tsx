import * as echarts from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import type { GraphSnapshot } from '@/api'

echarts.use([GraphChart, TooltipComponent, CanvasRenderer])

// Severity as fill weight of ink, never hue.
const colors: Record<string, string> = {
  critical: '#2D7B49',
  high: '#2D7B49',
  medium: 'rgba(45, 123, 73, 0.62)',
  low: 'rgba(45, 123, 73, 0.38)',
  info: '#0F2516',
}

export function AssetGraph({ snapshot, onSelect }: { snapshot?: GraphSnapshot; onSelect?: (node: any) => void }) {
  const option = useMemo(() => {
    const nodes = snapshot?.nodes || []
    const edges = snapshot?.edges || []
    return {
      animation: false,
      tooltip: { trigger: 'item', textStyle: { fontSize: 11, color: '#2D7B49' } },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          force: { repulsion: 180, edgeLength: [60, 130], gravity: 0.08 },
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            color: '#2D7B49',
            formatter: (params: any) => (params.data?.showLabel ? params.name : ''),
          },
          lineStyle: { color: 'rgba(45, 123, 73, 0.38)', width: 1, curveness: 0.08 },
          emphasis: { focus: 'adjacency', lineStyle: { width: 2, color: '#2D7B49' } },
          data: nodes.map((node, index) => ({
            id: node.id,
            name: node.label,
            symbolSize: node.type === 'organization' ? 26 : node.type === 'domain' ? 18 : 12,
            showLabel: index < 20 || Boolean(node.risk),
            itemStyle: { color: node.cdn ? '#0F2516' : colors[node.risk || 'info'] || '#0F2516' },
            ...node,
          })),
          links: edges.map((edge) => ({ source: edge.source, target: edge.target, name: edge.type })),
        },
      ],
    }
  }, [snapshot])

  return (
    <div
      data-testid="asset-graph"
      className="relative h-full min-h-[260px] w-full cursor-grab overflow-hidden border bg-card active:cursor-grabbing"
    >
      <ReactECharts
        option={option}
        notMerge
        style={{ height: '100%', width: '100%' }}
        onEvents={{
          click: (params: any) => {
            if (params?.data) onSelect?.(params.data)
          },
        }}
      />
    </div>
  )
}
