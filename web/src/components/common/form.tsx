import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Shared form/detail primitives — single source of truth for spacing,
// casing, and section labels across every page (docs/UI-AUDIT.md §24/Phase A).

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function Fact({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('border bg-card p-3', className)}>
      <div className="mono-label">{label}</div>
      <div className="mt-1.5 text-xs font-medium">{value}</div>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mono-label mb-2">{title}</div>
      {children}
    </div>
  )
}

export function KeyValues({
  data,
  max = 20,
  primitivesOnly = true,
}: {
  data?: Record<string, unknown>
  max?: number
  primitivesOnly?: boolean
}) {
  const entries = data
    ? Object.entries(data)
        .filter(([, value]) => (primitivesOnly ? value !== null && value !== '' && typeof value !== 'object' : true))
        .slice(0, max)
    : []
  if (!entries.length) return <div className="text-xs text-muted-foreground">No structured fields</div>
  return (
    <dl className="divide-y border text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[120px_1fr] gap-2 px-3 py-2">
          <dt className="truncate text-muted-foreground">{key}</dt>
          <dd className="break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

// Breadcrumb — one pattern for all detail pages (Phase B3).
export function Breadcrumb({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
      {items.map((item, index) => (
        <span key={index} className="flex min-w-0 items-center gap-2">
          {index > 0 ? <span className="text-muted-foreground">/</span> : null}
          {item.to ? (
            <Link to={item.to} className="shrink-0 underline-offset-2 hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="truncate text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
