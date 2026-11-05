import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Crosshair, Flag, Layers, Radar, Target, Terminal, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api'
import { STAGE_META, useMode, type Stage } from '@/app/mode'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  const advance = useMutation({
    mutationFn: () => api.advanceStage(organizationId, { fromStage: mode }),
    onSuccess: (result) => {
      toast.success(`Advanced ${STAGE_META[result.fromStage as Stage]?.shortLabel || result.fromStage} → ${STAGE_META[result.toStage as Stage]?.shortLabel || result.toStage}`)
      void queryClient.invalidateQueries({ queryKey: ['chain'] })
      const next = result.toStage as Stage
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

  const currentIndex = STAGES.indexOf(mode)
  const nextStage = STAGES[currentIndex + 1]
  const kinds = kindCounts(assets.data?.items)

  return (
    <Card className="mb-4 border-[rgba(0,250,0,0.25)]">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
        <CardTitle className="flex items-center gap-2">
          <Layers className="size-4 text-mint" />
          Chain Progress
        </CardTitle>
        <div className="flex items-center gap-2">
          {nextStage ? (
            <Button
              size="sm"
              variant="outline"
              disabled={advance.isPending}
              onClick={() => advance.mutate()}
              title={`Advance to ${STAGE_META[nextStage].label}`}
            >
              <Zap className="mr-1 size-3.5" />
              Advance to {STAGE_META[nextStage].shortLabel}
              <ArrowRight className="ml-1 size-3.5" />
            </Button>
          ) : (
            <span className="mono-label flex items-center gap-1 text-mint">
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
            const isDone = index < currentIndex
            return (
              <button
                key={stage}
                type="button"
                onClick={() => setMode(stage)}
                className={cn(
                  'flex items-center gap-3 rounded-[4px] border px-3 py-2 text-left transition-colors',
                  isCurrent
                    ? 'border-[rgba(0,250,0,0.5)] bg-[rgba(0,250,0,0.06)]'
                    : 'border-border bg-card hover:border-[rgba(0,250,0,0.3)]',
                )}
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full border',
                    isDone
                      ? 'border-mint bg-mint/15 text-mint'
                      : isCurrent
                        ? 'border-mint text-mint'
                        : 'border-border text-muted-foreground',
                  )}
                >
                  {isDone ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span className="min-w-0">
                  <span className="mono-label block">{STAGE_META[stage].label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {counts[stage].assets} {stage === 'exploit' ? 'breached' : stage === 'objectives' ? 'objectives' : 'assets'} · {counts[stage].extra}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

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
                    className="inline-flex items-center gap-1 rounded-[3px] border bg-card px-2 py-1 text-[11px]"
                    title={`${KIND_LABELS[kind] || kind} (${kind})`}
                  >
                    <span className="text-muted-foreground">{KIND_LABELS[kind] || kind}</span>
                    <span className="mono font-semibold text-mint">{count}</span>
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
    <div className="flex items-center justify-between rounded-[3px] border bg-card px-2 py-1.5 text-[11px]">
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
