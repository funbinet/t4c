import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Download, Eye, FileArchive, Flag, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, type Artifact, type Objective, type ObjectiveAction } from '@/api'
import { DataTable, type Column } from '@/components/common/data-table'
import { EmptyState } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatNumber, formatTime, relativeTime } from '@/lib/format'
import { humanize, severityVariant, statusVariant } from './chain-shared'

/**
 * ProducePanel is the objectives-mode payload surface: the objectives that
 * were created by exploit/objective SDKs and the artifacts those SDKs wrote.
 * It exposes View / Download / Re-run / Mark Exported actions (plan §8.5).
 */
export function ProducePanel({
  organizationId,
  onRunTask,
}: {
  organizationId?: string
  onRunTask: (assetId: string) => void
}) {
  const queryClient = useQueryClient()
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null)
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null)

  const objectives = useQuery({
    queryKey: ['produce-objectives', organizationId],
    queryFn: () => api.objectives({ organizationId, pageSize: 100 }),
    refetchInterval: 15_000,
  })
  const artifacts = useQuery({
    queryKey: ['produce-artifacts', organizationId],
    queryFn: () => api.artifacts({ organizationId, pageSize: 100 }),
    refetchInterval: 15_000,
  })
  const objectiveActions = useQuery({
    queryKey: ['produce-objective-actions', selectedObjective?.id],
    queryFn: () => api.objectiveActions(selectedObjective?.id || '', { pageSize: 100 }),
    enabled: Boolean(selectedObjective),
  })

  const markExported = useMutation({
    mutationFn: (id: string) => api.updateObjectiveStatus(id, 'exported'),
    onSuccess: () => {
      toast.success('Objective marked as exported')
      void queryClient.invalidateQueries({ queryKey: ['produce-objectives'] })
      void queryClient.invalidateQueries({ queryKey: ['chain-overview'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const downloadArtifact = (artifact: Artifact) => {
    // Artifacts are SDK-produced records; the console downloads their metadata
    // envelope (checksum + storage path) so operators can reconcile exports.
    const payload = JSON.stringify({ ...artifact, stage: 'objectives', downloadedAt: new Date().toISOString() }, null, 2)
    const href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = `${artifact.name || artifact.id}.json`
    anchor.click()
    URL.revokeObjectURL(href)
    toast.success(`Downloaded metadata for ${artifact.name}`)
  }

  const objectiveColumns: Column<Objective>[] = [
    {
      key: 'title',
      header: 'Objective',
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.title || row.id}</div>
          <div className="truncate text-[11px] text-muted-foreground">{row.detail || '—'}</div>
        </div>
      ),
    },
    { key: 'kind', header: 'Kind', cell: (row) => <Badge variant="info">{humanize(row.kind)}</Badge> },
    {
      key: 'severity',
      header: 'Severity',
      cell: (row) => <Badge variant={severityVariant(row.severity)}>{humanize(row.severity)}</Badge>,
      hideOnTablet: true,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <Badge variant={statusVariant(row.status)}>{humanize(row.status)}</Badge>,
    },
    { key: 'time', header: 'Discovered', cell: (row) => relativeTime(row.discoveredAt), hideOnTablet: true },
    {
      key: 'actions',
      header: '',
      stopRowClick: true,
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setSelectedObjective(row)}>
            <Eye className="mr-1 size-3.5" /> View
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={row.status === 'exported' || markExported.isPending}
            onClick={() => markExported.mutate(row.id)}
          >
            <Check className="mr-1 size-3.5" /> Exported
          </Button>
        </div>
      ),
    },
  ]

  const artifactColumns: Column<Artifact>[] = [
    { key: 'name', header: 'Artifact', cell: (row) => <span className="mono truncate">{row.name || row.id}</span> },
    { key: 'kind', header: 'Kind', cell: (row) => <Badge variant="outline">{humanize(row.kind)}</Badge> },
    { key: 'size', header: 'Size', cell: (row) => `${formatNumber(row.sizeBytes)} B`, hideOnTablet: true },
    { key: 'time', header: 'Exported', cell: (row) => formatTime(row.exportedAt), hideOnTablet: true },
    {
      key: 'actions',
      header: '',
      stopRowClick: true,
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setSelectedArtifact(row)}>
            <Eye className="mr-1 size-3.5" /> View
          </Button>
          <Button size="sm" variant="ghost" onClick={() => downloadArtifact(row)}>
            <Download className="mr-1 size-3.5" /> Download
          </Button>
          <Button size="sm" variant="outline" onClick={() => onRunTask(row.assetId)} title="Re-run an objective probe">
            <RefreshCw className="mr-1 size-3.5" /> Re-run
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
          <CardTitle className="flex items-center gap-2">
            <Flag className="size-4 text-mint" /> Objectives
          </CardTitle>
          <span className="mono-label">{formatNumber(objectives.data?.total)} collected</span>
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            rows={objectives.data?.items || []}
            columns={objectiveColumns}
            rowKey={(row) => row.id}
            empty={<EmptyState title="No objectives yet" description="Run objective-stage tasks to collect produce." />}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="size-4 text-mint" /> Artifacts
          </CardTitle>
          <span className="mono-label">{formatNumber(artifacts.data?.total)} files</span>
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            rows={artifacts.data?.items || []}
            columns={artifactColumns}
            rowKey={(row) => row.id}
            empty={<EmptyState title="No artifacts" description="Objective SDKs write extracted files here." />}
          />
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedObjective)} onOpenChange={(open) => !open && setSelectedObjective(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedObjective?.title || 'Objective'}</SheetTitle>
            <SheetDescription>Objective detail and its recorded action timeline.</SheetDescription>
          </SheetHeader>
          {selectedObjective ? (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="info">{humanize(selectedObjective.kind)}</Badge>
                <Badge variant={severityVariant(selectedObjective.severity)}>{humanize(selectedObjective.severity)}</Badge>
                <Badge variant={statusVariant(selectedObjective.status)}>{humanize(selectedObjective.status)}</Badge>
              </div>
              <p className="leading-5 text-muted-foreground">{selectedObjective.detail || 'No detail recorded.'}</p>
              <dl className="grid grid-cols-2 gap-2 rounded-[4px] border bg-card p-3">
                <Fact label="Discovered" value={formatTime(selectedObjective.discoveredAt)} />
                <Fact label="Asset" value={selectedObjective.assetId || '—'} />
                <Fact label="Task" value={selectedObjective.taskId || '—'} />
                <Fact label="Session" value={selectedObjective.sessionId || '—'} />
                <Fact label="Organization" value={selectedObjective.organizationId || '—'} />
                <Fact label="Created By" value={selectedObjective.createdBy || '—'} />
              </dl>
              <div>
                <div className="mono-label mb-2">Action Timeline</div>
                <div className="space-y-1.5">
                  {(objectiveActions.data?.items || []).map((action: ObjectiveAction) => (
                    <div key={action.id} className="rounded-[3px] border bg-card px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline">{humanize(action.kind)}</Badge>
                        <span className="text-[11px] text-muted-foreground">{formatTime(action.createdAt)}</span>
                      </div>
                      <div className="mt-1 break-words text-muted-foreground">{action.payload || '—'}</div>
                      {action.result ? <div className="mt-0.5 text-mint">→ {action.result}</div> : null}
                    </div>
                  ))}
                  {!objectiveActions.data?.items?.length ? (
                    <div className="py-4 text-center uppercase tracking-[0.04em] text-muted-foreground">No actions recorded</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(selectedArtifact)} onOpenChange={(open) => !open && setSelectedArtifact(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedArtifact?.name || 'Artifact'}</SheetTitle>
            <SheetDescription>Artifact metadata written by an objective SDK.</SheetDescription>
          </SheetHeader>
          {selectedArtifact ? (
            <div className="space-y-3 text-xs">
              <dl className="grid grid-cols-2 gap-2 rounded-[4px] border bg-card p-3">
                <Fact label="Kind" value={humanize(selectedArtifact.kind)} />
                <Fact label="Size" value={`${formatNumber(selectedArtifact.sizeBytes)} B`} />
                <Fact label="Storage Path" value={selectedArtifact.storagePath || '—'} />
                <Fact label="Checksum" value={selectedArtifact.checksum || '—'} />
                <Fact label="Exported" value={formatTime(selectedArtifact.exportedAt)} />
                <Fact label="Created By" value={selectedArtifact.createdBy || '—'} />
                <Fact label="Objective" value={selectedArtifact.objectiveId || '—'} />
                <Fact label="Asset" value={selectedArtifact.assetId || '—'} />
              </dl>
              <Button size="sm" onClick={() => downloadArtifact(selectedArtifact)}>
                <Download className="mr-1 size-3.5" /> Download metadata
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="mono-label">{label}</dt>
      <dd className="mt-0.5 break-words">{value}</dd>
    </div>
  )
}
