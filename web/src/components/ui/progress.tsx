import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

export function Progress({ className, value = 0, ...props }: ProgressPrimitive.ProgressProps) {
  return (
    <ProgressPrimitive.Root
      className={cn('relative h-1.5 w-full overflow-hidden bg-secondary', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator className="h-full bg-ring" style={{ width: `${value}%` }} />
    </ProgressPrimitive.Root>
  )
}
