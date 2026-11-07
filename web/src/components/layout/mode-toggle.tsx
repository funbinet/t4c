import { Crosshair, Radar, Target, type LucideIcon } from 'lucide-react'
import { useMode, type Stage } from '@/app/mode'
import { cn } from '@/lib/utils'

const STAGES: { stage: Stage; label: string; icon: LucideIcon }[] = [
  { stage: 'recon', label: 'Reconnaissance', icon: Radar },
  { stage: 'exploit', label: 'Exploitation', icon: Crosshair },
  { stage: 'objectives', label: 'Objectives', icon: Target },
]

// Centered icon-only three-stage toggle (plan §2.4). When the sidebar is
// collapsed the icons stack vertically so they fit the narrow rail.
export function ModeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { mode, setMode } = useMode()
  return (
    <div
      role="group"
      aria-label="Active stage"
      className={cn('flex items-center gap-1 border border-border p-1', collapsed && 'flex-col')}
    >
      {STAGES.map(({ stage, label, icon: Icon }) => {
        const active = mode === stage
        return (
          <button
            key={stage}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => setMode(stage)}
            className={cn(
              'flex h-9 w-9 items-center justify-center border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
              active && 'border-ring text-foreground',
            )}
          >
            <Icon className="size-4" />
            <span className="sr-only">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
