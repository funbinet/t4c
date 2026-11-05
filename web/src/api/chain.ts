import { client, execute } from './client'
import type { Stage } from '@/app/mode'

// Chain-stage domain types. The generated OpenAPI schemas predate the Stage,
// Exploited and Confidence columns, so the chain endpoints resolve to these
// explicit shapes instead of the generic generated objects. CSRF handling,
// 401 refresh and error mapping still flow through the shared client.
export type ShellSession = {
  id: string
  organizationId: string
  assetId: string
  taskId: string
  protocol: string
  state: string
  host: string
  port: number
  reignitedFrom?: string | null
  createdBy: string
  openedAt: string
  closedAt?: string | null
  lastActive: string
}

export type ShellCommand = {
  id: string
  sessionId: string
  seq: number
  command: string
  output: string
  exitCode: number
  runAt: string
}

export type Objective = {
  id: string
  organizationId: string
  assetId: string
  taskId: string
  sessionId?: string | null
  kind: string
  title: string
  detail: string
  severity: string
  status: string
  metadata?: Record<string, unknown>
  discoveredAt: string
  createdBy: string
}

export type ObjectiveAction = {
  id: string
  objectiveId: string
  kind: string
  payload: string
  result: string
  actor: string
  createdAt: string
}

export type Artifact = {
  id: string
  organizationId: string
  assetId: string
  objectiveId: string
  taskId: string
  name: string
  kind: string
  sizeBytes: number
  storagePath: string
  checksum: string
  exportedAt: string
  createdBy: string
}

export type ChainPlugin = {
  name: string
  type: string
  category: string
  severity: string
  description: string
  schemes?: string[]
  canOpenSession?: boolean
  requiresSession?: boolean
}

export type ChainPage<T> = {
  items: T[]
  total: number
  page?: number
  pageSize?: number
  stage?: string
}

// A classified recon asset as exposed by the stage-scoped asset endpoints.
// Exploit/objectives views only return assets with exploited = true.
export type ChainAsset = {
  id: string
  kind: string
  key: string
  stage?: string
  displayName?: string
  displayUrl?: string
  origin?: string
  notes?: string
  tags?: string[]
  data?: Record<string, unknown>
  firstSeen?: string
  lastSeen?: string
  confidence?: number
  exploited?: boolean
  exploitedAt?: string | null
  lastTaskId?: string
}

export type ChainFinding = {
  id: string
  taskId?: string
  kind?: string
  stage?: string
  dedupeKey?: string
  title?: string
  severity?: string
  target?: string
  pluginName?: string
  data?: Record<string, unknown>
  createdAt?: string
}

export type ChainTask = {
  id: string
  name?: string
  kind?: string
  stage?: string
  target?: string
  status?: string
  progress?: number
  policyId?: string
  scopeId?: string
  organizationId?: string
  createdBy?: string
  createdAt?: string
  startedAt?: string
  finishedAt?: string
  error?: string
  statistics?: Record<string, unknown>
}

// Automation parity records (monitors / schedules / policies / groups).
export type ChainAutomationItem = {
  id?: string
  name?: string
  description?: string
  kind?: string
  taskKind?: string
  status?: string
  stage?: string
  target?: string
  scopeId?: string
  policyId?: string
  cron?: string
  intervalSec?: number
  nextRunAt?: string
  lastRunAt?: string
  createdAt?: string
  config?: Record<string, unknown>
  type?: string
  targets?: string[]
}

export type StageTaskResult = ChainPage<ChainTask>

export type AdvanceResult = {
  organizationId: string
  fromStage: string
  toStage: string
  advanced: boolean
}

export type StageQuery = {
  organizationId?: string
  status?: string
  kind?: string
  objectiveId?: string
  assetId?: string
  page?: number
  pageSize?: number
  q?: string
  query?: string
  sort?: string
}

// StageOverview is the payload of GET /{stage}/overview: stage-scoped counters,
// the AssetKind distribution, the owning SDK registry and recent chain activity.
export type StageOverview = {
  stage: string
  label: string
  description: string
  nextStage?: string
  updatedAt: string
  counts: Record<string, number>
  byKind: Record<string, number>
  plugins: ChainPlugin[]
  sdkCount: number
  organizations: number
  recentSessions: ShellSession[]
  recentObjectives: Objective[]
  recentArtifacts: Artifact[]
}

// StageOrganization is a recon-discovered organization annotated with its
// per-stage chain counters (organizations are shared across all stages).
export type StageOrganization = {
  id: string
  canonicalName: string
  aliases?: string[]
  region?: string
  uscc?: string
  status: string
  defaultPolicyId?: string
  stage: string
  exploited: number
  sessions: number
  objectives: number
  artifacts: number
  tasks: number
}

// typedCall wraps execute() so the chain endpoints (whose OpenAPI response
// schemas are intentionally generic objects) resolve to concrete page/item
// shapes at the call site.
function typed<T>(operation: () => Promise<unknown>): Promise<T> {
  return execute(() => operation() as never) as unknown as Promise<T>
}

export const chainApi = {
  // --- Stage-scoped tasks (recon | exploit | objectives) ---
  stageTasks: (stage: Stage, query: StageQuery = {}) =>
    typed<StageTaskResult>(() =>
      client.GET('/{stage}/tasks', { params: { path: { stage }, query: query as never } }),
    ),
  createStageTask: (stage: Stage, body: Record<string, unknown>) =>
    typed<StageTaskResult>(() =>
      client.POST('/{stage}/tasks', { params: { path: { stage } }, body: body as never }),
    ),

  // --- Mode-scoped catalog (plan §7 / §9) ---
  stageOverview: (stage: Stage) =>
    typed<StageOverview>(() => client.GET('/{stage}/overview', { params: { path: { stage } } })),
  stageOrganizations: (stage: Stage, query: StageQuery = {}) =>
    typed<ChainPage<StageOrganization>>(() =>
      client.GET('/{stage}/organizations', { params: { path: { stage }, query: { query: query.query || query.q } as never } }),
    ),
  stageAssets: (stage: Stage, query: StageQuery = {}) =>
    typed<ChainPage<ChainAsset>>(() =>
      client.GET('/{stage}/assets', { params: { path: { stage }, query: query as never } }),
    ),
  stageFindings: (stage: Stage, query: StageQuery = {}) =>
    typed<ChainPage<ChainFinding>>(() =>
      client.GET('/{stage}/findings', { params: { path: { stage }, query: query as never } }),
    ),
  stageMonitors: (stage: Stage, query: StageQuery = {}) =>
    typed<ChainPage<ChainAutomationItem>>(() =>
      client.GET('/{stage}/monitors', { params: { path: { stage }, query: query as never } }),
    ),
  createStageMonitor: (stage: Stage, body: Record<string, unknown>) =>
    typed<ChainAutomationItem>(() =>
      client.POST('/{stage}/monitors', { params: { path: { stage } }, body: body as never }),
    ),
  stageSchedules: (stage: Stage, query: StageQuery = {}) =>
    typed<ChainPage<ChainAutomationItem>>(() =>
      client.GET('/{stage}/schedules', { params: { path: { stage }, query: query as never } }),
    ),
  createStageSchedule: (stage: Stage, body: Record<string, unknown>) =>
    typed<ChainAutomationItem>(() =>
      client.POST('/{stage}/schedules', { params: { path: { stage } }, body: body as never }),
    ),
  stagePolicies: (stage: Stage) =>
    typed<{ items: ChainAutomationItem[]; stage: string }>(() =>
      client.GET('/{stage}/policies', { params: { path: { stage } } }),
    ),
  createStagePolicy: (stage: Stage, body: Record<string, unknown>) =>
    typed<ChainAutomationItem>(() =>
      client.POST('/{stage}/policies', { params: { path: { stage } }, body: body as never }),
    ),
  stageGroups: (stage: Stage, query: StageQuery = {}) =>
    typed<ChainPage<ChainAutomationItem>>(() =>
      client.GET('/{stage}/groups', { params: { path: { stage }, query: query as never } }),
    ),
  createStageGroup: (stage: Stage, body: Record<string, unknown>) =>
    typed<ChainAutomationItem>(() =>
      client.POST('/{stage}/groups', { params: { path: { stage } }, body: body as never }),
    ),

  // --- Exploit stage ---
  sessions: (query: StageQuery = {}) =>
    typed<ChainPage<ShellSession>>(() => client.GET('/exploit/sessions', { params: { query: query as never } })),
  session: (id: string) =>
    typed<ShellSession>(() => client.GET('/exploit/sessions/{id}', { params: { path: { id } } })),
  closeSession: (id: string) =>
    typed<{ id: string; state: string }>(() =>
      client.POST('/exploit/sessions/{id}/close', { params: { path: { id } } as never, body: {} as never }),
    ),
  reigniteSession: (id: string) =>
    typed<ShellSession>(() =>
      client.POST('/exploit/sessions/{id}/reignite', { params: { path: { id } } as never, body: {} as never }),
    ),
  sessionCommands: (id: string, query: StageQuery = {}) =>
    typed<ChainPage<ShellCommand>>(() =>
      client.GET('/exploit/sessions/{id}/commands', { params: { path: { id }, query: query as never } }),
    ),
  runSessionCommand: (id: string, command: string) =>
    typed<ShellCommand>(() =>
      client.POST('/exploit/sessions/{id}/commands', { params: { path: { id } }, body: { command } }),
    ),
  exploitedAssets: (query: StageQuery = {}) =>
    typed<ChainPage<ChainAsset>>(() => client.GET('/exploit/assets', { params: { query: query as never } })),
  exploitPlugins: () =>
    typed<ChainPage<ChainPlugin>>(() => client.GET('/exploit/plugins')),

  // --- Objectives stage ---
  objectives: (query: StageQuery = {}) =>
    typed<ChainPage<Objective>>(() => client.GET('/objectives/list', { params: { query: query as never } })),
  objective: (id: string) =>
    typed<Objective>(() => client.GET('/objectives/{id}', { params: { path: { id } } })),
  updateObjectiveStatus: (id: string, status: string) =>
    typed<{ id: string; status: string }>(() =>
      client.PATCH('/objectives/{id}/status', { params: { path: { id } }, body: { status } }),
    ),
  objectiveActions: (id: string, query: StageQuery = {}) =>
    typed<ChainPage<ObjectiveAction>>(() =>
      client.GET('/objectives/{id}/actions', { params: { path: { id }, query: query as never } }),
    ),
  addObjectiveAction: (id: string, body: { kind: string; payload: string; result?: string }) =>
    typed<ObjectiveAction>(() =>
      client.POST('/objectives/{id}/actions', { params: { path: { id } }, body: body as never }),
    ),
  artifacts: (query: StageQuery = {}) =>
    typed<ChainPage<Artifact>>(() =>
      client.GET('/objectives/artifacts/list', { params: { query: query as never } }),
    ),
  artifact: (id: string) =>
    typed<Artifact>(() => client.GET('/objectives/artifacts/{id}', { params: { path: { id } } })),
  objectivePlugins: () =>
    typed<ChainPage<ChainPlugin>>(() => client.GET('/objectives/plugins/list')),

  // --- Governance ---
  advanceStage: (id: string, body: { fromStage?: string; toStage?: string } = {}) =>
    typed<AdvanceResult>(() =>
      client.POST('/organizations/{id}/advance-stage', { params: { path: { id } }, body: body as never }),
    ),
}
