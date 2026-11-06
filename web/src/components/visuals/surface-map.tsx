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

// Severity as fill weight of ink, never hue.
const colors: Record<string, string> = {
  critical: '#2D7B49',
  high: '#2D7B49',
  medium: 'rgba(45, 123, 73, 0.62)',
  low: 'rgba(45, 123, 73, 0.38)',
  info: '#0F2516',
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
        color: '#2D7B49',
        fontSize: 10,
      },
      itemStyle: { color, borderColor: '#090A08', borderWidth: 1.5, opacity: 0.95 },
      emphasis: { label: { show: true } },
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
      animation: false,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        borderColor: '#2D7B49',
        backgroundColor: '#0F2516',
        textStyle: { color: '#2D7B49', fontSize: 11 },
        formatter: (params: any) => `<b>${params.name}</b><br/>${params.seriesName || ''}`,
      },
      geo: {
        map: 't4c-world',
        roam: true,
        layoutCenter: ['50%', '50%'],
        layoutSize: '115%',
        silent: false,
        itemStyle: { areaColor: '#0F2516', borderColor: 'rgba(45, 123, 73, 0.38)', borderWidth: 0.7 },
        emphasis: { itemStyle: { areaColor: 'rgba(45, 123, 73, 0.62)' }, label: { show: false } },
        select: { disabled: true },
      },
      series,
    }
  }, [snapshot])

  return (
    <div
      data-testid="surface-map"
      className="relative h-full min-h-[260px] w-full cursor-grab overflow-hidden border bg-background active:cursor-grabbing"
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
      <div className="pointer-events-none absolute bottom-3 left-3 border bg-popover px-2.5 py-1.5 text-[10px] text-muted-foreground">
        Coordinates come from asset IPs · unlocated assets are not plotted
      </div>
    </div>
  )
}
