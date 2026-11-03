# Project-Level Asset Graph Homepage Design

## 1. Summary

T4C's interface is changing from a generic asset-management backend to an EASM workbench for red-team projects. The homepage is not a separate situational wallboard but the project workspace users enter directly after login: projects, organizations, root domains, subdomains, IPs, services, findings, and evidence form one continuous data chain, and the asset graph and geographic distribution share filter and selection state.

The visual direction uses the confirmed Option A: light, restrained, a single dark accent color, thin borders, and low noise. The homepage must simultaneously satisfy "know the project situation as soon as it opens" and "start analysis and batch operations as soon as it opens".

The core changes in this design are not only UI:

- Add first-class Project and Organization models.
- Introduce Neo4j as the query and projection layer for asset relationships.
- Introduce organization ownership lookup and GeoIP geographic enrichment.
- Reorganize the homepage into a graph main canvas plus map slice, rather than a stack of metric cards.
- Reserve full expression for future CDN edge nodes and origin-candidate relationships.

## 2. Why Now

The existing console is a generic backend structure: left-side module navigation, a top title, tables, and JSON fields. It cannot express the three most important things in red-team work:

1. An exercise project contains many organizations, and organizations and root domains need batch management.
2. Assets are not isolated records but a relationship network: "an organization owns a domain, the domain resolves to an IP, the IP exposes a service, and the service is associated with a finding."
3. Users need to see relationships, geographic distribution, and evidence sources at the same time and move directly to the next action from the same screen.

The existing `Scope` is only an asset group and cannot express projects, organizations, domain ownership, or scan coverage. Assets are currently stored flat by `(kind, key)` and lack explicit DNS, hosting, certificate, CDN, and finding ownership relationships. GeoIP configuration exists, but `geoCity` / `geoAsn` are not actually populated yet. Therefore the map and relationship graph cannot be assembled by the frontend alone.

## 3. Goals and Non-Goals

### Goals

- Users can create a project, for example "2025 Sichuan Province Attack-Defense Exercise", and batch import 100 organizations and their root domains.
- When a user enters a domain, they can reverse-look-up the registrant and see the source, time, raw result, and confidence.
- The homepage displays the current project's organization coverage, asset relationships, geographic distribution, and high-risk events.
- The graph and map share filters: selecting a map region filters the graph, and selecting a graph node locates the map position.
- Users can start batch scans directly from the organization page, view task status, and view evidence and asset details.
- Organization ownership results can be manually confirmed, rejected, or alias-merged; they must not be written into facts without a trace.
- Neo4j can be rebuilt without blocking the main business; MongoDB still stores raw observations, tasks, audits, and evidence.

### Non-Goals

- No automatic exploitation platform.
- Do not depend on page scraping or captcha bypass as the only data source.
- No separate situational wallboard page; the homepage is the situational page.
- Do not implement cross-tenant SaaS billing, a complex organization permission model, or complete attack-path inference in v1.
- Do not put raw observations and full HTTP responses into Neo4j.
- Do not introduce 3D globes, neon effects, or meaningless animation for a visual "tech" feel.

### Anti-Goals

- The map is only decorative, cannot filter, and cannot answer any judgment.
- The graph renders thousands of nodes and labels at once, making it unreadable.
- Ownership is automatically attributed to the wrong organization with no source and no manual correction path.
- CDN edge nodes are treated as the real asset location.
- The homepage still puts the task list or metric cards first visually.
- Writing to both Mongo and Neo4j without a rebuild and reconciliation mechanism.

## 4. User Workflows

### 4.1 Create a Project and Import Organizations

1. Create a project, filling in the project name, customer or owner, start/end time, and description.
2. Upload a CSV whose fields include at least organization name and root domain; root domains may be separated by semicolons.
3. The system establishes project membership for organizations and root domains.
4. For domains without a clear organization, start an organization ownership lookup; the result enters pending or auto-confirmed status.
5. Users can batch-start scan tasks for organizations or root domains.

### 4.2 Reverse-Look-Up the Organization for a Domain

1. Enter a domain in the global search box.
2. The system returns candidate organizations, source, match time, and confidence.
3. After the user confirms, the domain and organization establish an `OWNS` relationship; if rejected, the lookup record is kept but no factual relationship is established.
4. One organization may have multiple aliases and multiple root domains; legal names and display names are stored separately.

### 4.3 Homepage Analysis

1. After login, enter the last project or show the project selection page.
2. The homepage shows the graph main canvas, map slice, organization coverage, real-time discoveries, and current project context.
3. Clicking a city on the map keeps only that city's assets; clicking a graph node locates the corresponding map position.
4. Open the right-side inspector to view evidence, ownership, scan tasks, and asset details.
5. After selecting a batch of organizations or domains, directly submit batch scans or exports.

## 5. Information Architecture

```text
Project
  -> Organization
    -> Root Domain
      -> Domain (subdomain)
        -> IP
          -> Service
          -> Site
            -> URL
        -> CDN Provider / Edge IP
        -> Origin Candidate
    -> Certificate
    -> Finding
    -> Attribution Evidence
    -> Scan Task
```

The project is the default context, the organization is the ownership layer, the root domain is the batch-operation boundary, the graph is the relationship query layer, and evidence is stored in MongoDB.

## 6. Homepage Design (Option A)

### 6.1 Layout

- Top: project selection, global search, current project risk summary, and batch-operation entry.
- Left: project switcher, organization list, organization risk markers, and asset coverage summary.
- Center: asset relationship canvas supporting filtering, zooming, expansion by organization, and highlighting by risk.
- Right: geographic distribution map, current node inspector, and real-time discovery events.
- Bottom: lightweight event stream, not a separate wallboard.

### 6.2 Visual Constraints

- Background: light gray-white; content panels white; low-contrast borders.
- Primary text: dark gray-blue; secondary text: neutral gray.
- Accent color: dark blue-gray, used only for interaction and selected states.
- Risk colors: red, orange, blue; risk colors are used only for risk and severity, never for decoration.
- Chart nodes: at most five categories—organization, domain, IP, service, and finding; other nodes degrade to small dots or hide their labels.
- Font sizes, spacing, and borders uniformly use an 8px grid and fixed design tokens.
- No gradient glow, particle backgrounds, 3D globes, or decorative animation.

### 6.3 Graph Interaction

- By default, show only the current project's high-risk organizations, root domains, and directly related nodes.
- Return at most 300 to 500 nodes initially; when exceeded, aggregate by organization or domain and let users expand on demand.
- When an organization or domain is selected, the right-side inspector shows a relationship summary and evidence entry points.
- Support filtering by organization, domain, IP, risk, CDN, origin candidate, and recent change.
- Graph nodes and map points use the same selection store; filter conditions are shared.

### 6.4 Map Interaction

- The China map is the default view, with a world map switch.
- Asset points are shown by IP geolocation; an organization's registered address is not shown in place of asset location.
- Point types distinguish at least: asset IP, CDN edge node, origin candidate, and unlocated asset.
- The map uses clustering to avoid overlapping points; clicking a cluster expands or filters the graph.
- Private addresses and assets without GeoIP results go into the "unlocated" count and are not given fake positions on the map.
- The map and graph must share the same project, organization, risk, and time filters.

### 6.5 Empty and Error States

- No project: show a guide to create or import a project.
- No organizations in the project: show a CSV import entry and sample format.
- Organization ownership lookup in progress: show pending without blocking assets and tasks.
- Neo4j unavailable: the homepage degrades to organization and asset lists, displays "relationship graph temporarily unavailable", and does not block existing tasks and scans.
- GeoIP unavailable: the map displays "geographic data unavailable", while the graph and lists work normally.
- External ownership service unavailable: keep the pending lookup queue and allow retries and manual confirmation.

## 7. Domain Model

### 7.1 New Collections in MongoDB

- `projects`: project metadata, status, start/end time, description, creator.
- `project_organizations`: project-to-organization relationship, display name within the project, ordering, notes, and coverage status.
- `organizations`: canonical organization identity, legal name, aliases, type, Unified Social Credit Code, or ICP registrant information.
- `organization_attributions`: candidate domain-to-organization ownership, source, raw response, confidence, confirmation status, and lookup time.
- `project_domains`: root domains within a project, owning organization, import source, and enabled status.
- `ip_locations`: IP geolocation, country, province, city, latitude/longitude, ASN, data source, and update time.

Existing `assets`, `asset_observations`, `findings`, `tasks`, and `task_events` are retained. Tasks gain optional `projectId`, `organizationId`, and `rootDomainId` fields.

### 7.2 Relationship Semantics

- `Project -[:CONTAINS]-> Organization`
- `Organization -[:OWNS]-> Domain`, established only for explicitly confirmed root domains
- `Domain -[:SUBDOMAIN_OF]-> Domain`
- `Domain -[:RESOLVES_TO]-> IP`
- `Domain -[:USES_CDN]-> CDNProvider`
- `Domain -[:HAS_EDGE_IP]-> IP`
- `Domain -[:ORIGIN_CANDIDATE]-> IP`
- `IP -[:EXPOSES]-> Service`
- `IP -[:HOSTS]-> Site`
- `Site -[:SERVES]-> URL`
- `Certificate -[:COVERS]-> Domain`
- `Finding -[:FOUND_ON]-> Asset`
- `Task -[:DISCOVERED]-> Asset`
- `Attribution -[:CONFIRMS_OWNER]-> Organization`

Edge properties include at least `source`, `confidence`, `firstSeen`, `lastSeen`, and `projectId` (when project isolation is needed). Raw observations do not enter the graph; they are linked only by MongoDB id.

### 7.3 Project Isolation

- Asset nodes may be reused by multiple projects to avoid storing the same IP or domain repeatedly.
- Project visibility is guaranteed by both project membership edges and query conditions.
- All graph, map, search, and detail endpoints must carry the current projectId, and the server must validate project access permission.
- The frontend must not be able to read another project's relationships by changing projectId.

## 8. Neo4j Architecture

- Neo4j is the relationship query layer and visualization projection, not the source of truth for raw evidence.
- MongoDB is the source of truth for tasks, observations, findings, audits, and attribution.
- After assets and findings are written to Mongo, a graph outbox event drives the projector to update Neo4j.
- The projector must be idempotent: consuming the same event repeatedly must not create duplicate nodes or edges.
- Provide `t4c graph rebuild` or an equivalent maintenance command to rebuild the graph from Mongo.
- Provide a reconciliation task that compares Mongo asset counts and Neo4j node counts and last-update times in batches.
- Neo4j write failures do not block the main scan flow; failed events are retained and can be retried.
- Graph queries limit depth and node count by default, and the server performs aggregation instead of returning the whole graph to the frontend.

Suggested nodes: Project, Organization, Domain, IP, Service, Site, URL, Certificate, CDNProvider, Finding, Task. Project only high-value relationships into Neo4j to avoid an explosion of observation-level nodes.

## 9. External Data Sources

### 9.1 Organization Ownership

Known usable paths:

- Official JSON API: `GET https://openapi.chinaz.net/v1/1001/newicp` with parameters `domain`, `APIKey`, `ChinazVer=1.0`, returning CompanyName, CompanyType, SiteLicense, VerifyTime, Domain, ServiceLicence, ContentTypeName.
- Page-level fallback: `GET https://icp.chinaz.com/{domain}` using a legitimate session Cookie provided by the user, parsing the registering-organization name, registering-organization type, audit time, and other fields.

Design constraints:

- Prefer the official API key.
- Inject the Cookie only through backend environment variables or read-only files; it must not enter the frontend, logs, database, or Git.
- The page fallback does not bypass captchas, forge signatures, or scrape at high frequency.
- Cache lookups by domain with a default TTL of 7 days; manual refresh may force a re-query.
- Batch lookups go through a queue, respect the provider's recommended minimum request interval, and enter backoff retries on failure.
- Results preserve the raw response, source, lookup time, confidence, and manual confirmation status.
- Legal names and display aliases are separate; for example, the legal name might be "Sichuan Jili University" while the display name may be "Jili University".

### 9.2 GeoIP

- Add a `GeoResolver` interface, defaulting to a local offline database to avoid calling an external API for every IP.
- Prefer MaxMind GeoLite2 City/ASN; an optional ip2region adapter can improve Chinese city accuracy.
- Write the data source, database version, update time, and country/city confidence into `ip_locations`.
- Private IPs, reserved addresses, and unresolvable IPs do not enter map points.
- CDN edge IPs and origin-candidate IPs must use different location kinds and must not be confused.

### 9.3 CDN and Origin Candidates

- Retain existing DNS/CDN identification results and distinguish "the asset IP a domain resolves to directly" from "CDN edge IPs".
- The graph must show CDNProvider nodes and edge relationships.
- Origin candidates are inferred relationships with source and confidence and must not be marked as certain facts.
- v1 first completes the data model, display, and filtering; the origin-discovery algorithm can be strengthened incrementally as data sources become available.

## 10. API and DTOs

New or extended public endpoints:

- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/projects/{id}`
- `PATCH /api/v1/projects/{id}`
- `POST /api/v1/projects/{id}/organizations/import`
- `GET /api/v1/projects/{id}/organizations`
- `POST /api/v1/organizations/lookup`, input a domain, returns candidate organizations and sources
- `POST /api/v1/organizations/{id}/attributions/{attributionId}/confirm`
- `POST /api/v1/organizations/{id}/attributions/{attributionId}/reject`
- `GET /api/v1/projects/{id}/graph?focus=&depth=&types=&risk=&limit=`
- `GET /api/v1/projects/{id}/map?bbox=&risk=&types=`
- `GET /api/v1/projects/{id}/events`, SSE
- `POST /api/v1/tasks` extended with `projectId`, `organizationId`, `rootDomainId`

Graph DTO includes at least:

- `nodes[]`: id, type, label, risk, geo, summary, source
- `edges[]`: id, type, source, target, confidence, kind
- `truncated`, `aggregated`, `limit`

Map DTO includes at least:

- `points[]`: id, label, kind (asset/edge/origin), lat, lon, country, province, city, risk, assetCount, confidence
- `clusters[]`: id, label, lat, lon, assetCount, risk
- `unlocatedCount`

All endpoints must use the existing authentication, CSRF, RBAC, and problem+json error format. External provider credentials must never appear in API responses.

## 11. Data Flow and Asynchrony

```text
CSV import
  -> Project + Organization + Root Domain
  -> Organization attribution job
  -> Chinaz API / cookie fallback
  -> Attribution evidence in MongoDB
  -> Graph projector
  -> Neo4j owner edges

Scan task
  -> DNS / port / HTTP / webintel / findings
  -> assets + observations + findings in MongoDB
  -> graph outbox event
  -> Neo4j projector
  -> graph/map query API
```

- Batch import is an asynchronous job that returns a jobId and progress.
- Organization ownership lookup and GeoIP enrichment do not block task submission.
- The graph projector consumes a dedicated queue; failures enter retries and a DLQ.
- The homepage refreshes project summaries and events through SSE or short polling.

## 12. Security and Compliance

- Project permissions are validated on the server; the frontend projectId is not an authorization basis.
- The Chinaz Cookie and API key are read only from environment variables or read-only secret files.
- Provider requests use fixed domains and fixed endpoints; users may not control the target URL.
- All external requests set timeouts, maximum response body sizes, retry limits, and rate limits.
- Raw provider responses may contain personal information or sensitive filing information and must be stored and displayed according to sensitive-data permissions.
- Ownership confirmation, rejection, merging, and batch import write audit events.
- Do not write Cookies, API keys, or full raw responses to ordinary logs.

## 13. Compatibility and Migration

- Keep the existing Scope as a Legacy asset group; do not automatically disguise it as a Project.
- New projects and organizations use new collections and graph relationships; old tasks remain readable.
- Keep the existing `/assets/{kind}`, `/findings/{kind}`, and `/scopes` endpoints, but the new homepage does not use them as primary entry points.
- `t4c migrate` adds Neo4j constraints, indexes, and graph outbox initialization.
- Add `t4c graph rebuild` for backfill and disaster recovery.
- Backfill GeoIP and graph relationships for existing assets on demand without blocking upgrades.

## 14. Testing and Acceptance

### Unit Tests

- Chinaz JSON response field mapping and error-code handling.
- Cookie fallback HTML parsing using fixed fixtures, not the real network.
- Organization alias, legal-name, manual-confirmation, and rejection state machines.
- Graph edge deduplication, idempotent upsert, and truncation rules.
- GeoIP result conversion, private IP exclusion, and unlocated counting.
- Project isolation filters take effect at every query entry point.

### Integration Tests

- Project creation, organization import, ownership confirmation, and graph reads in a MongoDB + Neo4j Docker environment.
- The graph projector does not produce duplicate edges when consuming the same event repeatedly.
- After `graph rebuild`, node and edge counts reconcile with Mongo.
- The homepage degrades to a list view when Neo4j is unavailable.
- On Chinaz timeout, rate limit, API-key error, or cookie expiry, tasks enter a retryable state.
- Import and homepage queries for 100 organizations, 300 root domains, and thousands of assets complete within an acceptable time.

### Frontend and E2E

- Create a project and import organizations.
- Entering `guc.edu.cn` returns "Sichuan Jili University" and source information.
- After confirming ownership, the organization appears on the project homepage.
- Graph-map interaction: clicking a city filters the graph, and clicking a node locates the map.
- Switch between China/world maps and filter CDN edge and unlocated assets.
- Open the asset inspector to view ownership, evidence, tasks, and map position.
- Empty project, no GeoIP, Neo4j degraded, and provider error all have explicit UI states.
- Layouts at 1920x1080, 1440px desktop, and 1280px narrow screens do not overlap.

### Acceptance Criteria

- After first login, users see a project workspace, not a generic module backend.
- Users can manage 100 organizations and multiple root domains within one project.
- Domain reverse-lookup results are traceable, confirmable, and rejectable.
- The homepage graph and map share filters, and CDN edges and origin candidates are not confused.
- Neo4j can be rebuilt from Mongo, and query failures do not affect scanning or auditing.
- The page does not use raw JSON blocks as the primary asset display.

## 15. Implementation Boundaries and Default Choices

- Implement the homepage with Option A first; later pages will adopt the same design tokens gradually.
- Use ECharts + GeoJSON for the graph and map frontend to avoid introducing multiple visualization frameworks at once.
- Default to Neo4j 5.x; add the service, health check, and persistent volume to Docker Compose.
- Use a local GeoIP database by default; the specific provider can be replaced through an adapter.
- Prefer the official Chinaz JSON API, with the Cookie page fallback only as a transition.
- Single-tenant RBAC within a project by default; fine-grained project member permissions are out of scope for v1.
- The CDN origin-discovery algorithm is not promised as fully implemented in v1, but the data model, display, and confidence semantics must be reserved.

## 16. Decided Implementation Assumptions

The following default choices were confirmed during the design phase and will not be asked again during implementation; if they need to change later, they should be handled as explicit changes.

### 16.1 Project Access

v1 reuses the existing global RBAC: logged-in users access projects according to the viewer/operator/admin role, and no project-level member permissions are added. Project isolation is used for query and UI context, not as a replacement for user authorization. Project-level ACLs are left for a later version.

### 16.2 Asset-to-Project Ownership

An asset appears in a project graph only if at least one of the following is true:

- It is reachable through an explicit relationship from a confirmed root domain in that project;
- It was directly discovered by a task carrying that project's projectId.

Shared IPs, ASNs, or CDN infrastructure enter the project view only when they have a direct relationship to the project's domains or tasks; they are not automatically included just because they appeared in another project.

### 16.3 Ownership and Risk

- Domain ownership is a globally normalized fact, while confirmation status is stored independently within a project; the same domain may retain multiple candidate ownerships, but by default a project has only one primary ownership.
- A Finding is a task- and project-level fact; the same asset's risk is calculated separately in different projects.
- Default risk is the highest severity among unresolved Findings in the current project; node colors and map points are calculated from that value.
- The homepage time range defaults to the last 30 days, filtered by Finding firstSeen/lastSeen; changing the time range does not change historical facts.

### 16.4 Automatic Confirmation and Aliases

- Organization ownership must not be confirmed automatically. Even if the provider returns only one high-confidence candidate, it enters pending and must be confirmed or rejected by an operator.
- v1's "merge alias" only allows adding a display alias within the same Organization; it does not merge two Organization entities or rewrite historical relationships.
- Global merging of two Organizations is a later administrator feature and must have an auditable and rollback-capable design.

### 16.5 Coverage Definitions

The organization page and homepage each display two coverage values:

- Ownership coverage: a root domain has been imported and at least one domain has completed organization ownership confirmation.
- Scan coverage: the organization has at least one root domain in a scan task, and the task status is succeeded, partial, or running.

Do not collapse "scan coverage" into a single percentage that masks these two different problems.

### 16.6 Data Sources and Geography

- Prefer the official Chinaz JSON API, with the Cookie page fallback as a transition; both must go through a unified provider interface, rate limiting, caching, and auditing.
- GeoIP uses local MaxMind GeoLite2 City/ASN by default; if Chinese city accuracy is insufficient, an ip2region adapter can optionally be integrated. IPs without geographic data enter the unlocated count.
- CDN edge nodes and origin candidates use different location kinds; v1 does not promise a complete origin algorithm, only the data model, display, and confidence semantics.

### 16.7 Compatibility and Data Retention

- Keep the existing Scope as a Legacy asset group; do not automatically map it to a Project.
- Raw ownership responses are retained with the project, and only operator/admin can view the complete raw fields; ordinary viewers see only the structured summary.
- Provider Cookies/API keys are not persisted, do not enter the frontend, and are not written to ordinary logs; they are read only from environment variables or read-only files.

#### 16.8 External Resources Still Required from the User

The following are not design decisions but external resources needed for operation or acceptance:

- A usable Chinaz API key, or a legitimate page session Cookie that can be refreshed continuously.
- A production GeoIP database file and its licensing/update method.
- If real origin discovery is required, usable historical DNS, passive DNS, certificate, or commercial data sources.
