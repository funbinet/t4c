import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Download,
  FileClock,
  Globe2,
  Pencil,
  Play,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type EasmAsset, type FindingItem, type OrganizationDomain, type Task } from '@/api'
import { download } from '@/api/client'
import { RiskBadge, StatusBadge } from '@/components/common/badges'
import { DataTable } from '@/components/common/data-table'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { StatTile } from '@/components/common/stat-tile'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
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
import { formatNumber, formatTime, relativeTime } from '@/lib/format'

const tabs = ['overview', 'domains', 'assets', 'findings', 'tasks'] as const

export function OrganizationDetailPage() {
  const { id = '' } = useParams()
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab = tabs.includes((params.get('tab') as (typeof tabs)[number]) || 'overview')
    ? (params.get('tab') as (typeof tabs)[number])
    : 'overview'
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
  const summary = useQuery({
    queryKey: ['organization-summary', id],
    queryFn: () => api.organizationSummary(id),
    enabled: Boolean(id),
  })
  const domains = useQuery({
    queryKey: ['organization-domains', id],
    queryFn: () => api.domains(id),
    enabled: Boolean(id),
  })
  const assets = useQuery({
    queryKey: ['organization-assets', id],
    queryFn: () => api.organizationAssets(id, { page: 1, pageSize: 100 }),
    enabled: Boolean(id) && tab === 'assets',
  })
  const findings = useQuery({
    queryKey: ['organization-findings', id],
    queryFn: () => api.organizationFindings(id, { view: 'current', page: 1, pageSize: 100 }),
    enabled: Boolean(id) && tab === 'findings',
  })
  const tasks = useQuery({
    queryKey: ['organization-tasks', id],
    queryFn: () => api.organizationTasks(id, { page: 1, pageSize: 100 }),
    enabled: Boolean(id) && tab === 'tasks',
  })

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['organization', id] })
    void queryClient.invalidateQueries({ queryKey: ['organization-domains', id] })
    void queryClient.invalidateQueries({ queryKey: ['organization-summary', id] })
    void queryClient.invalidateQueries({ queryKey: ['organization-assets', id] })
    void queryClient.invalidateQueries({ queryKey: ['organization-findings', id] })
    void queryClient.invalidateQueries({ queryKey: ['organization-tasks', id] })
  }

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

  if (organization.isLoading || summary.isLoading) return <LoadingBlock label="Loading organization workspace…" />
  if (organization.error || summary.error)
    return (
      <ErrorState
        error={organization.error || summary.error}
        retry={() => {
          organization.refetch()
          summary.refetch()
        }}
      />
    )
  const org = organization.data!.organization
  const domainItems = domains.data?.items || []
  const confirmed = domainItems
    .filter((domain) => domain.status === 'confirmed')
    .map((domain) => domain.rootDomain)
    .filter((domain): domain is string => Boolean(domain))

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

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Button asChild variant="ghost" size="sm">
          <Link to="/organizations">
            <ArrowLeft />
            Organizations
          </Link>
        </Button>
        <span>/</span>
        <span>{org.canonicalName}</span>
      </div>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{org.canonicalName}</h1>
            <StatusBadge status={org.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {org.region ? <span>Region: {org.region}</span> : null}
            {org.aliases?.length ? <span>Aliases: {org.aliases.join(' / ')}</span> : null}
            {org.uscc ? <span className="mono">USCC：{org.uscc}</span> : null}
          </div>
        </div>
        {canWrite(role) ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => refreshICP.mutate()} disabled={refreshICP.isPending}>
              <RefreshCw />
              Reverse-Lookup Filed Domains
            </Button>
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              <PlusCircle />
              Add Root Domain
            </Button>
            <Button variant="outline" onClick={() => exportReport.mutate('xlsx')}>
              <Download />
              Export
            </Button>
            <Button variant="outline" onClick={openEditOrganization}>
              <Pencil />
              Edit
            </Button>
            <ConfirmDialog
              title="Delete organization"
              description="The organization will be moved to the recycle bin; confirmed domains and task history are kept. Deletion is blocked while tasks are queued or running."
              confirmLabel="Move to recycle bin"
              onConfirm={() => deleteOrganization.mutate()}
              trigger={
                <Button variant="outline" className="text-destructive">
                  <Trash2 />
                  Delete
                </Button>
              }
            />
            <Button
              onClick={() => {
                setScanDomains(confirmed.slice(0, 10))
                setScanOpen(true)
              }}
              disabled={!confirmed.length}
            >
              <Play />
              Start Scan
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatTile
          label="Confirmed Root Domains"
          value={summary.data?.confirmedDomains || 0}
          hint={`${summary.data?.candidateDomains || 0} pending`}
          icon={<Globe2 className="size-4" />}
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
          icon={<ShieldAlert className="size-4" />}
        />
        <StatTile
          label="Latest Scan"
          value={relativeTime(summary.data?.lastScanAt)}
          hint={`${summary.data?.linkedTasks || 0} linked task(s)`}
          icon={<FileClock className="size-4" />}
        />
      </div>

      <Tabs value={tab} onValueChange={switchTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="domains">Root Domains & Ownership</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="findings">Risks</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ownership Coverage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <Coverage
                  label="Confirmed Root Domains"
                  value={summary.data?.confirmedDomains || 0}
                  total={(summary.data?.confirmedDomains || 0) + (summary.data?.candidateDomains || 0)}
                />
                <Coverage
                  label="Assets Discovered"
                  value={(summary.data?.domainAssets || 0) + (summary.data?.ipAssets || 0) > 0 ? 1 : 0}
                  total={1}
                />
                <Coverage label="Scans Started" value={(summary.data?.linkedTasks || 0) > 0 ? 1 : 0} total={1} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Risk Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {(
                  [
                    ['critical', 'Critical'],
                    ['high', 'High'],
                    ['medium', 'Medium'],
                    ['low', 'Low'],
                    ['info', 'Info'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <span className={`risk-${key}`}>{label}</span>
                    <span className="tabular-nums">
                      {(summary.data?.[`${key}Findings` as keyof typeof summary.data] as number) || 0}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="domains">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Filed Root Domains</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  <PlusCircle />
                  Add
                </Button>
                <Button size="sm" disabled={!selectedDomains.length} onClick={() => confirm.mutate()}>
                  Confirm Selected
                </Button>
              </div>
            </CardHeader>
            <CardContent>
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
                          <Button size="sm" variant="ghost" onClick={() => void showEvidence(row)}>
                            Evidence
                          </Button>
                          {canWrite(role) ? (
                            <Button size="sm" variant="ghost" onClick={() => editDomain(row)}>
                              Edit
                            </Button>
                          ) : null}
                          {canWrite(role) ? (
                            <ConfirmDialog
                              title="Delete owned domain"
                              description={`${row.rootDomain} will be moved to the recycle bin; restoring it may conflict if another organization has confirmed ownership.`}
                              confirmLabel="Move to recycle bin"
                              onConfirm={() => deleteDomain.mutate(row.id || '')}
                              trigger={
                                <Button size="sm" variant="ghost" className="text-destructive">
                                  Delete
                                </Button>
                              }
                            />
                          ) : null}
                          {canWrite(role) && row.status === 'candidate' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                setRejectReason('Manually removed')
                                setRejectTarget(row)
                              }}
                            >
                              Remove
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
          <AssetTab query={assets} />
        </TabsContent>
        <TabsContent value="findings">
          <FindingTab query={findings} organizationId={id} />
        </TabsContent>
        <TabsContent value="tasks">
          <TaskTab query={tasks} />
        </TabsContent>
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Candidate Root Domains</DialogTitle>
            <DialogDescription>
              Separate entries with spaces, newlines, or commas. New domains enter the pending state.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={domainText}
            onChange={(event) => setDomainText(event.target.value)}
            placeholder="example.edu.cn"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!domainText.trim() || addDomains.isPending} onClick={() => addDomains.mutate()}>
              {addDomains.isPending ? 'Adding…' : 'Add Root Domains'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Organization Scan</DialogTitle>
            <DialogDescription>
              Creates one EASM scan task per confirmed root domain; select up to 10 at a time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {confirmed.map((domain) => (
              <label key={domain} className="flex items-center gap-2 rounded-[4px] border px-3 py-2 text-xs">
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
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScanOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!scanDomains.length || createScans.isPending} onClick={() => createScans.mutate()}>
              {createScans.isPending ? 'Submitting…' : 'Create Scan Tasks'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Candidate Root Domain</DialogTitle>
            <DialogDescription>
              {rejectTarget?.rootDomain} will be removed from this organization's candidate ownership, and the reason is
              recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || reject.isPending}
              onClick={() => {
                reject.mutate({ domainId: rejectTarget?.id || '', reason: rejectReason.trim() })
                setRejectTarget(null)
              }}
            >
              Remove Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Saving refreshes the organization in the governance list and on the map.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Organization Name</Label>
              <Input
                value={orgForm.canonicalName}
                onChange={(event) => setOrgForm({ ...orgForm, canonicalName: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Aliases (separated by |)</Label>
              <Input
                value={orgForm.aliases}
                onChange={(event) => setOrgForm({ ...orgForm, aliases: event.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Region</Label>
                <Input
                  value={orgForm.region}
                  onChange={(event) => setOrgForm({ ...orgForm, region: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unified Social Credit Code</Label>
                <Input
                  value={orgForm.uscc}
                  onChange={(event) => setOrgForm({ ...orgForm, uscc: event.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!orgForm.canonicalName.trim() || updateOrganization.isPending}
              onClick={() => updateOrganization.mutate()}
            >
              {updateOrganization.isPending ? 'Saving…' : 'Save Changes'}
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
            <div className="space-y-1.5">
              <Label>Site Name</Label>
              <Input
                value={domainForm.siteName}
                onChange={(event) => setDomainForm({ ...domainForm, siteName: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Homepage</Label>
              <Input
                value={domainForm.homeSite}
                onChange={(event) => setDomainForm({ ...domainForm, homeSite: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ICP Number</Label>
              <Input
                value={domainForm.icpNo}
                onChange={(event) => setDomainForm({ ...domainForm, icpNo: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Audit Date</Label>
              <Input
                value={domainForm.auditDate}
                onChange={(event) => setDomainForm({ ...domainForm, auditDate: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDomainEditTarget(null)}>
              Cancel
            </Button>
            <Button disabled={updateDomain.isPending} onClick={() => updateDomain.mutate()}>
              {updateDomain.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={evidenceView !== null} onOpenChange={(open) => !open && setEvidenceView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ownership Evidence</DialogTitle>
            <DialogDescription>
              Raw evidence masks sensitive fields for everyone except operators and admins.
            </DialogDescription>
          </DialogHeader>
          <pre className="mono max-h-[55vh] overflow-auto rounded-[4px] border border-border bg-black p-3 text-[11px] leading-5 text-mint">
            {JSON.stringify(evidenceView, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Coverage({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="mb-1.5 flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <b>
          {value} / {total}
        </b>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
function AssetTab({ query }: { query: ReturnType<typeof useQuery<any>> }) {
  if (query.isLoading) return <LoadingBlock />
  const items = query.data?.items || []
  return (
    <Card>
      <CardContent className="pt-4">
        <DataTable
          rows={items}
          rowKey={(row: EasmAsset) => row.id || row.key || ''}
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
                <Button size="sm" variant="ghost" onClick={() => void history(row)}>
                  History
                </Button>
              ),
            },
          ]}
        />
      </CardContent>
    </Card>
  )
}
function TaskTab({ query }: { query: ReturnType<typeof useQuery<any>> }) {
  if (query.isLoading) return <LoadingBlock />
  const items = query.data?.items || []
  return (
    <Card>
      <CardContent className="pt-4">
        <DataTable
          rows={items}
          rowKey={(row: Task) => row.id || ''}
          empty={<EmptyState title="No tasks" />}
          columns={[
            {
              key: 'name',
              header: 'Task',
              cell: (row: Task) => (
                <Link className="font-medium text-primary hover:underline" to={`/tasks/${row.id}`}>
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
