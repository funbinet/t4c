import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        {total} total · Page {page} of {pages}
      </span>
      <div className="flex gap-1">
        <Button
          size="icon"
          variant="outline"
          className="size-8"
          title="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft />
          <span className="sr-only">Previous</span>
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="size-8"
          title="Next page"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight />
          <span className="sr-only">Next</span>
        </Button>
      </div>
    </div>
  )
}
