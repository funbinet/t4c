import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { useState } from 'react'
import { api, type AuditEvent } from '@/api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { Input } from '@/components/ui/input'
import { formatTime } from '@/lib/format'

export function AuditPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const audit = useQuery({ queryKey: ['audit', q, page], queryFn: () => api.audit({ q, page, pageSize: 20 }) })
  const rows = (audit.data?.items || []) as AuditEvent[]
  return (
    <div>
      <PageHeader title="Audit log" description="Track authentication, organization ownership, scans, configuration, and administrative actions." />
      <div className="mb-3 max-w-sm">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          placeholder="Search actor, action, or resource…"
        />
      </div>
      {audit.isLoading ? (
        <LoadingBlock />
      ) : audit.error ? (
        <ErrorState error={audit.error} retry={() => audit.refetch()} />
      ) : (
        <>
          <DataTable
            rows={rows}
            rowKey={(row) => row.id || `${row.action}-${row.createdAt}`}
            empty={
              <EmptyState
                title="No audit events"
                action={<ScrollText className="mx-auto mt-2 size-5 text-muted-foreground" />}
              />
            }
            columns={[
              { key: 'actor', header: 'Actor', cell: (row) => row.actor || '—' },
              { key: 'action', header: 'Action', cell: (row) => <span className="mono">{row.action}</span> },
              { key: 'resource', header: 'Resource', cell: (row) => <span className="mono">{row.resource || '—'}</span> },
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
