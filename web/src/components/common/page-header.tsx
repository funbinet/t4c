import type { ReactNode } from 'react'
import { useReveal } from '@/components/common/reveal'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} className="reveal mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.06em] sm:text-xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
