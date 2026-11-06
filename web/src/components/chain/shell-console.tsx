import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CornerDownLeft, Power, RotateCcw, Terminal } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { api, type ShellCommand, type ShellSession } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatTime } from '@/lib/format'

/**
 * ShellConsole is the interactive terminal popup used by the exploit and
 * objectives modes. It streams a session's command history, accepts new
 * commands, and exposes close / re-ignition actions. Re-ignition creates a new
 * session linked to the original, so command history and audit stay continuous
 * (plan T10, re-ignitable shell sessions).
 */
export function ShellConsole({
  sessionId,
  open,
  onOpenChange,
}: {
  sessionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [command, setCommand] = useState('')
  const [localSessionId, setLocalSessionId] = useState<string | null>(sessionId)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => setLocalSessionId(sessionId), [sessionId])
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [open])

  const session = useQuery({
    queryKey: ['session', localSessionId],
    queryFn: () => api.session(localSessionId || ''),
    enabled: Boolean(open && localSessionId),
  })
  const history = useQuery({
    queryKey: ['session-commands', localSessionId],
    queryFn: () => api.sessionCommands(localSessionId || '', { pageSize: 200 }),
    enabled: Boolean(open && localSessionId),
    refetchInterval: open ? 4000 : false,
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history.data?.items?.length])

  const run = useMutation({
    mutationFn: () => api.runSessionCommand(localSessionId || '', command),
    onSuccess: () => {
      setCommand('')
      void queryClient.invalidateQueries({ queryKey: ['session-commands', localSessionId] })
    },
    onError: (error) => toast.error(error.message),
  })

  const close = useMutation({
    mutationFn: () => api.closeSession(localSessionId || ''),
    onSuccess: () => {
      toast.success('Session closed')
      void queryClient.invalidateQueries({ queryKey: ['session', localSessionId] })
      void queryClient.invalidateQueries({ queryKey: ['chain-sessions'] })
      void session.refetch()
    },
    onError: (error) => toast.error(error.message),
  })

  const reignite = useMutation({
    mutationFn: () => api.reigniteSession(localSessionId || ''),
    onSuccess: (fresh) => {
      toast.success('Session re-ignited')
      setLocalSessionId(fresh.id)
      void queryClient.invalidateQueries({ queryKey: ['chain-sessions'] })
    },
    onError: (error) => toast.error(error.message),
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (command.trim() && !run.isPending) run.mutate()
  }

  const sess: ShellSession | undefined = session.data
  const state = sess?.state || 'unknown'
  const canRun = state === 'open'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="size-4 text-foreground" />
            Shell Console
            {sess ? (
              <span className="mono text-[11px] font-normal text-muted-foreground">
                {sess.protocol}://{sess.host}:{sess.port}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Interactive command session. Commands are recorded for audit; re-ignition re-opens a closed session.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-2 flex items-center gap-2">
          <Badge variant={canRun ? 'success' : 'danger'}>{state}</Badge>
          {sess ? <span className="mono-label">Session {sess.id}</span> : null}
          {sess?.reignitedFrom ? <span className="mono-label">re-ignited from {sess.reignitedFrom}</span> : null}
          <div className="ml-auto flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={!sess || reignite.isPending}
              onClick={() => reignite.mutate()}
              title="Re-ignite a closed session"
            >
              <RotateCcw className="mr-1 size-3.5" /> Re-ignite
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!sess || state === 'closed' || close.isPending}
              onClick={() => close.mutate()}
              title="Close session"
            >
              <Power className="mr-1 size-3.5" /> Close
            </Button>
          </div>
        </div>

        <div className="h-80 overflow-y-auto border border-border bg-accent p-3 font-mono text-[12px] leading-relaxed text-foreground scrollbar-thin">
          <div className="text-foreground">T4C shell session — {sess?.host || 'connecting…'}</div>
          {history.isLoading ? <div className="text-foreground">Loading command history…</div> : null}
          {history.data?.items?.map((line: ShellCommand) => (
            <div key={line.id} className="whitespace-pre-wrap break-words">
              <div className="text-foreground">
                <span className="text-foreground">[{line.seq}] </span>$ {line.command}
              </div>
              {line.output ? <div className="text-foreground">{line.output}</div> : null}
              {line.exitCode !== 0 ? <div className="text-foreground">exit {line.exitCode}</div> : null}
            </div>
          ))}
          {!history.isLoading && !history.data?.items?.length ? (
            <div className="text-foreground">No commands recorded yet. Run a command below.</div>
          ) : null}
          <div ref={endRef} />
        </div>

        <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
          <span className="mono text-[12px] text-foreground">$</span>
          <Input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder={
              canRun ? 'whoami, id, uname -a, ls, cat /etc/passwd…' : 'Session is not open — re-ignite to run commands'
            }
            disabled={!canRun || run.isPending}
            className="mono border-border bg-accent text-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" size="sm" disabled={!canRun || run.isPending || !command.trim()}>
            <CornerDownLeft className="mr-1 size-3.5" /> Run
          </Button>
        </form>
        <DialogFooter className="text-[11px] text-muted-foreground">
          Last activity: {sess ? formatTime(sess.lastActive) : '—'} · Commands are simulated in SDK mode and recorded
          for audit.
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
