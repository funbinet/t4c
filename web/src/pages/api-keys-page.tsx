import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, type APIKey } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
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
import { formatTime } from '@/lib/format'

export function APIKeysPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState('read')
  const [secret, setSecret] = useState('')
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
  const rows = (keys.data?.items || []) as APIKey[]
  return (
    <div>
      <PageHeader title="API Keys" actions={<Button onClick={() => setOpen(true)}>New Key</Button>} />
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
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => remove.mutate(row.id || '')}
                    >
                      Revoke
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!name.trim()} onClick={() => create.mutate()}>
              Create key
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
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(secret)
                toast.success('Copied')
              }}
            >
              Copy
            </Button>
            <Button onClick={() => setSecret('')}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
