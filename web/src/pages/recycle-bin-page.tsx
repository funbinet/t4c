import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArchiveRestore } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/api'
import { DataTable } from '@/components/common/data-table'
import { ExpandableSearch, FilterDropdown, ScreenToolbar } from '@/components/common/screen-toolbar'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/lib/format'

type DeletedRecord = {
  type: string
  id: string
  label: string
  deletedAt: string
  deletedBy?: string
}

const resourceLabels: Record<string, string> = {
  organization: 'Organization',
  organization_domain: 'Owned domain',
  asset: 'Asset',
  policy: 'Policy',
  scope: 'Asset group',
  monitor: 'Monitor',
  schedule: 'Schedule',
  fingerprint: 'Fingerprint',
  github_monitor: 'GitHub monitor',
  user: 'User',
}

export function RecycleBinPage() {
  const queryClient = useQueryClient()
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const deleted = useQuery({
    queryKey: ['recycle-bin', type, q, page],
    queryFn: () => api.listRecycleBin({ type, q, page, pageSize: 20 }),
  })
  const restore = useMutation({
    mutationFn: ({ type: resourceType, id }: { type: string; id: string }) => api.restoreRecord(resourceType, id),
    onSuccess: (_, item) => {
      toast.success(`${resourceLabels[item.type] || item.type} restored`)
      void queryClient.invalidateQueries({ queryKey: ['recycle-bin'] })
      void queryClient.invalidateQueries()
    },
    onError: (error) => toast.error(error.message),
  })
  const rows = (deleted.data?.items || []) as DeletedRecord[]

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
            placeholder="Search deleted records…"
            title="Search recycle bin"
          />
        }
        center={deleted.isLoading ? 'Loading…' : `${deleted.data?.total ?? 0} records`}
        right={
          <FilterDropdown
            label="Filter by type"
            options={[
              { value: '', label: 'All Types' },
              ...Object.entries(resourceLabels).map(([value, label]) => ({ value, label })),
            ]}
            value={type}
            onChange={(value) => {
              setType(value)
              setPage(1)
            }}
          />
        }
      />
      {deleted.isLoading ? (
        <LoadingBlock />
      ) : deleted.error ? (
        <ErrorState error={deleted.error} retry={() => deleted.refetch()} />
      ) : (
        <>
          <DataTable
            rows={rows}
            rowKey={(row) => `${row.type}-${row.id}`}
            empty={<EmptyState title="Recycle bin is empty" />}
            columns={[
              { key: 'type', header: 'Type', cell: (row) => resourceLabels[row.type] || row.type },
              { key: 'label', header: 'Record', cell: (row) => <span className="font-medium">{row.label}</span> },
              { key: 'actor', header: 'Deleted by', cell: (row) => row.deletedBy || '—', hideOnTablet: true },
              { key: 'time', header: 'Deleted at', cell: (row) => formatTime(row.deletedAt) },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <Button
                    size="icon"
                    variant="outline"
                    title="Restore"
                    disabled={restore.isPending}
                    onClick={() => restore.mutate({ type: row.type, id: row.id })}
                  >
                    <ArchiveRestore />
                    <span className="sr-only">Restore</span>
                  </Button>
                ),
              },
            ]}
          />
          <Pagination
            page={deleted.data?.page || page}
            pageSize={deleted.data?.pageSize || 20}
            total={deleted.data?.total || 0}
            onChange={setPage}
          />
        </>
      )}
    </div>
  )
}
