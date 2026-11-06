import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// SOC vital signs tile: centered mono label, dominant tabular value, muted
// context line, semantic icon. Static, no motion, no fill.
export function StatTile({
  label,
  value,
  hint,
  icon,
  testId,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  testId?: string
  className?: string
}) {
  return (
    <Card className={cn('group relative min-w-0 p-4', className)} data-testid={testId}>
      <div className="relative text-center">
        {icon ? <div className="absolute right-0 top-0 text-muted-foreground">{icon}</div> : null}
        <div className="mono-label">{label}</div>
        <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
        {hint ? (
          <div className="mt-1 truncate text-[11px] uppercase tracking-[0.04em] text-muted-foreground">{hint}</div>
        ) : null}
      </div>
    </Card>
  )
}
