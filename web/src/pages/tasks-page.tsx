import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Square, Workflow } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/api'
import { StatusBadge } from '@/components/common/badges'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
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
import { Label } from '@/components/ui/label'
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
  const [form, setForm] = useState({ name: '', kind: 'domain', target: '', policyId: '', scopeId: '' })
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
  const create = useMutation({
    mutationFn: () =>
      api.createTask({
        name: form.name,
        kind: form.kind,
        target: form.target,
        policyId: form.policyId || undefined,
        scopeId: form.scopeId || undefined,
      }),
    onSuccess: () => {
      toast.success('Task created')
      setCreateOpen(false)
      setForm({ name: '', kind: 'domain', target: '', policyId: '', scopeId: '' })
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
      <PageHeader
        title="Scan Tasks"
        description="By default focuses on EASM tasks started from organizations and confirmed root domains; the raw task view keeps all scan and risk-cruise records."
        actions={
          canWrite(role) ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              New Task
            </Button>
          ) : null
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-[4px] bg-muted p-1">
          <Button
            size="sm"
            variant={origin === 'surface' ? 'default' : 'ghost'}
            onClick={() => setParam('origin', 'surface')}
          >
            Attack Surface Tasks
          </Button>
          <Button size="sm" variant={origin === 'all' ? 'default' : 'ghost'} onClick={() => setParam('origin', 'all')}>
            All Tasks
          </Button>
        </div>
        <form className="relative min-w-0 flex-1 sm:max-w-sm" onSubmit={(event) => event.preventDefault()}>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => setParam('q', event.target.value)}
            placeholder="Search tasks or targets…"
            className="pl-8"
          />
        </form>
        <Select value={status || 'all'} onValueChange={(value) => setParam('status', value === 'all' ? '' : value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {['queued', 'running', 'succeeded', 'partial', 'failed', 'canceled'].map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind || 'all'} onValueChange={(value) => setParam('kind', value === 'all' ? '' : value)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {['domain', 'ip', 'risk_cruising', 'asset_site_update'].map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
                action={<Workflow className="mx-auto mt-2 size-5 text-muted-foreground" />}
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
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/tasks/${row.id}`}>Details</Link>
                    </Button>
                    {canWrite(role) && !['succeeded', 'failed', 'canceled', 'partial'].includes(row.status || '') ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => cancel.mutate(row.id || '')}
                      >
                        <Square />
                        Stop
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
            <DialogTitle>New Scan Task</DialogTitle>
            <DialogDescription>
              Once queued, steps, assets, and risk events are visible on the task details page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Task Name (optional)">
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
              <Field label="Policy ID (optional)">
                <Input value={form.policyId} onChange={(event) => setForm({ ...form, policyId: event.target.value })} />
              </Field>
            </div>
            <Field label="Target">
              <Textarea
                value={form.target}
                onChange={(event) => setForm({ ...form, target: event.target.value })}
                placeholder="example.com / 10.0.0.0/24 / https://site.example"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!form.target.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Creating…' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
