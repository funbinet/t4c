import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Boxes, Building2, Crosshair, FileArchive, Package, Play, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type StageOrganization } from '@/api'
import { STAGE_META, stageBase, useMode, type Stage } from '@/app/mode'
import { DataTable, type Column } from '@/components/common/data-table'
import { ExpandableSearch, FilterDropdown, ScreenToolbar } from '@/components/common/screen-toolbar'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { StatTile } from '@/components/common/stat-tile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNumber, statusLabel } from '@/lib/format'
import { StagePill, stageScreenTitle, statusVariant } from './chain-shared'

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'candidate', label: 'Candidate' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'paused', label: 'Paused' },
]

const NEXT_STAGE: Record<Stage, Stage | undefined> = {
  recon: 'exploit',
  exploit: 'objectives',
  objectives: undefined,
}

/**
 * Organizations are discovered once in recon and shared by every stage. This
 * screen annotates each organization with its per-stage chain counters and, in
 * exploit mode, exposes the sequential AdvanceStage governance action
 * (plan §8.3: "Advance to Objectives").
 */
export function ChainOrganizationsPage() {
  const { mode } = useMode()
  const base = stageBase(mode)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const orgs = useQuery({
    queryKey: ['chain-organizations', mode, search],
    queryFn: () => api.stageOrganizations(mode, { query: search }),
    refetchInterval: 20_000,
  })
  const overview = useQuery({
    queryKey: ['chain-overview', mode],
    queryFn: () => api.stageOverview(mode),
  })

  // Advance from the organization's durable stage (not the active view), so a
  // stale or conflicting view can never skip a chain transition.
  const advance = useMutation({
    mutationFn: (row: StageOrganization) => api.advanceStage(row.id, { fromStage: row.currentStage || mode }),
    onSuccess: (result) => {
      toast.success(`Organization advanced to ${result.currentStage || result.toStage}`)
      void queryClient.invalidateQueries({ queryKey: ['chain-organizations'] })
      void queryClient.invalidateQueries({ queryKey: ['chain-overview'] })
      void queryClient.invalidateQueries({ queryKey: ['organization-stage'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const items = useMemo(() => {
    const rows = orgs.data?.items || []
    return status ? rows.filter((row) => row.status === status) : rows
  }, [orgs.data, status])

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, row) => ({
          exploited: acc.exploited + (row.exploited || 0),
          sessions: acc.sessions + (row.sessions || 0),
          objectives: acc.objectives + (row.objectives || 0),
          artifacts: acc.artifacts + (row.artifacts || 0),
        }),
        { exploited: 0, sessions: 0, objectives: 0, artifacts: 0 },
      ),
    [items],
  )

  const columns: Column<StageOrganization>[] = [
    {
      key: 'name',
      header: 'Organization',
      cell: (row) => (
        <div className="min-w-0">
          <Link
            className="block truncate font-medium text-primary hover:underline"
            to={`${base}/organizations/${row.id}`}
          >
            {row.canonicalName || row.id}
          </Link>
          <span className="block truncate text-[11px] text-muted-foreground">
            {row.region || '—'}
            {row.uscc ? ` · ${row.uscc}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>,
    },
    {
      key: 'currentStage',
      header: 'Chain Stage',
      cell: (row) => <StagePill stage={(row.currentStage as Stage) || mode} />,
      hideOnTablet: true,
    },
    {
      key: 'exploited',
      header: 'Breached',
      cell: (row) => <span className="mono font-semibold text-foreground">{formatNumber(row.exploited)}</span>,
    },
    {
      key: 'sessions',
      header: 'Sessions',
      cell: (row) => <span className="mono">{formatNumber(row.sessions)}</span>,
      hideOnTablet: true,
    },
    {
      key: 'objectives',
      header: 'Objectives',
      cell: (row) => <span className="mono">{formatNumber(row.objectives)}</span>,
    },
    {
      key: 'artifacts',
      header: 'Artifacts',
      cell: (row) => <span className="mono">{formatNumber(row.artifacts)}</span>,
      hideOnTablet: true,
    },
    {
      key: 'tasks',
      header: 'Stage Tasks',
      cell: (row) => <span className="mono">{formatNumber(row.tasks)}</span>,
      hideOnTablet: true,
    },
    {
      key: 'actions',
      header: '',
      stopRowClick: true,
      cell: (row) => {
        const stage: Stage = (row.currentStage as Stage) || mode
        const next = NEXT_STAGE[stage]
        const canAdvance = row.canAdvance ?? Boolean(next)
        return (
          <div className="flex justify-end gap-1.5">
            <Button
            asChild
            size="icon"
            variant="ghost"
            title="Produce"
            aria-label="Produce"
          >
              <Link to={`/assets?organizationId=${row.id}`}>
                <Package />
                <span className="sr-only">Produce</span>
              </Link>
            </Button>
            {canAdvance && next ? (
              <Button
                size="sm"
                variant="outline"
                disabled={advance.isPending}
                onClick={() => advance.mutate(row)}
                title={`Advance from ${stage} to ${STAGE_META[next].shortLabel}`}
              >
                <ArrowRight className="mr-1 size-3.5" /> Advance to {STAGE_META[next].shortLabel}
              </Button>
            ) : (
              <Badge variant="outline" className="normal-case tracking-normal text-foreground">
                Terminal stage
              </Badge>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <ScreenToolbar
        left={
          <div className="flex items-center gap-2">
            <span className="mono-label">{stageScreenTitle(mode, 'Organizations')}</span>
            <StagePill stage={mode} />
            <ExpandableSearch
              value={search}
              onChange={setSearch}
              placeholder="Search organizations…"
              title="Search organizations"
            />
            <FilterDropdown options={STATUS_FILTERS} value={status} onChange={setStatus} label="Filter by status" />
          </div>
        }
        center="Organizations are discovered in recon and shared across all three stages"
        right={
          <Button
            asChild
            size="icon"
            variant="outline"
            title="New task"
            aria-label="New task"
          >
            <Link to={`${base}/tasks?create=1`}>
              <Zap />
              <span className="sr-only">New {mode} task</span>
            </Link>
          </Button>
        }
      />

      {orgs.isLoading ? <LoadingBlock variant="grid" /> : null}
      {orgs.error ? <ErrorState error={orgs.error} retry={() => orgs.refetch()} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Organizations"
          value={formatNumber(items.length)}
          icon={<Boxes className="size-4" />}
          hint={`${formatNumber(overview.data?.organizations)} in chain`}
        />
        <StatTile
          label="Breached Assets"
          value={formatNumber(totals.exploited)}
          icon={<Crosshair className="size-4" />}
          hint="Exploited across all orgs"
        />
        <StatTile
          label="Shell Sessions"
          value={formatNumber(totals.sessions)}
          icon={<Building2 className="size-4" />}
          hint={`${formatNumber(overview.data?.counts?.openSessions)} open`}
        />
        <StatTile
          label="Objectives / Artifacts"
          value={`${formatNumber(totals.objectives)} / ${formatNumber(totals.artifacts)}`}
          icon={<FileArchive className="size-4" />}
          hint="Collected produce"
        />
      </div>

      <DataTable
        rows={items}
        columns={columns}
        rowKey={(row) => row.id}
        loading={orgs.isFetching && !orgs.data}
        empty={
          <EmptyState
            title="No organizations in this stage"
            description="Organizations are discovered by recon tasks and shared across every chain stage."
            action={
              <Button asChild size="icon" title="Run recon discovery" aria-label="Run recon discovery">
                <Link to="/tasks?create=1">
                  <Play />
                  <span className="sr-only">Run recon discovery</span>
                </Link>
              </Button>
            }
          />
        }
        onRowClick={(row) => navigate(`${base}/organizations/${row.id}`)}
        rowLabel={(row) => `Open ${row.canonicalName || row.id}`}
      />
    </div>
  )
}
