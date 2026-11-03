import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

export function Progress({ className, value = 0, ...props }: ProgressPrimitive.ProgressProps) {
  return (
    <ProgressPrimitive.Root
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-secondary', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full [background:var(--grad-button)] shadow-[0_0_8px_rgba(0,250,0,0.5)] transition-all"
        style={{ width: `${value}%` }}
      />
    </ProgressPrimitive.Root>
  )
}
