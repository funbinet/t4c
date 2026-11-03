import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, type Monitor } from '@/api'
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

export function MonitorsPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({
    name: '',
    kind: 'domain',
    target: '',
    intervalSec: 21600,
    scopeId: '',
    policyId: '',
  })
  const monitors = useQuery({ queryKey: ['monitors'], queryFn: () => api.monitors() })
  const scopes = useQuery({ queryKey: ['scopes'], queryFn: () => api.scopes() })
  const policies = useQuery({ queryKey: ['policies'], queryFn: () => api.policies() })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['monitors'] })
  const create = useMutation({
    mutationFn: () => api.createMonitor(form),
    onSuccess: () => {
      toast.success('Monitor created')
      setOpen(false)
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const action = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'pause' | 'resume' | 'run' }) => api.monitorAction(id, action),
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'run' ? 'Run triggered' : 'Status updated')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteMonitor(id),
    onSuccess: () => {
      toast.success('Monitor deleted')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const update = useMutation({
    mutationFn: () => api.updateMonitor(editingId, form),
    onSuccess: () => {
      toast.success('Monitor updated')
      setOpen(false)
      setEditingId('')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  function edit(row: Monitor) {
    setEditingId(row.id || '')
    setForm({
      name: row.name || '',
      kind: row.kind || 'domain',
      target: row.target || '',
      intervalSec: row.intervalSec || 21600,
      scopeId: row.scopeId || '',
      policyId: row.policyId || '',
    })
    setOpen(true)
  }
  const rows = (monitors.data?.items || []) as Monitor[]
  const scopeRows = (scopes.data?.items || []) as Array<{ id?: string; name?: string }>
  const policyRows = (policies.data?.items || []) as Array<{ id?: string; name?: string }>
  return (
    <div>
      <PageHeader
        title="Recurring monitors"
        description="Create recurring tasks for domains, IPs, sites, or WIH changes."
        actions={
          canWrite(role) ? (
            <Button
              onClick={() => {
                setEditingId('')
                setForm({
                  name: '',
                  kind: 'domain',
                  target: '',
                  intervalSec: 21600,
                  scopeId: '',
                  policyId: '',
                })
                setOpen(true)
              }}
            >
              <Plus />
              New monitor
            </Button>
          ) : null
        }
      />
      {monitors.isLoading ? (
        <LoadingBlock />
      ) : monitors.error ? (
        <ErrorState error={monitors.error} retry={() => monitors.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id || ''}
          empty={<EmptyState title="No monitors" />}
          columns={[
            { key: 'name', header: 'Name', cell: (row) => row.name },
            { key: 'kind', header: 'Type', cell: (row) => row.kind },
            { key: 'target', header: 'Target', cell: (row) => <span className="mono">{row.target}</span> },
            { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
            { key: 'next', header: 'Next run', cell: (row) => formatTime(row.nextRunAt), hideOnTablet: true },
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => action.mutate({ id: row.id || '', action: 'run' })}
                    >
                      <Play />
                      Run
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        action.mutate({ id: row.id || '', action: row.status === 'active' ? 'pause' : 'resume' })
                      }
                    >
                      {row.status === 'active' ? (
                        <>
                          <Pause />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play />
                          Resume
                        </>
                      )}
                    </Button>
                    <ConfirmDialog
                      title="Delete monitor"
                      description="The monitor will be moved to the recycle bin and stop scheduling. Historical runs are kept."
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
            <DialogTitle>{editingId ? 'Edit monitor' : 'New monitor'}</DialogTitle>
            <DialogDescription>
              A monitor must reference a valid asset group. The next run time is recalculated from the new interval
              after editing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <Select value={form.kind} onValueChange={(value) => setForm({ ...form, kind: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['domain', 'ip', 'site_update', 'wih_update'].map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Interval (seconds)">
                <Input
                  type="number"
                  value={form.intervalSec}
                  onChange={(e) => setForm({ ...form, intervalSec: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Target">
              <Input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
            </Field>
            <Field label="Asset group">
              <Select value={form.scopeId} onValueChange={(value) => setForm({ ...form, scopeId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an asset group" />
                </SelectTrigger>
                <SelectContent>
                  {scopeRows.map((scope) => (
                    <SelectItem key={scope.id || ''} value={scope.id || ''}>
                      {scope.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Policy ID (optional)">
              <Select
                value={form.policyId || 'none'}
                onValueChange={(value) => setForm({ ...form, policyId: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Use the task default policy</SelectItem>
                  {policyRows.map((policy) => (
                    <SelectItem key={policy.id || ''} value={policy.id || ''}>
                      {policy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !form.name.trim() || !form.target.trim() || !form.scopeId || create.isPending || update.isPending
              }
              onClick={() => (editingId ? update.mutate() : create.mutate())}
            >
              {editingId ? 'Save changes' : 'Create monitor'}
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
