import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api, type APIKey } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/common/data-table'
import { ExpandableSearch, ScreenToolbar } from '@/components/common/screen-toolbar'
import { Field } from '@/components/common/form'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Copy, KeyRound, Plus, X } from 'lucide-react'
import { formatTime } from '@/lib/format'

export function APIKeysPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState('read')
  const [secret, setSecret] = useState('')
  const [search, setSearch] = useState('')
  const keys = useQuery({ queryKey: ['api-keys'], queryFn: () => api.apiKeys() })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['api-keys'] })
  const create = useMutation({
    mutationFn: () =>
      api.createAPIKey({
        name,
        scopes: scopes
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: (result) => {
      setSecret(result.secret || '')
      setOpen(false)
      setName('')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteAPIKey(id),
    onSuccess: () => {
      toast.success('API key revoked')
      void refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const rows = useMemo(
    () =>
      ((keys.data?.items || []) as APIKey[]).filter(
        (row) => !search || `${row.name} ${(row.scopes || []).join(' ')}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [keys.data, search],
  )
  return (
    <div>
      <ScreenToolbar
        left={
          <ExpandableSearch
            value={search}
            onChange={setSearch}
            placeholder="Search key name or scopes…"
            title="Search API keys"
          />
        }
        center={keys.isLoading ? 'Loading…' : `${rows.length} keys`}
        right={
          <Button size="icon" title="New Key" aria-label="New Key" onClick={() => setOpen(true)}>
            <Plus />
            <span className="sr-only">New Key</span>
          </Button>
        }
      />
      {keys.isLoading ? (
        <LoadingBlock />
      ) : keys.error ? (
        <ErrorState error={keys.error} retry={() => keys.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id || row.name || ''}
          empty={<EmptyState title="No API keys" />}
          columns={[
            { key: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.name}</span> },
            {
              key: 'scopes',
              header: 'Scopes',
              cell: (row) => (
                <div className="flex flex-wrap gap-1">
                  {row.scopes?.map((scope) => (
                    <Badge key={scope} variant="outline">
                      {scope}
                    </Badge>
                  ))}
                </div>
              ),
            },
            { key: 'created', header: 'Created', cell: (row) => formatTime(row.createdAt), hideOnTablet: true },
            { key: 'lastUsed', header: 'Last used', cell: (row) => formatTime(row.lastUsedAt), hideOnTablet: true },
            {
              key: 'status',
              header: 'Status',
              cell: (row) =>
                row.revokedAt ? <Badge variant="danger">Revoked</Badge> : <Badge variant="success">Active</Badge>,
            },
            {
              key: 'actions',
              header: 'Actions',
              cell: (row) =>
                !row.revokedAt ? (
                  <div className="flex justify-end">
                    <Button
                      size="icon"
                      variant="outline"
                      className="text-destructive"
                      title="Revoke"
                      onClick={() => remove.mutate(row.id || '')}
                    >
                      <X />
                      <span className="sr-only">Revoke</span>
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Scopes" hint="Comma-separated, for example read,scan.">
              <Input value={scopes} onChange={(e) => setScopes(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button size="icon" variant="outline" title="Cancel" onClick={() => setOpen(false)}>
              <X />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button
              size="icon"
              disabled={!name.trim()}
              onClick={() => create.mutate()}
              title="Create"
              aria-label="Create"
            >
              <Plus />
              <span className="sr-only">Create</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(secret)} onOpenChange={(next) => !next && setSecret('')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save API Key</DialogTitle>
            <DialogDescription>Shown only once. It cannot be read again after this dialog closes.</DialogDescription>
          </DialogHeader>
          <Textarea readOnly value={secret} className="min-h-28 font-mono text-xs" />
          <DialogFooter>
            <Button
              size="icon"
              variant="outline"
              title="Copy"
              onClick={() => {
                void navigator.clipboard.writeText(secret)
                toast.success('Copied')
              }}
            >
              <Copy />
              <span className="sr-only">Copy</span>
            </Button>
            <Button size="icon" onClick={() => setSecret('')} title="Done" aria-label="Done">
              <KeyRound />
              <span className="sr-only">Done</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
