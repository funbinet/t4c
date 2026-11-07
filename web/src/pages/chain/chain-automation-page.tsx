import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Boxes, CalendarClock, Plus, Settings2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, type ChainAutomationItem, type ChainPage } from '@/api'
import { useAuth } from '@/app/auth'
import { STAGE_META, useMode, type Stage } from '@/app/mode'
import { StatusBadge } from '@/components/common/badges'
import { DataTable, type Column } from '@/components/common/data-table'
import { ScreenToolbar } from '@/components/common/screen-toolbar'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
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
import { STAGE_TASK_KINDS, StagePill, humanize } from './chain-shared'

export type AutomationKind = 'monitors' | 'schedules' | 'policies' | 'groups'

const CONFIG: Record<AutomationKind, { label: string; description: string; icon: typeof Activity }> = {
  monitors: {
    label: 'Monitors',
    description: 'Continuous stage watchers that re-run tasks on an interval',
    icon: Activity,
  },
  schedules: {
    label: 'Schedules',
    description: 'Cron / one-shot schedules for stage task execution',
    icon: CalendarClock,
  },
  policies: { label: 'Scan Policies', description: 'Module policies assigned to this chain stage', icon: Settings2 },
  groups: { label: 'Asset Groups', description: 'Scoped target groups reserved for this stage', icon: Boxes },
}

/**
 * One stage-scoped automation screen for all four automation resources
 * (plan §9). Every list/create call is mode-scoped, and created records are
 * stamped with the active Stage by the backend.
 */
export function ChainAutomationPage({ kind }: { kind: AutomationKind }) {
  const { mode } = useMode()
  const { role } = useAuth()
  const writable = canWrite(role)
  const queryClient = useQueryClient()
  const config = CONFIG[kind]
  const Icon = config.icon
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    target: '',
    targets: '',
    type: 'domain',
    intervalSec: '3600',
    cron: '0 3 * * *',
    kind: STAGE_TASK_KINDS[mode][0]?.value || 'exploit',
  })

  const list = useQuery({
    queryKey: ['chain-automation', kind, mode],
    queryFn: () => fetchItems(kind, mode),
    refetchInterval: 20_000,
  })

  const create = useMutation({
    mutationFn: () => createItem(kind, mode, form),
    onSuccess: () => {
      toast.success(`${config.label.slice(0, -1)} created for the ${mode} stage`)
      setCreateOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['chain-automation', kind, mode] })
      void queryClient.invalidateQueries({ queryKey: ['chain-overview', mode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = buildColumns(kind)
  const items = list.data?.items || []

  return (
    <div className="space-y-4">
      <ScreenToolbar
        left={
          <div className="flex items-center gap-2">
            <span className="mono-label">
              {STAGE_META[mode].shortLabel} · {config.label}
            </span>
            <StagePill stage={mode} />
          </div>
        }
        center={config.description}
        right={
          writable ? (
            <Button
            size="icon"
            title="New {config.label.slice(0, -1)}"
            aria-label="New {config.label.slice(0, -1)}"
            onClick={() => setCreateOpen(true)}
          >
              <Plus />
              <span className="sr-only">New {config.label.slice(0, -1)}</span>
            </Button>
          ) : (
            <span className="mono-label">Read-only access</span>
          )
        }
      />

      {list.isLoading ? <LoadingBlock variant="table" /> : null}
      {list.error ? <ErrorState error={list.error} retry={() => list.refetch()} /> : null}

      <div className="flex items-center gap-2">
        <Icon className="size-4 text-foreground" />
        <span className="text-xs text-muted-foreground">
          {formatNumber(list.data?.total ?? items.length)} {config.label.toLowerCase()} assigned to the {mode} stage
        </span>
      </div>

      <DataTable
        rows={items}
        columns={columns}
        rowKey={(row) => row.id || row.name || 'record'}
        loading={list.isFetching && !list.data}
        empty={
          <EmptyState
            title={`No ${mode} ${config.label.toLowerCase()}`}
            description={`Create one above; the backend will stamp stage = ${mode} on the record.`}
          />
        }
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="size-4 text-foreground" /> New {config.label.slice(0, -1)}
            </DialogTitle>
            <DialogDescription>
              The record is created in the {STAGE_META[mode].label} stage and only appears in that mode.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block">
              <span className="mono-label">Name</span>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={`${mode} ${kind.slice(0, -1)}`}
                autoComplete="off"
              />
            </label>
            {kind === 'policies' ? (
              <label className="block">
                <span className="mono-label">Description</span>
                <Input
                  className="mt-1"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="What this policy enables"
                  autoComplete="off"
                />
              </label>
            ) : null}
            {kind === 'monitors' || kind === 'schedules' ? (
              <>
                <label className="block">
                  <span className="mono-label">Target</span>
                  <Input
                    className="mt-1"
                    value={form.target}
                    onChange={(event) => setForm((prev) => ({ ...prev, target: event.target.value }))}
                    placeholder="domain, host or asset group"
                    autoComplete="off"
                  />
                </label>
                <label className="block">
                  <span className="mono-label">Task kind</span>
                  <Select value={form.kind} onValueChange={(value) => setForm((prev) => ({ ...prev, kind: value }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a task kind" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_TASK_KINDS[mode].map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {kind === 'monitors' ? (
                  <label className="block">
                    <span className="mono-label">Interval (seconds)</span>
                    <Input
                      className="mt-1"
                      type="number"
                      min={60}
                      value={form.intervalSec}
                      onChange={(event) => setForm((prev) => ({ ...prev, intervalSec: event.target.value }))}
                    />
                  </label>
                ) : (
                  <label className="block">
                    <span className="mono-label">Cron expression</span>
                    <Input
                      className="mt-1 mono"
                      value={form.cron}
                      onChange={(event) => setForm((prev) => ({ ...prev, cron: event.target.value }))}
                      placeholder="0 3 * * *"
                    />
                  </label>
                )}
              </>
            ) : null}
            {kind === 'groups' ? (
              <>
                <label className="block">
                  <span className="mono-label">Group type</span>
                  <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="domain">Domain</SelectItem>
                      <SelectItem value="ip">IP</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="block">
                  <span className="mono-label">Targets (comma separated)</span>
                  <Input
                    className="mt-1"
                    value={form.targets}
                    onChange={(event) => setForm((prev) => ({ ...prev, targets: event.target.value }))}
                    placeholder="example.com, 10.0.0.0/24"
                    autoComplete="off"
                  />
                </label>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" size="icon" onClick={() => setCreateOpen(false)} title="Cancel" aria-label="Cancel">
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button size="icon" onClick={() => create.mutate()} disabled={create.isPending} title="Create" aria-label="Create">
              <Plus />
              <span className="sr-only">Create</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ChainMonitorsPage() {
  return <ChainAutomationPage kind="monitors" />
}
export function ChainSchedulesPage() {
  return <ChainAutomationPage kind="schedules" />
}
export function ChainPoliciesPage() {
  return <ChainAutomationPage kind="policies" />
}
export function ChainGroupsPage() {
  return <ChainAutomationPage kind="groups" />
}

type AutomationForm = {
  name: string
  description: string
  target: string
  targets: string
  type: string
  intervalSec: string
  cron: string
  kind: string
}

async function fetchItems(kind: AutomationKind, mode: Stage): Promise<ChainPage<ChainAutomationItem>> {
  switch (kind) {
    case 'monitors':
      return api.stageMonitors(mode)
    case 'schedules':
      return api.stageSchedules(mode)
    case 'groups':
      return api.stageGroups(mode)
    case 'policies': {
      const data = await api.stagePolicies(mode)
      return { items: data.items, total: data.items.length, stage: data.stage }
    }
  }
}

function createItem(kind: AutomationKind, mode: Stage, form: AutomationForm) {
  const body: Record<string, unknown> = {
    name: form.name.trim() || `${mode}-${kind}`,
    stage: mode,
  }
  switch (kind) {
    case 'monitors':
      return api.createStageMonitor(mode, {
        ...body,
        kind: form.kind,
        target: form.target.trim(),
        intervalSec: Number(form.intervalSec) || 3600,
        status: 'active',
      })
    case 'schedules':
      return api.createStageSchedule(mode, {
        ...body,
        taskKind: form.kind,
        target: form.target.trim(),
        cron: form.cron.trim(),
        status: 'active',
      })
    case 'groups':
      return api.createStageGroup(mode, {
        ...body,
        type: form.type,
        targets: form.targets
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      })
    case 'policies':
      return api.createStagePolicy(mode, {
        ...body,
        description: form.description.trim(),
        config: {},
      })
  }
}

function buildColumns(kind: AutomationKind): Column<ChainAutomationItem>[] {
  const nameColumn: Column<ChainAutomationItem> = {
    key: 'name',
    header: 'Name',
    cell: (row) => <span className="font-medium">{row.name || row.id || '—'}</span>,
  }
  const stageColumn: Column<ChainAutomationItem> = {
    key: 'stage',
    header: 'Stage',
    cell: (row) => <Badge variant="outline">{row.stage || '—'}</Badge>,
    hideOnTablet: true,
  }
  const statusColumn: Column<ChainAutomationItem> = {
    key: 'status',
    header: 'Status',
    cell: (row) => <StatusBadge status={row.status} />,
  }
  switch (kind) {
    case 'monitors':
      return [
        nameColumn,
        { key: 'kind', header: 'Task Kind', cell: (row) => <Badge variant="info">{humanize(row.kind)}</Badge> },
        { key: 'target', header: 'Target', cell: (row) => <span className="mono truncate">{row.target || '—'}</span> },
        {
          key: 'interval',
          header: 'Interval',
          cell: (row) => <span className="mono">{row.intervalSec || 0}s</span>,
          hideOnTablet: true,
        },
        statusColumn,
        { key: 'next', header: 'Next Run', cell: (row) => formatTime(row.nextRunAt), hideOnTablet: true },
        stageColumn,
      ]
    case 'schedules':
      return [
        nameColumn,
        {
          key: 'taskKind',
          header: 'Task Kind',
          cell: (row) => <Badge variant="info">{humanize(row.taskKind || row.kind)}</Badge>,
        },
        { key: 'cron', header: 'Schedule', cell: (row) => <span className="mono">{row.cron || 'one-shot'}</span> },
        {
          key: 'target',
          header: 'Target',
          cell: (row) => <span className="mono truncate">{row.target || '—'}</span>,
          hideOnTablet: true,
        },
        statusColumn,
        { key: 'next', header: 'Next Run', cell: (row) => formatTime(row.nextRunAt), hideOnTablet: true },
        stageColumn,
      ]
    case 'policies':
      return [
        nameColumn,
        {
          key: 'description',
          header: 'Description',
          cell: (row) => <span className="text-muted-foreground">{row.description || '—'}</span>,
        },
        {
          key: 'config',
          header: 'Modules',
          cell: (row) => <span className="mono">{Object.keys(row.config || {}).length || '—'}</span>,
          hideOnTablet: true,
        },
        { key: 'created', header: 'Created', cell: (row) => formatTime(row.createdAt), hideOnTablet: true },
        stageColumn,
      ]
    case 'groups':
      return [
        nameColumn,
        { key: 'type', header: 'Type', cell: (row) => <Badge variant="info">{humanize(row.type)}</Badge> },
        {
          key: 'targets',
          header: 'Targets',
          cell: (row) => <span className="mono truncate">{row.targets?.join(', ') || '—'}</span>,
        },
        {
          key: 'count',
          header: 'Count',
          cell: (row) => <span className="mono">{formatNumber(row.targets?.length)}</span>,
          hideOnTablet: true,
        },
        { key: 'created', header: 'Created', cell: (row) => formatTime(row.createdAt), hideOnTablet: true },
        stageColumn,
      ]
  }
}
