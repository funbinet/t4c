import { useMemo } from 'react'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import ReactECharts from 'echarts-for-react'
import { cn } from '@/lib/utils'

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

export type RiskKey = 'critical' | 'high' | 'medium' | 'low' | 'info'

const RISK_ORDER: RiskKey[] = ['critical', 'high', 'medium', 'low', 'info']

const RISK_COLORS: Record<RiskKey, string> = {
  critical: '#ff4d4f',
  high: '#ff7a45',
  medium: '#ffc53d',
  low: '#36cfc9',
  info: '#8c8c8c',
}

const RISK_LABELS: Record<RiskKey, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
}

export function riskColor(risk: RiskKey): string {
  return RISK_COLORS[risk]
}

export function RiskDistributionChart({
  counts,
  className,
}: {
  counts: Partial<Record<RiskKey, number>>
  className?: string
}) {
  const option = useMemo(() => {
    const data = RISK_ORDER.map((key) => ({
      name: RISK_LABELS[key],
      value: counts[key] || 0,
      itemStyle: { color: RISK_COLORS[key], borderRadius: [0, 3, 3, 0] },
    }))
    const hasData = data.some((item) => item.value > 0)
    return {
      grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(10,12,16,0.95)',
        borderColor: '#2a2f3a',
        textStyle: { color: '#e6e9ef', fontSize: 12 },
        valueFormatter: (value: number) => `${value} risk(s)`,
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisLabel: { color: '#8c93a1', fontSize: 10 },
        axisLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: RISK_ORDER.map((key) => RISK_LABELS[key]).reverse(),
        axisLabel: { color: '#c2c8d2', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: hasData ? data.map((item) => ({ ...item, value: item.value })).reverse() : [],
          barWidth: '58%',
          itemStyle: { borderRadius: [0, 3, 3, 0] },
          label: {
            show: true,
            position: 'right',
            color: '#c2c8d2',
            fontSize: 11,
            formatter: (params: { value: number }) => (params.value > 0 ? `${params.value}` : ''),
          },
        },
      ],
    }
  }, [counts])

  return (
    <div className={cn('w-full', className)}>
      <ReactECharts echarts={echarts} option={option} style={{ height: 168 }} notMerge />
    </div>
  )
}

export function RiskLegend({ counts }: { counts: Partial<Record<RiskKey, number>> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {RISK_ORDER.map((key) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[2px]" style={{ background: RISK_COLORS[key] }} />
          <span className="text-muted-foreground">{RISK_LABELS[key]}</span>
          <span className="tabular-nums font-medium">{counts[key] || 0}</span>
        </span>
      ))}
    </div>
  )
}
