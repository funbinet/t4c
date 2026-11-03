import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, type, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-[4px] border border-input bg-secondary px-3 py-1 text-sm shadow-xs outline-none transition-colors placeholder:text-dim focus-visible:border-accent-bright disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
