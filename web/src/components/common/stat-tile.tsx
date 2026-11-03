import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { useReveal } from '@/components/common/reveal'

export function StatTile({
  label,
  value,
  hint,
  icon,
  testId,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  testId?: string
}) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <Card className="min-w-0 p-4" data-testid={testId}>
      <div ref={ref} className="reveal flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mono-label">{label}</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
          {hint ? <div className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</div> : null}
        </div>
        {icon ? <div className="rounded-[4px] bg-[rgba(0,250,0,0.08)] p-2 text-mint">{icon}</div> : null}
      </div>
    </Card>
  )
}
