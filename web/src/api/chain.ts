import type { components } from './schema'
import { client, execute } from './client'
import type { Stage } from '@/app/mode'

// Chain-stage domain types. The backend serialises these with camelCase JSON
// tags; the shapes are kept here so the exploit/objectives screens are fully
// typed without depending on generated response schemas for the new endpoints.
type Task = components['schemas']['Task']
type Asset = components['schemas']['Asset']

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
  page: number
  pageSize: number
}

export type StageTaskResult = {
  items: Task[]
  total: number
  page: number
  pageSize: number
  stage: string
}

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
}

// typedCall wraps execute() so the new chain endpoints (whose OpenAPI response
// schemas are intentionally generic objects) resolve to concrete page/item
// shapes at the call site. CSRF handling, 401 refresh, and error mapping all
// still flow through the shared client.
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
    typed<ChainPage<Asset>>(() => client.GET('/exploit/assets', { params: { query: query as never } })),
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
