import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Pause, Pencil, Play, Plus, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, type Monitor } from '@/api'
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

const kindLabels: Record<string, string> = {
  domain: 'Domain',
  ip: 'IP',
  site_update: 'Site Update',
  wih_update: 'WIH Update',
}

export function MonitorsPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [search, setSearch] = useState('')
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
  const rows = useMemo(
    () =>
      ((monitors.data?.items || []) as Monitor[]).filter(
        (row) => !search || `${row.name} ${row.target}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [monitors.data, search],
  )
  const scopeRows = (scopes.data?.items || []) as Array<{ id?: string; name?: string }>
  const policyRows = (policies.data?.items || []) as Array<{ id?: string; name?: string }>
  return (
    <div>
      <ScreenToolbar
        left={
          <ExpandableSearch
            value={search}
            onChange={setSearch}
            placeholder="Search monitor name or target…"
            title="Search monitors"
          />
        }
        center={monitors.isLoading ? 'Loading…' : `${rows.length} monitors`}
        right={
          canWrite(role) ? (
            <Button
              size="icon"
              title="New Monitor"
              aria-label="New Monitor"
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
              <span className="sr-only">New Monitor</span>
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
            { key: 'kind', header: 'Type', cell: (row) => kindLabels[row.kind || ''] || row.kind },
            { key: 'target', header: 'Target', cell: (row) => <span className="mono">{row.target}</span> },
            { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
            { key: 'next', header: 'Next run', cell: (row) => formatTime(row.nextRunAt), hideOnTablet: true },
            {
              key: 'actions',
              header: 'Actions',
              cell: (row) =>
                canWrite(role) ? (
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="outline" title="Edit" onClick={() => edit(row)}>
                      <Pencil />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      title="Run"
                      onClick={() => action.mutate({ id: row.id || '', action: 'run' })}
                    >
                      <Play />
                      <span className="sr-only">Run</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      title={row.status === 'active' ? 'Pause' : 'Resume'}
                      onClick={() =>
                        action.mutate({ id: row.id || '', action: row.status === 'active' ? 'pause' : 'resume' })
                      }
                    >
                      {row.status === 'active' ? <Pause /> : <Play />}
                      <span className="sr-only">{row.status === 'active' ? 'Pause' : 'Resume'}</span>
                    </Button>
                    <ConfirmDialog
                      title="Delete monitor"
                      description="Moved to the recycle bin. Historical runs are kept."
                      confirmLabel="Move To Recycle Bin"
                      onConfirm={() => remove.mutate(row.id || '')}
                      trigger={
                        <Button
                          size="icon"
                          variant="outline"
                          className="text-destructive"
                          title="Delete"
                        >
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
            <DialogTitle>{editingId ? 'Edit Monitor' : 'New Monitor'}</DialogTitle>
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
                    {Object.entries(kindLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
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
            <Field label="Policy">
              <Select
                value={form.policyId || 'none'}
                onValueChange={(value) => setForm({ ...form, policyId: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Task Default Policy</SelectItem>
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
            <Button size="icon" variant="outline" title="Cancel" onClick={() => setOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button
              disabled={
                !form.name.trim() || !form.target.trim() || !form.scopeId || create.isPending || update.isPending
              }
              onClick={() => (editingId ? update.mutate() : create.mutate())}
            >
              <Save className="size-4" />
              <span className="sr-only">Save</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
