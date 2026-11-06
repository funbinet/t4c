import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// Every button is an outlined square. Nothing is filled at rest; hover or
// active fills the surface, and that is the only state change.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap border bg-transparent text-xs font-medium uppercase tracking-[0.06em] text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-ring hover:bg-accent active:bg-accent',
        secondary: 'border-border hover:bg-accent active:bg-accent',
        outline: 'border-border hover:bg-accent active:bg-accent',
        ghost: 'border-transparent hover:bg-accent active:bg-accent',
        destructive: 'border-ring hover:bg-accent active:bg-accent',
        link: 'border-transparent hover:bg-accent active:bg-accent',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-5',
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
