import { useQuery } from '@tanstack/react-query'
import { FileText, History, Search, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, type FindingItem } from '@/api'
import { RiskBadge } from '@/components/common/badges'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Fact, KeyValues, Section } from '@/components/common/form'
import { formatTime, relativeTime, riskLabel } from '@/lib/format'

const kindLabels: Record<string, string> = {
  vuln: 'Vuln',
  nuclei: 'Nuclei',
  wih: 'WIH',
  file_leak: 'File Leak',
  protocol: 'Protocol',
}

const views = [
  { value: 'current', label: 'Current Risks', icon: ShieldAlert },
  { value: 'history', label: 'History', icon: History },
  { value: 'raw', label: 'Raw Scans', icon: FileText },
]

export function FindingsPage() {
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<FindingItem | null>(null)
  const [history, setHistory] = useState<FindingItem['finding'][]>([])
  const view = (params.get('view') || 'current') as 'current' | 'history' | 'raw'
  const severity = params.get('severity') || ''
  const kind = params.get('kind') || ''
  const q = params.get('q') || ''
  const page = Number(params.get('page') || 1)
  const query = useQuery({
    queryKey: ['findings', view, severity, kind, q, page],
    queryFn: () => api.findings({ view, severity, kind, q, page, pageSize: 20 }),
    refetchInterval: 30_000,
  })

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  async function open(row: FindingItem) {
    setSelected(row)
    setHistory([])
    const orgId = row.organizationIds?.[0]
    if (orgId && row.finding?.id) {
      try {
        const result = await api.findingHistory(row.finding.id, orgId)
        setHistory(result.items)
      } catch {
        setHistory([])
      }
    }
  }

  return (
    <div>
      <PageHeader title="Risks" />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap rounded-[4px] bg-muted p-1">
          {views.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={view === item.value ? 'default' : 'ghost'}
              title={item.label}
              onClick={() => setParam('view', item.value)}
            >
              <item.icon className="size-4" />
              <span className="sr-only">{item.label}</span>
            </Button>
          ))}
        </div>
        <form className="relative min-w-0 flex-1 sm:max-w-sm" onSubmit={(event) => event.preventDefault()}>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => setParam('q', event.target.value)}
            placeholder="Search title, target, or plugin…"
            className="pl-8"
          />
        </form>
        <Select value={severity || 'all'} onValueChange={(value) => setParam('severity', value === 'all' ? '' : value)}>
          <SelectTrigger className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            {['critical', 'high', 'medium', 'low', 'info'].map((item) => (
              <SelectItem key={item} value={item}>
                {riskLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind || 'all'} onValueChange={(value) => setParam('kind', value === 'all' ? '' : value)}>
          <SelectTrigger className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(kindLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {query.isLoading ? (
        <LoadingBlock />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            rows={query.data?.items || []}
            rowKey={(row) => row.finding?.id || `${row.finding?.target}-${row.finding?.dedupeKey}`}
            empty={
              <EmptyState
                title="No matching risks"
                description={
                  view === 'current'
                    ? 'No risks found under confirmed organization root domains yet.'
                    : 'No history or raw results match the current filters.'
                }
              />
            }
            columns={[
              {
                key: 'title',
                header: 'Risk',
                cell: (row) => (
                  <button className="max-w-[380px] text-left" onClick={() => void open(row)}>
                    <div className="truncate font-medium text-primary hover:underline">{row.finding?.title}</div>
                    <div className="mono mt-0.5 truncate text-[11px] text-muted-foreground">{row.finding?.target}</div>
                  </button>
                ),
              },
              { key: 'severity', header: 'Severity', cell: (row) => <RiskBadge risk={row.finding?.severity} /> },
              {
                key: 'kind',
                header: 'Type',
                cell: (row) => kindLabels[row.finding?.kind || ''] || row.finding?.kind || '—',
                hideOnTablet: true,
              },
              { key: 'occurrences', header: 'Occurrences', cell: (row) => row.occurrences || 1 },
              {
                key: 'orgs',
                header: 'Organizations',
                cell: (row) => row.organizationIds?.length || 0,
                hideOnTablet: true,
              },
              {
                key: 'created',
                header: 'Last Seen',
                cell: (row) => relativeTime(row.finding?.createdAt),
                hideOnTablet: true,
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
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selected?.finding?.title}</SheetTitle>
            <SheetDescription>
              <span className="mono">{selected?.finding?.target}</span> ·{' '}
              {selected?.finding?.pluginName || selected?.finding?.kind}
            </SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Fact label="Severity" value={<RiskBadge risk={selected.finding?.severity} />} />
                <Fact label="Type" value={kindLabels[selected.finding?.kind || ''] || selected.finding?.kind || '—'} />
                <Fact label="First Seen" value={formatTime(selected.finding?.createdAt)} />
                <Fact label="Occurrences" value={selected.occurrences || 1} />
              </div>
              {selected.rootDomains?.length ? (
                <Section title="Linked Root Domains">
                  <div className="flex flex-wrap gap-1.5">
                    {selected.rootDomains.map((item) => (
                      <span key={item} className="mono rounded border bg-muted px-2 py-1 text-[11px]">
                        {item}
                      </span>
                    ))}
                  </div>
                </Section>
              ) : null}
              <Section title="History Timeline">
                {history.length ? (
                  <div className="space-y-2">
                    {history.slice(0, 10).map((item, index) =>
                      item ? (
                        <div key={item.id || index} className="rounded-[4px] border p-2.5 text-xs">
                          <div className="flex justify-between gap-2">
                            <span className="font-medium">{item.title}</span>
                            <RiskBadge risk={item.severity} />
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">{formatTime(item.createdAt)}</div>
                        </div>
                      ) : null,
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No history records</div>
                )}
              </Section>
              <Section title="Structured Observations">
                <KeyValues
                  data={selected.finding?.data as Record<string, unknown> | undefined}
                  primitivesOnly={false}
                  max={25}
                />
              </Section>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
