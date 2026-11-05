import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, History, LockKeyhole, Plus, Workflow } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api, type Objective, type ObjectiveAction } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatTime } from '@/lib/format'
import { OBJECTIVE_STATUS_OPTIONS, humanize, statusVariant } from './chain-shared'

const ACTION_KINDS = [
  { value: 'review', label: 'Review' },
  { value: 'probe', label: 'Probe' },
  { value: 'shell', label: 'Shell' },
  { value: 'export', label: 'Export' },
  { value: 'note', label: 'Note' },
]

/**
 * ObjectiveWorkflow drives the objective lifecycle required by the produce
 * layer (plan §8.5): status transitions open -> in_progress -> closed ->
 * exported, operator actions logged through /objectives/{id}/actions, and the
 * full action timeline. All writes are audit-logged by the backend and are
 * gated by requireWrite, so the interactive controls are hidden from read-only
 * roles to match the server-side contract.
 */
export function ObjectiveWorkflow({ objective, writable = true }: { objective: Objective; writable?: boolean }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState(objective.status || 'open')
  const [actionKind, setActionKind] = useState('review')
  const [payload, setPayload] = useState('')

  useEffect(() => {
    setStatus(objective.status || 'open')
    setPayload('')
  }, [objective.id, objective.status])

  const actions = useQuery({
    queryKey: ['objective-workflow-actions', objective.id],
    queryFn: () => api.objectiveActions(objective.id, { pageSize: 100 }),
  })

  const updateStatus = useMutation({
    mutationFn: (next: string) => api.updateObjectiveStatus(objective.id, next),
    onSuccess: (_data, next) => {
      toast.success(`Objective status set to ${humanize(next)}`)
      void queryClient.invalidateQueries({ queryKey: ['produce-objectives'] })
      void queryClient.invalidateQueries({ queryKey: ['chain-overview'] })
      void queryClient.invalidateQueries({ queryKey: ['objective-workflow-actions', objective.id] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const addAction = useMutation({
    mutationFn: () =>
      api.addObjectiveAction(objective.id, {
        kind: actionKind,
        payload: payload.trim() || 'Manual action recorded from the console',
        result: 'recorded',
      }),
    onSuccess: () => {
      toast.success('Action recorded')
      setPayload('')
      void queryClient.invalidateQueries({ queryKey: ['objective-workflow-actions', objective.id] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <div className="space-y-4">
      <div>
        <div className="mono-label mb-2 flex items-center gap-1.5">
          <Workflow className="size-3.5" /> Status Workflow
          {!writable ? (
            <Badge variant="outline" className="ml-auto normal-case tracking-normal">
              <LockKeyhole className="mr-1 size-3" /> Read only
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(objective.status)}>{humanize(objective.status)}</Badge>
          <Select value={status} onValueChange={setStatus} disabled={!writable}>
            <SelectTrigger className="h-8 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OBJECTIVE_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {writable ? (
            <Button
              size="sm"
              disabled={status === objective.status || updateStatus.isPending}
              onClick={() => updateStatus.mutate(status)}
            >
              <Check className="mr-1 size-3.5" /> Apply
            </Button>
          ) : null}
        </div>
      </div>

      {writable ? (
        <div>
          <div className="mono-label mb-2 flex items-center gap-1.5">
            <Plus className="size-3.5" /> Log an action
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={actionKind} onValueChange={setActionKind}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_KINDS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-8 min-w-0 flex-1"
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              placeholder="Describe the action…"
              autoComplete="off"
            />
            <Button size="sm" variant="outline" disabled={addAction.isPending} onClick={() => addAction.mutate()}>
              Log
            </Button>
          </div>
        </div>
      ) : null}

      <div>
        <div className="mono-label mb-2 flex items-center gap-1.5">
          <History className="size-3.5" /> Action Timeline · {formatNumberActions(actions.data?.items)}
        </div>
        <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
          {(actions.data?.items || []).map((action: ObjectiveAction) => (
            <div key={action.id} className="rounded-[3px] border bg-card px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{humanize(action.kind)}</Badge>
                <span className="text-[11px] text-muted-foreground">{formatTime(action.createdAt)}</span>
              </div>
              <div className="mt-1 break-words text-muted-foreground">{action.payload || '—'}</div>
              {action.result ? <div className="mt-0.5 text-mint">→ {action.result}</div> : null}
              {action.actor ? <div className="mt-0.5 text-[11px] text-muted-foreground">by {action.actor}</div> : null}
            </div>
          ))}
          {!actions.isLoading && !actions.data?.items?.length ? (
            <div className="py-4 text-center uppercase tracking-[0.04em] text-muted-foreground">
              No actions recorded for this objective
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function formatNumberActions(items?: ObjectiveAction[]): string {
  return `${items?.length || 0} recorded`
}
