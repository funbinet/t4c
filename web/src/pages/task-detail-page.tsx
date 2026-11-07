import { Download, RefreshCw, RotateCcw, Square } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/api'
import { download } from '@/api/client'
import { RiskBadge, StatusBadge } from '@/components/common/badges'
import { DataTable } from '@/components/common/data-table'
import { Breadcrumb, Fact } from '@/components/common/form'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/app/auth'
import { canWrite } from '@/lib/access'
import { formatTime, relativeTime } from '@/lib/format'

type TaskEvent = { type?: string; message?: string; createdAt?: string; payload?: Record<string, unknown> }

export function TaskDetailPage() {
  const { id = '' } = useParams()
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [events, setEvents] = useState<TaskEvent[]>([])
  const tab = params.get('tab') || 'events'
  const detail = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.task(id),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  })
  const observations = useQuery({
    queryKey: ['task-observations', id, tab],
    queryFn: () => api.taskObservations(id, tab === 'ips' ? 'ip' : tab === 'assets' ? 'domain' : 'site'),
    enabled: ['domains', 'ips', 'sites', 'assets'].includes(tab),
  })
  const findings = useQuery({
    queryKey: ['task-findings', id, tab],
    queryFn: () => api.taskFindings(id, tab === 'wih' ? 'wih' : 'vuln'),
    enabled: tab === 'vulns' || tab === 'wih',
  })

  useEffect(() => {
    if (!id) return
    let source: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let retry = 1500
    let closed = false
    const connect = () => {
      source = new EventSource(`/api/v1/tasks/${id}/events`)
      const handle = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data) as TaskEvent
          setEvents((current) => [...current.slice(-299), parsed])
          if (['task.status', 'step.status', 'task.warning'].includes(parsed.type || '')) {
            void queryClient.invalidateQueries({ queryKey: ['task', id] })
          }
        } catch {
          // Ignore malformed SSE frames and keep the stream alive.
        }
      }
      source.onmessage = handle
      for (const name of ['task.status', 'step.status', 'task.warning', 'asset.new', 'finding.new'])
        source.addEventListener(name, handle as EventListener)
      source.onopen = () => {
        retry = 1500
      }
      source.onerror = () => {
        source?.close()
        if (closed) return
        timer = setTimeout(connect, retry)
        retry = Math.min(retry * 2, 15_000)
      }
    }
    connect()
    return () => {
      closed = true
      source?.close()
      if (timer) clearTimeout(timer)
    }
  }, [id, queryClient])

  const exportTask = useMutation({
    mutationFn: () => api.createExport({ taskId: id, format: 'xlsx' }),
    onSuccess: (result) => void download(result.downloadUrl || ''),
    onError: (error) => toast.error(error.message),
  })
  const action = useMutation({
    mutationFn: async ({ kind }: { kind: 'cancel' | 'retry' | 'sync' }) => {
      if (kind === 'cancel') await api.cancelTask(id)
      else if (kind === 'retry') await api.retryTask(id)
      else await api.syncTask(id)
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.kind === 'cancel'
          ? 'Task stopped'
          : variables.kind === 'retry'
            ? 'Task resubmitted'
            : 'Sync triggered',
      )
      void queryClient.invalidateQueries({ queryKey: ['task', id] })
    },
    onError: (error) => toast.error(error.message),
  })

  if (detail.isLoading) return <LoadingBlock label="Loading task…" />
  if (detail.error || !detail.data?.task)
    return <ErrorState error={detail.error ?? new Error('Task not found')} retry={() => detail.refetch()} />
  const task = detail.data.task
  const steps = detail.data.steps || []

  function switchTab(value: string) {
    const next = new URLSearchParams(params)
    if (value === 'events') next.delete('tab')
    else next.set('tab', value)
    setParams(next, { replace: true })
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Tasks', to: '/tasks' }, { label: task.name || task.id || '' }]} />
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{task.name || 'Scan Task'}</h1>
            <StatusBadge status={task.status} />
          </div>
          <div className="mono mt-2 text-xs text-muted-foreground">
            {task.target} · {task.kind} · {task.origin || 'manual'}
          </div>
        </div>
        {canWrite(role) ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon" variant="outline" title="Export" onClick={() => exportTask.mutate()}>
              <Download />
              <span className="sr-only">Export</span>
            </Button>
            <Button
              size="icon"
              variant="outline"
              title="Sync"
              onClick={() => action.mutate({ kind: 'sync' })}
            >
              <RefreshCw />
              <span className="sr-only">Sync</span>
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="text-destructive"
              title="Stop"
              disabled={['succeeded', 'failed', 'canceled', 'partial'].includes(task.status || '')}
              onClick={() => action.mutate({ kind: 'cancel' })}
            >
              <Square />
              <span className="sr-only">Stop</span>
            </Button>
            {['failed', 'partial'].includes(task.status || '') ? (
              <Button size="icon" title="Retry" onClick={() => action.mutate({ kind: 'retry' })}>
                <RotateCcw />
                <span className="sr-only">Retry</span>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Task Progress</span>
            <b className="tabular-nums">{task.progress || 0}%</b>
          </div>
          <Progress value={task.progress || 0} />
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <Fact label="Created" value={formatTime(task.createdAt)} />
            <Fact label="Started" value={formatTime(task.startedAt)} />
            <Fact label="Finished" value={formatTime(task.finishedAt)} />
            <Fact label="Policy" value={task.policyId || 'Default'} />
          </div>
          {task.error ? (
            <div className="mt-3 border border-ring px-3 py-2 text-xs text-destructive">
              {task.error}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Tabs value={tab} onValueChange={switchTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="ips">IPs</TabsTrigger>
          <TabsTrigger value="sites">Sites</TabsTrigger>
          <TabsTrigger value="vulns">Findings</TabsTrigger>
          <TabsTrigger value="wih">WIH</TabsTrigger>
        </TabsList>
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Event Stream</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length ? (
                <div className="max-h-[520px] space-y-2 overflow-auto pr-2 scrollbar-thin">
                  {events
                    .slice()
                    .reverse()
                    .map((event, index) => (
                      <div key={`${event.createdAt}-${index}`} className=" border p-2.5 text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">{event.type || 'event'}</span>
                          <span className="text-[10px] text-muted-foreground">{relativeTime(event.createdAt)}</span>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {String(event.message || JSON.stringify(event.payload || {}))}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <EmptyState title="No events yet" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="steps">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {steps.map((step) => (
                  <div key={step.id} className=" border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium">
                          {String(step.sequence)}. {String(step.kind)}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{String(step.message || '—')}</div>
                      </div>
                      <StatusBadge status={step.status} />
                    </div>
                    <Progress className="mt-2" value={step.progress || 0} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="domains">
          <ObservationTab query={observations} />
        </TabsContent>
        <TabsContent value="ips">
          <ObservationTab query={observations} />
        </TabsContent>
        <TabsContent value="sites">
          <ObservationTab query={observations} />
        </TabsContent>
        <TabsContent value="vulns">
          <FindingTab query={findings} />
        </TabsContent>
        <TabsContent value="wih">
          <FindingTab query={findings} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ObservationTab({ query }: { query: ReturnType<typeof useQuery<any>> }) {
  if (query.isLoading) return <LoadingBlock />
  const rows = query.data?.items || []
  return (
    <Card>
      <CardContent className="pt-4">
        <DataTable
          rows={rows}
          rowKey={(row: any) => row.id || row.key}
          empty={<EmptyState title="No observations" />}
          columns={[
            { key: 'key', header: 'Asset', cell: (row: any) => <span className="mono">{row.key}</span> },
            { key: 'source', header: 'Source', cell: (row: any) => row.source || '—' },
            { key: 'time', header: 'Observed At', cell: (row: any) => formatTime(row.observedAt) },
          ]}
        />
      </CardContent>
    </Card>
  )
}
function FindingTab({ query }: { query: ReturnType<typeof useQuery<any>> }) {
  if (query.isLoading) return <LoadingBlock />
  const rows = query.data?.items || []
  return (
    <Card>
      <CardContent className="pt-4">
        <DataTable
          rows={rows}
          rowKey={(row: any) => row.id || row.dedupeKey}
          empty={<EmptyState title="No findings" />}
          columns={[
            { key: 'title', header: 'Title', cell: (row: any) => row.title },
            { key: 'target', header: 'Target', cell: (row: any) => <span className="mono">{row.target}</span> },
            { key: 'severity', header: 'Severity', cell: (row: any) => <RiskBadge risk={row.severity} /> },
            { key: 'time', header: 'Time', cell: (row: any) => formatTime(row.createdAt) },
          ]}
        />
      </CardContent>
    </Card>
  )
}
