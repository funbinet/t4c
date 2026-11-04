import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RiskBadge } from '@/components/common/badges'
import { Fact } from '@/components/common/form'
import { ErrorState, LoadingBlock } from '@/components/common/states'
import { StatTile } from '@/components/common/stat-tile'
import { AssetGraph } from '@/components/visuals/asset-graph'
import { SurfaceMap } from '@/components/visuals/surface-map'
import { formatNumber, formatTime, relativeTime, riskLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

export function OverviewPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [range, setRange] = useState(params.get('range') || '30d')
  const [visual, setVisual] = useState<'map' | 'graph'>('map')
  const selectedOrg = params.get('organizationId') || ''

  // sync range state with URL param written by AppShell header
  useEffect(() => {
    const r = params.get('range') || '30d'
    if (r !== range) setRange(r)
  }, [params, range])
  const overview = useQuery({
    queryKey: ['overview', range],
    queryFn: () => api.overview(range),
    refetchInterval: 30_000,
  })
  const map = useQuery({
    queryKey: ['map', selectedOrg],
    queryFn: () => api.map(selectedOrg || undefined),
    refetchInterval: 45_000,
  })

  // global refresh from AppShell header icon
  useEffect(() => {
    const handler = () => {
      void overview.refetch()
      void map.refetch()
    }
    window.addEventListener('t4c:refresh', handler)
    return () => window.removeEventListener('t4c:refresh', handler)
  }, [overview, map])
  const graph = useQuery({
    queryKey: ['graph', selectedOrg],
    queryFn: () => api.graph(selectedOrg),
    enabled: Boolean(selectedOrg) && visual === 'graph',
    retry: 0,
  })
  const summary = useQuery({
    queryKey: ['organization-summary', selectedOrg],
    queryFn: () => api.organizationSummary(selectedOrg),
    enabled: Boolean(selectedOrg),
  })
  const selectedRisk = useMemo(
    () => overview.data?.topOrganizations.find((item) => item.organizationId === selectedOrg),
    [overview.data, selectedOrg],
  )

  if (overview.isLoading) return <LoadingBlock label="Aggregating attack surface…" />
  if (overview.error) return <ErrorState error={overview.error} retry={() => overview.refetch()} />

  const data = overview.data!
  const critical = (data.severity.critical || 0) + (data.severity.high || 0)
  const health = data.health

  function selectOrg(orgId: string) {
    const next = new URLSearchParams(params)
    if (orgId) next.set('organizationId', orgId)
    else next.delete('organizationId')
    setParams(next, { replace: true })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 5 stat tiles — 2x2 grid + full-width fifth on small screens, 5 across on desktop */}
      <div className="mb-4 grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Organizations"
          value={formatNumber(data.summary.organizations)}
          hint={`${formatNumber(data.summary.confirmedDomains)} confirmed root domains`}
        />
        <StatTile
          label="Exposed Assets"
          value={formatNumber(
            (data.summary.domainAssets || 0) + (data.summary.ipAssets || 0) + (data.summary.services || 0),
          )}
          hint={`${formatNumber(data.summary.unlocatedAssets)} unlocated IPs`}
        />
        <StatTile
          label="Current Risks"
          value={formatNumber(data.summary.currentFindings)}
          hint={`${formatNumber(critical)} critical and high`}
        />
        <StatTile
          label="Running Tasks"
          value={formatNumber((data.tasks.running || 0) + (data.tasks.queued || 0))}
          hint={`${formatNumber(data.tasks.succeeded || 0)} completed`}
        />
        <StatTile
          label="Data Freshness"
          value={relativeTime(data.updatedAt)}
          hint={formatTime(data.updatedAt)}
          testId="overview-freshness"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* three-column layout: orgs at risk | map | recent discoveries + risk distribution */}
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[clamp(200px,18vw,280px)_1fr_1fr] xl:grid-rows-1">
        {/* left: organizations at risk */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
            <CardTitle>Organizations at Risk</CardTitle>
            <Badge variant="outline">{data.topOrganizations.length}</Badge>
          </CardHeader>
          <div className="min-h-0 flex-1 overflow-auto p-2 scrollbar-thin">
            {data.topOrganizations.length ? (
              data.topOrganizations.map((org) => (
                <button
                  key={org.organizationId}
                  className={cn(
                    'mb-1 w-full rounded-[4px] border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted',
                    selectedOrg === org.organizationId && 'border-[rgba(0,250,0,0.35)] bg-[rgba(0,250,0,0.08)]',
                  )}
                  onClick={() => selectOrg(org.organizationId)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{org.name}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {org.assetCount || 0} assets · {org.findingCount || 0} risks
                      </div>
                    </div>
                    <RiskBadge risk={org.risk} />
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-12 text-center text-xs uppercase tracking-[0.04em] text-muted-foreground">
                No organization data
                <br />
                <Link className="mt-2 inline-block text-primary hover:underline" to="/organizations">
                  Import CSV
                </Link>
              </div>
            )}
          </div>
        </Card>

        {/* center: map */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
            <div className="flex items-center gap-1 rounded-[4px] bg-muted p-1">
              <Button size="sm" variant={visual === 'map' ? 'default' : 'ghost'} onClick={() => setVisual('map')}>
                Map
              </Button>
              <Button
                size="sm"
                variant={visual === 'graph' ? 'default' : 'ghost'}
                disabled={!selectedOrg}
                onClick={() => setVisual('graph')}
              >
                Graph
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <HealthChip label="ICP" value={health.icpQuery} />
              <HealthChip label="GeoIP" value={health.geoip} />
              <HealthChip label="Neo4j" value={health.neo4j} />
              {selectedOrg ? (
                <Button size="sm" variant="ghost" onClick={() => selectOrg('')}>
                  Global
                </Button>
              ) : null}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {visual === 'map' ? (
              map.isLoading ? (
                <LoadingBlock label="Locating assets…" />
              ) : map.error ? (
                <div className="grid h-full min-h-[360px] place-items-center rounded-[4px] border bg-card p-6 text-center">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.06em]">Map unavailable</div>
                    <p className="mt-1 text-xs uppercase tracking-[0.04em] text-muted-foreground">
                      GeoIP or map data service is not responding.
                    </p>
                  </div>
                </div>
              ) : (
                <SurfaceMap snapshot={map.data} onSelect={(_id, orgIds) => orgIds[0] && selectOrg(orgIds[0])} />
              )
            ) : graph.error ? (
              <div className="grid h-full min-h-[360px] place-items-center rounded-[4px] border bg-card p-6 text-center">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.06em]">Graph unavailable</div>
                  <p className="mt-1 text-xs uppercase tracking-[0.04em] text-muted-foreground">
                    Select an organization with graph data.
                  </p>
                </div>
              </div>
            ) : graph.isLoading ? (
              <LoadingBlock label="Loading relationship graph…" />
            ) : (
              <AssetGraph
                snapshot={graph.data}
                onSelect={(node) =>
                  node.entityId &&
                  navigate(
                    node.type === 'organization' ? `/organizations/${node.entityId}` : `/assets?focus=${node.entityId}`,
                  )
                }
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
            <span>
              {map.data
                ? `Unlocated assets ${formatNumber(map.data.unlocatedAssets)} · organizations ${formatNumber(map.data.unlocatedOrganizations)}`
                : 'Geographic data not loaded'}
            </span>
            {map.data?.truncated ? <span>Data truncated</span> : null}
          </div>
        </Card>

        {/* right: recent discoveries + risk distribution stacked */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto scrollbar-thin">
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle>{selectedOrg ? 'Selected Organization' : 'Recent Discoveries'}</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {selectedOrg ? (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold">{selectedRisk?.name || 'Organization'}</div>
                    <RiskBadge risk={selectedRisk?.risk} />
                  </div>
                  {summary.data ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Fact label="Root Domains" value={summary.data.confirmedDomains || 0} />
                      <Fact label="Assets" value={(summary.data.domainAssets || 0) + (summary.data.ipAssets || 0)} />
                      <Fact label="Current Risks" value={summary.data.currentFindings || 0} />
                      <Fact label="Tasks" value={summary.data.linkedTasks || 0} />
                    </div>
                  ) : null}
                  <Button asChild className="mt-4 w-full" variant="outline">
                    <Link to={`/organizations/${selectedOrg}`}>Open Organization</Link>
                  </Button>
                </div>
              ) : data.recentFindings.length ? (
                <div className="space-y-3">
                  {data.recentFindings.slice(0, 5).map((item) => (
                    <div key={item.finding?.id} className="border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="line-clamp-2 text-xs font-medium">{item.finding?.title}</div>
                        <RiskBadge risk={item.finding?.severity} />
                      </div>
                      <div className="mt-1 truncate text-[11px] text-muted-foreground">{item.finding?.target}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
                        {relativeTime(item.finding?.createdAt)} · {item.occurrences || 1} occurrences
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-xs uppercase tracking-[0.04em] text-muted-foreground">
                  No risks in the selected time range
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle>Risk Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {(['critical', 'high', 'medium', 'low', 'info'] as const).map((key) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className={`w-10 shrink-0 risk-${key}`}>{riskLabel(key)}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full risk-bg-${key}`}
                      style={{
                        width: `${Math.min(100, ((data.severity[key] || 0) / Math.max(1, data.summary.currentFindings || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-7 text-right tabular-nums">{data.severity[key] || 0}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {data.truncated ? (
        <div className="mt-3 rounded-[4px] border bg-card px-3 py-2 text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
          Data exceeds the display limit; some organizations are omitted.
        </div>
      ) : null}
    </div>
  )
}

function HealthChip({ label, value }: { label: string; value?: string }) {
  const ok = value === 'ok'
  return (
    <span
      title={ok ? 'OK' : (value ?? 'Unknown')}
      className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-1 text-[10px] uppercase tracking-[0.04em] text-muted-foreground"
    >
      <span className={cn('size-1.5 rounded-full', ok ? 'bg-[#00fa00]' : 'bg-[#3d8c3d]')} />
      {label}
    </span>
  )
}
