import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { useReveal } from '@/components/common/reveal'
import { cn } from '@/lib/utils'

// SOC "vital signs" tile: centered mono label, dominant tabular value, dim
// context line, semantic icon accent, hover lift + green glow. Research:
// docs/UI-ENHANCEMENT.md §Global (SOC dashboard patterns).
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
  const ref = useReveal<HTMLDivElement>()
  return (
    <Card
      className={cn(
        'group relative min-w-0 overflow-hidden p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(0,250,0,0.45)] hover:shadow-[0_0_22px_rgba(0,250,0,0.14)]',
        className,
      )}
      data-testid={testId}
    >
      <div ref={ref} className="reveal relative text-center">
        {icon ? (
          <div className="absolute right-0 top-0 text-dim transition-colors duration-200 group-hover:text-mint">
            {icon}
          </div>
        ) : null}
        <div className="mono-label">{label}</div>
        <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
        {hint ? (
          <div className="mt-1 truncate text-[11px] uppercase tracking-[0.04em] text-muted-foreground">{hint}</div>
        ) : null}
      </div>
    </Card>
  )
}
