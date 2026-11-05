import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Crosshair, Download, FileArchive, Layers, Play, Terminal, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type ChainAsset } from '@/api'
import { useAuth } from '@/app/auth'
import { STAGE_META, useMode } from '@/app/mode'
import { DataTable, type Column } from '@/components/common/data-table'
import { Pagination } from '@/components/common/pagination'
import { ExpandableSearch, FilterDropdown, ScreenToolbar } from '@/components/common/screen-toolbar'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { StatTile } from '@/components/common/stat-tile'
import { ExportDrawer } from '@/components/chain/export-drawer'
import { ShellConsole } from '@/components/chain/shell-console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { canWrite } from '@/lib/access'
import { formatNumber, formatTime, relativeTime } from '@/lib/format'
import {
  KIND_FILTERS,
  STAGE_TASK_KINDS,
  StagePill,
  confidencePercent,
  kindLabel,
  stageScreenTitle,
} from './chain-shared'
import { ProducePanel } from './chain-produce'

/**
 * ChainAssetsPage is the stage-scoped asset surface. In exploit mode it lists
 * only breached assets; in objectives mode it becomes the "Produce" view with
 * objectives, artifacts and the per-asset actions required by plan §8.5:
 * Open Shell, Probe / Run Task, Export / Download and Re-run.
 */
export function ChainAssetsPage() {
  const { mode } = useMode()
  const { role } = useAuth()
  const writable = canWrite(role)
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()

  const kind = params.get('kind') || ''
  const q = params.get('q') || ''
  const organizationId = params.get('organizationId') || ''
  const page = Math.max(1, Number(params.get('page') || 1))
  const focus = params.get('focus') || ''

  const [search, setSearch] = useState(q)
  const [shellSessionId, setShellSessionId] = useState<string | null>(null)
  const [shellOpen, setShellOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [taskTarget, setTaskTarget] = useState('')
  const [taskName, setTaskName] = useState('')
  const [taskKind, setTaskKind] = useState(STAGE_TASK_KINDS[mode][0]?.value || 'exploit')

  useEffect(() => setSearch(q), [q])
  useEffect(() => setTaskKind(STAGE_TASK_KINDS[mode][0]?.value || 'exploit'), [mode])

  const setParam = (key: string, value: string | number) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === 0) next.delete(key)
    else next.set(key, String(value))
    setParams(next, { replace: true })
  }

  const assets = useQuery({
    queryKey: ['chain-assets', mode, kind, q, organizationId, page],
    queryFn: () => api.stageAssets(mode, { kind, q, organizationId, page, pageSize: 20 }),
    refetchInterval: 20_000,
  })
  const overview = useQuery({
    queryKey: ['chain-overview', mode],
    queryFn: () => api.stageOverview(mode),
  })
  const orgs = useQuery({
    queryKey: ['chain-organizations', mode, ''],
    queryFn: () => api.stageOrganizations(mode),
  })
  const sessions = useQuery({
    queryKey: ['chain-sessions', mode],
    queryFn: () => api.sessions({ pageSize: 200 }),
    enabled: mode !== 'recon',
    refetchInterval: 15_000,
  })

  const runTask = useMutation({
    mutationFn: () =>
      api.createStageTask(mode, {
        name: taskName.trim() || `${STAGE_META[mode].shortLabel} follow-up`,
        kind: taskKind,
        target: taskTarget.trim() || 'exploited-assets',
        organizationId: organizationId || undefined,
        options: {},
      }),
    onSuccess: (result) => {
      toast.success(`Queued ${result.total || 1} ${STAGE_META[mode].shortLabel} task(s)`)
      setTaskOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['chain-assets'] })
      void queryClient.invalidateQueries({ queryKey: ['chain-overview'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const openTask = (target = '') => {
    setTaskTarget(target)
    setTaskName('')
    setTaskKind(STAGE_TASK_KINDS[mode][0]?.value || 'exploit')
    setTaskOpen(true)
  }

  const openShell = (asset: ChainAsset) => {
    const list = sessions.data?.items || []
    const session =
      list.find((item) => item.assetId === asset.id && item.state === 'open') ||
      list.find((item) => item.assetId === asset.id)
    if (!session) {
      toast.info('No shell session for this asset — run an exploit task first')
      return
    }
    setShellSessionId(session.id)
    setShellOpen(true)
  }

  const sessionFor = (asset?: ChainAsset | null) =>
    asset ? (sessions.data?.items || []).find((item) => item.assetId === asset.id) : undefined

  const selectedAsset = focus
    ? (assets.data?.items || []).find((asset) => asset.id === focus) || null
    : null

  const orgFilters = [
    { value: '', label: 'All organizations' },
    ...(orgs.data?.items || []).map((org) => ({ value: org.id, label: org.canonicalName || org.id })),
  ]

  const columns: Column<ChainAsset>[] = [
    {
      key: 'key',
      header: 'Asset',
      cell: (row) => (
        <div className="min-w-0">
          <div className="mono truncate font-medium">{row.displayName || row.key || row.id}</div>
          <div className="truncate text-[11px] text-muted-foreground">{kindLabel(row.kind)}</div>
        </div>
      ),
    },
    { key: 'kind', header: 'Classification', cell: (row) => <Badge variant="info">{kindLabel(row.kind)}</Badge>, hideOnTablet: true },
    {
      key: 'confidence',
      header: 'Confidence',
      cell: (row) => <span className="mono">{confidencePercent(row.confidence)}</span>,
      hideOnTablet: true,
    },
    {
      key: 'exploited',
      header: 'State',
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={row.exploited ? 'success' : 'outline'}>{row.exploited ? 'Breached' : 'Discovered'}</Badge>
          {row.exploitedAt ? <span className="text-[11px] text-muted-foreground">{relativeTime(row.exploitedAt)}</span> : null}
        </div>
      ),
    },
    { key: 'lastSeen', header: 'Last Seen', cell: (row) => formatTime(row.lastSeen), hideOnTablet: true },
    {
      key: 'actions',
      header: '',
      stopRowClick: true,
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => openShell(row)} title="Open shell console">
            <Terminal className="mr-1 size-3.5" /> Shell
          </Button>
          {writable ? (
            <Button size="sm" variant="outline" onClick={() => openTask(row.key)} title="Run a follow-up stage task">
              <Play className="mr-1 size-3.5" /> {mode === 'objectives' ? 'Probe' : 'Run Task'}
            </Button>
          ) : null}
          {mode === 'objectives' ? (
            <Button size="sm" variant="outline" onClick={() => setExportOpen(true)} title="Open export drawer">
              <Download className="mr-1 size-3.5" /> Export
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  const counts = overview.data?.counts || {}

  return (
    <div className="space-y-4">
      <ScreenToolbar
        left={
          <div className="flex items-center gap-2">
            <span className="mono-label">{stageScreenTitle(mode, mode === 'objectives' ? 'Produce' : 'Assets')}</span>
            <StagePill stage={mode} />
            <ExpandableSearch
              value={search}
              onChange={setSearch}
              onSubmit={() => setParam('q', search)}
              placeholder="Search asset key, title or display name…"
              title="Search stage assets"
            />
            <FilterDropdown options={KIND_FILTERS} value={kind} onChange={(value) => setParam('kind', value)} label="Filter by asset kind" />
            <FilterDropdown options={orgFilters} value={organizationId} onChange={(value) => setParam('organizationId', value)} label="Filter by organization" />
          </div>
        }
        center={mode === 'objectives' ? 'Classified breached assets and the produce extracted from them' : 'Only successfully breached assets are exposed in this stage'}
        right={
          <>
            {mode === 'objectives' ? (
              <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
                <Download className="mr-1 size-3.5" /> Export produce
              </Button>
            ) : null}
            {writable ? (
              <Button size="sm" onClick={() => openTask()}>
                <Zap className="mr-1 size-3.5" /> New {STAGE_META[mode].shortLabel} task
              </Button>
            ) : null}
          </>
        }
      />

      {assets.isLoading ? <LoadingBlock variant="grid" /> : null}
      {assets.error ? <ErrorState error={assets.error} retry={() => assets.refetch()} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Breached Assets" value={formatNumber(assets.data?.total ?? counts.assets)} icon={<Crosshair className="size-4" />} hint="Exploited = true" />
        <StatTile label="Asset Kinds" value={formatNumber(Object.keys(overview.data?.byKind || {}).length)} icon={<Layers className="size-4" />} hint="Classified by producing SDK" />
        <StatTile
          label={mode === 'objectives' ? 'Artifacts' : 'Open Sessions'}
          value={formatNumber(mode === 'objectives' ? counts.artifacts : counts.openSessions)}
          icon={mode === 'objectives' ? <FileArchive className="size-4" /> : <Terminal className="size-4" />}
          hint={`${formatNumber(counts.sessions)} total sessions`}
        />
        <StatTile
          label={mode === 'objectives' ? 'Objectives' : 'Stage SDKs'}
          value={formatNumber(mode === 'objectives' ? counts.objectives : overview.data?.sdkCount)}
          icon={<Zap className="size-4" />}
          hint={mode === 'objectives' ? 'Objective records created' : 'Dedicated exploit plugins'}
        />
      </div>

      <DataTable
        rows={assets.data?.items || []}
        columns={columns}
        rowKey={(row) => row.id}
        loading={assets.isFetching && !assets.data}
        empty={
          <EmptyState
            title={mode === 'objectives' ? 'No produce available' : 'No breached assets yet'}
            description={
              mode === 'objectives'
                ? 'Run exploit tasks and then objective probes to collect artifacts and objectives.'
                : 'Exploit-stage tasks flip discovered assets to exploited. Start one above.'
            }
            action={writable ? <Button size="sm" onClick={() => openTask()}>Run a stage task</Button> : undefined}
          />
        }
        onRowClick={(row) => setParam('focus', row.id)}
        rowLabel={(row) => `Inspect ${row.key || row.id}`}
      />
      <Pagination page={page} pageSize={20} total={assets.data?.total || 0} onChange={(value) => setParam('page', value)} />

      {mode === 'objectives' ? (
        <ProducePanel
          organizationId={organizationId || undefined}
          onRunTask={(assetId) => {
            const asset = (assets.data?.items || []).find((item) => item.id === assetId)
            openTask(asset?.key || '')
          }}
        />
      ) : null}

      <Sheet open={Boolean(focus)} onOpenChange={(open) => !open && setParam('focus', '')}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedAsset?.displayName || selectedAsset?.key || 'Asset detail'}</SheetTitle>
            <SheetDescription>Classified asset record for the {STAGE_META[mode].label} stage.</SheetDescription>
          </SheetHeader>
          {selectedAsset ? (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="info">{kindLabel(selectedAsset.kind)}</Badge>
                <Badge variant={selectedAsset.exploited ? 'success' : 'outline'}>
                  {selectedAsset.exploited ? 'Breached' : 'Discovered'}
                </Badge>
                <StagePill stage={mode} />
              </div>
              <dl className="grid grid-cols-2 gap-2 rounded-[4px] border bg-card p-3">
                <Fact label="Key" value={selectedAsset.key || '—'} />
                <Fact label="Origin" value={selectedAsset.origin || 'scan'} />
                <Fact label="Confidence" value={confidencePercent(selectedAsset.confidence)} />
                <Fact label="Stage" value={selectedAsset.stage || mode} />
                <Fact label="First Seen" value={formatTime(selectedAsset.firstSeen)} />
                <Fact label="Last Seen" value={formatTime(selectedAsset.lastSeen)} />
                <Fact label="Exploited At" value={formatTime(selectedAsset.exploitedAt)} />
                <Fact label="Last Task" value={selectedAsset.lastTaskId || '—'} />
              </dl>
              {selectedAsset.tags?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedAsset.tags.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              ) : null}
              {selectedAsset.notes ? <p className="leading-5 text-muted-foreground">{selectedAsset.notes}</p> : null}
              <div>
                <div className="mono-label mb-1.5">Enrichment Data</div>
                <pre className="max-h-56 overflow-auto rounded-[4px] border bg-[#050b05] p-3 font-mono text-[11px] leading-relaxed text-[#9fe89f] scrollbar-thin">
                  {JSON.stringify(selectedAsset.data || {}, null, 2)}
                </pre>
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" onClick={() => openShell(selectedAsset)}>
                  <Terminal className="mr-1 size-3.5" /> Open Shell
                </Button>
                {sessionFor(selectedAsset) ? (
                  <span className="mono-label self-center">
                    session {sessionFor(selectedAsset)?.state} · {sessionFor(selectedAsset)?.protocol}
                  </span>
                ) : null}
                {writable ? (
                  <Button size="sm" variant="outline" onClick={() => openTask(selectedAsset.key)}>
                    <Play className="mr-1 size-3.5" /> Run Task
                  </Button>
                ) : null}
                {mode === 'objectives' ? (
                  <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
                    <Download className="mr-1 size-3.5" /> Export
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-xs uppercase tracking-[0.04em] text-muted-foreground">
              This asset is not on the current page. Clear the filters or go back to page one.
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New {STAGE_META[mode].shortLabel} task</DialogTitle>
            <DialogDescription>
              Spawn a stage-scoped follow-up task. The engine routes it to the {mode} queue and records the stage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block">
              <span className="mono-label">Task kind</span>
              <Select value={taskKind} onValueChange={setTaskKind}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select a task kind" /></SelectTrigger>
                <SelectContent>
                  {STAGE_TASK_KINDS[mode].map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block">
              <span className="mono-label">Target</span>
              <Input
                className="mt-1"
                value={taskTarget}
                onChange={(event) => setTaskTarget(event.target.value)}
                placeholder="host, URL or asset key"
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mono-label">Name (optional)</span>
              <Input
                className="mt-1"
                value={taskName}
                onChange={(event) => setTaskName(event.target.value)}
                placeholder={`${STAGE_META[mode].shortLabel} follow-up`}
                autoComplete="off"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>Cancel</Button>
            <Button onClick={() => runTask.mutate()} disabled={runTask.isPending}>
              <Zap className="mr-1 size-3.5" /> {runTask.isPending ? 'Queueing…' : 'Queue task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShellConsole sessionId={shellSessionId} open={shellOpen} onOpenChange={setShellOpen} />
      <ExportDrawer
        organizationId={organizationId || undefined}
        open={exportOpen}
        onOpenChange={setExportOpen}
      />
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
