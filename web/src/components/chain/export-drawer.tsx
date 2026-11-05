import { useQuery } from '@tanstack/react-query'
import { Check, Download, FileArchive, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api, type Artifact, type Objective } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatNumber, formatTime } from '@/lib/format'

type ExportFormat = 'json' | 'csv'

/**
 * ExportDrawer is the objectives-mode export panel. It lists the collected
 * artifacts and objectives for an organization, lets the operator select what
 * to export, and downloads the result as JSON or CSV. It is the "extract /
 * display / map / export" endpoint of the three-stage chain (plan T10).
 */
export function ExportDrawer({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [format, setFormat] = useState<ExportFormat>('json')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  const artifacts = useQuery({
    queryKey: ['export-artifacts', organizationId],
    queryFn: () => api.artifacts({ organizationId, pageSize: 200 }),
    enabled: Boolean(open),
  })
  const objectives = useQuery({
    queryKey: ['export-objectives', organizationId],
    queryFn: () => api.objectives({ organizationId, pageSize: 200 }),
    enabled: Boolean(open),
  })

  const rows = useMemo(
    () =>
      (artifacts.data?.items || []).map((a: Artifact) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        size: a.sizeBytes,
        time: a.exportedAt,
        detail: a.checksum || a.storagePath,
        type: 'artifact' as const,
      })),
    [artifacts.data],
  )
  const objectiveRows = useMemo(
    () =>
      (objectives.data?.items || []).map((o: Objective) => ({
        id: o.id,
        name: o.title,
        kind: o.kind,
        size: 0,
        time: o.discoveredAt,
        detail: o.status,
        type: 'objective' as const,
      })),
    [objectives.data],
  )

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allItems = [...rows, ...objectiveRows]
  const chosen = allItems.filter((item) => selected.has(item.id))

  const asCSV = (items: typeof allItems) => {
    const header = 'id,type,name,kind,sizeBytes,timestamp,detail'
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    return [
      header,
      ...items.map((item) =>
        [item.id, item.type, item.name, item.kind, item.size, item.time, item.detail].map(escape).join(','),
      ),
    ].join('\n')
  }

  const doExport = () => {
    if (!chosen.length) {
      toast.error('Select at least one item to export')
      return
    }
    setExporting(true)
    try {
      const payload =
        format === 'json'
          ? JSON.stringify(
              {
                exportedAt: new Date().toISOString(),
                organizationId: organizationId || null,
                stage: 'objectives',
                count: chosen.length,
                items: chosen,
              },
              null,
              2,
            )
          : asCSV(chosen)
      const mime = format === 'json' ? 'application/json' : 'text/csv'
      const blob = new Blob([payload], { type: mime })
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `t4c-objectives-${Date.now()}.${format}`
      anchor.click()
      URL.revokeObjectURL(href)
      toast.success(`Exported ${chosen.length} item(s) as ${format.toUpperCase()}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileArchive className="size-4 text-mint" /> Export Objectives
          </SheetTitle>
          <SheetDescription>
            Select collected artifacts and objectives to export as JSON or CSV. Downloads are generated client-side.
          </SheetDescription>
        </SheetHeader>

        <div className="mb-4 flex items-center gap-2">
          <span className="mono-label">Format</span>
          <div className="flex gap-1.5">
            <Button size="sm" variant={format === 'json' ? 'default' : 'outline'} onClick={() => setFormat('json')}>
              <FileJson className="mr-1 size-3.5" /> JSON
            </Button>
            <Button size="sm" variant={format === 'csv' ? 'default' : 'outline'} onClick={() => setFormat('csv')}>
              <FileSpreadsheet className="mr-1 size-3.5" /> CSV
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => setSelected(new Set(allItems.map((item) => item.id)))}
          >
            Select all
          </Button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <MiniStat label="Artifacts" value={rows.length} />
          <MiniStat label="Objectives" value={objectiveRows.length} />
          <MiniStat label="Selected" value={chosen.length} />
        </div>

        <div className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
          {artifacts.isLoading || objectives.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading collected data…
            </div>
          ) : null}
          {allItems.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 rounded-[4px] border bg-card px-3 py-2 text-xs hover:border-[rgba(0,250,0,0.35)]"
            >
              <Checkbox
                checked={selected.has(item.id)}
                onCheckedChange={() => toggle(item.id)}
                aria-label={`Select ${item.name}`}
              />
              <div className="min-w-0 flex-1">
                <div className="mono truncate font-medium">{item.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {item.kind} · {item.type === 'artifact' ? `${formatNumber(item.size)} B` : item.detail} ·{' '}
                  {formatTime(item.time)}
                </div>
              </div>
              <Badge variant={item.type === 'objective' ? 'info' : 'outline'}>{item.type}</Badge>
            </label>
          ))}
          {!artifacts.isLoading && !objectives.isLoading && !allItems.length ? (
            <div className="py-10 text-center text-xs uppercase tracking-[0.04em] text-muted-foreground">
              Nothing collected yet — run objective-stage tasks to produce artifacts.
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between border-t pt-4">
          <span className="text-[11px] text-muted-foreground">
            {chosen.length} item(s) · {format.toUpperCase()}
          </span>
          <Button size="sm" onClick={doExport} disabled={exporting || !chosen.length}>
            {exporting ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Download className="mr-1 size-3.5" />}
            Export
            <Check className="ml-1 size-3.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[3px] border bg-card px-2 py-1.5 text-center">
      <div className="mono-label">{label}</div>
      <div className="mono text-sm font-semibold text-mint">{value}</div>
    </div>
  )
}
