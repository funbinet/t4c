import * as echarts from 'echarts/core'
import { MapChart, ScatterChart } from 'echarts/charts'
import { GeoComponent, GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import ReactECharts from 'echarts-for-react'
import { useMemo, useRef } from 'react'
import worldGeo from '@/assets/world.geo.json'
import type { MapSnapshot } from '@/api'

echarts.use([MapChart, ScatterChart, GeoComponent, GridComponent, TooltipComponent, CanvasRenderer])
let registered = false
if (!registered) {
  echarts.registerMap('t4c-world', worldGeo as never)
  registered = true
}

const colors: Record<string, string> = {
  critical: '#ff6b6b',
  high: '#00fa00',
  medium: '#00cc00',
  low: '#66cc66',
  info: '#3d8c3d',
}

export function SurfaceMap({
  snapshot,
  onSelect,
}: {
  snapshot?: MapSnapshot
  onSelect?: (assetId: string, orgIds: string[]) => void
}) {
  const chartRef = useRef<any>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const chart = chartRef.current
    if (!chart) return
    const rect = event.currentTarget.getBoundingClientRect()
    const point = [event.clientX - rect.left, event.clientY - rect.top]
    try {
      if (chart.containPixel?.({ geoIndex: 0 }, point)) return
    } catch {
      // Fall through to the panel-level drag handler if ECharts is not ready.
    }
    dragRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const last = dragRef.current
    if (!last) return
    const dx = event.clientX - last.x
    const dy = event.clientY - last.y
    if (dx !== 0 || dy !== 0) {
      chartRef.current?.dispatchAction({ type: 'geoRoam', componentType: 'geo', geoIndex: 0, dx, dy })
      dragRef.current = { x: event.clientX, y: event.clientY }
    }
    event.preventDefault()
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const option = useMemo(() => {
    const points = snapshot?.points || []
    const series = Object.entries(colors).map(([risk, color]) => ({
      name: risk,
      type: 'scatter',
      coordinateSystem: 'geo',
      symbol: 'pin',
      symbolSize: risk === 'critical' ? 30 : risk === 'high' ? 26 : risk === 'medium' ? 22 : 18,
      symbolOffset: [0, '-50%'],
      label: {
        show: risk === 'critical',
        position: 'top',
        formatter: (params: any) => params.data?.name || '',
        color: '#eaffea',
        fontSize: 10,
      },
      itemStyle: { color, borderColor: '#000500', borderWidth: 1.5, opacity: 0.95 },
      emphasis: { scale: 1.4, label: { show: true } },
      data: points
        .filter((point) => (point.risk || 'info') === risk)
        .map((point) => ({
          name: point.key,
          value: [point.lon, point.lat],
          assetId: point.assetId,
          orgIds: point.orgIds || [],
        })),
    }))
    return {
      animationDuration: 250,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        borderColor: 'rgba(0, 250, 0, 0.2)',
        backgroundColor: '#0a0a0a',
        textStyle: { color: '#eaffea', fontSize: 11 },
        formatter: (params: any) => `<b>${params.name}</b><br/>${params.seriesName || ''}`,
      },
      geo: {
        map: 't4c-world',
        roam: true,
        layoutCenter: ['50%', '50%'],
        layoutSize: '115%',
        silent: false,
        itemStyle: { areaColor: '#003d00', borderColor: 'rgba(0, 250, 0, 0.25)', borderWidth: 0.7 },
        emphasis: { itemStyle: { areaColor: '#005c00' }, label: { show: false } },
        select: { disabled: true },
      },
      series,
    }
  }, [snapshot])

  return (
    <div
      data-testid="surface-map"
      className="data-grid relative h-full min-h-[260px] w-full cursor-grab overflow-hidden rounded-[4px] border bg-black active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <ReactECharts
        option={option}
        notMerge
        style={{ height: '100%', width: '100%' }}
        onChartReady={(chart) => {
          chartRef.current = chart
        }}
        onEvents={{
          click: (params: any) => {
            if (params?.data?.assetId) onSelect?.(params.data.assetId, params.data.orgIds || [])
          },
        }}
      />
      <div className="glass pointer-events-none absolute bottom-3 left-3 rounded-[4px] px-2.5 py-1.5 text-[10px] text-muted-foreground shadow-sm">
        Coordinates come from asset IPs · unlocated assets are not plotted
      </div>
    </div>
  )
}
