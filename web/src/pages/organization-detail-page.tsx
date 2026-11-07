import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Check,
  Crosshair,
  Download,
  FileText,
  Globe,
  History,
  LayoutDashboard,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  Workflow,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  api,
  type ChainAsset,
  type ChainFinding,
  type ChainTask,
  type EasmAsset,
  type FindingItem,
  type OrganizationDomain,
  type Task,
} from '@/api'
import { download } from '@/api/client'
import { RiskBadge, StatusBadge } from '@/components/common/badges'
import { DataTable } from '@/components/common/data-table'
import { Breadcrumb, Field } from '@/components/common/form'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { StatTile } from '@/components/common/stat-tile'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { AssetGraph } from '@/components/visuals/asset-graph'
import { RiskDistributionChart, RiskLegend } from '@/components/visuals/risk-distribution'
import { SurfaceMap } from '@/components/visuals/surface-map'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { canWrite } from '@/lib/access'
import { useAuth } from '@/app/auth'
import { STAGE_META, stageBase, useMode } from '@/app/mode'
import { formatNumber, formatTime, relativeTime } from '@/lib/format'
import { kindLabel } from './chain/chain-shared'

const reconTabs = ['overview', 'domains', 'assets', 'findings', 'tasks'] as const
const stageTabs = ['overview', 'assets', 'findings', 'tasks'] as const

export function OrganizationDetailPage() {
  const { id = '' } = useParams()
  const { role } = useAuth()
  const { mode } = useMode()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const isRecon = mode === 'recon'
  const base = stageBase(mode)
  const tabList: readonly string[] = isRecon ? reconTabs : stageTabs
  const tabParam = params.get('tab') || 'overview'
  const tab: string = tabList.includes(tabParam) ? tabParam : 'overview'
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [evidenceView, setEvidenceView] = useState<unknown>(null)
  const [rejectTarget, setRejectTarget] = useState<OrganizationDomain | null>(null)
  const [domainEditTarget, setDomainEditTarget] = useState<OrganizationDomain | null>(null)
  const [domainForm, setDomainForm] = useState({ siteName: '', homeSite: '', icpNo: '', auditDate: '' })
  const [rejectReason, setRejectReason] = useState('Manually removed')
  const [domainText, setDomainText] = useState('')
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])
  const [scanDomains, setScanDomains] = useState<string[]>([])
  const [orgForm, setOrgForm] = useState({ canonicalName: '', aliases: '', region: '', uscc: '' })

  const organization = useQuery({
    queryKey: ['organization', id],
    queryFn: () => api.organization(id),
    enabled: Boolean(id),
  })
  // Recon-only workspace queries: domains, ICP ownership and the recon surface
  // are meaningless in exploit/objectives, so they never run outside recon
  // (strict mode isolation).
  const summary = useQuery({
    queryKey: ['organization-summary', id],
    queryFn: () => api.organizationSummary(id),
    enabled: Boolean(id) && isRecon,
  })
  const domains = useQuery({
    queryKey: ['organization-domains', id],
    queryFn: () => api.domains(id),
    enabled: Boolean(id) && isRecon,
  })
  const assets = useQuery({
    queryKey: ['organization-assets', id],
    queryFn: () => api.organizationAssets(id, { page: 1, pageSize: 100 }),
    enabled: Boolean(id) && isRecon,
  })
  const findings = useQuery({
    queryKey: ['organization-findings', id],
    queryFn: () => api.organizationFindings(id, { view: 'current', page: 1, pageSize: 100 }),
    enabled: Boolean(id) && isRecon,
  })
  const tasks = useQuery({
    queryKey: ['organization-tasks', id],
    queryFn: () => api.organizationTasks(id, { page: 1, pageSize: 100 }),
    enabled: Boolean(id) && isRecon,
  })
  // The organization's own map (plan §8.4): risk-colored pins scoped to this
  // organization. It serves every mode; the graph is a recon projection.
  const orgMap = useQuery({
    queryKey: ['organization-map', id],
    queryFn: () => api.map(id),
    enabled: Boolean(id),
  })
  const orgGraph = useQuery({
    queryKey: ['organization-graph', id],
    queryFn: () => api.graph(id),
    enabled: Boolean(id) && isRecon,
  })

  // Stage-mode queries: every read is scoped to the active stage AND this
  // organization, sourced exclusively from the stage endpoints.
  const stageAssetsQ = useQuery({
    queryKey: ['org-stage-assets', mode, id],
    queryFn: () => api.stageAssets(mode, { organizationId: id, pageSize: 100 }),
    enabled: Boolean(id) && !isRecon,
  })
  const stageFindingsQ = useQuery({
    queryKey: ['org-stage-findings', mode, id],
    queryFn: () => api.stageFindings(mode, { organizationId: id, pageSize: 100 }),
    enabled: Boolean(id) && !isRecon,
  })
  const stageTasksQ = useQuery({
    queryKey: ['org-stage-tasks', mode, id],
    queryFn: () => api.stageTasks(mode, { organizationId: id, pageSize: 100, sort: 'createdAt:desc' }),
    enabled: Boolean(id) && !isRecon,
  })
  const sessionsQ = useQuery({
    queryKey: ['org-sessions', id],
    queryFn: () => api.sessions({ organizationId: id, pageSize: 100 }),
    enabled: Boolean(id) && mode === 'exploit',
  })
  const objectivesQ = useQuery({
    queryKey: ['org-objectives', id],
    queryFn: () => api.objectives({ organizationId: id, pageSize: 100 }),
    enabled: Boolean(id) && mode === 'objectives',
  })
  const artifactsQ = useQuery({
    queryKey: ['org-artifacts', id],
    queryFn: () => api.artifacts({ organizationId: id, pageSize: 100 }),
    enabled: Boolean(id) && mode === 'objectives',
  })

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['organization', id] })
    void queryClient.invalidateQueries({ queryKey: ['organization-domains', id] })
    void queryClient.invalidateQueries({ queryKey: ['organization-summary', id] })
    void queryClient.invalidateQueries({ queryKey: ['organization-assets', id] })
    void queryClient.invalidateQueries({ queryKey: ['organization-findings', id] })
    void queryClient.invalidateQueries({ queryKey: ['organization-tasks', id] })
    void queryClient.invalidateQueries({ queryKey: ['org-stage-assets'] })
    void queryClient.invalidateQueries({ queryKey: ['org-stage-findings'] })
    void queryClient.invalidateQueries({ queryKey: ['org-stage-tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['org-sessions'] })
    void queryClient.invalidateQueries({ queryKey: ['org-objectives'] })
    void queryClient.invalidateQueries({ queryKey: ['org-artifacts'] })
  }

  // The single stage action: exploit mode launches an exploit workflow and
  // objectives mode starts a produce probe. Recon keeps its full toolbar.
  const launchStage = useMutation({
    mutationFn: (name: string) => api.createStageTask(mode, { name, target: name, organizationId: id, options: {} }),
    onSuccess: (result) => {
      toast.success(`Queued ${result.total || 1} ${STAGE_META[mode].shortLabel} task(s)`)
      refreshAll()
    },
    onError: (error) => toast.error(error.message),
  })

  const confirm = useMutation({
    mutationFn: () => api.confirmDomains(id, selectedDomains),
    onSuccess: () => {
      toast.success('Domain ownership confirmed')
      setSelectedDomains([])
      refreshAll()
    },
    onError: (error) => toast.error(error.message),
  })
  const addDomains = useMutation({
    mutationFn: () => api.importDomains(id, domainText.split(/[\s,]+/).filter(Boolean)),
    onSuccess: () => {
      toast.success('Candidate domain added')
      setDomainText('')
      setAddOpen(false)
      refreshAll()
    },
    onError: (error) => toast.error(error.message),
  })
  const refreshICP = useMutation({
    mutationFn: () => api.refreshICP(id),
    onSuccess: () => {
      toast.success('ICP reverse lookup job submitted')
      refreshAll()
    },
    onError: (error) => toast.error(error.message),
  })
  const reject = useMutation({
    mutationFn: ({ domainId, reason }: { domainId: string; reason: string }) => api.rejectDomain(id, domainId, reason),
    onSuccess: () => {
      toast.success('Domain removed')
      refreshAll()
    },
    onError: (error) => toast.error(error.message),
  })
  const updateDomain = useMutation({
    mutationFn: () => api.updateDomain(id, domainEditTarget?.id || '', domainForm),
    onSuccess: () => {
      toast.success('Domain details updated')
      setDomainEditTarget(null)
      refreshAll()
    },
    onError: (error) => toast.error(error.message),
  })
  const deleteDomain = useMutation({
    mutationFn: (domainId: string) => api.deleteDomain(id, domainId),
    onSuccess: () => {
      toast.success('Domain moved to recycle bin')
      refreshAll()
    },
    onError: (error) => toast.error(error.message),
  })
  const createScans = useMutation({
    mutationFn: () => api.createScans(id, scanDomains),
    onSuccess: () => {
      toast.success(`Created ${scanDomains.length} scan task(s)`)
      setScanOpen(false)
      setScanDomains([])
      refreshAll()
    },
    onError: (error) => toast.error(error.message),
  })
  const exportReport = useMutation({
    mutationFn: (format: 'xlsx' | 'csv') => api.exportOrganization(id, format),
    onSuccess: (result) => void download(result.downloadUrl || ''),
    onError: (error) => toast.error(error.message),
  })
  const updateOrganization = useMutation({
    mutationFn: () =>
      api.updateOrganization(id, {
        canonicalName: orgForm.canonicalName,
        aliases: orgForm.aliases
          .split('|')
          .map((item) => item.trim())
          .filter(Boolean),
        region: orgForm.region,
        uscc: orgForm.uscc,
      }),
    onSuccess: () => {
      toast.success('Organization updated')
      setEditOpen(false)
      refreshAll()
    },
    onError: (error) => toast.error(error.message),
  })
  const deleteOrganization = useMutation({
    mutationFn: () => api.deleteOrganization(id),
    onSuccess: () => {
      toast.success('Organization moved to recycle bin')
      void queryClient.invalidateQueries({ queryKey: ['organizations'] })
      window.location.assign('/organizations')
    },
    onError: (error) => toast.error(error.message),
  })

  if (organization.isLoading) return <LoadingBlock label="Loading organization workspace..." />
  if (organization.error) return <ErrorState error={organization.error} retry={() => organization.refetch()} />
  if (!organization.data?.organization)
    return (
      <ErrorState
        error={organization.error ?? new Error('Organization not found')}
        retry={() => organization.refetch()}
      />
    )
  const org = organization.data.organization
  const domainItems = domains.data?.items || []
  const confirmed = domainItems
    .filter((domain) => domain.status === 'confirmed')
    .map((domain) => domain.rootDomain)
    .filter((domain): domain is string => Boolean(domain))

  // Stage-mode risk distribution, computed from this organization's findings.
  const stageRiskCounts = (() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    for (const item of stageFindingsQ.data?.items || []) {
      const severity = (item.severity || 'info').toLowerCase()
      if (severity === 'critical' || severity === 'high' || severity === 'medium' || severity === 'low') {
        counts[severity] += 1
      } else {
        counts.info += 1
      }
    }
    return counts
  })()
  const openSessions = (sessionsQ.data?.items || []).filter((session) => session.state === 'open').length
  const latestStageTask = (stageTasksQ.data?.items || [])[0]
  const stageLabel = STAGE_META[mode].shortLabel

  function openEditOrganization() {
    setOrgForm({
      canonicalName: org.canonicalName || '',
      aliases: (org.aliases || []).join(' | '),
      region: org.region || '',
      uscc: org.uscc || '',
    })
    setEditOpen(true)
  }

  function switchTab(next: string) {
    const search = new URLSearchParams(params)
    if (next === 'overview') search.delete('tab')
    else search.set('tab', next)
    setParams(search, { replace: true })
  }
  async function showEvidence(domain: OrganizationDomain) {
    try {
      setEvidenceView(await api.evidence(id, domain.id || ''))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load evidence')
    }
  }
  function editDomain(domain: OrganizationDomain) {
    setDomainForm({
      siteName: domain.siteName || '',
      homeSite: domain.homeSite || '',
      icpNo: domain.icpNo || '',
      auditDate: domain.auditDate || '',
    })
    setDomainEditTarget(domain)
  }

  const riskFields = {
    critical: isRecon ? summary.data?.criticalFindings || 0 : stageRiskCounts.critical,
    high: isRecon ? summary.data?.highFindings || 0 : stageRiskCounts.high,
    medium: isRecon ? summary.data?.mediumFindings || 0 : stageRiskCounts.medium,
    low: isRecon ? summary.data?.lowFindings || 0 : stageRiskCounts.low,
    info: isRecon ? summary.data?.infoFindings || 0 : stageRiskCounts.info,
  }
  const tabsUi = [
    ['overview', 'Overview', LayoutDashboard],
    ...(isRecon ? ([['domains', 'Root Domains', Globe]] as const) : []),
    ['assets', isRecon ? 'Assets' : 'Breached Assets', Crosshair],
    ['findings', 'Risks', ShieldAlert],
    ['tasks', 'Tasks', Workflow],
  ] as const

  return (
    <div>
      <Breadcrumb
        items={[{ label: 'Organizations', to: `${base}/organizations` }, { label: org.canonicalName || '' }]}
      />
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{org.canonicalName}</h1>
            <StatusBadge status={org.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {org.region ? <span>Region: {org.region}</span> : null}
            {org.aliases?.length ? <span>Aliases: {org.aliases.join(' / ')}</span> : null}
            {org.uscc ? <span className="mono">USCC: {org.uscc}</span> : null}
          </div>
        </div>
        {canWrite(role) && isRecon ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="icon"
              title="Start Scan"
              onClick={() => {
                setScanDomains(confirmed.slice(0, 10))
                setScanOpen(true)
              }}
            >
              <Play />
              <span className="sr-only">Start Scan</span>
            </Button>
            <Button
              size="icon"
              variant="outline"
              title="ICP Lookup"
              onClick={() => refreshICP.mutate()}
              disabled={refreshICP.isPending}
            >
              <Search className="size-4" />
              <span className="sr-only">ICP Lookup</span>
            </Button>
            <Button size="icon" variant="outline" title="Add Root Domain" onClick={() => setAddOpen(true)}>
              <Plus />
              <span className="sr-only">Add Root Domain</span>
            </Button>
            <Button size="icon" variant="outline" title="Export Report" onClick={() => exportReport.mutate('xlsx')}>
              <Download />
              <span className="sr-only">Export</span>
            </Button>
            <Button size="icon" variant="outline" title="Edit Organization" onClick={openEditOrganization}>
              <Pencil />
              <span className="sr-only">Edit</span>
            </Button>
            <ConfirmDialog
              title="Delete organization"
              description="Moved to the recycle bin. Blocked while tasks are queued or running."
              confirmLabel="Move To Recycle Bin"
              onConfirm={() => deleteOrganization.mutate()}
              trigger={
                <Button size="icon" variant="outline" className="size-9 text-destructive" title="Delete Organization">
                  <Trash2 />
                  <span className="sr-only">Delete</span>
                </Button>
              }
            />
          </div>
        ) : canWrite(role) && !isRecon ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              title={`Start ${STAGE_META[mode].label}`}
              aria-label={`Start ${STAGE_META[mode].label}`}
              disabled={launchStage.isPending}
              onClick={() => launchStage.mutate(`${stageLabel} ${org.canonicalName || id}`)}
            >
              <Play />
              <span className="sr-only">Start {STAGE_META[mode].label}</span>
            </Button>
          </div>
        ) : null}
      </div>

      {/* Stat cards. Recon keeps its six workspace counters; exploit and
          objectives surface the stage-scoped counters for this organization. */}
      {isRecon ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            label="Confirmed Root Domains"
            value={summary.data?.confirmedDomains || 0}
            hint={`${summary.data?.candidateDomains || 0} pending`}
          />
          <StatTile label="Domain Assets" value={formatNumber(summary.data?.domainAssets)} />
          <StatTile
            label="IP Assets"
            value={formatNumber(summary.data?.ipAssets)}
            hint={`${summary.data?.unlocatedAssets || 0} unlocated`}
          />
          <StatTile label="Services" value={formatNumber(summary.data?.services)} />
          <StatTile
            label="Current Risks"
            value={formatNumber(summary.data?.currentFindings)}
            hint={`${summary.data?.criticalFindings || 0} critical · ${summary.data?.highFindings || 0} high`}
          />
          <StatTile
            label="Latest Scan"
            value={relativeTime(summary.data?.lastScanAt)}
            hint={`${summary.data?.linkedTasks || 0} linked tasks`}
          />
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            label={mode === 'objectives' ? 'Objectives' : 'Breached Assets'}
            value={formatNumber(mode === 'objectives' ? objectivesQ.data?.total : stageAssetsQ.data?.total)}
            hint="Stage scoped"
          />
          {mode === 'exploit' ? (
            <StatTile
              label="Shell Sessions"
              value={formatNumber(sessionsQ.data?.total)}
              hint={`${openSessions} open`}
            />
          ) : (
            <StatTile label="Artifacts" value={formatNumber(artifactsQ.data?.total)} hint="Collected produce" />
          )}
          <StatTile label={`${stageLabel} Tasks`} value={formatNumber(stageTasksQ.data?.total)} />
          <StatTile label="Stage Findings" value={formatNumber(stageFindingsQ.data?.total)} />
          <StatTile
            label="Latest Run"
            value={relativeTime(latestStageTask?.createdAt)}
            hint={latestStageTask?.status || 'no runs yet'}
          />
          <StatTile label="Chain Position" value={stageLabel} hint="Durable stage on the organization row" />
        </div>
      )}

      <Tabs value={tab} onValueChange={switchTab}>
        <TabsList className="mx-auto flex w-full max-w-4xl justify-center">
          {tabsUi.map(([value, label, Icon]) => (
            <TabsTrigger key={value} value={value} className="size-9 gap-0 px-0" title={label}>
              <Icon className="size-4" />
              <span className="sr-only">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          {isRecon ? (
            <div className="space-y-4">
              {/* Full-width map and graph for this organization: the pins and
                  the projection are visible without scrolling. */}
              <Card>
                <CardHeader className="border-b py-3">
                  <CardTitle className="flex items-center justify-center gap-2">
                    Surface Map &amp; Graph
                    <span className="mono-label">{orgMap.data?.points?.length || 0} located pins</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid h-[420px] lg:grid-cols-5">
                    <div className="h-full lg:col-span-3 lg:border-r">
                      <SurfaceMap snapshot={orgMap.data} />
                    </div>
                    <div className="h-full lg:col-span-2">
                      {orgGraph.data && (orgGraph.data.nodes?.length || 0) > 0 ? (
                        <AssetGraph snapshot={orgGraph.data} />
                      ) : (
                        <div className="grid h-full place-items-center p-6 text-center text-xs uppercase tracking-[0.04em] text-muted-foreground">
                          No graph projection yet — run a recon scan.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader className="border-b py-3">
                    <CardTitle>Recent Discoveries</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {(assets.data?.items || []).slice(0, 5).map((asset) => (
                      <div
                        key={asset.id || asset.key}
                        className="flex items-center justify-between gap-2 border-b pb-2 last:border-0"
                      >
                        <span className="mono truncate">{asset.key}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {asset.kind || 'asset'}
                          </span>
                          <RiskBadge risk={asset.risk} />
                        </span>
                      </div>
                    ))}
                    {!assets.data?.items?.length ? (
                      <div className="py-6 text-center uppercase tracking-[0.04em] text-muted-foreground">
                        No assets discovered yet — confirm root domains and press Play.
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="border-b py-3">
                    <CardTitle>Risk Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <RiskDistributionChart counts={riskFields} />
                    <RiskLegend counts={riskFields} />
                    {riskFields.critical > 0 ? (
                      <div className="border border-ring px-3 py-2 text-[11px] text-foreground">
                        {riskFields.critical} critical risk(s) require immediate attention.
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                {mode === 'exploit' ? (
                  <Card>
                    <CardHeader className="border-b py-3">
                      <CardTitle>Breached Assets</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      {(stageAssetsQ.data?.items || []).slice(0, 6).map((asset: ChainAsset) => (
                        <div
                          key={asset.id || asset.key}
                          className="flex items-center justify-between gap-2 border-b pb-2 last:border-0"
                        >
                          <span className="mono truncate">{asset.key}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {kindLabel(asset.kind)}
                            </span>
                            <span className="mono text-[10px] text-muted-foreground">
                              {relativeTime(asset.exploitedAt)}
                            </span>
                          </span>
                        </div>
                      ))}
                      {!stageAssetsQ.data?.items?.length ? (
                        <div className="py-6 text-center uppercase tracking-[0.04em] text-muted-foreground">
                          No breached assets yet — start an exploit run.
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="border-b py-3">
                      <CardTitle>Objectives</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      {(objectivesQ.data?.items || []).slice(0, 6).map((objective) => (
                        <div
                          key={objective.id}
                          className="flex items-center justify-between gap-2 border-b pb-2 last:border-0"
                        >
                          <span className="truncate">{objective.title}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {objective.kind}
                            </span>
                            <StatusBadge status={objective.status} />
                          </span>
                        </div>
                      ))}
                      {!objectivesQ.data?.items?.length ? (
                        <div className="py-6 text-center uppercase tracking-[0.04em] text-muted-foreground">
                          No objectives yet — start a probe run.
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                )}

                {mode === 'exploit' ? (
                  <Card>
                    <CardHeader className="border-b py-3">
                      <CardTitle>Shell Sessions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      {(sessionsQ.data?.items || []).slice(0, 6).map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between gap-2 border-b pb-2 last:border-0"
                        >
                          <span className="mono truncate">
                            {session.host}:{session.port}
                          </span>
                          <StatusBadge status={session.state === 'open' ? 'running' : 'closed'} />
                        </div>
                      ))}
                      {!sessionsQ.data?.items?.length ? (
                        <div className="py-6 text-center uppercase tracking-[0.04em] text-muted-foreground">
                          No shell sessions — successful exploits open sessions.
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="border-b py-3">
                      <CardTitle>Artifacts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      {(artifactsQ.data?.items || []).slice(0, 6).map((artifact) => (
                        <div
                          key={artifact.id}
                          className="flex items-center justify-between gap-2 border-b pb-2 last:border-0"
                        >
                          <span className="mono truncate">{artifact.name}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {artifact.kind}
                            </span>
                            <span className="mono text-[10px] text-muted-foreground">{artifact.sizeBytes} B</span>
                          </span>
                        </div>
                      ))}
                      {!artifactsQ.data?.items?.length ? (
                        <div className="py-6 text-center uppercase tracking-[0.04em] text-muted-foreground">
                          No artifacts — probe SDKs write extracted produce here.
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="border-b py-3">
                    <CardTitle>Stage Findings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {(stageFindingsQ.data?.items || []).slice(0, 6).map((item: ChainFinding) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 border-b pb-2 last:border-0"
                      >
                        <span className="truncate">{item.title}</span>
                        <RiskBadge risk={item.severity} />
                      </div>
                    ))}
                    {!stageFindingsQ.data?.items?.length ? (
                      <div className="py-6 text-center uppercase tracking-[0.04em] text-muted-foreground">
                        No stage findings for this organization yet.
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b py-3">
                    <CardTitle>{stageLabel} Tasks</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {(stageTasksQ.data?.items || []).slice(0, 6).map((task: ChainTask) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between gap-2 border-b pb-2 last:border-0"
                      >
                        <Link className="truncate text-primary hover:underline" to={`${base}/tasks/${task.id}`}>
                          {task.name || task.id}
                        </Link>
                        <StatusBadge status={task.status} />
                      </div>
                    ))}
                    {!stageTasksQ.data?.items?.length ? (
                      <div className="py-6 text-center uppercase tracking-[0.04em] text-muted-foreground">
                        No {stageLabel.toLowerCase()} tasks yet — press Play to start one.
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="border-b py-3">
                  <CardTitle>Risk Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <RiskDistributionChart counts={riskFields} />
                  <RiskLegend counts={riskFields} />
                  {riskFields.critical > 0 ? (
                    <div className="border border-ring px-3 py-2 text-[11px] text-foreground">
                      {riskFields.critical} critical risk(s) require immediate attention.
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b py-3">
                  <CardTitle className="flex items-center justify-center gap-2">
                    Surface Map
                    <span className="mono-label">{orgMap.data?.points?.length || 0} located pins</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <SurfaceMap snapshot={orgMap.data} />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
        <TabsContent value="domains">
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="flex items-center justify-center gap-2">
                Filed Root Domains
                <span className="mono-label">{domainItems.length} filed</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {canWrite(role) && selectedDomains.length > 0 ? (
                <div className="mb-3 flex justify-end">
                  <Button
                    size="icon"
                    variant="outline"
                    title={`Confirm ${selectedDomains.length} selected domain(s)`}
                    disabled={confirm.isPending}
                    onClick={() => confirm.mutate()}
                  >
                    <Check />
                    <span className="sr-only">Confirm Selected Domains</span>
                  </Button>
                </div>
              ) : null}
              {domains.isLoading ? (
                <LoadingBlock />
              ) : (
                <DataTable
                  rows={domainItems}
                  rowKey={(row) => row.id || row.rootDomain || ''}
                  empty={
                    <EmptyState
                      title="No filed root domains"
                      description="Add candidate domains or run an ICP reverse lookup."
                    />
                  }
                  columns={[
                    {
                      key: 'select',
                      header: '',
                      cell: (row) =>
                        row.status === 'candidate' ? (
                          <Checkbox
                            checked={selectedDomains.includes(row.rootDomain || '')}
                            onCheckedChange={(checked) =>
                              setSelectedDomains((current) =>
                                checked
                                  ? [...current, row.rootDomain || '']
                                  : current.filter((item) => item !== row.rootDomain),
                              )
                            }
                          />
                        ) : null,
                    },
                    {
                      key: 'domain',
                      header: 'Root Domain',
                      cell: (row) => <span className="mono font-medium">{row.rootDomain}</span>,
                    },
                    { key: 'site', header: 'Site', cell: (row) => row.siteName || '—', hideOnTablet: true },
                    { key: 'icp', header: 'ICP Number', cell: (row) => row.icpNo || '—', hideOnTablet: true },
                    { key: 'confidence', header: 'Confidence', cell: (row) => row.confidence || '—' },
                    { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
                    {
                      key: 'actions',
                      header: 'Actions',
                      cell: (row) => (
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button size="icon" variant="outline" title="Evidence" onClick={() => void showEvidence(row)}>
                            <FileText />
                            <span className="sr-only">Evidence</span>
                          </Button>
                          {canWrite(role) ? (
                            <Button size="icon" variant="outline" title="Edit Domain" onClick={() => editDomain(row)}>
                              <Pencil />
                              <span className="sr-only">Edit</span>
                            </Button>
                          ) : null}
                          {canWrite(role) ? (
                            <ConfirmDialog
                              title="Delete Owned Domain"
                              description={`${row.rootDomain} will be moved to the recycle bin.`}
                              confirmLabel="Move To Recycle Bin"
                              onConfirm={() => deleteDomain.mutate(row.id || '')}
                              trigger={
                                <Button size="icon" variant="outline" className="text-destructive" title="Delete">
                                  <Trash2 />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              }
                            />
                          ) : null}
                          {canWrite(role) && row.status === 'candidate' ? (
                            <Button
                              size="icon"
                              variant="outline"
                              className="text-destructive"
                              title="Remove Candidate"
                              onClick={() => {
                                setRejectReason('Manually removed')
                                setRejectTarget(row)
                              }}
                            >
                              <X />
                              <span className="sr-only">Remove</span>
                            </Button>
                          ) : null}
                        </div>
                      ),
                    },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="assets">
          {isRecon ? <AssetTab query={assets} base={base} /> : <StageAssetTab query={stageAssetsQ} />}
        </TabsContent>
        <TabsContent value="findings">
          {isRecon ? <FindingTab query={findings} organizationId={id} /> : <StageFindingTab query={stageFindingsQ} />}
        </TabsContent>
        <TabsContent value="tasks">
          {isRecon ? <TaskTab query={tasks} base={base} /> : <StageTaskTab query={stageTasksQ} base={base} />}
        </TabsContent>
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Candidate Root Domains</DialogTitle>
            <DialogDescription>Separated by spaces, commas, or newlines.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={domainText}
            onChange={(event) => setDomainText(event.target.value)}
            placeholder="example.edu.cn"
          />
          <DialogFooter>
            <Button size="icon" variant="outline" title="Cancel" onClick={() => setAddOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button disabled={!domainText.trim() || addDomains.isPending} onClick={() => addDomains.mutate()}>
              <Plus />
              {addDomains.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Organization Scan</DialogTitle>
            <DialogDescription>One scan task per confirmed root domain; up to 10 at a time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {confirmed.length ? (
              confirmed.map((domain) => (
                <label key={domain} className="flex items-center gap-2 border px-3 py-2 text-xs">
                  <Checkbox
                    checked={scanDomains.includes(domain)}
                    onCheckedChange={(checked) =>
                      setScanDomains((current) =>
                        checked ? current.slice(0, 9).concat(domain) : current.filter((item) => item !== domain),
                      )
                    }
                  />
                  <span className="mono">{domain}</span>
                </label>
              ))
            ) : (
              <div className="space-y-3 border p-4 text-xs leading-5 text-muted-foreground">
                <div className="font-medium uppercase tracking-[0.04em] text-ink">No confirmed root domains yet</div>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Add candidate root domains for this organization.</li>
                  <li>Run the ICP reverse lookup to locate filing evidence.</li>
                  <li>Confirm domain ownership in the Root Domains tab.</li>
                  <li>Press Play again to launch the full recon.</li>
                </ol>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => (setScanOpen(false), setAddOpen(true))}
                    title="Add Domain"
                    aria-label="Add Domain"
                  >
                    <Plus className="size-4" />
                    <span className="sr-only">Add Domain</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={refreshICP.isPending}
                    onClick={() => refreshICP.mutate()}
                  >
                    <Search className="size-4" />
                    <span className="sr-only">ICP Lookup</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" title="Cancel" onClick={() => setScanOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button disabled={!scanDomains.length || createScans.isPending} onClick={() => createScans.mutate()}>
              <Play />
              {createScans.isPending ? 'Submitting...' : 'Scan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Candidate Root Domain</DialogTitle>
            <DialogDescription>Removed from candidate ownership; the reason is recorded.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" title="Cancel" onClick={() => setRejectTarget(null)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || reject.isPending}
              onClick={() => {
                reject.mutate({ domainId: rejectTarget?.id || '', reason: rejectReason.trim() })
                setRejectTarget(null)
              }}
            >
              <Trash2 />
              <span className="sr-only">Remove</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Organization Name">
              <Input
                value={orgForm.canonicalName}
                onChange={(event) => setOrgForm({ ...orgForm, canonicalName: event.target.value })}
              />
            </Field>
            <Field label="Aliases" hint="Separated by |">
              <Input
                value={orgForm.aliases}
                onChange={(event) => setOrgForm({ ...orgForm, aliases: event.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Region">
                <Input
                  value={orgForm.region}
                  onChange={(event) => setOrgForm({ ...orgForm, region: event.target.value })}
                />
              </Field>
              <Field label="Unified Social Credit Code">
                <Input
                  value={orgForm.uscc}
                  onChange={(event) => setOrgForm({ ...orgForm, uscc: event.target.value })}
                />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" title="Cancel" onClick={() => setEditOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button
              disabled={!orgForm.canonicalName.trim() || updateOrganization.isPending}
              onClick={() => updateOrganization.mutate()}
            >
              <Save />
              <span className="sr-only">Save</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(domainEditTarget)} onOpenChange={(open) => !open && setDomainEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Owned Domain</DialogTitle>
            <DialogDescription className="mono">{domainEditTarget?.rootDomain}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Site Name">
              <Input
                value={domainForm.siteName}
                onChange={(event) => setDomainForm({ ...domainForm, siteName: event.target.value })}
              />
            </Field>
            <Field label="Homepage">
              <Input
                value={domainForm.homeSite}
                onChange={(event) => setDomainForm({ ...domainForm, homeSite: event.target.value })}
              />
            </Field>
            <Field label="ICP Number">
              <Input
                value={domainForm.icpNo}
                onChange={(event) => setDomainForm({ ...domainForm, icpNo: event.target.value })}
              />
            </Field>
            <Field label="Audit Date">
              <Input
                value={domainForm.auditDate}
                onChange={(event) => setDomainForm({ ...domainForm, auditDate: event.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" title="Cancel" onClick={() => setDomainEditTarget(null)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button disabled={updateDomain.isPending} onClick={() => updateDomain.mutate()}>
              <Save />
              <span className="sr-only">Save</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={evidenceView !== null} onOpenChange={(open) => !open && setEvidenceView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ownership Evidence</DialogTitle>
          </DialogHeader>
          <pre className="mono max-h-[55vh] overflow-auto border border-border bg-black p-3 text-[11px] leading-5 text-foreground">
            {JSON.stringify(evidenceView, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AssetTab({ query, base }: { query: ReturnType<typeof useQuery<any>>; base: string }) {
  const navigate = useNavigate()
  if (query.isLoading) return <LoadingBlock />
  const items = query.data?.items || []
  return (
    <Card>
      <CardContent className="pt-4">
        <DataTable
          rows={items}
          rowKey={(row: EasmAsset) => row.id || row.key || ''}
          onRowClick={(row: EasmAsset) => row.id && navigate(`${base}/assets?focus=${row.id}`)}
          rowLabel={(row: EasmAsset) => `Open asset ${row.key}`}
          empty={<EmptyState title="No assets" />}
          columns={[
            { key: 'key', header: 'Asset', cell: (row: EasmAsset) => <span className="mono">{row.key}</span> },
            { key: 'kind', header: 'Type', cell: (row: EasmAsset) => row.kind },
            { key: 'risk', header: 'Risk', cell: (row: EasmAsset) => <RiskBadge risk={row.risk} /> },
            { key: 'seen', header: 'Last Seen', cell: (row: EasmAsset) => formatTime(row.lastSeen) },
          ]}
        />
      </CardContent>
    </Card>
  )
}

// Stage-mode asset table: only breached assets of this organization, straight
// from the stage endpoint.
function StageAssetTab({ query }: { query: ReturnType<typeof useQuery<any>> }) {
  if (query.isLoading) return <LoadingBlock />
  const items = query.data?.items || []
  return (
    <Card>
      <CardContent className="pt-4">
        <DataTable
          rows={items}
          rowKey={(row: ChainAsset) => row.id || row.key || ''}
          empty={<EmptyState title="No breached assets" description="Assets appear here once an exploit succeeds." />}
          columns={[
            { key: 'key', header: 'Asset', cell: (row: ChainAsset) => <span className="mono">{row.key}</span> },
            { key: 'kind', header: 'Type', cell: (row: ChainAsset) => kindLabel(row.kind) },
            {
              key: 'breached',
              header: 'Breached',
              cell: (row: ChainAsset) => relativeTime(row.exploitedAt),
            },
            { key: 'seen', header: 'Last Seen', cell: (row: ChainAsset) => formatTime(row.lastSeen) },
          ]}
        />
      </CardContent>
    </Card>
  )
}

function FindingTab({ query, organizationId }: { query: ReturnType<typeof useQuery<any>>; organizationId: string }) {
  if (query.isLoading) return <LoadingBlock />
  const items = query.data?.items || []
  async function history(item: FindingItem) {
    try {
      const result = await api.findingHistory(item.finding?.id || '', organizationId)
      toast.message(`${result.items.length} history record(s)`, { description: result.items[0]?.title })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load history')
    }
  }
  return (
    <Card>
      <CardContent className="pt-4">
        <DataTable
          rows={items}
          rowKey={(row: FindingItem) => row.finding?.id || ''}
          empty={<EmptyState title="No current risks" />}
          columns={[
            {
              key: 'title',
              header: 'Risk',
              cell: (row: FindingItem) => (
                <div>
                  <div className="font-medium">{row.finding?.title}</div>
                  <div className="text-[11px] text-muted-foreground">{row.finding?.target}</div>
                </div>
              ),
            },
            {
              key: 'severity',
              header: 'Severity',
              cell: (row: FindingItem) => <RiskBadge risk={row.finding?.severity} />,
            },
            { key: 'occurrences', header: 'Count', cell: (row: FindingItem) => row.occurrences || 1 },
            { key: 'time', header: 'Last Seen', cell: (row: FindingItem) => formatTime(row.finding?.createdAt) },
            {
              key: 'actions',
              header: 'Actions',
              cell: (row: FindingItem) => (
                <Button size="icon" variant="outline" title="History" onClick={() => void history(row)}>
                  <History />
                  <span className="sr-only">History</span>
                </Button>
              ),
            },
          ]}
        />
      </CardContent>
    </Card>
  )
}

// Stage-mode findings table: stage findings for this organization only.
function StageFindingTab({ query }: { query: ReturnType<typeof useQuery<any>> }) {
  if (query.isLoading) return <LoadingBlock />
  const items = query.data?.items || []
  return (
    <Card>
      <CardContent className="pt-4">
        <DataTable
          rows={items}
          rowKey={(row: ChainFinding) => row.id || ''}
          empty={<EmptyState title="No stage findings" description="Risks recorded by stage SDKs appear here." />}
          columns={[
            {
              key: 'title',
              header: 'Risk',
              cell: (row: ChainFinding) => (
                <div>
                  <div className="font-medium">{row.title}</div>
                  <div className="text-[11px] text-muted-foreground">{row.target}</div>
                </div>
              ),
            },
            { key: 'kind', header: 'Kind', cell: (row: ChainFinding) => kindLabel(row.kind) },
            { key: 'severity', header: 'Severity', cell: (row: ChainFinding) => <RiskBadge risk={row.severity} /> },
            { key: 'time', header: 'Recorded', cell: (row: ChainFinding) => formatTime(row.createdAt) },
          ]}
        />
      </CardContent>
    </Card>
  )
}

function TaskTab({ query, base }: { query: ReturnType<typeof useQuery<any>>; base: string }) {
  const navigate = useNavigate()
  if (query.isLoading) return <LoadingBlock />
  const items = query.data?.items || []
  return (
    <Card>
      <CardContent className="pt-4">
        <DataTable
          rows={items}
          rowKey={(row: Task) => row.id || ''}
          onRowClick={(row: Task) => row.id && navigate(`${base}/tasks/${row.id}`)}
          rowLabel={(row: Task) => `Open task ${row.name}`}
          empty={<EmptyState title="No tasks" />}
          columns={[
            {
              key: 'name',
              header: 'Task',
              stopRowClick: true,
              cell: (row: Task) => (
                <Link className="font-medium text-primary hover:underline" to={`${base}/tasks/${row.id}`}>
                  {row.name}
                </Link>
              ),
            },
            { key: 'target', header: 'Target', cell: (row: Task) => <span className="mono">{row.target}</span> },
            { key: 'status', header: 'Status', cell: (row: Task) => <StatusBadge status={row.status} /> },
            { key: 'progress', header: 'Progress', cell: (row: Task) => `${row.progress || 0}%` },
            { key: 'created', header: 'Created', cell: (row: Task) => formatTime(row.createdAt) },
          ]}
        />
      </CardContent>
    </Card>
  )
}

// Stage-mode task table: this organization's tasks in the active stage.
function StageTaskTab({ query, base }: { query: ReturnType<typeof useQuery<any>>; base: string }) {
  const navigate = useNavigate()
  if (query.isLoading) return <LoadingBlock />
  const items = query.data?.items || []
  return (
    <Card>
      <CardContent className="pt-4">
        <DataTable
          rows={items}
          rowKey={(row: ChainTask) => row.id || ''}
          onRowClick={(row: ChainTask) => row.id && navigate(`${base}/tasks/${row.id}`)}
          rowLabel={(row: ChainTask) => `Open task ${row.name}`}
          empty={<EmptyState title="No stage tasks" description="Press Play to start a stage run." />}
          columns={[
            {
              key: 'name',
              header: 'Task',
              stopRowClick: true,
              cell: (row: ChainTask) => (
                <Link className="font-medium text-primary hover:underline" to={`${base}/tasks/${row.id}`}>
                  {row.name || row.id}
                </Link>
              ),
            },
            { key: 'target', header: 'Target', cell: (row: ChainTask) => <span className="mono">{row.target}</span> },
            { key: 'status', header: 'Status', cell: (row: ChainTask) => <StatusBadge status={row.status} /> },
            { key: 'progress', header: 'Progress', cell: (row: ChainTask) => `${row.progress || 0}%` },
            { key: 'created', header: 'Created', cell: (row: ChainTask) => formatTime(row.createdAt) },
          ]}
        />
      </CardContent>
    </Card>
  )
}
