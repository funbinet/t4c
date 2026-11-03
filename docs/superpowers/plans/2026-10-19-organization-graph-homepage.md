# Project-Level Asset Graph Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the T4C homepage into a project-level EASM workbench supporting batch project and organization management, domain ownership lookup, a Neo4j asset relationship graph, and GeoIP map interaction.

**Architecture:** MongoDB stores projects, organizations, domains, ownership evidence, tasks, observations, and findings; Neo4j idempotently projects asset relationships through a graph outbox. The frontend uses Vue 3 plus ECharts, sharing project, organization, risk, and time filters in a light workbench.

**Tech Stack:** Go 1.27, MongoDB 8, Neo4j 5.x, RabbitMQ, Vue 3, TypeScript, Pinia, ECharts, Vue ECharts, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-organization-graph-homepage-design.md`

## Global Constraints

- All new JSON/BSON fields use camelCase.
- `context.Context` must be the first parameter of every new service, provider, and repository method.
- MongoDB is the source of truth for projects, organizations, ownership evidence, tasks, observations, and findings.
- Neo4j may only be a rebuildable projection and must never become a blocking dependency for scan writes.
- All graph/map/search queries must carry projectId, and the server must validate that the project exists.
- The Chinaz cookie/API key may only be read from environment variables or read-only files, and must never enter the frontend, database, audit details, or ordinary logs.
- External provider requests may only use fixed URLs and fixed paths; users may not control the target URL.
- Do not implement captcha bypass, signature forgery, or high-frequency scraping.
- The map displays IP geolocation; CDN edge IPs, origin candidates, direct asset IPs, and unlocated assets must remain distinct.
- The homepage uses Option A: light, restrained, a single accent color, thin borders, no gradient glow, and no decorative animation.
- Do not add a separate wallboard page.
- Keep the existing Scope as a Legacy asset group; do not automatically convert it into a Project.
- v1 uses the existing global RBAC and does not add project-level member permissions; projectId is only used for query isolation and UI context.
- Organization ownership must not be confirmed automatically; candidate results must remain pending until an operator confirms or rejects them.
- After each task, commit only the files for that task, not unrelated pre-existing changes.

## Review Focus

- When a provider cookie/API key expires or is rate limited, CSV import and asset discovery must still complete ingestion, and ownership enters a retryable pending state.
- When the same asset is discovered by multiple projects, project A's graph and map must not leak project B's edges, findings, domains, or organizations.
- Private IPs, CDN edge IPs, origin candidates, and ordinary asset IPs must not be confused in the data model or UI.
- Large projects (100 organizations, 300 root domains, thousands of assets) must not return the complete graph at once; results must be aggregated, truncated, and expandable.
- When Neo4j, GeoIP, or a provider is unavailable, the homepage must still show a usable organization list and error state, never a blank screen.

## Task 1: Project and organization domain model and MongoDB storage

**Files:**
- Create: `internal/domain/projects.go`
- Modify: `internal/domain/models.go`
- Modify: `internal/store/store.go`
- Create: `internal/store/projects.go`
- Create: `internal/domain/projects_test.go`
- Create: `internal/store/projects_integration_test.go`

**Interfaces:**
- Produces `domain.Project`, `Organization`, `ProjectOrganization`, `ProjectDomain`, `OrganizationAttribution`, `IPLocation`.
- Produces store methods: `CreateProject`, `GetProject`, `ListProjects`, `UpsertOrganization`, `GetOrganizationByLegalName`, `AddOrganizationToProject`, `ListProjectOrganizations`, `AddProjectDomain`, `ListProjectDomains`, `AddAttribution`, `ListAttributions`, `ConfirmAttribution`, `RejectAttribution`, `UpsertIPLocation`, `GetIPLocation`.

- [ ] **Step 1: Write failing tests** in `internal/domain/projects_test.go`: `TestProjectValidateRejectsEmptyName`, `TestProjectDomainValidateRejectsInvalidDomain`, `TestAttributionStatusTransitions`.
- [ ] **Step 2: Run tests** `go test ./internal/domain -run 'TestProject|TestAttribution' -v`; expect FAIL.
- [ ] **Step 3: Add domain types** with the fields in the spec, all IDs as `bson.ObjectID`, timestamps as `time.Time` or `*time.Time`, plus validation methods.
- [ ] **Step 4: Add collections and indexes** in `internal/store/store.go`: `projects`, `organizations`, `project_organizations`, `project_domains`, `organization_attributions`, `ip_locations`; unique legal name, unique project/org, unique project/domain, unique IP.
- [ ] **Step 5: Implement repositories** in `internal/store/projects.go`; every create/upsert sets timestamps and `SchemaVersion`. `ConfirmAttribution` must be idempotent and only accept `pending`.
- [ ] **Step 6: Write and run Mongo integration tests** in `internal/store/projects_integration_test.go`; use `T4C_TEST_MONGO_URI`, skip when absent.
- [ ] **Step 7: Run** `T4C_TEST_MONGO_URI=mongodb://127.0.0.1:27017 go test ./internal/store -run 'TestProject|TestOrganization|TestAttribution' -v`; expect PASS or SKIP.
- [ ] **Step 8: Commit** `feat: add project and organization storage`.

## Task 2: CSV project import service

**Files:**
- Create: `internal/modules/projects/service.go`
- Create: `internal/modules/projects/import.go`
- Create: `internal/modules/projects/service_test.go`
- Modify: `internal/platform/netsafe/netsafe.go` only if a reusable domain validator is needed.

**Interfaces:**
- Produces `projects.ImportRow`, `projects.ImportResult`, `projects.Repository`, `projects.LookupScheduler`, and `projects.Service.ImportCSV(ctx, projectID, io.Reader) (ImportResult, error)`.
- `LookupScheduler.EnqueueLookup(ctx, projectID, domain) error` lets import enqueue attribution work without calling a supplier inline.
- `ImportResult` has `Organizations`, `Domains`, `QueuedLookups`, `Warnings`.

- [ ] **Step 1: Write failing tests** for multiple root domains, invalid domain rejection, idempotent import, and missing legal name producing a pending lookup.
- [ ] **Step 2: Run** `go test ./internal/modules/projects -run TestImportCSV -v`; expect FAIL.
- [ ] **Step 3: Implement CSV parsing** with `encoding/csv`, UTF-8 BOM handling, empty-line skipping, semicolon-separated domains, and `netsafe.ValidateDomain`.
- [ ] **Step 4: Implement repository-backed import** that upserts organizations, project membership, project domains, and pending attributions. If `LookupScheduler` is configured, enqueue pending lookups; do not call a supplier inline and do not start scan tasks during import.
- [ ] **Step 5: Run** `go test ./internal/modules/projects -v`; expect PASS.
- [ ] **Step 6: Commit** `feat: add CSV project import`.

## Task 3: Chinaz organization attribution provider

**Files:**
- Create: `internal/modules/orgintel/provider.go`
- Create: `internal/modules/orgintel/chinaz_api.go`
- Create: `internal/modules/orgintel/chinaz_page.go`
- Create: `internal/modules/orgintel/service.go`
- Create: `internal/modules/orgintel/chinaz_api_test.go`
- Create: `internal/modules/orgintel/chinaz_page_test.go`
- Create: `internal/modules/orgintel/testdata/guc.edu.cn.html`

**Interfaces:**
- `orgintel.Candidate` has `Name`, `Type`, `SiteLicense`, `ServiceLicense`, `VerifyTime`, `Source`, `Confidence`, `Raw`.
- `orgintel.Provider` has `Name() string` and `Lookup(ctx, domain string) ([]Candidate, error)`.
- `orgintel.Service.EnqueueLookup(ctx, projectID, domain string) (*domain.OrganizationAttribution, error)` creates a pending attribution and publishes a lookup job.
- `orgintel.Service.Process(ctx, attributionID bson.ObjectID) error` calls the provider chain and updates the attribution.
- `orgintel.Service.Lookup(ctx, domain string) ([]Candidate, error)` is the provider-facing method used by tests and `Process`.

- [ ] **Step 1: Write failing tests** for JSON mapping, upstream failure, GUC page fixture parsing, and pending attribution persistence.
- [ ] **Step 2: Run** `go test ./internal/modules/orgintel -v`; expect FAIL.
- [ ] **Step 3: Implement official JSON provider** using fixed `https://openapi.chinaz.net/v1/1001/newicp` with `domain`, `APIKey`, `ChinazVer=1.0`; map `CompanyName`, `CompanyType`, `SiteLicense`, `ServiceLicence`, `VerifyTime`; confidence `1.0`.
- [ ] **Step 4: Implement page fallback** using fixed `https://icp.chinaz.com/{domain}` and a configured Cookie; parse `#companyName`, the registering-organization type label, and the audit-time label; confidence `0.8`; never log the Cookie.
- [ ] **Step 5: Implement provider chain** API first, page fallback second; apply a per-domain cache TTL of 7 days and a per-provider minimum interval. `Process` updates pending attributions; on failure return a typed error and leave the attribution retryable. Add `q.orgintel` to `jobs.QueueNames` and enqueue lookup jobs.
- [ ] **Step 6: Run** `go test ./internal/modules/orgintel -v`; expect PASS.
- [ ] **Step 7: Commit** `feat: add chinaz organization attribution provider`.

## Task 4: Project, organization, and attribution lookup HTTP API

**Files:**
- Create: `internal/httpapi/projects.go`
- Create: `internal/httpapi/organization_lookup.go`
- Create: `internal/httpapi/projects_test.go`
- Modify: `internal/httpapi/server.go`
- Modify: `internal/httpapi/openapi.go`
- Modify: `internal/app/app.go`

**Interfaces:**
- Routes: `GET/POST /projects`, `GET/PATCH /projects/{id}`, `POST /projects/{id}/organizations/import`, `GET /projects/{id}/organizations`, `POST /organizations/lookup`, `GET /organizations/{id}/attributions/{attributionId}`, `POST .../confirm`, `POST .../reject`.
- `POST /organizations/lookup` returns HTTP 202 with `{attributionId, status: "pending"}` unless a cached confirmed result exists.
- Uses `projects.Service` and `orgintel.Service`.

- [ ] **Step 1: Write failing handler tests** for write permission, pagination, lookup source, confirm authorization, and invalid CSV.
- [ ] **Step 2: Run** `go test ./internal/httpapi -run 'TestProject|TestLookup|TestConfirm|TestImport' -v`; expect FAIL.
- [ ] **Step 3: Implement handlers and DTOs**; all responses use `{ "data": ... }`, errors use `httpx.WriteProblem`.
- [ ] **Step 4: Wire services** into `httpapi.Server` and `app.New`; register routes before the SPA fallback.
- [ ] **Step 5: Update OpenAPI** path summaries; do not expose raw attribution in list DTOs.
- [ ] **Step 6: Run** `go test ./internal/httpapi -v`; expect PASS.
- [ ] **Step 7: Commit** `feat: expose project and organization lookup APIs`.

## Task 5: GeoIP location resolution

**Files:**
- Create: `internal/platform/geoip/resolver.go`
- Create: `internal/platform/geoip/maxmind.go`
- Create: `internal/platform/geoip/resolver_test.go`
- Modify: `internal/platform/config/config.go`
- Modify: `internal/app/app.go`

**Interfaces:**
- `geoip.Location` has country, province, city, latitude, longitude, ASN, ASN org, source, confidence.
- `geoip.Resolver` has `Lookup(ctx, netip.Addr) (*Location, error)` and `Health(ctx) error`.
- `geoip.NewMaxMindResolver(cityPath, asnPath string) (*MaxMindResolver, error)`.

- [ ] **Step 1: Write failing tests** for invalid IP, private IP returning nil, normalization, and missing database health.
- [ ] **Step 2: Run** `go test ./internal/platform/geoip -v`; expect FAIL.
- [ ] **Step 3: Add `geoip.enabled` config** and initialize the resolver in `app.New`; a missing database is a warning, not startup failure.
- [ ] **Step 4: Implement resolver** with injectable readers; private, loopback, link-local, and reserved addresses return `nil, nil`.
- [ ] **Step 5: Persist through `store.UpsertIPLocation`**; keep the IP as the unique key.
- [ ] **Step 6: Run** `go test ./internal/platform/geoip ./internal/platform/config -v`; expect PASS.
- [ ] **Step 7: Commit** `feat: add offline geoip resolver`.

## Task 6: Neo4j client, graph outbox, and projector

**Files:**
- Create: `internal/platform/graphdb/client.go`
- Create: `internal/platform/graphdb/schema.go`
- Create: `internal/modules/graph/projector.go`
- Create: `internal/modules/graph/events.go`
- Create: `internal/modules/graph/projector_test.go`
- Modify: `internal/platform/config/config.go`
- Modify: `internal/platform/jobs/jobs.go`
- Modify: `internal/store/inventory.go`
- Modify: `internal/app/app.go`
- Modify: `cmd/t4c/main.go`

**Interfaces:**
- Adds `neo4j` config block and `q.graph` queue.
- `graph.Event` has `Type`, `AssetID`, `TaskID`, `ProjectID`, `OrganizationID`, `Domain`, `OccurredAt`.
- `graph.Projector.HandleDelivery`, `Rebuild`, `Health`.

- [ ] **Step 1: Write failing tests** for idempotent upsert, unknown task, event payload shape, and schema constraints; fake the graph store.
- [ ] **Step 2: Run** `go test ./internal/modules/graph ./internal/platform/graphdb -v`; expect FAIL.
- [ ] **Step 3: Add config and queue** with `T4C_NEO4J_*` environment overrides and `q.graph` in `jobs.QueueNames`.
- [ ] **Step 4: Emit outbox events** from asset/finding/attribution writes; payload contains IDs and stable keys only, never raw evidence.
- [ ] **Step 5: Implement projector** using `MERGE` on stable IDs and project membership; read task/project context from Mongo. Neo4j failure is non-blocking and retryable.
- [ ] **Step 6: Wire worker and all-in-one mode** so `q.graph` goes to the projector and `q.orgintel` goes to the attribution processor; add `t4c graph rebuild` reading from Mongo.
- [ ] **Step 7: Run** `go test ./internal/modules/graph ./internal/platform/graphdb ./internal/store -v`; expect PASS or SKIP.
- [ ] **Step 8: Commit** `feat: project graph events into neo4j`.

## Task 7: Graph, map, and project event API

**Files:**
- Create: `internal/httpapi/graph.go`
- Create: `internal/httpapi/graph_test.go`
- Modify: `internal/httpapi/server.go`
- Modify: `internal/httpapi/openapi.go`
- Create: `internal/modules/graph/query.go`

**Interfaces:**
- Routes: `GET /projects/{id}/graph`, `GET /projects/{id}/map`, `GET /projects/{id}/events`.
- Graph DTO: `nodes`, `edges`, `truncated`, `aggregated`, `limit`.
- Map DTO: `points`, `clusters`, `unlocatedCount`.

- [ ] **Step 1: Write failing tests** for unknown project, limit truncation, private IP exclusion, project isolation, and project event payload.
- [ ] **Step 2: Run** `go test ./internal/httpapi -run 'TestGraph|TestMap|TestProjectIsolation' -v`; expect FAIL.
- [ ] **Step 3: Implement query options** `focus`, `depth`, `types`, `risk`, `limit`; default 300, max 500.
- [ ] **Step 4: Implement Cypher** starting from the requested Project; never start from a global asset. Aggregate map by city/country.
- [ ] **Step 5: Implement project SSE** with no raw evidence or credentials.
- [ ] **Step 6: Run** `go test ./internal/httpapi -v`; expect PASS.
- [ ] **Step 7: Commit** `feat: expose project graph and map APIs`.

## Task 8: Task project context

**Files:**
- Modify: `internal/domain/models.go`
- Modify: `internal/modules/tasking/engine.go`
- Modify: `internal/httpapi/tasks.go`
- Modify: `internal/store/tasks.go`
- Create/modify: `internal/modules/tasking/engine_test.go`

**Interfaces:**
- Adds optional `ProjectID`, `OrganizationID`, `RootDomainID` to Task.
- `POST /tasks` accepts these fields; `ListTasks` filters by projectId.

- [ ] **Step 1: Write failing tests** for project persistence, project filtering, unknown project rejection, and legacy scope compatibility.
- [ ] **Step 2: Run** `go test ./internal/modules/tasking ./internal/store ./internal/httpapi -run 'TestTask.*Project|TestTask.*Legacy' -v`; expect FAIL.
- [ ] **Step 3: Add fields and store filters**; old tasks remain readable.
- [ ] **Step 4: Update task API** and validate project existence before submit.
- [ ] **Step 5: Run** `go test ./internal/modules/tasking ./internal/store ./internal/httpapi -v`; expect PASS.
- [ ] **Step 6: Commit** `feat: add project context to tasks`.

## Task 9: Frontend design tokens and authentication shell

**Files:**
- Modify: `web/src/styles.css`
- Modify: `web/src/layouts/AppLayout.vue`
- Modify: `web/src/router.ts`
- Modify: `web/src/pages/LoginPage.vue`
- Create: `web/src/pages/ProjectHomePage.vue`
- Create: `web/src/layouts/AppLayout.test.ts`

**Interfaces:**
- Adds route `/projects/:projectId`; `/` redirects to the last project or the projects list; `/dashboard` redirects to `/`.
- Adds light design tokens: `--t4c-bg`, `--t4c-surface`, `--t4c-text`, `--t4c-muted`, `--t4c-border`, `--t4c-accent`, risk colors.

- [ ] **Step 1: Write failing tests** for project context rendering, navigation, and root redirect.
- [ ] **Step 2: Run** `cd web && npx vitest run src/layouts/AppLayout.test.ts`; expect FAIL.
- [ ] **Step 3: Add design tokens** and convert the shell to a light, narrow, collapsible layout.
- [ ] **Step 4: Add project route** and redirect the legacy dashboard.
- [ ] **Step 5: Run** `cd web && npx vitest run src/layouts/AppLayout.test.ts && npm run typecheck`; expect PASS.
- [ ] **Step 6: Commit** `feat: add light console shell and project route`.

## Task 10: Frontend project state and typed API

**Files:**
- Create: `web/src/api/projects.ts`
- Create: `web/src/types/graph.ts`
- Create: `web/src/stores/project.ts`
- Create: `web/src/stores/project.test.ts`
- Create: `web/vitest.config.ts`

**Interfaces:**
- Types: `Project`, `Organization`, `GraphNode`, `GraphEdge`, `MapPoint`, `MapCluster`.
- API: `fetchProjects`, `createProject`, `importOrganizations`, `lookupDomain`, `fetchAttribution`, `fetchProjectGraph`, `fetchProjectMap`.
- Store: `currentProjectId`, `selectedNodeId`, `filters`, `setFilter`, `selectNode`; default filters `{ risk: "high", kind: "all", timeRange: "30d", mapScope: "china" }`.

- [ ] **Step 1: Write failing tests** for default filters, graph/map filter sync, project reset, and problem code preservation.
- [ ] **Step 2: Run** `cd web && npx vitest run src/stores/project.test.ts`; expect FAIL.
- [ ] **Step 3: Implement typed API and store** using existing `api<T>()`; never include provider credentials.
- [ ] **Step 4: Run** `cd web && npx vitest run src/stores/project.test.ts && npm run typecheck`; expect PASS.
- [ ] **Step 5: Commit** `feat: add typed project store and api`.

## Task 11: Graph and map components

**Files:**
- Modify: `web/package.json`
- Modify: `web/package-lock.json`
- Create: `web/src/components/graph/AssetGraph.vue`
- Create: `web/src/components/graph/AssetGraph.test.ts`
- Create: `web/src/components/map/AssetMap.vue`
- Create: `web/src/components/map/AssetMap.test.ts`
- Create: `web/src/assets/maps/china.json`
- Create: `web/src/assets/maps/world.json`

**Interfaces:**
- `AssetGraph` props `nodes`, `edges`, `selectedId`, `loading`; emits `select`, `expand`, `filter`.
- `AssetMap` props `points`, `clusters`, `scope`, `selectedId`; emits `select`, `region`, `scopeChange`.

- [ ] **Step 1: Install** `cd web && npm install echarts vue-echarts`.
- [ ] **Step 2: Write failing tests** for node selection, legend, China/world switch, region selection, and unlocated count. Mock ECharts.
- [ ] **Step 3: Implement graph** with labels only for selected/unit/domain nodes; risk colors only for risk; empty state.
- [ ] **Step 4: Implement map** with geo series; point kinds `asset`, `edge`, `origin`; no point for private IP; missing GeoIP adds to unlocated count.
- [ ] **Step 5: Document GeoJSON source/license** in `docs/ARCHITECTURE.md`; commit only licensed map data.
- [ ] **Step 6: Run** `cd web && npx vitest run src/components/graph src/components/map && npm run typecheck`; expect PASS.
- [ ] **Step 7: Commit** `feat: add asset graph and map components`.

## Task 12: Homepage composition, project import, and domain lookup

**Files:**
- Modify: `web/src/pages/ProjectHomePage.vue`
- Create: `web/src/components/project/ProjectSwitcher.vue`
- Create: `web/src/components/project/ProjectImportDialog.vue`
- Create: `web/src/components/project/DomainLookupDialog.vue`
- Create: `web/src/components/project/AssetInspector.vue`
- Create: `web/src/pages/ProjectHomePage.test.ts`
- Modify: `web/src/pages/DashboardPage.vue` to redirect or remove.

**Interfaces:**
- Project homepage consumes Task 10/11. No separate wallboard.
- Layout: top project/search/actions, left organizations, center graph, right map/inspector/events, bottom event strip.

- [ ] **Step 1: Write failing tests** for project context, lookup candidate, import refresh, graph inspector, map filter, and Neo4j unavailable banner.
- [ ] **Step 2: Run** `cd web && npx vitest run src/pages/ProjectHomePage.test.ts`; expect FAIL.
- [ ] **Step 3: Build the layout** with small text summaries, not metric-card grids.
- [ ] **Step 4: Implement import/lookup** with CSV warnings, source/confidence, confirm/reject, and list refresh. Lookup returns pending, then polls `fetchAttribution` every 2 seconds for up to 60 seconds; show timeout and retry state.
- [ ] **Step 5: Implement degraded states** for no project, no GeoIP, and Neo4j down.
- [ ] **Step 6: Run** `cd web && npx vitest run src/pages/ProjectHomePage.test.ts && npm run typecheck && npm run build`; expect PASS.
- [ ] **Step 7: Commit** `feat: build project asset graph homepage`.

## Task 13: Deployment, migration, diagnostics, and E2E

**Files:**
- Modify: `deploy/compose.yaml`
- Modify: `deploy/config.docker.yaml`
- Modify: `config.example.yaml`
- Modify: `internal/platform/config/config.go`
- Modify: `cmd/t4c/main.go`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PARITY.md`
- Create: `web/e2e/home.spec.ts`
- Modify: `web/e2e/support.ts`
- Modify: `web/e2e/console.spec.ts`

- [ ] **Step 1: Add Neo4j compose service** with a pinned 5.x image, volume, auth, ports 7474/7687, and healthcheck.
- [ ] **Step 2: Add config and doctor checks** for Neo4j, GeoIP files, and Chinaz configured/missing status; never print secret values.
- [ ] **Step 3: Add E2E** for login, project creation, CSV import, `guc.edu.cn -> Sichuan Jili University`, confirm, graph selection, map filter, and degraded banner; use API fixtures and no real Chinaz network.
- [ ] **Step 4: Update existing E2E expectations** from `/dashboard` to project home.
- [ ] **Step 5: Run backend verification** `go test ./...`, `go test -race ./...`, `go vet ./...`.
- [ ] **Step 6: Run frontend verification** `cd web && npm run typecheck && npm run build && npx vitest run`.
- [ ] **Step 7: Run integration** with `T4C_TEST_MONGO_URI` and `T4C_TEST_NEO4J_URI`.
- [ ] **Step 8: Run E2E** with `E2E_PASSWORD`; do not output secrets.
- [ ] **Step 9: Commit** `feat: deploy project graph homepage`.

## Self-Review

- Spec coverage: project/organization model, CSV import, Chinaz provider, graph/map API, GeoIP, Neo4j projection, homepage Option A, legacy Scope, security, fallback, and tests all have tasks.
- Type consistency: projectId is a string at API/JS boundaries and bson.ObjectID in the Mongo domain; graph/map DTOs use string IDs.
- Review Focus tests are assigned to Tasks 3, 7, 11, and 12.
- Plan scope: individual legacy pages are not restyled beyond the shared shell; they follow after homepage parity.
