import { RefreshCw } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api, type PocPlugin } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isAdmin } from '@/lib/access'
import { useAuth } from '@/app/auth'

export function PocPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')
  const plugins = useQuery({ queryKey: ['poc-plugins'], queryFn: () => api.pocPlugins() })
  const sync = useMutation({
    mutationFn: () => api.syncPOC(),
    onSuccess: () => {
      toast.success('PoC metadata synced')
      void queryClient.invalidateQueries({ queryKey: ['poc-plugins'] })
    },
    onError: (error) => toast.error(error.message),
  })
  const rows = useMemo(
    () =>
      ((plugins.data?.items || []) as PocPlugin[]).filter(
        (row) =>
          (kind === 'all' || row.type === kind) &&
          (!search || `${row.name} ${row.appName} ${row.vulName}`.toLowerCase().includes(search.toLowerCase())),
      ),
    [plugins.data, kind, search],
  )
  return (
    <div>
      <PageHeader
        title="PoC Plugins"
        actions={
          isAdmin(role) ? (
            <Button size="icon" title="Sync Metadata" onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCw className={sync.isPending ? 'animate-spin' : undefined} />
              <span className="sr-only">Sync Metadata</span>
            </Button>
          ) : null
        }
      />
      <div className="mb-3 flex flex-wrap gap-3">
        <Input
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plugin, application, or vulnerability…"
        />
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="poc">PoC</SelectItem>
            <SelectItem value="sniffer">Protocol detection</SelectItem>
            <SelectItem value="brute">Weak passwords</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {plugins.isLoading ? (
        <LoadingBlock />
      ) : plugins.error ? (
        <ErrorState error={plugins.error} retry={() => plugins.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.name || ''}
          empty={<EmptyState title="No plugin metadata" />}
          columns={[
            { key: 'name', header: 'Plugin', cell: (row) => <span className="mono font-medium">{row.name}</span> },
            {
              key: 'type',
              header: 'Type',
              cell: (row) => <Badge variant={row.type === 'poc' ? 'info' : 'outline'}>{row.type}</Badge>,
            },
            { key: 'app', header: 'Application', cell: (row) => row.appName || '—', hideOnTablet: true },
            { key: 'vuln', header: 'Vulnerability', cell: (row) => row.vulName || '—' },
            { key: 'schemes', header: 'Protocols', cell: (row) => row.schemes?.join(', ') || '—', hideOnTablet: true },
          ]}
        />
      )}
    </div>
  )
}
