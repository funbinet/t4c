import { Boxes, FileArchive, Flag, HardDriveDownload, ShieldCheck } from 'lucide-react'
import type { Artifact, Objective } from '@/api'
import { StatTile } from '@/components/common/stat-tile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { humanize } from './chain-shared'

/**
 * ProduceBreakdown is the objectives-mode analytics strip above the produce
 * tables (plan §8.5). It is computed entirely client-side from the two produce
 * queries so it stays instant and never adds a new endpoint: headline totals,
 * the objective/artifact distributions by status, kind and severity, export
 * coverage and the extracted byte volume. Read-only by design.
 */
export function ProduceBreakdown({
  objectives,
  artifacts,
  loading,
}: {
  objectives: Objective[]
  artifacts: Artifact[]
  loading?: boolean
}) {
  const objectiveCount = objectives.length
  const exported = objectives.filter((item) => item.status === 'exported').length
  const totalBytes = artifacts.reduce((sum, item) => sum + (item.sizeBytes || 0), 0)
  const checksummed = artifacts.filter((item) => Boolean(item.checksum)).length
  const exportPct = objectiveCount ? Math.round((exported / objectiveCount) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Objectives"
          value={formatNumber(objectiveCount)}
          hint="Collected produce"
          icon={<Flag className="size-4" />}
        />
        <StatTile
          label="Exported"
          value={`${formatNumber(exported)} · ${exportPct}%`}
          hint="Marked as exported"
          icon={<ShieldCheck className="size-4" />}
        />
        <StatTile
          label="Artifacts"
          value={formatNumber(artifacts.length)}
          hint={`${formatNumber(checksummed)} checksummed`}
          icon={<FileArchive className="size-4" />}
        />
        <StatTile
          label="Extracted Volume"
          value={formatBytes(totalBytes)}
          hint="Across all artifacts"
          icon={<HardDriveDownload className="size-4" />}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
          <CardTitle className="flex items-center gap-2">
            <Boxes className="size-4 text-mint" /> Produce Breakdown
          </CardTitle>
          <span className="mono-label">{objectiveCount + artifacts.length} records</span>
        </CardHeader>
        <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
          <Distribution title="Objectives by Status" data={countBy(objectives.map((item) => item.status))} />
          <Distribution title="Objectives by Kind" data={countBy(objectives.map((item) => item.kind))} />
          <Distribution
            title="Objectives by Severity"
            data={countBy(objectives.map((item) => item.severity))}
            toneByKey={severityTone}
          />
          <Distribution title="Artifacts by Kind" data={countBy(artifacts.map((item) => item.kind))} />
        </CardContent>
        {loading ? (
          <div className="px-4 pb-4 text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
            Refreshing produce telemetry…
          </div>
        ) : null}
      </Card>
    </div>
  )
}

function countBy(values: (string | undefined)[]): { key: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const raw of values) {
    const key = raw || 'unknown'
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

// toDistribution converts a server-side count map into the sorted shape
// consumed by <Distribution />. Exported so other chain screens can render the
// same bars from the /objectives/summary payload.
export function toDistribution(counts?: Record<string, number>): { key: string; count: number }[] {
  return Object.entries(counts || {})
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

export function severityTone(key: string): string {
  switch (key) {
    case 'critical':
    case 'high':
      return 'bg-[rgb(250,80,80)]'
    case 'medium':
      return 'bg-[rgb(240,180,60)]'
    case 'low':
    case 'info':
      return 'bg-[rgb(90,160,250)]'
    default:
      return 'bg-mint'
  }
}

export function Distribution({
  title,
  data,
  toneByKey,
}: {
  title: string
  data: { key: string; count: number }[]
  toneByKey?: (key: string) => string
}) {
  const max = data.reduce((peak, item) => Math.max(peak, item.count), 0)
  return (
    <div className="min-w-0">
      <div className="mono-label mb-2.5">{title}</div>
      {data.length ? (
        <div className="space-y-2">
          {data.map((item) => (
            <div key={item.key} className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-muted-foreground" title={item.key}>
                  {humanize(item.key)}
                </span>
                <span className="mono text-[11px] font-semibold text-foreground">{formatNumber(item.count)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    toneByKey ? toneByKey(item.key) : 'bg-mint',
                  )}
                  style={{ width: `${max ? Math.max(6, Math.round((item.count / max) * 100)) : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-3 text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
          No records in this dimension
        </div>
      )}
    </div>
  )
}

// Human-readable byte volume without pulling in a formatting dependency; the
// console already renders raw byte counts in the artifact tables.
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${formatNumber(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(1)} ${units[unit]}`
}
