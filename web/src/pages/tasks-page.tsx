import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Crosshair, List, Plus, Search, Square, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/api'
import { StatusBadge } from '@/components/common/badges'
import { DataTable } from '@/components/common/data-table'
import { ExpandableSearch, FilterDropdown, ScreenToolbar } from '@/components/common/screen-toolbar'
import { Pagination } from '@/components/common/pagination'
import { Field } from '@/components/common/form'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { canWrite } from '@/lib/access'
import { useAuth } from '@/app/auth'
import { relativeTime } from '@/lib/format'

export function TasksPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', kind: 'domain', target: '', policyId: '', scopeId: '', organizationId: '' })
  const origin = params.get('origin') || 'surface'
  const status = params.get('status') || ''
  const kind = params.get('kind') || ''
  const q = params.get('q') || ''
  const page = Number(params.get('page') || 1)
  const tasks = useQuery({
    queryKey: ['tasks', origin, status, kind, q, page],
    queryFn: () => api.tasks({ origin, status, kind, q, page, pageSize: 20 }),
    refetchInterval: 10_000,
  })
  const organizations = useQuery({ queryKey: ['organizations', ''], queryFn: () => api.organizations('') })
  const create = useMutation({
    mutationFn: () =>
      api.createTask({
        name: form.name,
        kind: form.kind,
        target: form.target,
        policyId: form.policyId || undefined,
        scopeId: form.scopeId || undefined,
        organizationId: form.organizationId || undefined,
      }),
    onSuccess: () => {
      toast.success('Task created')
      setCreateOpen(false)
      setForm({ name: '', kind: 'domain', target: '', policyId: '', scopeId: '', organizationId: '' })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error) => toast.error(error.message),
  })
  const cancel = useMutation({
    mutationFn: (id: string) => api.cancelTask(id),
    onSuccess: () => {
      toast.success('Task stopped')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error) => toast.error(error.message),
  })
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  return (
    <div>
      <ScreenToolbar
        left={
          <>
            <div className="flex rounded-[4px] bg-muted p-1">
              <Button
                size="sm"
                variant={origin === 'surface' ? 'default' : 'ghost'}
                title="Attack Surface Tasks"
                onClick={() => setParam('origin', 'surface')}
              >
                <Crosshair className="size-4" />
                <span className="sr-only">Attack Surface</span>
              </Button>
              <Button size="sm" variant={origin === 'all' ? 'default' : 'ghost'} title="All Tasks" onClick={() => setParam('origin', 'all')}>
                <List className="size-4" />
                <span className="sr-only">All Tasks</span>
              </Button>
            </div>
            <ExpandableSearch
              value={q}
              onChange={(value) => setParam('q', value)}
              placeholder="Search tasks or targets…"
              title="Search tasks"
            />
          </>
        }
        center={tasks.isLoading ? 'Loading…' : `${tasks.data?.total ?? 0} tasks`}
        right={
          <>
            {canWrite(role) ? (
              <Button size="icon" title="New Task" aria-label="New Task" onClick={() => setCreateOpen(true)}>
                <Plus />
                <span className="sr-only">New Task</span>
              </Button>
            ) : null}
            <FilterDropdown
              label="Filter by status"
              options={[
                { value: '', label: 'All Statuses' },
                ...['queued', 'running', 'succeeded', 'partial', 'failed', 'canceled'].map((item) => ({
                  value: item,
                  label: item,
                })),
              ]}
              value={status}
              onChange={(value) => setParam('status', value)}
            />
            <FilterDropdown
              label="Filter by type"
              options={[
                { value: '', label: 'All Types' },
                ...['domain', 'ip', 'risk_cruising', 'asset_site_update'].map((item) => ({
                  value: item,
                  label: item,
                })),
              ]}
              value={kind}
              onChange={(value) => setParam('kind', value)}
            />
          </>
        }
      />
      {tasks.isLoading ? (
        <LoadingBlock />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} retry={() => tasks.refetch()} />
      ) : (
        <>
          <DataTable
            rows={tasks.data?.items || []}
            rowKey={(row) => row.id || ''}
            empty={
              <EmptyState
                title="No matching tasks"
                description="Start a root-domain scan from an organization, or create a task manually."
              />
            }
            columns={[
              {
                key: 'name',
                header: 'Task',
                cell: (row) => (
                  <Link to={`/tasks/${row.id}`} className="font-medium text-primary hover:underline">
                    {row.name || row.id}
                  </Link>
                ),
              },
              { key: 'target', header: 'Target', cell: (row) => <span className="mono">{row.target}</span> },
              { key: 'kind', header: 'Type', cell: (row) => row.kind || '—', hideOnTablet: true },
              { key: 'origin', header: 'Origin', cell: (row) => row.origin || 'manual', hideOnTablet: true },
              { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
              {
                key: 'progress',
                header: 'Progress',
                cell: (row) => (
                  <div className="w-28">
                    <Progress value={row.progress || 0} />
                    <div className="mt-1 text-[10px] text-muted-foreground">{row.progress || 0}%</div>
                  </div>
                ),
              },
              { key: 'created', header: 'Created', cell: (row) => relativeTime(row.createdAt), hideOnTablet: true },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <div className="flex justify-end gap-1">
                    <Button asChild size="icon" variant="outline" className="size-8" title="Details">
                      <Link to={`/tasks/${row.id}`}>
                        <Search className="size-4" />
                        <span className="sr-only">Details</span>
                      </Link>
                    </Button>
                    {canWrite(role) && !['succeeded', 'failed', 'canceled', 'partial'].includes(row.status || '') ? (
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8 text-destructive hover:text-destructive"
                        title="Stop"
                        onClick={() => cancel.mutate(row.id || '')}
                      >
                        <Square />
                        <span className="sr-only">Stop</span>
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            page={tasks.data?.page || page}
            pageSize={tasks.data?.pageSize || 20}
            total={tasks.data?.total || 0}
            onChange={(next) => setParam('page', String(next))}
          />
        </>
      )}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Task Name" hint="Optional.">
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Task Type">
                <Select value={form.kind} onValueChange={(value) => setForm({ ...form, kind: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="domain">Domain</SelectItem>
                    <SelectItem value="ip">IP</SelectItem>
                    <SelectItem value="risk_cruising">Risk Cruise</SelectItem>
                    <SelectItem value="asset_site_update">Site Update</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Policy ID" hint="Optional.">
                <Input value={form.policyId} onChange={(event) => setForm({ ...form, policyId: event.target.value })} />
              </Field>
            </div>
            <Field label="Organization" hint="Optional. Links the task to an organization.">
              <Select
                value={form.organizationId || 'none'}
                onValueChange={(value) => setForm({ ...form, organizationId: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No organization</SelectItem>
                  {(organizations.data?.items || []).map((org) => (
                    <SelectItem key={org.id || ''} value={org.id || ''}>
                      {org.canonicalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Target">
              <Textarea
                value={form.target}
                onChange={(event) => setForm({ ...form, target: event.target.value })}
                placeholder="example.com / 10.0.0.0/24 / https://site.example"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" className="size-8" title="Cancel" onClick={() => setCreateOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button disabled={!form.target.trim() || create.isPending} onClick={() => create.mutate()}>
              <Plus />
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
