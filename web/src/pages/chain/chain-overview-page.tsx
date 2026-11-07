import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowRight,
  Boxes,
  Crosshair,
  FileArchive,
  Flag,
  Layers,
  ListChecks,
  Package,
  PieChart,
  Radar,
  ShieldAlert,
  Target,
  Terminal,
  Workflow,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, type Artifact, type ChainPlugin, type Objective, type ShellSession } from '@/api'
import { STAGES, STAGE_META, stageBase, useMode, type Stage } from '@/app/mode'
import { DataTable, type Column } from '@/components/common/data-table'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { ScreenToolbar } from '@/components/common/screen-toolbar'
import { StatTile } from '@/components/common/stat-tile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatNumber, formatTime, relativeTime } from '@/lib/format'
import { KIND_LABELS } from './chain-shared'
import { Distribution, formatBytes, severityTone, toDistribution } from './chain-produce-breakdown'

const STAGE_ICONS = { recon: Radar, exploit: Crosshair, objectives: Target } as const

/**
 * ChainOverviewPage is the mode-scoped landing screen for the exploit and
 * objectives stages (plan §8.3 / §8.5). Everything is pulled from the
 * stage-scoped endpoints so counters, SDK inventories and recent activity
 * belong to the active chain link rather than the recon surface.
 */
export function ChainOverviewPage() {
  const { mode } = useMode()
  const base = stageBase(mode)

  const overview = useQuery({
    queryKey: ['chain-overview', mode],
    queryFn: () => api.stageOverview(mode),
    refetchInterval: 15_000,
  })
  const tasks = useQuery({
    queryKey: ['chain-overview-tasks', mode],
    queryFn: () => api.stageTasks(mode, { pageSize: 6 }),
  })
  const sessions = useQuery({
    queryKey: ['chain-overview-sessions', mode],
    queryFn: () => api.sessions({ pageSize: 6 }),
    enabled: mode === 'exploit',
  })
  const objectives = useQuery({
    queryKey: ['chain-overview-objectives', mode],
    queryFn: () => api.objectives({ pageSize: 6 }),
    enabled: mode === 'objectives',
  })
  const artifacts = useQuery({
    queryKey: ['chain-overview-artifacts', mode],
    queryFn: () => api.artifacts({ pageSize: 6 }),
    enabled: mode === 'objectives',
  })
  // Server-computed produce analytics (grouped in SQL). Authoritative across
  // all objectives/artifacts, not just the recently loaded page above.
  const produceSummary = useQuery({
    queryKey: ['chain-overview-produce-summary'],
    queryFn: () => api.produceSummary(),
    enabled: mode === 'objectives',
    refetchInterval: 30_000,
  })

  const counts = overview.data?.counts || {}
  const summary = produceSummary.data?.summary
  const byKind = overview.data?.byKind || {}
  const plugins = overview.data?.plugins || []
  const next = overview.data?.nextStage as Stage | undefined

  return (
    <div className="space-y-4">
      <ScreenToolbar
        left={
          <div className="flex items-center gap-2">
            <span className="mono-label">{STAGE_META[mode].label} Overview</span>
            <Badge variant="success">{overview.data?.sdkCount ?? 0} SDKs</Badge>
          </div>
        }
        center={overview.data?.description || 'Loading stage telemetry…'}
        right={
          <>
            <Button asChild size="icon" variant="outline" title="Tasks" aria-label="Tasks">
              <Link to={`${base}/tasks`}>
                <Workflow />
                <span className="sr-only">Tasks</span>
              </Link>
            </Button>
            <Button asChild size="icon" title="New task" aria-label="New task">
              <Link to={`${base}/tasks?create=1`}>
                <Zap />
                <span className="sr-only">New {STAGE_META[mode].shortLabel} Task</span>
              </Link>
            </Button>
          </>
        }
      />

      {overview.isLoading ? <LoadingBlock variant="grid" /> : null}
      {overview.error ? <ErrorState error={overview.error} retry={() => overview.refetch()} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Organizations"
          value={formatNumber(counts.organizations)}
          icon={<Boxes className="size-4" />}
          hint="Discovered once in recon"
        />
        <StatTile
          label={mode === 'objectives' ? 'Objectives' : 'Breached Assets'}
          value={formatNumber(counts.assets)}
          icon={<Crosshair className="size-4" />}
          hint={`${formatNumber(counts.exploited)} exploited`}
        />
        <StatTile
          label={mode === 'objectives' ? 'Artifacts' : 'Shell Sessions'}
          value={formatNumber(mode === 'objectives' ? counts.artifacts : counts.sessions)}
          icon={mode === 'objectives' ? <FileArchive className="size-4" /> : <Terminal className="size-4" />}
          hint={`${formatNumber(counts.openSessions)} open sessions`}
        />
        <StatTile
          label="Stage Tasks"
          value={formatNumber(counts.tasks)}
          icon={<ListChecks className="size-4" />}
          hint={`${formatNumber(counts.findings)} stage findings`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChainProgressCard mode={mode} counts={counts} next={next} />
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
            <CardTitle className="flex items-center gap-2">
              <Layers className="size-4 text-foreground" /> Asset Classification
            </CardTitle>
            <span className="mono-label">{Object.keys(byKind).length} kinds</span>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5 pt-4">
            {Object.entries(byKind).length ? (
              Object.entries(byKind)
                .sort((a, b) => b[1] - a[1])
                .map(([kind, count]) => (
                  <span
                    key={kind}
                    className="inline-flex items-center gap-1 border px-2 py-1 text-[11px]"
                    title={kind}
                  >
                    <span className="text-muted-foreground">{KIND_LABELS[kind] || kind}</span>
                    <span className="mono font-semibold text-foreground">{formatNumber(count)}</span>
                  </span>
                ))
            ) : (
              <div className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                No classified assets in this stage yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-foreground" /> {STAGE_META[mode].shortLabel} SDK Registry
          </CardTitle>
          <span className="mono-label">{plugins.length} dedicated SDKs · minimum 8</span>
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            rows={plugins}
            rowKey={(row) => row.name || ''}
            empty={
              <EmptyState title="No SDKs registered" description="Built-in plugins are registered on first request." />
            }
            columns={pluginColumns}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
            <CardTitle className="flex items-center gap-2">
              <Workflow className="size-4 text-foreground" /> Recent {STAGE_META[mode].shortLabel} Tasks
            </CardTitle>
            <Button asChild size="icon" variant="ghost" title="View all" aria-label="View all">
              <Link to={`${base}/tasks`}>
                <ArrowRight />
                <span className="sr-only">View all</span>
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pt-4 text-xs">
            {(tasks.data?.items || []).map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                <Link className="truncate text-primary hover:underline" to={`${base}/tasks/${task.id}`}>
                  {task.name || task.id}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="mono text-muted-foreground">{task.target}</span>
                  <Badge variant="outline">{task.status || 'queued'}</Badge>
                </span>
              </div>
            ))}
            {!tasks.data?.items?.length ? (
              <div className="py-6 text-center uppercase tracking-[0.04em] text-muted-foreground">
                No stage tasks yet — start one above.
              </div>
            ) : null}
          </CardContent>
        </Card>

        {mode === 'exploit' ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
              <CardTitle className="flex items-center gap-2">
                <Terminal className="size-4 text-foreground" /> Recent Shell Sessions
              </CardTitle>
              <Button asChild size="icon" variant="ghost" title="View assets" aria-label="View assets">
                <Link to={`${base}/assets`}>
                  <ArrowRight />
                  <span className="sr-only">View assets</span>
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                rows={sessions.data?.items || []}
                rowKey={(row) => row.id || ''}
                empty={
                  <EmptyState
                    title="No shell sessions"
                    description="Successful exploits with shell capability open a session."
                  />
                }
                columns={sessionColumns}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
              <CardTitle className="flex items-center gap-2">
                <Flag className="size-4 text-foreground" /> Recent Objectives
              </CardTitle>
              <Button asChild size="icon" variant="ghost" title="Open produce" aria-label="Open produce">
                <Link to={`${base}/assets`}>
                  <Package />
                  <span className="sr-only">Open produce</span>
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                rows={objectives.data?.items || []}
                rowKey={(row) => row.id || ''}
                empty={
                  <EmptyState title="No objectives yet" description="Run objective-stage tasks to collect produce." />
                }
                columns={objectiveColumns}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {mode === 'objectives' ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
            <CardTitle className="flex items-center gap-2">
              <FileArchive className="size-4 text-foreground" /> Recent Artifacts
            </CardTitle>
            <span className="mono-label">{formatNumber(artifacts.data?.total)} collected</span>
          </CardHeader>
          <CardContent className="pt-0">
            <DataTable
              rows={artifacts.data?.items || []}
              rowKey={(row) => row.id || ''}
              empty={<EmptyState title="No artifacts" description="Objective SDKs write extracted files here." />}
              columns={artifactColumns}
            />
          </CardContent>
        </Card>
      ) : null}

      {mode === 'objectives' ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
            <CardTitle className="flex items-center gap-2">
              <PieChart className="size-4 text-foreground" /> Produce Analytics
            </CardTitle>
            <span className="mono-label">
              {formatNumber(summary?.objectives)} objectives · {formatNumber(summary?.exported)} exported ·{' '}
              {formatBytes(summary?.totalBytes || 0)} extracted
            </span>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-3">
            <Distribution title="Objectives by Status" data={toDistribution(summary?.byStatus)} />
            <Distribution
              title="Objectives by Severity"
              data={toDistribution(summary?.bySeverity)}
              toneByKey={severityTone}
            />
            <Distribution title="Artifacts by Kind" data={toDistribution(summary?.artifactsByKind)} />
          </CardContent>
          {produceSummary.isLoading ? (
            <div className="px-4 pb-4 text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
              Computing server-side produce breakdown…
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}

function ChainProgressCard({ mode, counts, next }: { mode: Stage; counts: Record<string, number>; next?: Stage }) {
  const currentIndex = STAGES.indexOf(mode)
  const railCounts: Record<Stage, number> = {
    recon: counts.assets || 0,
    exploit: counts.exploited || 0,
    objectives: counts.objectives || 0,
  }
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-foreground" /> Chain Progress
        </CardTitle>
        {next ? (
          <Link
            to={`${stageBase(next)}`}
            className="inline-flex items-center gap-1 text-[11px] text-foreground hover:underline"
          >
            Next: {STAGE_META[next].shortLabel} <ArrowRight className="size-3" />
          </Link>
        ) : (
          <span className="mono-label flex items-center gap-1 text-foreground">
            <Flag className="size-3.5" /> Terminal stage
          </span>
        )}
      </CardHeader>
      <CardContent className="grid gap-2 pt-4 sm:grid-cols-3">
        {STAGES.map((stage, index) => {
          const Icon = STAGE_ICONS[stage]
          const isCurrent = stage === mode
          const isDone = index < currentIndex
          return (
            <Link
              key={stage}
              to={stageBase(stage) || '/'}
              className={cn(
                'flex items-center gap-2 border px-3 py-2',
                isCurrent
                  ? 'border-ring'
                  : 'border-border hover:border-ring',
              )}
            >
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center border',
                  isDone
                    ? 'border-ring text-foreground'
                    : isCurrent
                      ? 'border-ring text-foreground'
                      : 'border-border text-muted-foreground',
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="mono-label block">{STAGE_META[stage].shortLabel}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {formatNumber(railCounts[stage])} {stage === 'objectives' ? 'objectives' : 'assets'}
                </span>
              </span>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}

const pluginColumns: Column<ChainPlugin>[] = [
  { key: 'name', header: 'SDK', cell: (row) => <span className="mono font-medium">{row.name}</span> },
  { key: 'type', header: 'Vector', cell: (row) => <Badge variant="info">{row.type}</Badge> },
  {
    key: 'severity',
    header: 'Severity',
    cell: (row) => (
      <Badge variant={row.severity === 'critical' ? 'danger' : row.severity === 'high' ? 'warning' : 'outline'}>
        {row.severity || 'info'}
      </Badge>
    ),
  },
  {
    key: 'description',
    header: 'Capability',
    cell: (row) => <span className="text-muted-foreground">{row.description || '—'}</span>,
    hideOnTablet: true,
  },
  {
    key: 'session',
    header: 'Session',
    cell: (row) => (
      <Badge variant={row.canOpenSession || row.requiresSession ? 'success' : 'outline'}>
        {row.canOpenSession ? 'opens' : row.requiresSession ? 'requires' : '—'}
      </Badge>
    ),
    hideOnTablet: true,
  },
]

const sessionColumns: Column<ShellSession>[] = [
  {
    key: 'host',
    header: 'Host',
    cell: (row) => (
      <span className="mono">
        {row.host}:{row.port}
      </span>
    ),
  },
  { key: 'protocol', header: 'Protocol', cell: (row) => <Badge variant="outline">{row.protocol}</Badge> },
  {
    key: 'state',
    header: 'State',
    cell: (row) => <Badge variant={row.state === 'open' ? 'success' : 'outline'}>{row.state}</Badge>,
  },
  { key: 'opened', header: 'Opened', cell: (row) => relativeTime(row.openedAt), hideOnTablet: true },
]

const objectiveColumns: Column<Objective>[] = [
  { key: 'title', header: 'Objective', cell: (row) => <span className="font-medium">{row.title}</span> },
  { key: 'kind', header: 'Kind', cell: (row) => <Badge variant="info">{row.kind}</Badge> },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => <Badge variant={row.status === 'exported' ? 'success' : 'outline'}>{row.status}</Badge>,
  },
  { key: 'time', header: 'Discovered', cell: (row) => relativeTime(row.discoveredAt), hideOnTablet: true },
]

const artifactColumns: Column<Artifact>[] = [
  { key: 'name', header: 'Artifact', cell: (row) => <span className="mono">{row.name}</span> },
  { key: 'kind', header: 'Kind', cell: (row) => <Badge variant="outline">{row.kind}</Badge> },
  { key: 'size', header: 'Size', cell: (row) => `${formatNumber(row.sizeBytes)} B`, hideOnTablet: true },
  { key: 'time', header: 'Exported', cell: (row) => formatTime(row.exportedAt), hideOnTablet: true },
]
