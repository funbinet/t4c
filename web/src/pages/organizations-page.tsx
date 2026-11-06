import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUp, Pencil, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type Organization } from '@/api'
import { RiskBadge, StatusBadge } from '@/components/common/badges'
import { DataTable } from '@/components/common/data-table'
import { Field } from '@/components/common/form'
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
import { formatTime } from '@/lib/format'
import { canWrite } from '@/lib/access'
import { useAuth } from '@/app/auth'

export function OrganizationsPage() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({ canonicalName: '', aliases: '', region: '', uscc: '' })
  const orgs = useQuery({ queryKey: ['organizations', query], queryFn: () => api.organizations(query) })
  const map = useQuery({ queryKey: ['map'], queryFn: () => api.map() })

  const create = useMutation({
    mutationFn: () =>
      api.createOrganization({
        canonicalName: form.canonicalName,
        aliases: form.aliases
          .split('|')
          .map((item) => item.trim())
          .filter(Boolean),
        region: form.region,
        uscc: form.uscc,
      }),
    onSuccess: () => {
      toast.success('Organization created')
      setCreateOpen(false)
      setForm({ canonicalName: '', aliases: '', region: '', uscc: '' })
      void queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
    onError: (error) => toast.error(error.message),
  })
  const importOrgs = useMutation({
    mutationFn: (file: File) => api.importOrganizations(file),
    onSuccess: () => {
      toast.success('Organization data imported')
      setImportOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
    onError: (error) => toast.error(error.message),
  })
  const update = useMutation({
    mutationFn: () =>
      api.updateOrganization(editingId, {
        canonicalName: form.canonicalName,
        aliases: form.aliases
          .split('|')
          .map((item) => item.trim())
          .filter(Boolean),
        region: form.region,
        uscc: form.uscc,
      }),
    onSuccess: () => {
      toast.success('Organization updated')
      setEditOpen(false)
      setEditingId('')
      void queryClient.invalidateQueries({ queryKey: ['organizations'] })
      void queryClient.invalidateQueries({ queryKey: ['organization', editingId] })
      void queryClient.invalidateQueries({ queryKey: ['map'] })
    },
    onError: (error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteOrganization(id),
    onSuccess: () => {
      toast.success('Organization moved to recycle bin')
      void queryClient.invalidateQueries({ queryKey: ['organizations'] })
      void queryClient.invalidateQueries({ queryKey: ['map'] })
    },
    onError: (error) => toast.error(error.message),
  })

  function editOrganization(org: Organization) {
    setEditingId(org.id || '')
    setForm({
      canonicalName: org.canonicalName || '',
      aliases: (org.aliases || []).join(' | '),
      region: org.region || '',
      uscc: org.uscc || '',
    })
    setEditOpen(true)
  }

  const riskByOrg = new Map((map.data?.organizations || []).map((item) => [item.orgId, item]))
  const rows = orgs.data?.items || []
  return (
    <div>
      <div className="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <div className="flex min-w-0 items-center">
          {searchOpen ? (
            <form
              className="relative"
              onSubmit={(event) => {
                event.preventDefault()
                void orgs.refetch()
              }}
            >
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search organization name, alias, or credit code…"
                className="h-9 w-[min(22rem,52vw)] bg-transparent pl-8 pr-8"
              />
              <button
                type="button"
                title="Close search"
                aria-label="Close search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-foreground hover:text-foreground"
                onClick={() => {
                  setSearchOpen(false)
                  setQuery('')
                }}
              >
                <X className="size-3.5" />
              </button>
            </form>
          ) : (
            <Button
              size="icon"
              variant="outline"
              title="Search organizations"
              aria-label="Search organizations"
              onClick={() => setSearchOpen(true)}
            >
              <Search />
            </Button>
          )}
        </div>
        <div className="text-center text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
          {orgs.isLoading ? 'Loading…' : `${rows.length} organizations`}
        </div>
        <div className="flex items-center justify-end gap-2">
          {canWrite(role) ? (
            <>
              <Button
                size="icon"
                variant="outline"
                title="Import CSV"
                aria-label="Import CSV"
                onClick={() => setImportOpen(true)}
              >
                <Upload />
              </Button>
              <Button
                size="icon"
                title="New Organization"
                aria-label="New Organization"
                onClick={() => setCreateOpen(true)}
              >
                <Plus />
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {orgs.isLoading ? (
        <LoadingBlock />
      ) : orgs.error ? (
        <ErrorState error={orgs.error} retry={() => orgs.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id || row.canonicalName || 'org'}
          onRowClick={(row) => row.id && navigate(`/organizations/${row.id}`)}
          rowLabel={(row) => `Open ${row.canonicalName || 'organization'}`}
          empty={
            <EmptyState
              title="No organizations yet"
              description="Import a CSV with organization names and root domains, or create a single organization first."
              action={
                canWrite(role) ? (
                  <Button variant="outline" size="icon" onClick={() => setImportOpen(true)} title="Import" aria-label="Import">
                    <FileUp />
                    <span className="sr-only">Import</span>
                  </Button>
                ) : undefined
              }
            />
          }
          columns={[
            {
              key: 'name',
              header: 'Organization',
              cell: (row) => <span className="font-medium">{row.canonicalName}</span>,
            },
            { key: 'region', header: 'Region', cell: (row) => row.region || '—', hideOnTablet: true },
            {
              key: 'aliases',
              header: 'Aliases',
              cell: (row) =>
                row.aliases?.length ? (
                  <span className="text-muted-foreground">{row.aliases.slice(0, 2).join(' / ')}</span>
                ) : (
                  '—'
                ),
              hideOnTablet: true,
            },
            {
              key: 'risk',
              header: 'Highest Risk',
              cell: (row) => <RiskBadge risk={riskByOrg.get(row.id || '')?.risk} />,
            },
            {
              key: 'assets',
              header: 'Exposed Assets',
              cell: (row) => <span className="tabular-nums">{riskByOrg.get(row.id || '')?.assetCount ?? '—'}</span>,
            },
            { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
            {
              key: 'updated',
              header: 'Last Updated',
              cell: (row) => (row.updatedAt ? formatTime(row.updatedAt) : '—'),
              hideOnTablet: true,
            },
            {
              key: 'actions',
              header: 'Actions',
              stopRowClick: true,
              cell: (row) =>
                canWrite(role) ? (
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8"
                      title="Edit"
                      onClick={() => editOrganization(row)}
                    >
                      <Pencil />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <ConfirmDialog
                      title="Delete organization"
                      description="Moved to the recycle bin. Blocked while tasks are queued or running."
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Organization Name">
              <Input
                value={form.canonicalName}
                onChange={(event) => setForm({ ...form, canonicalName: event.target.value })}
              />
            </Field>
            <Field label="Aliases (separated by |)">
              <Input value={form.aliases} onChange={(event) => setForm({ ...form, aliases: event.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Region">
                <Input value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} />
              </Field>
              <Field label="Unified Social Credit Code">
                <Input value={form.uscc} onChange={(event) => setForm({ ...form, uscc: event.target.value })} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button
              size="icon"
              variant="outline"
              className="size-8"
              title="Cancel"
              onClick={() => setCreateOpen(false)}
            >
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button disabled={!form.canonicalName.trim() || create.isPending} onClick={() => create.mutate()}>
              <Plus />
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Organizations CSV</DialogTitle>
            <DialogDescription>
              Required column: canonicalName. Optional: aliases, region, uscc, rootDomains.
            </DialogDescription>
          </DialogHeader>
          <div className=" border bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">
            <div className="mono">canonicalName,aliases,region,uscc,rootDomains</div>
            <div className="mono">Acme College,College A|College B,SH,12510000...,guc.edu.cn;example.edu.cn</div>
          </div>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) importOrgs.mutate(file)
            }}
          />
          <DialogFooter>
            <Button
              size="icon"
              variant="outline"
              className="size-8"
              title="Cancel"
              onClick={() => setImportOpen(false)}
            >
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Organization Name">
              <Input
                value={form.canonicalName}
                onChange={(event) => setForm({ ...form, canonicalName: event.target.value })}
              />
            </Field>
            <Field label="Aliases (separated by |)">
              <Input value={form.aliases} onChange={(event) => setForm({ ...form, aliases: event.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Region">
                <Input value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} />
              </Field>
              <Field label="Unified Social Credit Code">
                <Input value={form.uscc} onChange={(event) => setForm({ ...form, uscc: event.target.value })} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" className="size-8" title="Cancel" onClick={() => setEditOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button disabled={!form.canonicalName.trim() || update.isPending} onClick={() => update.mutate()}>
              <Save />
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
