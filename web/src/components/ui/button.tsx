import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[4px] text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'text-black shadow-[0_0_12px_rgba(0,250,0,0.25)] [background:var(--grad-button)] hover:[background:var(--accent-600)]',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-[#1a1a1a]',
        outline: 'border border-border bg-card text-foreground hover:bg-secondary hover:text-mint',
        ghost: 'hover:bg-secondary hover:text-mint',
        destructive: 'bg-destructive text-black hover:bg-[#ff8585]',
        link: 'text-mint underline-offset-4 hover:text-primary hover:underline',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 rounded-[4px] px-3 text-xs',
        lg: 'h-10 rounded-[4px] px-5',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
