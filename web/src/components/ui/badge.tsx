import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// Badges are outlined ink chips. Severity is weight, not hue: critical and
// high get the strong ink outline, everything else the hairline outline.
const badgeVariants = cva('inline-flex items-center border px-2 py-0.5 text-[11px] font-medium', {
  variants: {
    variant: {
      default: 'border-border text-foreground',
      outline: 'border-border text-muted-foreground',
      success: 'border-border text-foreground',
      warning: 'border-border text-muted-foreground',
      danger: 'border-ring text-foreground',
      info: 'border-border text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
