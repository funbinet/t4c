import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type EasmAsset } from '@/api'
import { RiskBadge } from '@/components/common/badges'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { formatTime } from '@/lib/format'
import { canWrite } from '@/lib/access'
import { useAuth } from '@/app/auth'

const surfaceKinds = ['', 'domain', 'ip', 'service']
const inventoryKinds = ['', 'domain', 'ip', 'site', 'url', 'cert', 'service', 'cidr']

export function AssetsPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<EasmAsset | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({
    kind: 'domain',
    key: '',
    displayName: '',
    displayUrl: '',
    notes: '',
    tags: '',
  })
  const view = params.get('view') === 'inventory' ? 'inventory' : 'surface'
  const kind = params.get('kind') || ''
  const risk = params.get('risk') || ''
  const q = params.get('q') || ''
  const page = Number(params.get('page') || 1)
  const focus = params.get('focus') || ''
  const query = useQuery({
    queryKey: ['assets', view, kind, risk, q, page],
    queryFn: () => api.assets({ view, kind, risk, q, page, pageSize: 20 }),
    refetchInterval: 30_000,
  })
  const detail = useQuery({
    queryKey: ['asset', view, focus],
    queryFn: () => api.asset(focus, view),
    enabled: Boolean(focus),
  })
  const create = useMutation({
    mutationFn: () =>
      api.createAsset({
        ...form,
        tags: form.tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success('Asset created')
      setEditorOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: (error) => toast.error(error.message),
  })
  const update = useMutation({
    mutationFn: () =>
      api.updateAsset(editingId, {
        displayName: form.displayName,
        displayUrl: form.displayUrl,
        notes: form.notes,
        tags: form.tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success('Asset updated')
      setEditorOpen(false)
      setEditingId('')
      void queryClient.invalidateQueries({ queryKey: ['assets'] })
      void queryClient.invalidateQueries({ queryKey: ['asset'] })
    },
    onError: (error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteAsset(id),
    onSuccess: () => {
      toast.success('Asset moved to recycle bin')
      setSelected(null)
      setParam('focus', '')
      void queryClient.invalidateQueries({ queryKey: ['assets'] })
      void queryClient.invalidateQueries({ queryKey: ['organization-assets'] })
    },
    onError: (error) => toast.error(error.message),
  })

  function openCreate() {
    setEditingId('')
    setForm({ kind: 'domain', key: '', displayName: '', displayUrl: '', notes: '', tags: '' })
    setEditorOpen(true)
  }
  function openEdit(row: EasmAsset) {
    setEditingId(row.id || '')
    setForm({
      kind: row.kind || 'domain',
      key: row.key || '',
      displayName: row.displayName || '',
      displayUrl: row.displayUrl || '',
      notes: row.notes || '',
      tags: (row.tags || []).join(', '),
    })
    setEditorOpen(true)
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  function open(row: EasmAsset) {
    setSelected(row)
    setParam('focus', row.id || '')
  }
  const visible = selected || detail.data
  const kinds = view === 'surface' ? surfaceKinds : inventoryKinds

  return (
    <div>
      <PageHeader
        title="Attack Surface Assets"
        description="Shows domains, IPs, and services linked to confirmed organization root domains by default; the raw scan inventory is kept as a secondary view."
        actions={
          canWrite(role) && view === 'inventory' ? (
            <Button onClick={openCreate}>
              <Plus />
              New Asset
            </Button>
          ) : null
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-[4px] bg-muted p-1">
          <Button
            size="sm"
            variant={view === 'surface' ? 'default' : 'ghost'}
            onClick={() => setParam('view', 'surface')}
          >
            Exposure
          </Button>
          <Button
            size="sm"
            variant={view === 'inventory' ? 'default' : 'ghost'}
            onClick={() => setParam('view', 'inventory')}
          >
            Raw Inventory
          </Button>
        </div>
        <form
          className="relative min-w-0 flex-1 sm:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault()
            setParam('q', q)
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={params.get('q') || ''}
            onChange={(event) => setParam('q', event.target.value)}
            placeholder="Search asset key or title…"
            className="pl-8"
          />
        </form>
        <Select value={kind || 'all'} onValueChange={(value) => setParam('kind', value === 'all' ? '' : value)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {kinds.filter(Boolean).map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {view === 'surface' ? (
          <Select value={risk || 'all'} onValueChange={(value) => setParam('risk', value === 'all' ? '' : value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All risks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risks</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
      </div>
      {query.isLoading ? (
        <LoadingBlock />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            rows={query.data?.items || []}
            rowKey={(row) => `${row.kind}-${row.id || row.key}`}
            scrollable
            empty={
              <EmptyState
                title="No matching assets"
                description="Adjust the filters, or confirm root domains for an organization and start a scan first."
              />
            }
            columns={[
              {
                key: 'key',
                header: 'Asset',
                cell: (row) => (
                  <button
                    className="mono max-w-[360px] truncate text-left font-medium text-primary hover:underline"
                    onClick={() => open(row)}
                  >
                    {row.key}
                  </button>
                ),
              },
              { key: 'kind', header: 'Type', cell: (row) => row.kind || '—' },
              { key: 'risk', header: 'Risk', cell: (row) => <RiskBadge risk={row.risk} /> },
              { key: 'title', header: 'Title', cell: (row) => row.title || '—', hideOnTablet: true },
              {
                key: 'orgs',
                header: 'Organizations',
                cell: (row) => (row.organizationIds?.length ? `${row.organizationIds.length}` : '—'),
                hideOnTablet: true,
              },
              { key: 'lastSeen', header: 'Last Seen', cell: (row) => formatTime(row.lastSeen), hideOnTablet: true },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) =>
                  canWrite(role) ? (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                        <Pencil />
                        Edit
                      </Button>
                      <ConfirmDialog
                        title="Delete asset"
                        description="The asset and its observations will be hidden from the current view and moved to the recycle bin; a later scan that observes it again restores it automatically."
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
          <Pagination
            page={query.data?.page || page}
            pageSize={query.data?.pageSize || 20}
            total={query.data?.total || 0}
            onChange={(next) => setParam('page', String(next))}
          />
        </>
      )}
      <Sheet open={Boolean(visible)} onOpenChange={(open) => !open && (setSelected(null), setParam('focus', ''))}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="mono break-all">{visible?.key}</SheetTitle>
            <SheetDescription>
              {visible?.kind} · {visible?.title || 'Untitled'}
            </SheetDescription>
          </SheetHeader>
          {visible ? (
            <div className="space-y-4">
              {canWrite(role) ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(visible)}>
                    <Pencil />
                    Edit Basic Info
                  </Button>
                  <ConfirmDialog
                    title="Delete asset"
                    description="The asset will be moved to the recycle bin; a later scan that observes it again restores it automatically."
                    confirmLabel="Move to recycle bin"
                    onConfirm={() => remove.mutate(visible.id || '')}
                    trigger={
                      <Button size="sm" variant="outline" className="text-destructive">
                        <Trash2 />
                        Delete
                      </Button>
                    }
                  />
                </div>
              ) : null}
              {visible.restoreReason === 'scan_rediscovery' && visible.restoredAt ? (
                <div className="rounded-[4px] border border-[rgba(180,255,180,0.3)] bg-[rgba(180,255,180,0.06)] px-3 py-2 text-xs text-mint">
                  Re-discovered by a scan and automatically restored on {formatTime(visible.restoredAt)}.
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Fact label="Risk" value={<RiskBadge risk={visible.risk} />} />
                <Fact label="Type" value={visible.kind || '—'} />
                <Fact label="First Seen" value={formatTime(visible.firstSeen)} />
                <Fact label="Last Seen" value={formatTime(visible.lastSeen)} />
                <Fact label="Origin" value={visible.origin === 'manual' ? 'Manual' : 'Scan discovery'} />
              </div>
              {visible.displayName || visible.displayUrl || visible.notes || visible.tags?.length ? (
                <Section title="Maintenance Info">
                  <div className="space-y-2 rounded-[4px] border bg-card p-3 text-xs">
                    {visible.displayName ? <div>Name: {visible.displayName}</div> : null}
                    {visible.displayUrl ? <div className="mono break-all">URL：{visible.displayUrl}</div> : null}
                    {visible.notes ? <div className="whitespace-pre-wrap">Notes: {visible.notes}</div> : null}
                    {visible.tags?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {visible.tags.map((tag) => (
                          <span key={tag} className="rounded border bg-muted px-2 py-0.5 text-[11px]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Section>
              ) : null}
              {visible.rootDomains?.length ? (
                <Section title="Linked Root Domains">
                  <div className="flex flex-wrap gap-1.5">
                    {visible.rootDomains.map((domain) => (
                      <span key={domain} className="mono rounded border bg-muted px-2 py-1 text-[11px]">
                        {domain}
                      </span>
                    ))}
                  </div>
                </Section>
              ) : null}
              {visible.organizationIds?.length ? (
                <Section title="Organizations">
                  <div className="flex flex-wrap gap-1.5">
                    {visible.organizationIds.map((id) => (
                      <span key={id} className="mono rounded border bg-muted px-2 py-1 text-[11px]">
                        {id}
                      </span>
                    ))}
                  </div>
                </Section>
              ) : null}
              <Section title="Observation Summary">
                <KeyValues data={visible.data as Record<string, unknown> | undefined} />
              </Section>
            </div>
          ) : (
            <LoadingBlock />
          )}
        </SheetContent>
      </Sheet>
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Asset Basic Info' : 'New Manual Asset'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Type, unique key, and raw scan data stay read-only.'
                : 'Manual assets are marked with the manual origin and never modify scan-generated raw data.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.kind}
                  onValueChange={(value) => setForm({ ...form, kind: value })}
                  disabled={Boolean(editingId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryKinds.filter(Boolean).map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unique Key</Label>
                <Input
                  value={form.key}
                  disabled={Boolean(editingId)}
                  onChange={(event) => setForm({ ...form, key: event.target.value })}
                  placeholder="example.com / 1.1.1.1 / https://…"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input
                value={form.displayUrl}
                onChange={(event) => setForm({ ...form, displayUrl: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tags (comma-separated)</Label>
              <Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={(!editingId && (!form.kind || !form.key.trim())) || create.isPending || update.isPending}
              onClick={() => (editingId ? update.mutate() : create.mutate())}
            >
              {create.isPending || update.isPending ? 'Saving…' : editingId ? 'Save Changes' : 'Create Asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[4px] border bg-card p-2.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xs font-medium">{value}</div>
    </div>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</div>
      {children}
    </div>
  )
}
function KeyValues({ data }: { data?: Record<string, unknown> }) {
  const entries = data
    ? Object.entries(data)
        .filter(([, value]) => value !== null && value !== '' && typeof value !== 'object')
        .slice(0, 20)
    : []
  if (!entries.length) return <div className="text-xs text-muted-foreground">No structured observation fields</div>
  return (
    <dl className="divide-y rounded-[4px] border text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[120px_1fr] gap-2 px-3 py-2">
          <dt className="truncate text-muted-foreground">{key}</dt>
          <dd className="break-all">{String(value)}</dd>
        </div>
      ))}
    </dl>
  )
}
