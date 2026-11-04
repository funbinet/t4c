import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { FileUp, Pencil, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, type Fingerprint } from '@/api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Field } from '@/components/common/form'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
        actions={
          canWrite(role) ? (
            <>
              <Button size="icon" variant="outline" title="Bulk Import" onClick={() => setImportOpen(true)}>
                <Upload />
                <span className="sr-only">Bulk Import</span>
              </Button>
              <Button
                size="icon"
                title="New Fingerprint"
                onClick={() => {
                  setEditingId('')
                  setForm({ name: '', rule: '' })
                  setOpen(true)
                }}
              >
                <Plus />
                <span className="sr-only">New Fingerprint</span>
              </Button>
            </>
          ) : null
        }
      />
      <div className="mb-3 max-w-sm">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fingerprint name or rule…"
        />
      </div>
      {fingerprints.isLoading ? (
        <LoadingBlock />
      ) : fingerprints.error ? (
        <ErrorState error={fingerprints.error} retry={() => fingerprints.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id || row.name || ''}
          empty={<EmptyState title="No fingerprints" />}
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
                    <Button size="icon" variant="outline" className="size-8" title="Edit" onClick={() => edit(row)}>
                      <Pencil />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <ConfirmDialog
                      title="Delete fingerprint"
                      description="Moved to the recycle bin and no longer loaded for site identification."
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
            <DialogTitle>{editingId ? 'Edit Fingerprint' : 'New Fingerprint'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Rule" hint="WIH boolean expression.">
              <Textarea
                value={form.rule}
                onChange={(e) => setForm({ ...form, rule: e.target.value })}
                placeholder='body="example" || title="Example"'
              />
            </Field>
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" className="size-8" title="Cancel" onClick={() => setOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button
              disabled={!form.name.trim() || !form.rule.trim() || create.isPending || update.isPending}
              onClick={() => (editingId ? update.mutate() : create.mutate())}
            >
              <Save className="size-4" />
              {editingId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Import Fingerprints</DialogTitle>
          </DialogHeader>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-64 font-mono text-xs"
            placeholder={'- name: Example\n  rule: body="example"'}
            aria-label="Fingerprint rules (YAML or JSON)"
          />
          <DialogFooter>
            <Button size="icon" variant="outline" className="size-8" title="Cancel" onClick={() => setImportOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button disabled={!content.trim()} onClick={() => importRules.mutate()}>
              <FileUp />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
