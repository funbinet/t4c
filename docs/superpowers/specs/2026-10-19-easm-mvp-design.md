# EASM MVP Design: Organization-First World Map Attack Surface Wallboard

## 1. Summary

The T4C homepage becomes an EASM situational-awareness wallboard: the world map is the main canvas, organizations are the first-level entity, and the asset graph grows on top of the map.

The user first selects an organization from the organization list, and the map narrows to that organization's asset locations; then the user opens the graph, and relationship lines between domains, IPs, services, and findings float above the map while the base map remains visible. Domain reverse lookup is also closed-loop: enter any root domain, find its ICP registrant, then fetch all filed root domains under that registrant; after confirmation they enter the map and graph.

This design supersedes the page direction in `2026-10-19-organization-graph-homepage-design.md` ("homepage as the situational page, no separate wallboard, light workbench"). Underlying models such as projects and organizations can still be reused, but this MVP does not introduce Project.

## 2. Why Now

The existing console is a generic asset-management backend: assets are stored flat by `(kind, key)`, and neither the map nor the graph exists. In red-team and EASM scenarios, the two most common questions—"what other filed root domains does this organization have?" and "how are these assets exposed on the map, and how do they relate to each other?"—cannot currently be answered on one screen.

Existing capabilities can support the MVP:

- The scan pipeline already writes domains, IPs, services, sites, certificates, and findings to MongoDB; `data.ips` on domain assets, `data.ports` on IP assets, and `data.ip/port` on service assets are enough to derive the relationship graph.
- `config.geoip.city/asn` is reserved but not yet actually parsed.
- ICP domain lookup already has two usable sources: the Chinaz HTML page (domain → registrant) and the self-hosted ICP_Query (registrant → all filed domains).

## 3. Goals

- Use the world map as the main canvas of the EASM page, with organization bubbles as the first layer.
- After selecting an organization, keep only that organization's asset locations on the map and allow toggling the graph relationship layer.
- Entering a root domain can reverse-look-up the ICP registrant, then reverse-look-up all filed root domains under that registrant; every ownership record carries source, time, and confidence.
- MongoDB remains the source of truth; Neo4j is only a rebuildable relationship projection.
- GeoIP enrichment is offline; unlocated assets have an explicit count and are never given fake coordinates.
- If Neo4j, ICP, or GeoIP is unavailable, the map, lists, and existing scan functionality still work.

## 4. Non-Goals

- No automatic exploitation and no automatic batch scanning of newly discovered domains.
- No multi-tenancy, project-level member permissions, or exercise project model (Project is deferred).
- No organization merge API; the MVP handles duplicate organizations through aliases and re-attribution, and merging is deferred.
- No origin-candidate inference; CDN edge nodes keep the existing `cdn/cdnName` and count as organization assets, but their origin addresses are not inferred.
- No 3D globe, particle backgrounds, or decorative animation.
- No SSE real-time push; the MVP uses 30-second polling.

## 5. Anti-Goals

- The map is only decorative and cannot filter or locate anything.
- Rendering thousands of nodes and labels at once, making it unreadable.
- Low-confidence ownership is automatically confirmed and written as fact.
- Treating an organization's registered address as an asset's geographic location.
- A Neo4j write failure blocks the main scan flow.
- Cookies, raw HTML, or raw ICP responses are written to the frontend, logs, or Neo4j.

## 6. User Workflows

### 6.1 Domain → Organization → All Filed Root Domains

1. Enter `scitc.edu.cn` in the EASM search box.
2. The system normalizes it to a root domain, calls the Chinaz HTML lookup, and returns the ICP registrant, ICP number, and audit time.
3. The user confirms the registrant, and the system creates or merges an Organization.
4. The system calls ICP_Query by registrant name to fetch all filing records, deduplicates by root domain, and returns a candidate list.
5. The user selects domains; after confirmation they are written to `organization_domains` and projected as `OWNS` edges.
6. When confirming domains, the user may optionally check "also create scan tasks"; by default only ownership is confirmed and no task is created. If checked, the existing task API is reused to enqueue immediately, without adding a draft task state.

### 6.2 Organization → Asset Graph

1. Open the EASM page; the map shows organization bubbles. Bubble size = asset count, color = highest risk.
2. Click an organization; the map narrows to that organization's asset points, and the right-side inspector shows filed domains, asset statistics, and sources.
3. Click "Graph"; relationship lines float above the map: organization → domain → IP → service → finding.
4. Click any node; the inspector shows evidence, raw source, scan tasks, and asset details.
5. The breadcrumb returns to the organization layer.

## 7. Interface and Interaction

### 7.1 Page Structure

- Top: product name, global search (domain/organization), organization filter, and ICP/GeoIP/Neo4j health status.
- Left: organization list showing asset count, high-risk count, and ICP coverage status.
- Center: world map main canvas.
- Right: inspector (appears when an organization or node is selected).
- Bottom: legend, unlocated asset count, and last update time.

### 7.2 Layers

1. **Organization layer:** one bubble per organization, scaled by asset count and colored by highest risk.
2. **Asset layer:** after selecting an organization, show that organization's domain/IP locations; only IPs can be placed on the map, and domains are attached to IPs as labels.
3. **Graph layer:** relationship lines overlay the map; by default only depth 2 and at most 300 nodes are shown, with anything beyond aggregated by domain or IP.

### 7.3 Visual Constraints

- Only the EASM page uses the dark wallboard; the rest of the console keeps the existing light style.
- Background is dark blue-gray; assets are blue, medium risk is amber, and high risk is red; risk colors are used only for risk.
- Thin lines, low noise; no neon glow, particles, or 3D.
- Respect `prefers-reduced-motion`; no entrance animation by default.

### 7.4 Empty and Degraded States

- No organizations: show an "import organizations/domains" guide and a manual-create entry.
- ICP_Query unavailable: organization details still show confirmed domains, display "ICP reverse lookup temporarily unavailable", and allow manual import.
- Chinaz cookie expired: search returns an explicit "ICP lookup credentials expired" error without affecting the map or graph.
- Neo4j unavailable: the graph button is disabled with "relationship graph temporarily unavailable", while the map and lists work normally.
- GeoIP missing: the map shows "geographic data unavailable" and the unlocated count.

## 8. Data Model

### 8.1 New MongoDB Collections

`organizations`

- `_id`, `canonicalName`, `aliases[]`
- `uscc?` (not automatically collected in the MVP; written only manually or by a later enterprise data source)
- `region?` (derived from the ICP number prefix, e.g. "Shu ICP Filing" → Shu)
- `externalIds`: `{ icpQuery?, aiqicha?, tianyancha? }`
- `status`: `active | merged`, `mergedInto?`
- `createdAt`, `updatedAt`

`organization_domains`

- `_id`, `organizationId`, `rootDomain`
- `siteName?`, `homeSite?`, `icpNo?`, `auditDate?`
- `source`: `icp_query | chinaz | manual | seed`
- `confidence`: `high | medium | low`
- `status`: `candidate | confirmed | rejected`
- `evidenceId?`, `firstSeen`, `lastSeen`, `updatedAt`
- Unique index: `(organizationId, rootDomain)`; plain indexes: `rootDomain`, `status`

`icp_evidence`

- `_id`, `provider`, `queryType` (`domain | organization`), `queryKey`
- `raw` (HTML summary or raw JSON), `fetchedAt`, `expiresAt`, `payloadHash`
- No cookies are stored; raw responses are retained only here for manual verification.

`ip_locations`

- `_id`, `ip`, `lat`, `lon`, `country?`, `province?`, `city?`, `asn?`, `asnOrg?`
- `source`, `updatedAt`
- Unique index: `ip`

`graph_outbox`

- `_id`, `entityType` (`asset | finding | organization_domain | organization`), `entityId`, `op` (`upsert | delete`), `createdAt`, `processedAt?`, `attempts`
- Index: `(processedAt, createdAt)`

`icp_jobs`

- `_id`, `organizationId`, `status` (`queued | running | done | failed`), `requestedBy`, `resultCount`, `error?`, `createdAt`, `finishedAt?`
- Retained for 7 days; updated by the worker.

Existing `assets`, `asset_observations`, `findings`, `tasks`, and `task_events` are not structurally changed.

### 8.2 Neo4j Relationships

Nodes:

- `Organization {id, name}`
- `Domain {name, root}`
- `IP {addr, cdn, cdnName}`
- `Service {key, port, protocol, service}`
- `Finding {id, kind, severity, title}`

Edges:

- `(:Organization)-[:OWNS {source, confidence, status, icpNo}]->(:Domain)`
- `(:Domain)-[:RESOLVES_TO]->(:IP)`, from domain asset `data.ips[]`
- `(:IP)-[:EXPOSES]->(:Service)`, from service asset `data.ip` + `data.port`
- `(:Finding)-[:FOUND_ON]->(:Domain|:IP|:Service)`, matched exactly by finding.target or after parsing a URL/host:port

### 8.3 Relationship Derivation Rules

- Domain → IP: take `data.ips[]` from `asset.kind=domain`.
- IP → service: take `data.ip`, `data.port`, `data.protocol` from `asset.kind=service`.
- CDN marker: mark `cdn=true` when either the IP asset has non-empty `data.cdnName/cdnType` or a domain asset resolving to that IP has `data.cdn=true`.
- Finding → asset: first match `finding.target` exactly against the asset key; if that fails, parse it as a URL host or `host:port`; if it still cannot be matched, count it in `unlinkedFindings` and do not fabricate an edge.
- All edges are derived data and can be fully rebuilt from MongoDB.

## 9. Organization Identity and Ownership

### 9.1 Identity Keys

Priority:

1. Unified Social Credit Code (if present).
2. Normalized name + filing region.
3. Alias table.

Name normalization: remove whitespace, unify full-width/half-width characters, strip parenthesized suffixes such as "(headquarters)", and remove common legal-form suffixes before comparison; keep the original name for display.

Organizations with the same name must be distinguished by region, ICP number prefix, or USCC, not by name alone.

### 9.2 Confidence

- `high`: normalized names match exactly, and the ICP number matches a recorded ICP number.
- `medium`: normalized names match exactly, and the ICP number prefix (region) matches.
- `low`: only fuzzy name similarity.

USCC is not a required field in the MVP; it participates in matching only when manually entered or provided by a later enterprise data source.

Rules:

- `high` may be confirmed automatically, but an audit record must be written (source, time, matching basis).
- `medium` creates a candidate that is checked by default; `OWNS` is established only after manual confirmation.
- `low` must be manually confirmed and does not automatically enter the graph or map.
- Candidate ownership appears only in the ownership review panel and does not enter the map, graph, or organization statistics.

### 9.3 Domain → Organization

- A domain may have multiple candidate registrants and stays `candidate`; `OWNS` is established only after manual confirmation.
- In the MVP, a rootDomain has at most one `confirmed` organization at a time; if a re-decision is truly needed, an operator performs re-attribution and the old relationship keeps an audit record.
- Raw evidence is written to `icp_evidence`, and the frontend can expand it to view source and time.

### 9.4 Asset Ownership Closure

The MVP uses the following closure rules to avoid shared infrastructure polluting organization views:

- An organization owns `confirmed` rootDomains.
- Subdomains discovered under a rootDomain (asset.kind=domain with a key ending in `.<rootDomain>`) automatically belong to that organization.
- An IP enters the organization view only through the resolution relationship from that organization's domain assets' `data.ips[]`; services and findings on the IP are inherited accordingly.
- One IP may be referenced by multiple organizations (shared/CDN/cloud host) and counts toward each referencing organization's asset closure; the UI marks it "shared".
- CDN nodes also count as organization assets, additionally marked `cdn=true` and `cdnName`; the map and graph label them "CDN edge" to avoid mistaking them for the origin or host location.
- IPs, services, and findings that are not reachable through a confirmed domain path do not count toward organization bubbles or left-side statistics.
- Organization bubble size = deduplicated asset count within the closure (domain + ip); color = highest risk within the closure.

### 9.5 Risk Definition

- Risk is calculated as "the latest finding per asset + finding.dedupeKey"; repeated historical scans do not accumulate.
- Severity order: `critical > high > medium > low > info`; `info` does not participate in organization color.
- Findings that cannot be matched to an asset do not count toward organization risk and are counted separately in `unlinkedFindings`.
- The `risk=` filter means "at least one latest finding at that severity or above exists".

## 10. ICP Integration

### 10.1 Provider Interface

```go
type ICPProvider interface {
    LookupByDomain(ctx context.Context, rootDomain string) ([]DomainAttribution, error)
    SearchByOrganization(ctx context.Context, org OrganizationQuery) ([]ICPDomain, error)
}
```

Typed errors: `ErrCookieExpired`, `ErrRateLimited`, `ErrQuotaExceeded`, `ErrProviderUnavailable`, `ErrNeedsHumanVerification`.

### 10.2 Chinaz: Domain → Registrant

- Request `https://icp.chinaz.com/{rootDomain}` and parse the registering-organization name, registering-organization type, and audit-time fields from the server-rendered HTML.
- The page contains a per-session `sk`; use it to call `tooldata.chinaz.com/icp/api/website/queryPermit` (signed with `rd/ts/token`) to obtain the website filing/license number.
- This flow has been verified not to depend on browser JavaScript; if the filing-number endpoint fails, registrant information is still returned, but confidence is downgraded.
- Cookie and User-Agent must be configured as a pair, and the UA must be a real browser UA.

### 10.3 ICP_Query: Registrant → All Domains

- External sidecar, default address `http://127.0.0.1:16181`.
- Request `GET /query/web?search={organizationName}&pageNum={n}&pageSize={size}`.
- Parse `params.list[]`: `domain`, `serviceLicence`, `unitName`, `serviceName`; the audit-time field depends on what the sidecar actually returns and is left empty when missing.
- Pagination: read `total/pages` on the first page, wait a fixed 5 seconds between pages, and cap at 20 pages.
- Mark `medium/high` only when `unitName` matches the normalized organization name (or an alias); otherwise treat it as a candidate.
- This service is deployed independently; T4C does not introduce a Python runtime or copy its code.

### 10.4 Configuration

```yaml
icp:
  cacheTTL: 168h
  chinaz:
    cookieFile: ""          # takes precedence over the environment variable
    userAgent: ""
  icpQuery:
    baseURL: "http://127.0.0.1:16181"
    timeout: 30s
    pageSize: 50
```

Environment variables:

- `T4C_ICP_CHINAZ_COOKIE`
- `T4C_ICP_CHINAZ_USER_AGENT`
- `T4C_ICP_ICPQUERY_BASE_URL` (optional override)

Security:

- The cookie is read only from an environment variable or read-only file and never enters MongoDB, logs, audit details, or the frontend.
- Health checks return only `ok | cookie_expired | unavailable` and never return the cookie's contents or length.

### 10.5 Rate Limiting, Caching, and Circuit Breaking

- One token bucket per provider; Chinaz 1 QPS, ICP_Query 1 concurrent request.
- Single-flight for requests with the same key; cache for 7 days, and manual refresh may force a re-query.
- Open the circuit breaker for 10 minutes after 5 consecutive failures; return `ErrProviderUnavailable` while open.
- ICP_Query pagination waits 5 seconds between pages; never run full pagination synchronously inside an HTTP handler—the worker does it.

## 11. GeoIP

- Read local MaxMind GeoLite2 City/ASN mmdb files: `config.geoip.city`, `config.geoip.asn`.
- Add a `GeoResolver` that resolves latitude/longitude, country, province, city, ASN, and ASN organization for public IPs.
- Private, reserved, or failed lookups → do not write coordinates and count as "unlocated".
- `ip_locations` acts as a cache and is filled when IP assets are written or during periodic reconciliation.
- The map draws only IPs with coordinates; domains attach to IPs through resolution relationships.

## 12. Neo4j Projection

- Use `neo4j-go-driver/v5`.
- Use `graph_outbox`: `UpsertAsset`, `AddFinding`, ownership confirmation/import, and organization changes append events in the same transaction as the MongoDB write or immediately after.
- The projector consumes events ordered by `(processedAt, createdAt)` and writes idempotently with `MERGE`; after successful consumption it writes `processedAt`.
- For updates to `RESOLVES_TO/EXPOSES/FOUND_ON/OWNS`, delete the entity's old edges first and rebuild them to avoid stale relationships.
- `delete` events are used for disabled/removed organization domains and assets.
- Provide `t4c graph rebuild`: clear the derived graph and rebuild it fully.
- Perform a lightweight reconciliation every 24 hours, comparing key node/edge counts; trigger a full rebuild when the difference exceeds a threshold.
- Projection failures only record status and retries; they never block scanning.
- Graph queries must limit depth and node count: `depth<=3`, `limit<=500`; when exceeded, the server aggregates and marks the DTO with `truncated/aggregated`.
- When Neo4j is not configured, the graph API returns `503 graph_unavailable`; the map and lists are unaffected.

## 13. API

New:

- `GET /api/v1/organizations?query=&limit=`
- `POST /api/v1/organizations` (manual creation)
- `GET /api/v1/organizations/{id}`
- `POST /api/v1/icp/lookup`, input `{domain}`, returns candidate registrants
- `POST /api/v1/organizations/{id}/icp-domains/refresh`, enqueues reverse lookup; returns job id
- `GET /api/v1/icp/jobs/{id}`, returns status, result count, and error
- `GET /api/v1/organizations/{id}/domains`
- `POST /api/v1/organizations/{id}/domains/confirm`, input `{domains[]}`
- `POST /api/v1/organizations/{id}/domains/import`, manual CSV/text import
- `GET /api/v1/easm/map?orgId=&risk=`
- `GET /api/v1/easm/graph?orgId=&depth=2&limit=300`
- `GET /api/v1/easm/health`

Permissions:

- Read endpoints: all authenticated roles.
- Create organization, confirm ownership, import domains, refresh reverse lookup: `operator` or `admin`.
- Reuse existing CSRF, RBAC, and problem+json error format.

All write endpoints must be audited: who confirmed which ownership, what the source was, and when.

## 14. Frontend

- The existing `DashboardPage` is replaced by `EasmPage`, and the `/` route goes directly to the EASM wallboard; the old dashboard page is not kept.
- Useful task metrics and system health from the old dashboard are folded into the EASM top status bar or inspector rather than remaining a separate page.
- Use Vue 3 + TypeScript + Pinia; the graph and map use ECharts + vue-echarts.
- The world map GeoJSON is bundled as a static asset and is not fetched from the internet at runtime.
- State: current organization, selected node, graph toggle, health status, and polling time.
- Data: poll map/graph every 30 seconds; switching organizations requests immediately without waiting for the poll.
- Component split: `EasmPage`, `WorldMap`, `OrgRail`, `Inspector`, `Legend`, `HealthPill`.

## 15. MVP Milestones

1. Organization and filed-domain storage, migration, indexes, and unit tests.
2. ICP provider: Chinaz HTML + ICP_Query client, caching, error classification, httptest fixtures.
3. GeoIP resolver and `ip_locations` enrichment.
4. Neo4j projection worker + `t4c graph rebuild`.
5. EASM API with permissions and auditing.
6. Frontend wallboard: organization layer → asset layer → graph layer, inspector, degraded states.
7. End-to-end verification: seed data + Playwright smoke.

## 16. Verification

- Unit tests: domain normalization, HTML/JSON parsing, confidence rules, GeoIP failure fallback, and projection idempotency.
- Integration tests: Mongo (`T4C_TEST_MONGO_URI`); Neo4j uses `T4C_TEST_NEO4J_URI` and is skipped when absent.
- Frontend: `npm run typecheck`, `npm run build`.
- E2E: organization list → select organization → open graph → return; the page must not go blank when ICP is unavailable.
- Manual acceptance: use `scitc.edu.cn` to verify the domain → registrant → multiple root domains chain.

## 17. Risks

- ICP_Query depends on third-party automation of the MIIT interface and captcha recognition, which carries ToS and stability risks; it must remain a replaceable sidecar, and the deployer decides whether to enable it.
- Changes to the Chinaz page structure will break parsing; the parser needs fixture tests and explicit error states.
- Incorrect merging of organizations with the same name pollutes the graph; low confidence must be manually confirmed.
- Large graphs may become unreadable; the MVP prioritizes aggregation and truncation.

## 18. Decisions Left to the Builder

- Both the map and graph are implemented with ECharts; if world map interaction is insufficient, MapLibre may be used instead, without changing the API.
- The MVP uses 30-second polling and does not use SSE.
- The homepage is the EASM page; `/dashboard` is not kept, and the old DashboardPage is deleted or replaced.
- Do not introduce the Project model; organizations are global entities, and Scope continues to handle scan grouping.
- "Add to scan" in organization details only creates existing tasks and does not add new automatic scanning logic.
