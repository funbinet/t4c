import { Check, Filter, Search, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'

/**
 * Screen-wide toolbar used by every console screen. Mirrors the
 * Organizations layout: expanding search on the left, a small centered
 * status note, and filter / action icon buttons on the right.
 */
export function ScreenToolbar({
  left,
  center,
  right,
}: {
  left?: ReactNode
  center?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
      <div className="flex min-w-0 items-center gap-2">{left}</div>
      <div className="min-w-0 truncate text-center text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
        {center}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">{right}</div>
    </div>
  )
}

/**
 * The Organizations-style search control: an outline Search icon button that
 * expands into an inline input; closing it clears the query.
 */
export function ExpandableSearch({
  value,
  onChange,
  onSubmit,
  placeholder,
  title = 'Search',
  className = 'w-[min(22rem,52vw)]',
}: {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder: string
  title?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <Button
        size="icon"
        variant="outline"
        title={title}
        aria-label={title}
        onClick={() => setOpen(true)}
      >
        <Search />
      </Button>
    )
  }
  return (
    <form
      className="relative"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit?.()
      }}
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-mint" />
      <Input
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-9 bg-transparent pl-8 pr-8 ${className}`}
      />
      <button
        type="button"
        title="Close search"
        aria-label="Close search"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[3px] p-0.5 text-mint transition-colors hover:text-white"
        onClick={() => {
          setOpen(false)
          onChange('')
        }}
      >
        <X className="size-3.5" />
      </button>
    </form>
  )
}

export type FilterOption = { value: string; label: string }

/**
 * Icon-only outline filter button with a dropdown popup. Selecting an option
 * applies it and closes the popup; the trigger stays an icon button.
 */
export function FilterDropdown({
  options,
  value,
  onChange,
  label,
  icon: Icon,
}: {
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
  label: string
  icon?: LucideIcon
}) {
  const TriggerIcon = Icon ?? Filter
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="outline" title={label} aria-label={label}>
          <TriggerIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value || 'all'}
            onSelect={() => onChange(option.value)}
          >
            <Check
              className={`size-3.5 ${value === option.value ? 'opacity-100' : 'opacity-0'}`}
            />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
