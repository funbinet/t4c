import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, type Schedule } from '@/api'
import { StatusBadge } from '@/components/common/badges'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatTime } from '@/lib/format'
import { canWrite } from '@/lib/access'
import { useAuth } from '@/app/auth'

export function SchedulesPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({
    name: '',
    kind: 'recurrent_scan',
    taskKind: 'domain',
    target: '',
    policyId: '',
    cron: '0 2 * * *',
    startAt: '',
  })
  const schedules = useQuery({ queryKey: ['schedules'], queryFn: () => api.schedules() })
  const policies = useQuery({ queryKey: ['policies'], queryFn: () => api.policies() })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['schedules'] })
  const create = useMutation({
    mutationFn: () =>
      api.createSchedule({ ...form, startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined }),
    onSuccess: () => {
      toast.success('Schedule created')
      setOpen(false)
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSchedule(id),
    onSuccess: () => {
      toast.success('Schedule deleted')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const update = useMutation({
    mutationFn: () =>
      api.updateSchedule(editingId, {
        ...form,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      toast.success('Schedule updated')
      setOpen(false)
      setEditingId('')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  function edit(row: Schedule) {
    setEditingId(row.id || '')
    setForm({
      name: row.name || '',
      kind: String(row.kind || 'recurrent_scan'),
      taskKind: String(row.taskKind || 'domain'),
      target: String(row.target || ''),
      policyId: String(row.policyId || ''),
      cron: String(row.cron || ''),
      startAt: row.startAt ? new Date(String(row.startAt)).toISOString().slice(0, 16) : '',
    })
    setOpen(true)
  }
  const rows = (schedules.data?.items || []) as Schedule[]
  const policyRows = (policies.data?.items || []) as Array<{ id?: string; name?: string }>
  return (
    <div>
      <PageHeader
        title="Scheduled tasks"
        description="Manage recurring Cron scans and future one-off tasks."
        actions={
          canWrite(role) ? (
            <Button
              onClick={() => {
                setEditingId('')
                setForm({
                  name: '',
                  kind: 'recurrent_scan',
                  taskKind: 'domain',
                  target: '',
                  policyId: '',
                  cron: '0 2 * * *',
                  startAt: '',
                })
                setOpen(true)
              }}
            >
              <Plus />
              New schedule
            </Button>
          ) : null
        }
      />
      {schedules.isLoading ? (
        <LoadingBlock />
      ) : schedules.error ? (
        <ErrorState error={schedules.error} retry={() => schedules.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id || ''}
          empty={
            <EmptyState
              title="No schedules"
              action={<CalendarClock className="mx-auto mt-2 size-5 text-muted-foreground" />}
            />
          }
          columns={[
            { key: 'name', header: 'Name', cell: (row) => row.name },
            { key: 'kind', header: 'Type', cell: (row) => String(row.kind || '—') },
            { key: 'target', header: 'Target', cell: (row) => <span className="mono">{String(row.target || '—')}</span> },
            {
              key: 'cron',
              header: 'Cron',
              cell: (row) => <span className="mono">{row.cron || '—'}</span>,
              hideOnTablet: true,
            },
            { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status || '')} /> },
            { key: 'next', header: 'Next run', cell: (row) => formatTime(row.nextRunAt) },
            {
              key: 'actions',
              header: 'Actions',
              cell: (row) =>
                canWrite(role) ? (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => edit(row)}>
                      <Pencil />
                      Edit
                    </Button>
                    <ConfirmDialog
                      title="Delete schedule"
                      description="The schedule will be moved to the recycle bin and stop running. Historical scan tasks are kept."
                      confirmLabel="Move to recycle bin"
                      onConfirm={() => remove.mutate(row.id || '')}
                      trigger={
                        <Button size="sm" variant="ghost" className="text-destructive">
                          <Trash2 />
                          Delete
                        </Button>
                      }
                    />
                  </div>
                ) : null,
            },
          ]}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit schedule' : 'New schedule'}</DialogTitle>
            <DialogDescription>A schedule must reference a valid policy. The next run time is recalculated after saving.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Schedule type">
                <Select value={form.kind} onValueChange={(value) => setForm({ ...form, kind: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recurrent_scan">Recurring scan</SelectItem>
                    <SelectItem value="future_scan">One-off task</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Task type">
                <Select value={form.taskKind} onValueChange={(value) => setForm({ ...form, taskKind: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="domain">Domain</SelectItem>
                    <SelectItem value="ip">IP</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Target">
              <Input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
            </Field>
            <Field label="Scan policy">
              <Select value={form.policyId} onValueChange={(value) => setForm({ ...form, policyId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a scan policy" />
                </SelectTrigger>
                <SelectContent>
                  {policyRows.map((policy) => (
                    <SelectItem key={policy.id || ''} value={policy.id || ''}>
                      {policy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {form.kind === 'recurrent_scan' ? (
              <Field label="Cron">
                <Input value={form.cron} onChange={(e) => setForm({ ...form, cron: e.target.value })} />
              </Field>
            ) : (
              <Field label="Start time">
                <Input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                />
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !form.name.trim() || !form.target.trim() || !form.policyId || create.isPending || update.isPending
              }
              onClick={() => (editingId ? update.mutate() : create.mutate())}
            >
              {editingId ? 'Save changes' : 'Create schedule'}
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
