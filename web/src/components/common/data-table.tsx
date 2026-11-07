import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SkeletonTable } from '@/components/ui/skeleton'

export type Column<T> = {
  key: string
  header: string
  className?: string
  cell: (row: T) => ReactNode
  hideOnTablet?: boolean
  hideOnMobile?: boolean
  /** Keep clicks inside this cell from opening the row. */
  stopRowClick?: boolean
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty,
  loading,
  scrollable = false,
  onRowClick,
  rowLabel,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  empty: ReactNode
  loading?: boolean
  scrollable?: boolean
  onRowClick?: (row: T) => void
  rowLabel?: (row: T) => string
}) {
  if (loading) return <SkeletonTable columns={columns.length || 4} rows={6} />
  if (!rows.length) return <>{empty}</>
  return (
    <>
      <div
        className={cn(
          'hidden overflow-hidden border md:block',
          scrollable && 'max-h-[calc(100vh-18rem)] overflow-y-auto scrollbar-thin',
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="mono-label sticky top-0 z-10 border-b bg-popover !text-[11px]">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      'px-4 py-3 font-medium',
                      column.className,
                      column.hideOnTablet && 'hidden xl:table-cell',
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cn('hover:bg-accent', onRowClick && 'cursor-pointer')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 py-3 align-middle',
                        column.className,
                        column.hideOnTablet && 'hidden xl:table-cell',
                      )}
                      onClick={column.stopRowClick ? (event) => event.stopPropagation() : undefined}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            className={cn('border p-3', onRowClick && 'cursor-pointer')}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={
              onRowClick
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onRowClick(row)
                    }
                  }
                : undefined
            }
            tabIndex={onRowClick ? 0 : undefined}
            aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
          >
            <dl className="space-y-2">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div
                    key={column.key}
                    className="flex items-start justify-between gap-3 text-xs"
                    onClick={column.stopRowClick ? (event) => event.stopPropagation() : undefined}
                  >
                    <dt className="shrink-0 text-muted-foreground">{column.header}</dt>
                    <dd className="min-w-0 text-right">{column.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  )
}
