import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api, type Scope } from '@/api'
import { DataTable } from '@/components/common/data-table'
import { ExpandableSearch, ScreenToolbar } from '@/components/common/screen-toolbar'
import { Field } from '@/components/common/form'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { canWrite } from '@/lib/access'
import { useAuth } from '@/app/auth'
import { formatTime } from '@/lib/format'

export function ScopesPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', type: 'domain', targets: '' })
  const scopes = useQuery({ queryKey: ['scopes'], queryFn: () => api.scopes() })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['scopes'] })
  const create = useMutation({
    mutationFn: () => api.createScope({ ...form, targets: form.targets.split(/[\s,]+/).filter(Boolean) }),
    onSuccess: () => {
      toast.success('Asset group created')
      setOpen(false)
      setForm({ name: '', type: 'domain', targets: '' })
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteScope(id),
    onSuccess: () => {
      toast.success('Asset group deleted')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const update = useMutation({
    mutationFn: () =>
      api.updateScope(editingId, {
        ...form,
        targets: form.targets.split(/[\s,]+/).filter(Boolean),
      }),
    onSuccess: () => {
      toast.success('Asset group updated')
      setOpen(false)
      setEditingId('')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  function edit(row: Scope) {
    setEditingId(row.id || '')
    setForm({ name: row.name || '', type: row.type || 'domain', targets: (row.targets || []).join('\n') })
    setOpen(true)
  }
  const rows = useMemo(
    () =>
      ((scopes.data?.items || []) as Scope[]).filter(
        (row) => !search || `${row.name} ${(row.targets || []).join(' ')}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [scopes.data, search],
  )
  return (
    <div>
      <ScreenToolbar
        left={
          <ExpandableSearch
            value={search}
            onChange={setSearch}
            placeholder="Search group name or targets…"
            title="Search asset groups"
          />
        }
        center={scopes.isLoading ? 'Loading…' : `${rows.length} groups`}
        right={
          canWrite(role) ? (
            <Button
              size="icon"
              title="New Asset Group"
              aria-label="New Asset Group"
              onClick={() => {
                setEditingId('')
                setForm({ name: '', type: 'domain', targets: '' })
                setOpen(true)
              }}
            >
              <Plus />
              <span className="sr-only">New Asset Group</span>
            </Button>
          ) : null
        }
      />
      {scopes.isLoading ? (
        <LoadingBlock />
      ) : scopes.error ? (
        <ErrorState error={scopes.error} retry={() => scopes.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id || row.name || ''}
          empty={<EmptyState title="No asset groups" />}
          columns={[
            { key: 'name', header: 'Name', cell: (row) => row.name },
            { key: 'type', header: 'Type', cell: (row) => row.type },
            {
              key: 'targets',
              header: 'Targets',
              cell: (row) => <span className="mono max-w-[420px] truncate">{row.targets?.join(', ') || '—'}</span>,
            },
            { key: 'created', header: 'Created', cell: (row) => formatTime(row.createdAt), hideOnTablet: true },
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
                      title="Delete asset group"
                      description="Moved to the recycle bin. Blocked while referenced by active monitors."
                      confirmLabel="Move To Recycle Bin"
                      onConfirm={() => remove.mutate(row.id || '')}
                      trigger={
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8 text-destructive"
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
            <DialogTitle>{editingId ? 'Edit Asset Group' : 'New Asset Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Type">
              <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="domain">Domain</SelectItem>
                  <SelectItem value="ip">IP / CIDR</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Targets" hint="Separate targets with commas, spaces, or new lines.">
              <Textarea value={form.targets} onChange={(e) => setForm({ ...form, targets: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" className="size-8" title="Cancel" onClick={() => setOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button
              disabled={!form.name.trim() || !form.targets.trim() || create.isPending || update.isPending}
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
