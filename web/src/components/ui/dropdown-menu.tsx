import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger
export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: DropdownPrimitive.DropdownMenuContentProps) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-40 rounded-[4px] border border-border bg-popover p-1 text-popover-foreground shadow-[0_8px_30px_rgba(0,0,0,0.8)]',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  )
}
export function DropdownMenuItem({ className, ...props }: DropdownPrimitive.DropdownMenuItemProps) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex cursor-default select-none items-center gap-2 rounded-[3px] px-2.5 py-2 text-xs outline-none focus:bg-secondary focus:text-mint',
        className,
      )}
      {...props}
    />
  )
}
export function DropdownMenuSeparator({ className, ...props }: DropdownPrimitive.DropdownMenuSeparatorProps) {
  return <DropdownPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
}
