import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, type Scope } from '@/api'
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
import { Textarea } from '@/components/ui/textarea'
import { canWrite } from '@/lib/access'
import { useAuth } from '@/app/auth'
import { formatTime } from '@/lib/format'

export function ScopesPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
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
  const rows = (scopes.data?.items || []) as Scope[]
  return (
    <div>
      <PageHeader
        title="Asset groups"
        description="Keep the existing workflow of grouping assets by domain or IP range."
        actions={
          canWrite(role) ? (
            <Button
              onClick={() => {
                setEditingId('')
                setForm({ name: '', type: 'domain', targets: '' })
                setOpen(true)
              }}
            >
              <Plus />
              New asset group
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
                    <Button size="sm" variant="ghost" onClick={() => edit(row)}>
                      <Pencil />
                      Edit
                    </Button>
                    <ConfirmDialog
                      title="Delete asset group"
                      description="The asset group will be moved to the recycle bin. It cannot be deleted while referenced by active monitors."
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
            <DialogTitle>{editingId ? 'Edit asset group' : 'New asset group'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Changes to targets affect future tasks and monitors only. Historical links are not rebuilt.'
                : 'Separate targets with commas, spaces, or new lines.'}
            </DialogDescription>
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
            <Field label="Targets">
              <Textarea value={form.targets} onChange={(e) => setForm({ ...form, targets: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.name.trim() || !form.targets.trim() || create.isPending || update.isPending}
              onClick={() => (editingId ? update.mutate() : create.mutate())}
            >
              {editingId ? 'Save changes' : 'Create asset group'}
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
