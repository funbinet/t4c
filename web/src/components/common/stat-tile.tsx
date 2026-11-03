import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { useReveal } from '@/components/common/reveal'

export function StatTile({
  label,
  value,
  hint,
  testId,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  testId?: string
}) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <Card className="min-w-0 p-4" data-testid={testId}>
      <div ref={ref} className="reveal">
        <div className="mono-label">{label}</div>
        <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
        {hint ? (
          <div className="mt-1 truncate text-[11px] uppercase tracking-[0.04em] text-muted-foreground">{hint}</div>
        ) : null}
      </div>
    </Card>
  )
}
