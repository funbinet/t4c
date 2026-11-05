import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CircleSlash2, ListChecks, Loader2, Workflow, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type ChainTask } from '@/api'
import { useAuth } from '@/app/auth'
import { STAGE_META, stageBase, useMode } from '@/app/mode'
import { StatusBadge } from '@/components/common/badges'
import { DataTable, type Column } from '@/components/common/data-table'
import { Pagination } from '@/components/common/pagination'
import { ExpandableSearch, FilterDropdown, ScreenToolbar } from '@/components/common/screen-toolbar'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { StatTile } from '@/components/common/stat-tile'
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
import { canWrite } from '@/lib/access'
import { formatNumber, formatTime } from '@/lib/format'
import {
  STAGE_TASK_KINDS,
  TASK_STATUS_FILTERS,
  StagePill,
  humanize,
  stageScreenTitle,
} from './chain-shared'

/**
 * Stage-scoped Tasks screen (plan §8.3 / §8.5). Tasks are created through
 * POST /{stage}/tasks so the engine stamps the correct Stage and routes the
 * work to the stage queue. The create dialog only offers task kinds that are
 * valid for the active stage.
 */
export function ChainTasksPage() {
  const { mode } = useMode()
  const base = stageBase(mode)
  const { role } = useAuth()
  const writable = canWrite(role)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()

  const status = params.get('status') || ''
  const kind = params.get('kind') || ''
  const q = params.get('q') || ''
  const page = Math.max(1, Number(params.get('page') || 1))
  const [search, setSearch] = useState(q)
  const [createOpen, setCreateOpen] = useState(params.get('create') === '1')
  // Radix Select forbids empty-string item values, so "no selection" uses an
  // explicit sentinel that is mapped back to undefined before submission.
  const NONE = '__none__'
  const [form, setForm] = useState({
    name: '',
    kind: STAGE_TASK_KINDS[mode][0]?.value || 'exploit',
    target: '',
    organizationId: NONE,
    policyId: NONE,
  })

  useEffect(() => setSearch(q), [q])
  useEffect(() => {
    setForm((prev) => ({ ...prev, kind: STAGE_TASK_KINDS[mode][0]?.value || 'exploit' }))
  }, [mode])
  useEffect(() => {
    if (params.get('create') === '1') setCreateOpen(true)
  }, [params])

  const setParam = (key: string, value: string | number) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === 0) next.delete(key)
    else next.set(key, String(value))
    setParams(next, { replace: true })
  }

  const tasks = useQuery({
    queryKey: ['chain-tasks', mode, status, q, page],
    queryFn: () => api.stageTasks(mode, { status, q, page, pageSize: 20 }),
    refetchInterval: 10_000,
  })
  const overview = useQuery({
    queryKey: ['chain-overview', mode],
    queryFn: () => api.stageOverview(mode),
  })
  const orgs = useQuery({
    queryKey: ['chain-organizations', mode, ''],
    queryFn: () => api.stageOrganizations(mode),
  })
  const policies = useQuery({
    queryKey: ['chain-policies', mode],
    queryFn: () => api.stagePolicies(mode),
  })

  const create = useMutation({
    mutationFn: () =>
      api.createStageTask(mode, {
        name: form.name.trim() || `${STAGE_META[mode].shortLabel}-${Date.now()}`,
        kind: form.kind,
        target: form.target.trim() || 'discovered-assets',
        organizationId: form.organizationId === NONE ? undefined : form.organizationId,
        policyId: form.policyId === NONE ? undefined : form.policyId,
        options: {},
      }),
    onSuccess: (result) => {
      toast.success(`Queued ${result.total || 1} ${STAGE_META[mode].shortLabel} task(s)`)
      setCreateOpen(false)
      const next = new URLSearchParams(params)
      next.delete('create')
      setParams(next, { replace: true })
      void queryClient.invalidateQueries({ queryKey: ['chain-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['chain-overview'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const rows = useMemo(() => {
    const items = tasks.data?.items || []
    return kind ? items.filter((item) => item.kind === kind) : items
  }, [tasks.data, kind])

  const distribution = useMemo(() => {
    const out = { running: 0, succeeded: 0, failed: 0 }
    for (const row of tasks.data?.items || []) {
      if (row.status === 'running' || row.status === 'queued') out.running += 1
      else if (row.status === 'succeeded') out.succeeded += 1
      else if (row.status === 'failed') out.failed += 1
    }
    return out
  }, [tasks.data])

  const kindFilters = [
    { value: '', label: 'All task kinds' },
    ...STAGE_TASK_KINDS[mode].map((option) => ({ value: option.value, label: option.label })),
  ]

  const columns: Column<ChainTask>[] = [
    {
      key: 'name',
      header: 'Task',
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.name || row.id}</div>
          <div className="mono truncate text-[11px] text-muted-foreground">{row.target || '—'}</div>
        </div>
      ),
    },
    { key: 'kind', header: 'Kind', cell: (row) => <Badge variant="info">{humanize(row.kind)}</Badge>, hideOnTablet: true },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'progress',
      header: 'Progress',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
            <div className="h-full bg-mint" style={{ width: `${Math.min(100, Math.max(0, row.progress || 0))}%` }} />
          </div>
          <span className="mono text-[11px] text-muted-foreground">{Math.round(row.progress || 0)}%</span>
        </div>
      ),
      hideOnTablet: true,
    },
    { key: 'stage', header: 'Stage', cell: (row) => <Badge variant="outline">{row.stage || mode}</Badge>, hideOnTablet: true },
    { key: 'created', header: 'Created', cell: (row) => formatTime(row.createdAt), hideOnTablet: true },
  ]

  return (
    <div className="space-y-4">
      <ScreenToolbar
        left={
          <div className="flex items-center gap-2">
            <span className="mono-label">{stageScreenTitle(mode, 'Tasks')}</span>
            <StagePill stage={mode} />
            <ExpandableSearch
              value={search}
              onChange={setSearch}
              onSubmit={() => setParam('q', search)}
              placeholder="Search task name or target…"
              title="Search stage tasks"
            />
            <FilterDropdown options={kindFilters} value={kind} onChange={(value) => setParam('kind', value)} label="Filter by task kind" />
            <FilterDropdown options={TASK_STATUS_FILTERS} value={status} onChange={(value) => setParam('status', value)} label="Filter by status" />
          </div>
        }
        center={`${formatNumber(tasks.data?.total ?? overview.data?.counts?.tasks)} tasks recorded in this stage`}
        right={
          writable ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Zap className="mr-1 size-3.5" /> New {STAGE_META[mode].shortLabel} task
            </Button>
          ) : (
            <span className="mono-label">Read-only access</span>
          )
        }
      />

      {tasks.isLoading ? <LoadingBlock variant="grid" /> : null}
      {tasks.error ? <ErrorState error={tasks.error} retry={() => tasks.refetch()} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Stage Tasks" value={formatNumber(tasks.data?.total ?? overview.data?.counts?.tasks)} icon={<ListChecks className="size-4" />} hint="All time" />
        <StatTile label="Active / Queued" value={formatNumber(distribution.running)} icon={<Loader2 className="size-4" />} hint="On this page" />
        <StatTile label="Succeeded" value={formatNumber(distribution.succeeded)} icon={<CheckCircle2 className="size-4" />} hint="On this page" />
        <StatTile label="Failed" value={formatNumber(distribution.failed)} icon={<CircleSlash2 className="size-4" />} hint="On this page" />
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        loading={tasks.isFetching && !tasks.data}
        empty={
          <EmptyState
            title="No stage tasks yet"
            description={`Create a ${STAGE_META[mode].shortLabel} task to start work in this chain link.`}
            action={writable ? <Button size="sm" onClick={() => setCreateOpen(true)}>Create task</Button> : undefined}
          />
        }
        onRowClick={(row) => navigate(`${base}/tasks/${row.id}`)}
        rowLabel={(row) => `Open task ${row.name || row.id}`}
      />
      <Pagination page={page} pageSize={20} total={tasks.data?.total || 0} onChange={(value) => setParam('page', value)} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="size-4 text-mint" /> New {STAGE_META[mode].shortLabel} task
            </DialogTitle>
            <DialogDescription>
              The engine stamps stage = {mode}, selects the matching SDK registry and routes the steps to the stage queue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block">
              <span className="mono-label">Task kind</span>
              <Select value={form.kind} onValueChange={(value) => setForm((prev) => ({ ...prev, kind: value }))}>
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
                value={form.target}
                onChange={(event) => setForm((prev) => ({ ...prev, target: event.target.value }))}
                placeholder="domain, host, URL or asset key"
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mono-label">Name (optional)</span>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={`${STAGE_META[mode].shortLabel} validation`}
                autoComplete="off"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mono-label">Organization</span>
                <Select value={form.organizationId} onValueChange={(value) => setForm((prev) => ({ ...prev, organizationId: value }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Any organization" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Any organization</SelectItem>
                    {(orgs.data?.items || []).map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.canonicalName || org.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block">
                <span className="mono-label">Scan policy</span>
                <Select value={form.policyId} onValueChange={(value) => setForm((prev) => ({ ...prev, policyId: value }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Default policy" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Default policy</SelectItem>
                    {(policies.data?.items || [])
                      .filter((policy) => Boolean(policy.id))
                      .map((policy) => (
                        <SelectItem key={policy.id} value={policy.id as string}>{policy.name || policy.id}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              <Zap className="mr-1 size-3.5" /> {create.isPending ? 'Queueing…' : 'Queue task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
