import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe, List, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type EasmAsset } from '@/api'
import { RiskBadge } from '@/components/common/badges'
import { DataTable } from '@/components/common/data-table'
import { ExpandableSearch, FilterDropdown, ScreenToolbar } from '@/components/common/screen-toolbar'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Fact, Field, KeyValues, Section } from '@/components/common/form'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { formatTime } from '@/lib/format'
import { canWrite } from '@/lib/access'
import { useAuth } from '@/app/auth'

const surfaceKinds = ['', 'domain', 'ip', 'service']
const inventoryKinds = ['', 'domain', 'ip', 'site', 'url', 'certificate', 'service', 'cidr']

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
      <ScreenToolbar
        left={
          <>
            <div className="flex rounded-[4px] bg-muted p-1">
              <Button
                size="sm"
                variant={view === 'surface' ? 'default' : 'ghost'}
                title="Exposure view"
                onClick={() => setParam('view', 'surface')}
              >
                <Globe className="size-4" />
                <span className="sr-only">Exposure</span>
              </Button>
              <Button
                size="sm"
                variant={view === 'inventory' ? 'default' : 'ghost'}
                title="Raw inventory view"
                onClick={() => setParam('view', 'inventory')}
              >
                <List className="size-4" />
                <span className="sr-only">Raw Inventory</span>
              </Button>
            </div>
            <ExpandableSearch
              value={q}
              onChange={(value) => setParam('q', value)}
              placeholder="Search asset key or title…"
              title="Search assets"
            />
          </>
        }
        center={query.isLoading ? 'Loading…' : `${query.data?.total ?? 0} assets`}
        right={
          <>
            {canWrite(role) && view === 'inventory' ? (
              <Button size="icon" title="New Asset" aria-label="New Asset" onClick={openCreate}>
                <Plus />
                <span className="sr-only">New Asset</span>
              </Button>
            ) : null}
            <FilterDropdown
              label="Filter by type"
              options={[{ value: '', label: 'All Types' }, ...kinds.filter(Boolean).map((k) => ({ value: k, label: k }))]}
              value={kind}
              onChange={(value) => setParam('kind', value)}
            />
            {view === 'surface' ? (
              <FilterDropdown
                label="Filter by risk"
                options={[
                  { value: '', label: 'All Risks' },
                  { value: 'critical', label: 'Critical' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
                value={risk}
                onChange={(value) => setParam('risk', value)}
              />
            ) : null}
          </>
        }
      />
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
            onRowClick={(row) => open(row)}
            rowLabel={(row) => `Open asset ${row.key}`}
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
                stopRowClick: true,
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
                stopRowClick: true,
                cell: (row) =>
                  canWrite(role) ? (
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="outline" className="size-8" title="Edit" onClick={() => openEdit(row)}>
                        <Pencil />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <ConfirmDialog
                        title="Delete asset"
                        description="Moved to the recycle bin. A later scan that observes it again restores it automatically."
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
                  <Button size="icon" variant="outline" className="size-8" title="Edit" onClick={() => openEdit(visible)}>
                    <Pencil />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <ConfirmDialog
                    title="Delete asset"
                    description="Moved to the recycle bin. A later scan that observes it again restores it automatically."
                    confirmLabel="Move To Recycle Bin"
                    onConfirm={() => remove.mutate(visible.id || '')}
                    trigger={
                      <Button size="icon" variant="outline" className="size-8 text-destructive hover:text-destructive" title="Delete">
                        <Trash2 />
                        <span className="sr-only">Delete</span>
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
                    {visible.displayName ? (
                      <div>
                        <span className="mr-2 text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                          Name:
                        </span>
                        {visible.displayName}
                      </div>
                    ) : null}
                    {visible.displayUrl ? (
                      <div className="break-all">
                        <span className="mr-2 text-[11px] uppercase tracking-[0.04em] text-muted-foreground">URL:</span>
                        <span className="mono">{visible.displayUrl}</span>
                      </div>
                    ) : null}
                    {visible.notes ? (
                      <div className="whitespace-pre-wrap">
                        <span className="mr-2 text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                          Notes:
                        </span>
                        {visible.notes}
                      </div>
                    ) : null}
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
                  <div className="text-xs text-muted-foreground">{visible.organizationIds.length} linked</div>
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
            <DialogTitle>{editingId ? 'Edit Asset' : 'New Manual Asset'}</DialogTitle>
            {editingId ? <DialogDescription>Type, key, and raw scan data stay read-only.</DialogDescription> : null}
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
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
              </Field>
              <Field label="Unique Key">
                <Input
                  value={form.key}
                  disabled={Boolean(editingId)}
                  onChange={(event) => setForm({ ...form, key: event.target.value })}
                  placeholder="example.com / 1.1.1.1 / https://…"
                />
              </Field>
            </div>
            <Field label="Display Name">
              <Input
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              />
            </Field>
            <Field label="URL">
              <Input
                value={form.displayUrl}
                onChange={(event) => setForm({ ...form, displayUrl: event.target.value })}
              />
            </Field>
            <Field label="Tags" hint="Comma-separated.">
              <Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
            </Field>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" className="size-8" title="Cancel" onClick={() => setEditorOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button
              disabled={(!editingId && (!form.kind || !form.key.trim())) || create.isPending || update.isPending}
              onClick={() => (editingId ? update.mutate() : create.mutate())}
            >
              <Save className="size-4" />
              {create.isPending || update.isPending ? 'Saving…' : editingId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
