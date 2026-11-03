import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUp, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type Organization } from '@/api'
import { RiskBadge, StatusBadge } from '@/components/common/badges'
import { DataTable } from '@/components/common/data-table'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { PageHeader } from '@/components/common/page-header'
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
import { canWrite } from '@/lib/access'
import { useAuth } from '@/app/auth'

export function OrganizationsPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
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
      <PageHeader
        title="Organization Governance"
        description="Maintain filed root domains, ownership evidence, risk coverage, and scan tasks per organization. Organizations are the backbone of the T4C attack surface workspace."
        actions={
          canWrite(role) ? (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <FileUp />
                Import CSV
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus />
                New Organization
              </Button>
            </>
          ) : null
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form
          className="relative min-w-0 flex-1 sm:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault()
            void orgs.refetch()
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search organization name, alias, or credit code…"
            className="pl-8"
          />
        </form>
        <Button variant="outline" onClick={() => void orgs.refetch()}>
          <RefreshCw />
          Refresh
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">{rows.length} organizations</span>
      </div>
      {orgs.isLoading ? (
        <LoadingBlock />
      ) : orgs.error ? (
        <ErrorState error={orgs.error} retry={() => orgs.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id || row.canonicalName || 'org'}
          empty={
            <EmptyState
              title="No organizations yet"
              description="Import a CSV with organization names and root domains, or create a single organization first."
              action={
                canWrite(role) ? (
                  <Button onClick={() => setImportOpen(true)}>
                    <FileUp />
                    Import Organizations
                  </Button>
                ) : undefined
              }
            />
          }
          columns={[
            {
              key: 'name',
              header: 'Organization',
              cell: (row) => (
                <Link to={`/organizations/${row.id}`} className="font-medium text-primary hover:underline">
                  {row.canonicalName}
                </Link>
              ),
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
            { key: 'risk', header: 'Highest Risk', cell: (row) => <RiskBadge risk={riskByOrg.get(row.id || '')?.risk} /> },
            {
              key: 'assets',
              header: 'Exposed Assets',
              cell: (row) => <span className="tabular-nums">{riskByOrg.get(row.id || '')?.assetCount ?? '—'}</span>,
            },
            { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
            {
              key: 'updated',
              header: 'Last Updated',
              cell: (row) => (row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('zh-CN') : '—'),
              hideOnTablet: true,
            },
            {
              key: 'actions',
              header: 'Actions',
              cell: (row) =>
                canWrite(role) ? (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => editOrganization(row)}>
                      <Pencil />
                      Edit
                    </Button>
                    <ConfirmDialog
                      title="Delete organization"
                      description="The organization will be moved to the recycle bin; its domains and task history are not permanently deleted. Deletion is blocked while tasks are queued or running."
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Organization</DialogTitle>
            <DialogDescription>After creation you can add candidate root domains and run ICP ownership lookups.</DialogDescription>
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
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!form.canonicalName.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Creating…' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Organizations CSV</DialogTitle>
            <DialogDescription>
              Required column: canonicalName. Optional columns: aliases, region, uscc, rootDomains. Separate multiple aliases with | and multiple root domains with semicolons.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">
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
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>Name, aliases, region, and Unified Social Credit Code sync to organization governance and the graph.</DialogDescription>
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
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!form.canonicalName.trim() || update.isPending} onClick={() => update.mutate()}>
              {update.isPending ? 'Saving…' : 'Save Changes'}
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
