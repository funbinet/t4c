import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { api, type AuditEvent } from '@/api'
import { DataTable } from '@/components/common/data-table'
import { ExpandableSearch, ScreenToolbar } from '@/components/common/screen-toolbar'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/lib/format'

export function AuditPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const audit = useQuery({ queryKey: ['audit', q, page], queryFn: () => api.audit({ q, page, pageSize: 20 }) })
  const rows = (audit.data?.items || []) as AuditEvent[]
  return (
    <div>
      <ScreenToolbar
        left={
          <ExpandableSearch
            value={q}
            onChange={(value) => {
              setQ(value)
              setPage(1)
            }}
            placeholder="Search actor, action, or resource…"
            title="Search audit log"
          />
        }
        center={audit.isLoading ? 'Loading…' : `${audit.data?.total ?? 0} events`}
        right={
          <Button
            size="icon"
            variant="outline"
            title="Sync Logs"
            aria-label="Sync Logs"
            disabled={audit.isFetching}
            onClick={() => audit.refetch()}
          >
            <RefreshCw className={audit.isFetching ? 'animate-spin' : undefined} />
            <span className="sr-only">Sync Logs</span>
          </Button>
        }
      />
      {audit.isLoading ? (
        <LoadingBlock />
      ) : audit.error ? (
        <ErrorState error={audit.error} retry={() => audit.refetch()} />
      ) : (
        <>
          <DataTable
            rows={rows}
            rowKey={(row) => row.id || `${row.action}-${row.createdAt}`}
            empty={<EmptyState title="No audit events" />}
            columns={[
              { key: 'actor', header: 'Actor', cell: (row) => row.actor || '—' },
              { key: 'action', header: 'Action', cell: (row) => <span className="mono">{row.action}</span> },
              {
                key: 'resource',
                header: 'Resource',
                cell: (row) => <span className="mono">{row.resource || '—'}</span>,
              },
              { key: 'ip', header: 'IP', cell: (row) => row.ip || '—', hideOnTablet: true },
              { key: 'time', header: 'Time', cell: (row) => formatTime(row.createdAt) },
            ]}
          />
          <Pagination
            page={audit.data?.page || page}
            pageSize={audit.data?.pageSize || 20}
            total={audit.data?.total || 0}
            onChange={setPage}
          />
        </>
      )}
    </div>
  )
}
