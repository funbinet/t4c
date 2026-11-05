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
      className={cn('flex items-center gap-1 rounded-[4px] border border-border p-1', collapsed && 'flex-col')}
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
              'flex h-9 w-9 items-center justify-center rounded-[4px] text-muted-foreground transition-all duration-200 hover:bg-[rgba(0,250,0,0.06)] hover:text-white',
              active && 'bg-[rgba(0,250,0,0.1)] text-mint hover:bg-[rgba(0,250,0,0.12)]',
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
