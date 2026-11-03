import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root
export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-9 items-center rounded-[4px] border border-border bg-secondary p-1 text-dim',
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
        'inline-flex h-7 items-center justify-center rounded-[3px] px-3 text-xs font-medium transition-colors data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:shadow-[0_0_10px_rgba(0,250,0,0.3)]',
        className,
      )}
      {...props}
    />
  )
}
export function TabsContent({ className, ...props }: TabsPrimitive.TabsContentProps) {
  return <TabsPrimitive.Content className={cn('mt-3 outline-none', className)} {...props} />
}
