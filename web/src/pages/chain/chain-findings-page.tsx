import { useQuery } from '@tanstack/react-query'
import { FileSearch, ShieldAlert, ShieldCheck, Siren } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type ChainFinding } from '@/api'
import { stageBase, useMode } from '@/app/mode'
import { RiskBadge } from '@/components/common/badges'
import { DataTable, type Column } from '@/components/common/data-table'
import { Pagination } from '@/components/common/pagination'
import { ExpandableSearch, FilterDropdown, ScreenToolbar } from '@/components/common/screen-toolbar'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { StatTile } from '@/components/common/stat-tile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatNumber, formatTime } from '@/lib/format'
import { FINDING_KIND_FILTERS, SEVERITY_FILTERS, StagePill, findingKindLabel, stageScreenTitle } from './chain-shared'

/**
 * Stage-scoped Risks screen. Findings are filtered on the server by stage and
 * kind; severity is a client-side refinement over the current page so the
 * same finding record is never duplicated per stage.
 */
export function ChainFindingsPage() {
  const { mode } = useMode()
  const base = stageBase(mode)
  const [params, setParams] = useSearchParams()
  const kind = params.get('kind') || ''
  const severity = params.get('severity') || ''
  const q = params.get('q') || ''
  const page = Math.max(1, Number(params.get('page') || 1))
  const focus = params.get('focus') || ''
  const [search, setSearch] = useState(q)

  useEffect(() => setSearch(q), [q])

  const setParam = (key: string, value: string | number) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === 0) next.delete(key)
    else next.set(key, String(value))
    setParams(next, { replace: true })
  }

  const findings = useQuery({
    queryKey: ['chain-findings', mode, kind, q, page],
    queryFn: () => api.stageFindings(mode, { kind, q, page, pageSize: 20 }),
    refetchInterval: 20_000,
  })
  const overview = useQuery({
    queryKey: ['chain-overview', mode],
    queryFn: () => api.stageOverview(mode),
  })

  const rows = useMemo(() => {
    const items = findings.data?.items || []
    return severity ? items.filter((item) => item.severity === severity) : items
  }, [findings.data, severity])

  const severityCounts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const row of findings.data?.items || []) {
      out[row.severity || 'info'] = (out[row.severity || 'info'] || 0) + 1
    }
    return out
  }, [findings.data])

  const selected = focus ? rows.find((row) => row.id === focus) || null : null

  const columns: Column<ChainFinding>[] = [
    {
      key: 'title',
      header: 'Finding',
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.title || row.id}</div>
          <div className="mono truncate text-[11px] text-muted-foreground">{row.target || '—'}</div>
        </div>
      ),
    },
    { key: 'kind', header: 'Kind', cell: (row) => <Badge variant="info">{findingKindLabel(row.kind)}</Badge> },
    { key: 'severity', header: 'Severity', cell: (row) => <RiskBadge risk={row.severity} /> },
    {
      key: 'plugin',
      header: 'SDK',
      cell: (row) => <span className="mono text-muted-foreground">{row.pluginName || '—'}</span>,
      hideOnTablet: true,
    },
    { key: 'created', header: 'Created', cell: (row) => formatTime(row.createdAt), hideOnTablet: true },
    {
      key: 'task',
      header: '',
      stopRowClick: true,
      cell: (row) =>
        row.taskId ? (
          <Button asChild size="sm" variant="ghost">
            <Link to={`${base}/tasks/${row.taskId}`}>Task</Link>
          </Button>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <ScreenToolbar
        left={
          <div className="flex items-center gap-2">
            <span className="mono-label">{stageScreenTitle(mode, 'Risks')}</span>
            <StagePill stage={mode} />
            <ExpandableSearch
              value={search}
              onChange={setSearch}
              onSubmit={() => setParam('q', search)}
              placeholder="Search finding title or target…"
              title="Search stage findings"
            />
            <FilterDropdown
              options={FINDING_KIND_FILTERS}
              value={kind}
              onChange={(value) => setParam('kind', value)}
              label="Filter by finding kind"
            />
            <FilterDropdown
              options={SEVERITY_FILTERS}
              value={severity}
              onChange={(value) => setParam('severity', value)}
              label="Filter by severity"
            />
          </div>
        }
        center="Findings emitted by stage SDKs — exploit and objective results stay in their own stage"
        right={<span className="mono-label">{formatNumber(findings.data?.total)} stage findings</span>}
      />

      {findings.isLoading ? <LoadingBlock variant="grid" /> : null}
      {findings.error ? <ErrorState error={findings.error} retry={() => findings.refetch()} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Stage Findings"
          value={formatNumber(findings.data?.total ?? overview.data?.counts?.findings)}
          icon={<ShieldAlert className="size-4" />}
          hint="Current stage only"
        />
        <StatTile
          label="Critical / High"
          value={formatNumber((severityCounts.critical || 0) + (severityCounts.high || 0))}
          icon={<Siren className="size-4" />}
          hint="On the current page"
        />
        <StatTile
          label="Medium"
          value={formatNumber(severityCounts.medium)}
          icon={<FileSearch className="size-4" />}
          hint="On the current page"
        />
        <StatTile
          label="Low / Info"
          value={formatNumber((severityCounts.low || 0) + (severityCounts.info || 0))}
          icon={<ShieldCheck className="size-4" />}
          hint="On the current page"
        />
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        loading={findings.isFetching && !findings.data}
        empty={
          <EmptyState
            title="No findings in this stage"
            description="Exploit and objective SDKs emit findings when they validate or collect a result."
          />
        }
        onRowClick={(row) => setParam('focus', row.id)}
        rowLabel={(row) => `Inspect ${row.title || row.id}`}
      />
      <Pagination
        page={page}
        pageSize={20}
        total={findings.data?.total || 0}
        onChange={(value) => setParam('page', value)}
      />

      <Sheet open={Boolean(focus)} onOpenChange={(open) => !open && setParam('focus', '')}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selected?.title || 'Finding detail'}</SheetTitle>
            <SheetDescription>Stage-scoped finding emitted by a chain SDK.</SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap gap-1.5">
                <RiskBadge risk={selected.severity} />
                <Badge variant="info">{findingKindLabel(selected.kind)}</Badge>
                <StagePill stage={mode} />
              </div>
              <dl className="grid grid-cols-2 gap-2 border bg-card p-3">
                <Fact label="Target" value={selected.target || '—'} />
                <Fact label="Plugin" value={selected.pluginName || '—'} />
                <Fact label="Kind" value={findingKindLabel(selected.kind)} />
                <Fact label="Stage" value={selected.stage || mode} />
                <Fact label="Dedupe Key" value={selected.dedupeKey || '—'} />
                <Fact label="Created" value={formatTime(selected.createdAt)} />
              </dl>
              {selected.taskId ? (
                <Button asChild size="sm" variant="outline">
                  <Link to={`${base}/tasks/${selected.taskId}`}>Open originating task</Link>
                </Button>
              ) : null}
              <div>
                <div className="mono-label mb-1.5">Evidence</div>
                <pre className="max-h-64 overflow-auto border bg-accent p-3 font-mono text-[11px] leading-relaxed text-foreground scrollbar-thin">
                  {JSON.stringify(selected.data || {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-xs uppercase tracking-[0.04em] text-muted-foreground">
              This finding is not on the current page.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="mono-label">{label}</dt>
      <dd className="mt-0.5 break-words">{value}</dd>
    </div>
  )
}
