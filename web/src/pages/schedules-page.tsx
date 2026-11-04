import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, type Schedule } from '@/api'
import { StatusBadge } from '@/components/common/badges'
import { DataTable } from '@/components/common/data-table'
import { ExpandableSearch, ScreenToolbar } from '@/components/common/screen-toolbar'
import { Field } from '@/components/common/form'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatTime } from '@/lib/format'
import { canWrite } from '@/lib/access'
import { useAuth } from '@/app/auth'

export function SchedulesPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [search, setSearch] = useState('')
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
  const rows = useMemo(
    () =>
      ((schedules.data?.items || []) as Schedule[]).filter(
        (row) => !search || `${row.name} ${row.target}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [schedules.data, search],
  )
  const policyRows = (policies.data?.items || []) as Array<{ id?: string; name?: string }>
  return (
    <div>
      <ScreenToolbar
        left={
          <ExpandableSearch
            value={search}
            onChange={setSearch}
            placeholder="Search schedule name or target…"
            title="Search schedules"
          />
        }
        center={schedules.isLoading ? 'Loading…' : `${rows.length} schedules`}
        right={
          canWrite(role) ? (
            <Button
              size="icon"
              title="New Schedule"
              aria-label="New Schedule"
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
              <span className="sr-only">New Schedule</span>
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
          empty={<EmptyState title="No schedules" />}
          columns={[
            { key: 'name', header: 'Name', cell: (row) => row.name },
            { key: 'kind', header: 'Type', cell: (row) => String(row.kind || '—') },
            {
              key: 'target',
              header: 'Target',
              cell: (row) => <span className="mono">{String(row.target || '—')}</span>,
            },
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
                    <Button size="icon" variant="outline" className="size-8" title="Edit" onClick={() => edit(row)}>
                      <Pencil />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <ConfirmDialog
                      title="Delete schedule"
                      description="Moved to the recycle bin. Historical scan tasks are kept."
                      confirmLabel="Move To Recycle Bin"
                      onConfirm={() => remove.mutate(row.id || '')}
                      trigger={
                        <Button size="icon" variant="outline" className="size-8 text-destructive hover:text-destructive" title="Delete">
                          <Trash2 />
                          <span className="sr-only">Delete</span>
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
            <DialogTitle>{editingId ? 'Edit Schedule' : 'New Schedule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Schedule">
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
              <Field label="Task">
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
            <Button size="icon" variant="outline" className="size-8" title="Cancel" onClick={() => setOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button
              disabled={
                !form.name.trim() || !form.target.trim() || !form.policyId || create.isPending || update.isPending
              }
              onClick={() => (editingId ? update.mutate() : create.mutate())}
            >
              <Save className="size-4" />
              {editingId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
