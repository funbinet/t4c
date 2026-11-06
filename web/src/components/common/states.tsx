import type { ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SkeletonCard, SkeletonGrid, SkeletonTable, SkeletonText } from '@/components/ui/skeleton'

export function LoadingBlock({
  label,
  variant = 'table',
}: {
  label?: string
  variant?: 'table' | 'grid' | 'card' | 'text'
}) {
  let skeleton: ReactNode
  switch (variant) {
    case 'grid':
      skeleton = <SkeletonGrid />
      break
    case 'card':
      skeleton = <SkeletonCard lines={3} />
      break
    case 'text':
      skeleton = <SkeletonText lines={4} />
      break
    case 'table':
    default:
      skeleton = <SkeletonTable columns={4} rows={6} />
  }
  // The label is exposed to assistive technology through an sr-only status so
  // callers keep a stable API and loading regions are announced. A fragment
  // keeps the DOM layout identical to the bare skeleton.
  return (
    <>
      {label ? (
        <span className="sr-only" role="status">
          {label}
        </span>
      ) : null}
      {skeleton}
    </>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="grid min-h-48 place-items-center border border-dashed bg-card px-6 text-center">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.06em]">{title}</div>
        {description ? <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{description}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  )
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Request failed. Please try again.'
  return (
    <div className="border border-ring bg-popover p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 text-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.06em] text-foreground">Unable to load</div>
          <p className="mt-1 break-words text-xs leading-5 text-foreground">{message}</p>
        </div>
        {retry ? (
          <Button size="icon" variant="outline" onClick={retry} title="Retry" aria-label="Retry">
            <RotateCcw />
            <span className="sr-only">Retry</span>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
