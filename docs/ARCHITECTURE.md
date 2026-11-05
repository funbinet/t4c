# Architecture

## Runtime topology

T4C runs as one native `t4c all` process backed by PostgreSQL and Redis. It
serves the embedded SPA and API, consumes Redis Streams, runs the PostgreSQL
scheduler lease and projects the graph outbox. If the worker loop or HTTP server
fails, the process exits non-zero so systemd can restart it. Docker is optional
and carries only PostgreSQL and Redis. Neo4j, ICP_Query and GeoIP are external
integrations, not part of the default Compose stack.

## Module boundaries

| Package                       | Responsibility                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `internal/modules/discovery`  | Target parsing and ProjectDiscovery SDK adapters for DNS, passive sources, ports, TLS and HTTP                  |
| `internal/modules/webintel`   | Fingerprints, WIH, file leaks, katana crawling, screenshots and nuclei SDK results                              |
| `internal/modules/poc`        | Go plugin registry, HTTP/TCP/sniffer/brute plugins                                                              |
| `internal/modules/tasking`    | Task state machine, steps, outbox, worker handlers                                                              |
| `internal/modules/monitoring` | Monitors, schedules, leader lease                                                                               |
| `internal/modules/github`     | GitHub search and monitoring                                                                                    |
| `internal/modules/reporting`  | CSV/XLSX reports                                                                                                |
| `internal/store`              | PostgreSQL/GORM repositories, AutoMigrate and indexes                                                                                |
| `internal/platform`           | Config, logging, Redis Streams, auth primitives, network safety, notifications and ProjectDiscovery SDK helpers |
| `internal/modules/exploit`    | Exploit SDK plugin registry (10 built-in plugins) and HTTP helpers                                                                  |
| `internal/modules/objective`  | Objective SDK plugin registry (10 built-in plugins) and shell executor                                                                |

Modules share the domain model but do not reach into another module's private
helpers. Repository access is centralized in `internal/store`.

## Console

The embedded console lives in `web/` and is built with React, TypeScript, Vite,
Tailwind CSS, Radix/shadcn-style primitives, TanStack Query/Table and ECharts.
`make build` writes the Vite output to `internal/webui/dist` before compiling Go,
and `go:embed` places those files in the `t4c` binary. Node.js is build-time
only; the runtime serves `/`, hashed assets and SPA fallback directly from Go.
The checked-in OpenAPI document is the source for generated TypeScript types.
Shareable list filters and map/graph selection live in the URL; server state is
cached by TanStack Query. The console is organization-centric and exposes
overview, organizations, assets, findings and tasks as the primary path while
automation, intelligence and administration remain secondary navigation groups.

Since v3.5.0 the console is also **stage-aware**. `web/src/app/mode.tsx` provides
`Stage`, `STAGES`, `STAGE_META`, `stageBase()`, `ModeProvider` and `useMode()`; the
active stage (`recon | exploit | objectives`) is resolved from the URL path and
persisted in local storage. A three-icon toggle switches stages, navigation is
stage-prefixed (`/exploit/*`, `/objectives/*`), and dedicated chain pages live in
`web/src/pages/chain/` with shared vocabulary in `chain-shared.tsx`. The typed
chain client (`web/src/api/chain.ts`) wraps `openapi-fetch` and defines explicit
domain types for records whose generated OpenAPI schemas predate the `Stage` and
`Exploited` columns. Chain-specific components (stage banner, shell console,
export drawer, objective workflow, produce breakdown) live in
`web/src/components/chain/` and `web/src/pages/chain/`.

## Scanner pipeline

```text
subfinder -> dnsx -> naabu -> tlsx
                    |
                    v
                  httpx
                    |
        +-----------+-----------+
        |           |           |
   fingerprints    WIH        katana
        |                       |
        +-----------+-----------+
                    |
                  nuclei
```

All scanner engines run in-process. The worker passes the task context through
the SDK adapters; no scanner executable is launched. `pdtools` maps the T4C
network policy onto ProjectDiscovery's network policy and redirects SDK logs
to the application's structured logger.

## Three-stage chain (v3.5.0)

```text
recon              exploit                objectives
(discover)   -->   (breach/validate)  -->  (collect produce)
   |                    |                       |
13 recon SDKs     10 exploit SDKs        10 objective SDKs
broaden (opt-in)  exploit / postex       probe
```

Organizations are **discovered once in recon** and shared across all stages;
there is no per-stage duplication of assets. A first-class `Stage`
(`internal/domain/stage.go`) is threaded through `Task`, `Finding`, `Asset`,
`Monitor`, `Schedule`, `Scope` and `SubmitInput`. `StageForTaskKind()` derives the
owning stage when a request omits it, and `stagePredicate()` treats legacy rows
with an empty `stage` column as recon-owned so historical data is retained.

**Domain and classification.** `AssetKind` now covers `bucket`,
`api_endpoint`, `credential`, `password`, `session`, `certificate`, `file`,
`site`, `url`, `cidr` and the derived `exploited` state; `Asset.Confidence`,
`Asset.Exploited` and `Asset.ExploitedAt` were added. Exploit/objectives asset
views filter `exploited = true`. `internal/domain/exploit.go` and
`objective.go` add `ShellSession`, `ShellCommand`, `Artifact`, `Objective` and
`ObjectiveAction` (plus `ObjectiveKind`: `shell`, `download`, `probe`, `loot`,
`flag`).

**SDK registries.** `internal/modules/exploit` and `internal/modules/objective`
each expose `Register`, `Registry`, `Find`, `PluginsByType` and `Counts`, with
10 built-in plugins apiece. Recon exposes 13 SDKs from a static registry in
`internal/httpapi/stage_api.go` (seven original adapters plus six opt-in
broadeners: `ct`, `asn`, `dnszone`, `cloud`, `rdns`, `endpoints`). Contract tests
enforce ≥8 SDKs per stage, metadata completeness, idempotent registration and
registry isolation. Broadening is **off by default** and gated by
`TaskOptions.Broaden` / `PolicyConfig.Broaden`.

**Engine and queues.** `StepPlan` gained `broaden`, `exploit`, `postex` and
`probe` steps and new task kinds (`exploit`, `exploit_brute`, `exploit_inject`,
`objective`). `queueForStep` routes them to `q.discovery.broaden`,
`q.exploit.http`, `q.exploit.postex` and `q.objectives.probe`. Exploit steps flip
`Asset.Exploited`, open shell sessions, create objectives and write artifacts;
objective steps run the objective SDK plugins. Existing per-step timeouts and
the zombie reaper apply unchanged.

**REST surface.** `internal/httpapi/chain_api.go` and `stage_api.go` implement
generic stage-scoped endpoints (`/{stage}/tasks`, `/overview`, `/organizations`,
`/assets`, `/findings`, `/monitors`, `/schedules`, `/policies`, `/groups`) plus
dedicated exploit (sessions, commands, reignite, exploited assets, plugins) and
objectives (list, summary, status, actions, artifacts, downloads, plugins)
routes. `parseStage` validates the path stage. `GET /objectives/summary`
computes produce analytics with grouped SQL in `internal/store/produce.go`
(`ProduceSummary`), honouring the soft-delete lifecycle and an optional
`organizationId` scope. The OpenAPI document (103 paths) is enforced by
contract tests so every route is documented with a unique operation ID.

**Governance and security.** `Organization.Stage` is the durable chain stage,
normalized in `Validate()` / `EffectiveStage()` and backfilled by `Migrate()`.
`GET /organizations/{id}/stage` exposes the current stage, allowed successor and
audit-derived transition history; `POST /organizations/{id}/advance-stage`
(`requireWrite`) validates the sequential `recon → exploit → objectives`
transition against the persisted stage, persists it with a compare-and-swap
guard in `internal/store/org_stage.go`, and is audit-logged. Conflicting or
skipped transitions map to `409` / `400` problems. `GET /{stage}/organizations`
reports each organization's real `currentStage` alongside the browsed stage, and
the console advances from the persisted stage rather than the active UI mode.
Artifact downloads are auth-gated, write a sanitized `Content-Disposition`, and
are never served from the SPA static path; `ShellCommand` and `ObjectiveAction`
writes are audited. `artifact` and `objective` participate in recoverable soft
deletion and appear in the Recycle Bin. Re-ignition reuses recorded non-secret
session metadata only.

## Task lifecycle

```text
POST /tasks
  -> tasks(status=queued)
  -> task_steps
  -> outbox
  -> Redis Streams
  -> worker executes one step
  -> task_events + observations/findings
  -> enqueue next step
  -> finalize(status=succeeded|partial|failed)
```

Optional steps (screenshots, WIH, file leak, PoC, nuclei) fail to `partial`
without aborting the task. Critical steps (target validation, DNS, HTTP,
statistics) fail the task.

## Assets

- `assets`: canonical `(kind, key)` rows with JSONB scan data.
- `asset_observations`: per-task snapshots for historical task views and reports.
- `scope_asset_links`: many-to-many membership with first/last seen and tags.
- Asset management metadata (`origin`, display name/URL, notes and tags) is separate
  from scan-owned `data`; user edits never rewrite scanner facts.

Canonical assets keep global search fast; observations preserve the exact
task result set and record the producing `engine`/`engineVersion`.

## Lifecycle and CRUD

Organizations, organization domains, assets, scopes, policies, monitors,
schedules, fingerprints, GitHub monitors, users, artifacts and objectives use
recoverable soft deletion. Normal reads, authentication, schedulers and
EASM/graph projections ignore rows with `deletedAt`; administrators restore
records from `/api/v1/recycle-bin`. Chain-stage artifacts and objectives were
added to `lifecycleResourceOrder`, so deleted produce stays recoverable and
delete operations record `chain.artifact_delete` / `chain.objective_delete`
audit events.

All delete and restore operations are audited. Policy deletion is blocked while
active monitors or unfinished schedules reference it, scope deletion is blocked
while active monitors reference it, and organization deletion is blocked while a
queued or running task belongs to it. Users cannot delete themselves or the last
active administrator, and deleting a user revokes all sessions.

Assets deleted manually stay hidden even if observations continue to arrive,
except that a later scan re-observing the same `(kind, key)` atomically restores
the canonical asset and records `restoreReason=scan_rediscovery`. Manual metadata
is preserved across that recovery.

## EASM

- `organizations`: canonical identity, aliases, region and external IDs.
- `organization_domains`: confirmed/candidate ICP ownership with source and confidence.
- `icp_evidence`: raw provider evidence; never contains cookies.
- `ip_locations`: offline GeoIP cache.
- `graph_outbox` + `icp_jobs`: graph projection and async ICP refresh.

The EASM surface is organization-first. `/easm` keeps the world map and graph
overview; `/easm/organizations` handles organization and domain review,
`/easm/organizations/:id` exposes assets, current findings, tasks and reports,
and `/easm/assets`, `/easm/findings`, `/easm/tasks` provide cross-organization
views. PostgreSQL remains the source of truth; Neo4j is rebuilt from the outbox
and `t4c graph rebuild` after storage migrations that change projection identifiers.

ICP attribution uses the Chinaz domain page plus its signed permit endpoint for
domain → organization. Organization → filed domains uses the external
ICP_Query sidecar (`icp.icpQuery.baseURL`). Optional EASM services are reached
through loopback ports when run with the infrastructure Compose overlay. Provider
credentials come from environment variables or read-only files and are never persisted.

## Queue topology

| Queue                 | Work                                                      |
| --------------------- | --------------------------------------------------------- |
| `q.discovery.dns`     | DNS and Fofa discovery                                    |
| `q.discovery.broaden` | Opt-in recon broadening (CT, ASN, DNS zone, cloud, rDNS, endpoints) |
| `q.discovery.network` | Port/TLS scanning                                         |
| `q.web.fetch`         | HTTP probing                                              |
| `q.web.scan`          | Fingerprints, WIH, spider, file leak, screenshots, nuclei |
| `q.poc.http`          | HTTP/brute checks                                         |
| `q.poc.service`       | Protocol sniffing                                         |
| `q.exploit.http`      | Exploit validation (`exploit` step)                       |
| `q.exploit.postex`    | Post-exploitation / session handling (`postex` step)      |
| `q.objectives.probe`  | Objective SDK probes (`probe` step)                       |
| `q.monitor`           | Monitoring work                                           |
| `q.github`            | GitHub jobs                                               |
| `q.icp`               | ICP organization refresh                                  |
| `q.maintenance`       | Statistics/export/maintenance                             |

Each queue is a Redis Stream named `t4c:jobs:<queue>` with consumer group
`t4c-workers`. Consumers use manual acknowledgement and remove acknowledged
entries. Failed jobs are delayed in `t4c:jobs:<queue>:retry` and published again
after 10 seconds; after three retries they move to
`t4c:jobs:<queue>:dlq`. Unacknowledged entries are reclaimed after two minutes
of inactivity, while active handlers refresh their lease every 30 seconds.

The outbox collection is the durable handoff; the relay republishes pending
messages. Redis must run with AOF persistence and `maxmemory-policy noeviction`
so queued jobs are not evicted.

## Security boundaries

- `netsafe` remains the source of truth for blocked CIDRs, private ranges,
  loopback and URL redirects.
- `pdtools` converts that policy into ProjectDiscovery `networkpolicy` options.
- nuclei disables code/file/headless protocols, local file access, interactsh
  and automatic upload/update checks by default.
- Scanner concurrency and response sizes are bounded by `scanners` config.
- Screenshot/export paths are validated against path traversal.
- Secrets are never logged; sensitive findings are masked at the UI boundary.
