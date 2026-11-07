import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Download, Eye, FileArchive, Flag, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, type Artifact, type Objective } from '@/api'
import { useAuth } from '@/app/auth'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable, type Column } from '@/components/common/data-table'
import { EmptyState } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { canWrite } from '@/lib/access'
import { formatNumber, formatTime, relativeTime } from '@/lib/format'
import { humanize, severityVariant, statusVariant } from './chain-shared'
import { ProduceBreakdown } from './chain-produce-breakdown'
import { ObjectiveWorkflow } from './chain-objective-workflow'

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
  const { role } = useAuth()
  const writable = canWrite(role)
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

  const markExported = useMutation({
    mutationFn: (id: string) => api.updateObjectiveStatus(id, 'exported'),
    onSuccess: () => {
      toast.success('Objective marked as exported')
      void queryClient.invalidateQueries({ queryKey: ['produce-objectives'] })
      void queryClient.invalidateQueries({ queryKey: ['chain-overview'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const downloadArtifact = useMutation({
    mutationFn: async (artifact: Artifact) => {
      // The backend writes Content-Disposition and records an audit event; the
      // console simply saves the returned envelope as a file.
      const blob = await api.artifactDownload(artifact.id)
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `${artifact.name || artifact.id}.json`
      anchor.click()
      URL.revokeObjectURL(href)
    },
    onSuccess: () => toast.success('Artifact envelope downloaded'),
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteArtifact = useMutation({
    mutationFn: (id: string) => api.deleteArtifact(id),
    onSuccess: () => {
      toast.success('Artifact removed (recoverable from Recycle Bin)')
      setSelectedArtifact(null)
      void queryClient.invalidateQueries({ queryKey: ['produce-artifacts'] })
      void queryClient.invalidateQueries({ queryKey: ['chain-overview'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteObjective = useMutation({
    mutationFn: (id: string) => api.deleteObjective(id),
    onSuccess: () => {
      toast.success('Objective removed (recoverable from Recycle Bin)')
      setSelectedObjective(null)
      void queryClient.invalidateQueries({ queryKey: ['produce-objectives'] })
      void queryClient.invalidateQueries({ queryKey: ['chain-overview'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

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
          <Button
            size="icon"
            variant="ghost"
            title="View objective"
            aria-label="View objective"
            onClick={() => setSelectedObjective(row)}
          >
            <Eye />
            <span className="sr-only">View</span>
          </Button>
          <Button
            size="icon"
            variant="outline"
            disabled={row.status === 'exported' || markExported.isPending}
            onClick={() => markExported.mutate(row.id)}
            title="Mark exported"
            aria-label="Mark exported"
            >
            <Check />
            <span className="sr-only">Mark exported</span>
          </Button>
          {writable ? (
            <ConfirmDialog
              trigger={
                <Button size="icon" variant="ghost" title="Delete objective" aria-label="Delete objective">
                  <Trash2 className="size-3.5" />
                </Button>
              }
              title="Delete objective?"
              description={`${row.title || row.id} will be soft-deleted and can be restored from the Recycle Bin.`}
              confirmLabel="Delete"
              onConfirm={() => deleteObjective.mutate(row.id)}
            />
          ) : null}
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
          <Button
            size="icon"
            variant="ghost"
            title="View artifact"
            aria-label="View artifact"
            onClick={() => setSelectedArtifact(row)}
          >
            <Eye />
            <span className="sr-only">View</span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={downloadArtifact.isPending}
            onClick={() => downloadArtifact.mutate(row)}
            title="Download artifact"
            aria-label="Download artifact"
            >
            <Download />
            <span className="sr-only">Download</span>
          </Button>
          {writable ? (
            <Button
              size="icon"
              variant="outline"
              onClick={() => onRunTask(row.assetId)}
              title="Re-run an objective probe"
              aria-label="Re-run an objective probe"
              >
              <RefreshCw />
              <span className="sr-only">Re-run</span>
            </Button>
          ) : null}
          {writable ? (
            <ConfirmDialog
              trigger={
                <Button size="icon" variant="ghost" title="Delete artifact" aria-label="Delete artifact">
                  <Trash2 className="size-3.5" />
                </Button>
              }
              title="Delete artifact?"
              description={`${row.name || row.id} will be soft-deleted and can be restored from the Recycle Bin.`}
              confirmLabel="Delete"
              onConfirm={() => deleteArtifact.mutate(row.id)}
            />
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="xl:col-span-2">
        <ProduceBreakdown
          objectives={objectives.data?.items || []}
          artifacts={artifacts.data?.items || []}
          loading={objectives.isLoading || artifacts.isLoading}
        />
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
          <CardTitle className="flex items-center gap-2">
            <Flag className="size-4 text-foreground" /> Objectives
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
            <FileArchive className="size-4 text-foreground" /> Artifacts
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
            <SheetDescription>Objective detail, lifecycle status and its recorded action timeline.</SheetDescription>
          </SheetHeader>
          {selectedObjective ? (
            <div className="space-y-4 text-xs">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="info">{humanize(selectedObjective.kind)}</Badge>
                <Badge variant={severityVariant(selectedObjective.severity)}>
                  {humanize(selectedObjective.severity)}
                </Badge>
                <Badge variant={statusVariant(selectedObjective.status)}>{humanize(selectedObjective.status)}</Badge>
              </div>
              <p className="leading-5 text-muted-foreground">{selectedObjective.detail || 'No detail recorded.'}</p>
              <dl className="grid grid-cols-2 gap-2 border p-3">
                <Fact label="Discovered" value={formatTime(selectedObjective.discoveredAt)} />
                <Fact label="Asset" value={selectedObjective.assetId || '—'} />
                <Fact label="Task" value={selectedObjective.taskId || '—'} />
                <Fact label="Session" value={selectedObjective.sessionId || '—'} />
                <Fact label="Organization" value={selectedObjective.organizationId || '—'} />
                <Fact label="Created By" value={selectedObjective.createdBy || '—'} />
              </dl>
              <ObjectiveWorkflow objective={selectedObjective} writable={writable} />
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
              <dl className="grid grid-cols-2 gap-2 border p-3">
                <Fact label="Kind" value={humanize(selectedArtifact.kind)} />
                <Fact label="Size" value={`${formatNumber(selectedArtifact.sizeBytes)} B`} />
                <Fact label="Storage Path" value={selectedArtifact.storagePath || '—'} />
                <Fact label="Checksum" value={selectedArtifact.checksum || '—'} />
                <Fact label="Exported" value={formatTime(selectedArtifact.exportedAt)} />
                <Fact label="Created By" value={selectedArtifact.createdBy || '—'} />
                <Fact label="Objective" value={selectedArtifact.objectiveId || '—'} />
                <Fact label="Asset" value={selectedArtifact.assetId || '—'} />
              </dl>
              <Button
                size="icon"
                disabled={downloadArtifact.isPending}
                onClick={() => downloadArtifact.mutate(selectedArtifact)}
                title="Download envelope"
                aria-label="Download envelope"
                >
                <Download />
                <span className="sr-only">Download envelope</span>
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
