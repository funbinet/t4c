import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[4px] bg-secondary', className)} />
}

/** A few stacked text lines used inside cards, lists and detail headers. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

/** Card-shaped placeholder with a header row and a body of lines. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('rounded-[4px] border bg-card p-4', className)}>
      <Skeleton className="mb-3 h-4 w-1/3" />
      <SkeletonText lines={lines} />
    </div>
  )
}

/**
 * Table-shaped placeholder. Renders a header row and `rows` body rows so the
 * layout matches the real DataTable (which is hidden on mobile, so this mirrors
 * that behaviour).
 */
export function SkeletonTable({
  columns = 4,
  rows = 6,
  className,
}: {
  columns?: number
  rows?: number
  className?: string
}) {
  return (
    <div className={cn('rounded-[4px] border bg-card', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="mono-label sticky top-0 z-10 border-b bg-[#050505] !text-[11px]">
            <tr>
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index} className="px-4 py-3 font-medium">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-3 align-middle">
                    <Skeleton className={cn('h-3', colIndex === 0 ? 'w-32' : 'w-20')} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** A grid of small cards, handy for stat tiles / asset tiles. */
export function SkeletonGrid({
  count = 6,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} lines={2} />
      ))}
    </div>
  )
}

/** Full-page-ish skeleton used as a Suspense fallback / route loader. */
export function SkeletonScreen({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <Skeleton className="h-8 w-1/3" />
      <SkeletonGrid count={3} />
      <SkeletonTable columns={5} rows={6} />
    </div>
  )
}
