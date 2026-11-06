import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Crosshair, Flag, History, Layers, Radar, Target, Terminal, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api'
import { STAGE_META, useMode, type Stage } from '@/app/mode'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const STAGES: Stage[] = ['recon', 'exploit', 'objectives']

const STAGE_ICONS = {
  recon: Radar,
  exploit: Crosshair,
  objectives: Target,
} as const

// AssetKind labels used to surface the recon asset classification in the UI.
const KIND_LABELS: Record<string, string> = {
  domain: 'Domains',
  ip: 'IPs',
  service: 'Services',
  web: 'Web',
  site: 'Sites',
  api_endpoint: 'API Endpoints',
  credential: 'Credentials',
  password: 'Passwords',
  session: 'Sessions',
  certificate: 'Certificates',
  bucket: 'Buckets',
  file: 'Files',
  url: 'URLs',
  cidr: 'CIDRs',
  exploited: 'Exploited',
}

/**
 * StageBanner shows the three-stage chain progress for an organization and
 * provides the governance "Advance to next stage" action (plan T7). It is
 * stage-aware: counts are pulled from the corresponding mode-scoped endpoints,
 * and the asset classification strip exposes the AssetKind distribution that
 * recon broadening and exploit flips produce.
 */
export function StageBanner({ organizationId }: { organizationId: string }) {
  const { mode, setMode } = useMode()
  const queryClient = useQueryClient()

  const exploited = useQuery({
    queryKey: ['chain-exploited', organizationId],
    queryFn: () => api.exploitedAssets({ organizationId, pageSize: 1 }),
    enabled: Boolean(organizationId),
  })
  const sessions = useQuery({
    queryKey: ['chain-sessions', organizationId],
    queryFn: () => api.sessions({ organizationId, pageSize: 1 }),
    enabled: Boolean(organizationId),
  })
  const objectives = useQuery({
    queryKey: ['chain-objectives', organizationId],
    queryFn: () => api.objectives({ organizationId, pageSize: 1 }),
    enabled: Boolean(organizationId),
  })
  const artifacts = useQuery({
    queryKey: ['chain-artifacts', organizationId],
    queryFn: () => api.artifacts({ organizationId, pageSize: 1 }),
    enabled: Boolean(organizationId),
  })
  const assets = useQuery({
    queryKey: ['chain-asset-kinds', organizationId],
    queryFn: () => api.organizationAssets(organizationId, { page: 1, pageSize: 200 }),
    enabled: Boolean(organizationId),
  })
  // The authoritative, persisted stage for this organization. The active UI
  // mode is only a view preference and may legitimately differ from it.
  const stageState = useQuery({
    queryKey: ['organization-stage', organizationId],
    queryFn: () => api.organizationStage(organizationId),
    enabled: Boolean(organizationId),
  })
  const rawStage = stageState.data?.currentStage
  const effectiveStage: Stage = rawStage && STAGES.includes(rawStage as Stage) ? (rawStage as Stage) : mode

  const advance = useMutation({
    mutationFn: () => api.advanceStage(organizationId, { fromStage: effectiveStage }),
    onSuccess: (result) => {
      toast.success(
        `Advanced ${STAGE_META[result.fromStage as Stage]?.shortLabel || result.fromStage} → ${STAGE_META[result.toStage as Stage]?.shortLabel || result.toStage}`,
      )
      void queryClient.invalidateQueries({ queryKey: ['chain'] })
      void queryClient.invalidateQueries({ queryKey: ['organization-stage', organizationId] })
      void queryClient.invalidateQueries({ queryKey: ['chain-organizations'] })
      const next = (result.currentStage || result.toStage) as Stage
      if (STAGES.includes(next)) setMode(next)
    },
    onError: (error) => toast.error(error.message),
  })

  const counts: Record<Stage, { assets: number; extra: string }> = {
    recon: {
      assets: assets.data?.total ?? 0,
      extra: `${Object.keys(kindCounts(assets.data?.items)).length} asset kinds`,
    },
    exploit: {
      assets: exploited.data?.total ?? 0,
      extra: `${sessions.data?.total ?? 0} shell sessions`,
    },
    objectives: {
      assets: objectives.data?.total ?? 0,
      extra: `${artifacts.data?.total ?? 0} artifacts`,
    },
  }

  // The rail doubles as the view selector, so its highlight follows the active
  // mode; the governance action follows the persisted stage instead.
  const viewIndex = STAGES.indexOf(mode)
  const currentIndex = STAGES.indexOf(effectiveStage)
  const nextStage = STAGES[currentIndex + 1]
  const kinds = kindCounts(assets.data?.items)

  return (
    <Card className="mb-4 border-border">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
        <CardTitle className="flex items-center gap-2">
          <Layers className="size-4 text-foreground" />
          Chain Progress
          <span className="mono-label border px-1.5 py-0.5 text-[10px] text-foreground">
            Current: {STAGE_META[effectiveStage].label}
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          {mode !== effectiveStage ? (
            <span className="mono-label text-[10px] text-muted-foreground">Viewing {STAGE_META[mode].shortLabel}</span>
          ) : null}
          {nextStage ? (
            <Button
              size="sm"
              variant="outline"
              disabled={advance.isPending || stageState.isLoading}
              onClick={() => advance.mutate()}
              title={`Advance from ${STAGE_META[effectiveStage].label} to ${STAGE_META[nextStage].label}`}
            >
              <Zap className="mr-1 size-3.5" />
              Advance to {STAGE_META[nextStage].shortLabel}
              <ArrowRight className="ml-1 size-3.5" />
            </Button>
          ) : (
            <span className="mono-label flex items-center gap-1 text-foreground">
              <Flag className="size-3.5" /> Terminal stage
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Three-stage progress rail */}
        <div className="grid gap-2 sm:grid-cols-3">
          {STAGES.map((stage, index) => {
            const Icon = STAGE_ICONS[stage]
            const isCurrent = stage === mode
            const isDone = index < viewIndex
            return (
              <button
                key={stage}
                type="button"
                onClick={() => setMode(stage)}
                className={cn(
                  'flex items-center gap-3 border px-3 py-2 text-left',
                  isCurrent
                    ? 'border-ring bg-accent'
                    : 'border-border bg-card hover:border-ring',
                )}
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center border',
                    isDone
                      ? 'border-mint bg-accent text-foreground'
                      : isCurrent
                        ? 'border-mint text-foreground'
                        : 'border-border text-muted-foreground',
                  )}
                >
                  {isDone ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span className="min-w-0">
                  <span className="mono-label block">{STAGE_META[stage].label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {counts[stage].assets}{' '}
                    {stage === 'exploit' ? 'breached' : stage === 'objectives' ? 'objectives' : 'assets'} ·{' '}
                    {counts[stage].extra}
                  </span>
                </span>
                {stage === mode && mode !== effectiveStage ? (
                  <span className="ml-auto text-[9px] uppercase tracking-wider text-primary">view</span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* Persisted stage transitions — an auditable governance trail that
            stays accurate regardless of which mode the operator is viewing. */}
        {stageState.data?.history?.length ? (
          <div>
            <div className="mono-label mb-2 flex items-center gap-1">
              <History className="size-3" /> Stage Transitions
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stageState.data.history.slice(0, 4).map((item, index) => (
                <span
                  key={`${item.at}-${index}`}
                  className="inline-flex items-center gap-1.5 border bg-card px-2 py-1 text-[11px]"
                >
                  <span className="mono font-semibold text-foreground">
                    {item.fromStage || '—'} → {item.toStage || '—'}
                  </span>
                  <span className="text-muted-foreground">
                    {item.actor || 'system'} · {formatTime(item.at)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Asset classification (AssetKind) strip — surfaces recon broadening
            and exploit-stage classification directly in the org Overview. */}
        <div>
          <div className="mono-label mb-2 flex items-center gap-1">
            <Crosshair className="size-3" /> Asset Classification
          </div>
          {Object.keys(kinds).length ? (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(kinds)
                .sort((a, b) => b[1] - a[1])
                .map(([kind, count]) => (
                  <span
                    key={kind}
                    className="inline-flex items-center gap-1 border bg-card px-2 py-1 text-[11px]"
                    title={`${KIND_LABELS[kind] || kind} (${kind})`}
                  >
                    <span className="text-muted-foreground">{KIND_LABELS[kind] || kind}</span>
                    <span className="mono font-semibold text-foreground">{count}</span>
                  </span>
                ))}
            </div>
          ) : (
            <div className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
              No classified assets yet — run recon to populate the surface.
            </div>
          )}
        </div>

        {/* Stage-specific quick stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickStat icon={<Radar className="size-3.5" />} label="Recon Assets" value={assets.data?.total ?? 0} />
          <QuickStat icon={<Terminal className="size-3.5" />} label="Exploited" value={exploited.data?.total ?? 0} />
          <QuickStat icon={<Target className="size-3.5" />} label="Objectives" value={objectives.data?.total ?? 0} />
          <QuickStat icon={<Flag className="size-3.5" />} label="Artifacts" value={artifacts.data?.total ?? 0} />
        </div>
      </CardContent>
    </Card>
  )
}

function QuickStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border bg-card px-2 py-1.5 text-[11px]">
      <span className="flex items-center gap-1 text-muted-foreground">
        {icon} {label}
      </span>
      <span className="mono font-semibold">{value}</span>
    </div>
  )
}

type AssetLike = { kind?: string }
function kindCounts(items?: AssetLike[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of items || []) {
    const k = a?.kind || 'unknown'
    out[k] = (out[k] || 0) + 1
  }
  return out
}
