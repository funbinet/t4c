import type { ReactNode } from 'react'
import { AlertTriangle, LoaderCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-[4px] border bg-card">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        {label}
      </div>
    </div>
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
    <div className="grid min-h-48 place-items-center rounded-[4px] border border-dashed bg-card px-6 text-center">
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
    <div className="rounded-[4px] border border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.06)] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 text-destructive" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.06em] text-destructive">Failed to load data</div>
          <p className="mt-1 break-words text-xs leading-5 text-[#ff9d9d]">{message}</p>
        </div>
        {retry ? (
          <Button size="sm" variant="outline" onClick={retry}>
            <RotateCcw />
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  )
}
