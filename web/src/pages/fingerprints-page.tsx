import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fingerprint as FingerprintIcon, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api, type Fingerprint } from '@/api'
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
import { Textarea } from '@/components/ui/textarea'
import { canWrite } from '@/lib/access'
import { useAuth } from '@/app/auth'

export function FingerprintsPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [form, setForm] = useState({ name: '', rule: '' })
  const [content, setContent] = useState('')
  const fingerprints = useQuery({ queryKey: ['fingerprints'], queryFn: () => api.fingerprints() })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['fingerprints'] })
  const create = useMutation({
    mutationFn: () => api.createFingerprint(form),
    onSuccess: () => {
      toast.success('Fingerprint created')
      setOpen(false)
      setForm({ name: '', rule: '' })
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteFingerprint(id),
    onSuccess: () => {
      toast.success('Fingerprint deleted')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const importRules = useMutation({
    mutationFn: () => api.importFingerprints(content),
    onSuccess: () => {
      toast.success('Fingerprints imported')
      setImportOpen(false)
      setContent('')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const update = useMutation({
    mutationFn: () => api.updateFingerprint(editingId, form),
    onSuccess: () => {
      toast.success('Fingerprint updated')
      setOpen(false)
      setEditingId('')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  function edit(row: Fingerprint) {
    setEditingId(row.id || '')
    setForm({ name: row.name || '', rule: row.rule || '' })
    setOpen(true)
  }
  const rows = useMemo(
    () =>
      ((fingerprints.data?.items || []) as Fingerprint[]).filter(
        (row) => !search || `${row.name} ${row.rule}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [fingerprints.data, search],
  )
  return (
    <div>
      <PageHeader
        title="Fingerprints"
        description="Boolean expression rules cover body, header, title, and icon_hash for site identification."
        actions={
          canWrite(role) ? (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload />
                Bulk import
              </Button>
              <Button
                onClick={() => {
                  setEditingId('')
                  setForm({ name: '', rule: '' })
                  setOpen(true)
                }}
              >
                <Plus />
                Add fingerprint
              </Button>
            </>
          ) : null
        }
      />
      <div className="mb-3 max-w-sm">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search fingerprint name or rule…" />
      </div>
      {fingerprints.isLoading ? (
        <LoadingBlock />
      ) : fingerprints.error ? (
        <ErrorState error={fingerprints.error} retry={() => fingerprints.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id || row.name || ''}
          empty={
            <EmptyState
              title="No fingerprints"
              action={<FingerprintIcon className="mx-auto mt-2 size-5 text-muted-foreground" />}
            />
          }
          columns={[
            { key: 'name', header: 'Name', cell: (row) => row.name },
            {
              key: 'rule',
              header: 'Rule',
              cell: (row) => <span className="mono max-w-[620px] truncate text-[11px]">{row.rule}</span>,
            },
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
                      title="Delete fingerprint"
                      description="The fingerprint will be moved to the recycle bin and no longer loaded for site identification."
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
            <DialogTitle>{editingId ? 'Edit fingerprint' : 'Add fingerprint'}</DialogTitle>
            <DialogDescription>Uses WIH boolean expressions. Rules are revalidated before saving.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Rule">
              <Textarea
                value={form.rule}
                onChange={(e) => setForm({ ...form, rule: e.target.value })}
                placeholder='body="example" || title="Example"'
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.name.trim() || !form.rule.trim() || create.isPending || update.isPending}
              onClick={() => (editingId ? update.mutate() : create.mutate())}
            >
              {editingId ? 'Save changes' : 'Create fingerprint'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk import fingerprints</DialogTitle>
            <DialogDescription>Supports YAML or JSON rule arrays.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-64 font-mono text-xs"
            placeholder={'- name: Example\n  rule: body="example"'}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!content.trim()} onClick={() => importRules.mutate()}>
              Import
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
