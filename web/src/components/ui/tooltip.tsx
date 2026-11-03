import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger
export function TooltipContent({ className, sideOffset = 6, ...props }: TooltipPrimitive.TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-[3px] border border-border bg-secondary px-2 py-1 text-[11px] text-foreground shadow-[0_4px_20px_rgba(0,0,0,0.8)]',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}
