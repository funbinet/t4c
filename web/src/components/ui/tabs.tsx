import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root
export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-9 items-center border border-border p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}
export function TabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-7 items-center justify-center border border-transparent px-3 text-[11px] font-medium uppercase tracking-[0.06em] data-[state=active]:border-ring data-[state=active]:text-foreground',
        className,
      )}
      {...props}
    />
  )
}
export function TabsContent({ className, ...props }: TabsPrimitive.TabsContentProps) {
  return <TabsPrimitive.Content className={cn('mt-3 outline-none', className)} {...props} />
}
