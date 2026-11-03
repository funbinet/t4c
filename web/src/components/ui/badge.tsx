import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium', {
  variants: {
    variant: {
      default: 'border-[rgba(0,250,0,0.24)] bg-[rgba(0,250,0,0.06)] text-mint',
      outline: 'border-border bg-card text-muted-foreground',
      success: 'border-[rgba(0,250,0,0.4)] bg-[rgba(0,250,0,0.1)] text-[#00fa00]',
      warning: 'border-[rgba(0,204,0,0.4)] bg-[rgba(0,204,0,0.08)] text-[#00cc00]',
      danger: 'border-[rgba(255,107,107,0.4)] bg-[rgba(255,107,107,0.08)] text-destructive',
      info: 'border-[rgba(180,255,180,0.3)] bg-[rgba(180,255,180,0.06)] text-mint',
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
