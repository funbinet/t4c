# T4C

**An authorization-first platform for external attack surface management (EASM).**

T4C 3.0 is a Go-based rewrite for authorized asset discovery and external attack surface management. A single `t4c` process serves the embedded React console, REST/SSE API, task workers, and scheduler. PostgreSQL stores application data; Redis Streams provides durable asynchronous work.

> **Authorized use only:** Scan only assets, domains, IPs, and sites for which you have explicit permission. Read [Disclaimer.md](Disclaimer.md) before use.

<p>
  <a href="docs/ARCHITECTURE.md">Architecture</a> ·
  <a href="docs/PARITY.md">Feature parity</a> ·
  <a href="docs/EASM-OPERATIONS.md">EASM operations</a> ·
  <a href="#api">API</a> ·
  <a href="#security-model">Security model</a>
</p>

> **Compatibility note:** Version 3.0 is a rewrite, not an in-place upgrade. It does not migrate legacy MongoDB data and is not compatible with the old `/api`; PostgreSQL 18 is the application database.

---

## Capabilities

### Organization-Centric EASM

- Organize assets, domains, risks, and tasks under an `organization` instead of scattering scan results across tasks.
- Domain ownership workflow: ICP lookup → candidate domains → manual confirm/reject/transfer, preserving source, confidence, and raw evidence.
- Organization overview, world map, relationship graph, cross-organization asset/risk/task views, and CSV / XLSX reports.
- Neo4j relationship projection, GeoIP map, and ICP_Query lookups are optional; when missing they degrade gracefully without affecting assets and list views.

### Asset Discovery

- Supports domains, subdomains, IPs, CIDRs, and other targets, with built-in blocklists and SSRF protection.
- In-process ProjectDiscovery SDK: `subfinder` → `dnsx` → `naabu` → `tlsx` → `httpx` → `katana`.
- Port and service identification, TLS certificates, HTTP title/status/tech stack, site crawling, screenshots (optional Chromium).
- Normalized asset model: canonical asset + per-task observation; historical tasks remain viewable, and reports are generated from task snapshots.

### Risk and Intelligence

- Fingerprint library and boolean rule DSL, with built-in and custom fingerprints.
- WIH / JavaScript sensitive-information collection and file-leak detection.
- 96 PoC / sniffer / brute plugins covering common HTTP, SSH, MySQL, PostgreSQL, MSSQL, MongoDB, Redis, FTP, SMTP, IMAP, and POP3 paths.
- Official `nuclei` Go SDK; by default only HTTP templates under `assets/nuclei` are loaded.
- GitHub search and monitoring, FOFA queries, site monitoring, and scheduled tasks.

### Platform and Delivery

- React 19 + TypeScript + Vite console: TanStack Query/Table, Radix UI, Tailwind CSS, ECharts.
- OpenAPI 3.1 documentation, RFC 7807 error responses, SSE task events, Prometheus metrics.
- Three-tier RBAC (`viewer` / `operator` / `admin`), API keys, CSRF, audit logs, and structured logging.
- A single Go binary (scan assets kept external) with native systemd deployment; Docker is only used for PostgreSQL and Redis. All background components run inside the same T4C process.

### Three-Stage Chain (v3.5.0)

- **recon → exploit → objectives**: a single organization is discovered once in recon, breached in exploit, and its "produce" (objectives, sessions, artifacts) collected in objectives.
- A first-class `Stage` / `Mode` threads through tasks, findings, assets, monitors, schedules, scopes and the console; a three-icon toggle switches the active stage.
- **13 recon / 10 exploit / 10 objective SDKs**, each with its own registry and contract tests enforcing a minimum of 8 per stage. Recon broadening (CT logs, ASN, DNS zone, cloud buckets, rDNS, endpoints) is **opt-in** and off by default.
- New engine steps (`broaden`, `exploit`, `postex`, `probe`) on dedicated Redis Stream queues; `AdvanceStage` governance enforces sequential transitions.
- Exploit/objectives console screens include a shell console (open/re-ignite/command), an export drawer, an objective lifecycle workflow, and produce analytics. Artifact downloads are auth-gated and never served from the SPA static path; deleted produce is recoverable from the Recycle Bin.
- Full details: [docs/3-5-0.md](docs/3-5-0.md) · [docs/CHAIN-IMPLEMENTATION-PLAN.md](docs/CHAIN-IMPLEMENTATION-PLAN.md) · [docs/CHAIN-TASKS.md](docs/CHAIN-TASKS.md).

## Architecture

```text
                     ┌──────────────────────────────────────┐
  Browser / API ────▶│ web                                  │────▶ PostgreSQL 18
                     │ SPA · REST · SSE · OpenAPI · metrics │
                     └───────────────┬──────────────────────┘
                                     │ outbox
                                     ▼
                              Redis Streams
                                     │
                     ┌───────────────▼──────────────────────┐
                     │ worker loop inside the same t4c process │
                     │ steps: DNS / ports / HTTP / fingerprint / PoC │
                     └──────────────────────────────────────┘

  scheduler in the same process ── PostgreSQL lease ──▶ due tasks
  Optional external services: Neo4j (relationship graph), MaxMind GeoIP (map), ICP_Query
```

- The Web/API layer provides the embedded console, REST, SSE, health checks, and metrics.
- The same `t4c` process consumes Redis Streams, executes task steps, dispatches scheduled jobs, and projects graph data.
- `t4c all` is the only run entrypoint; production uses a persistent Redis queue.

For a more complete design, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); for legacy feature mapping, see [docs/PARITY.md](docs/PARITY.md).

## Quick Start

### Prerequisites

| Component | Version | Notes |
| --- | --- | --- |
| Go | 1.27+ | Builds the backend and single binary |
| Node.js | 22.12+ | Frontend build only; embedded into `t4c` after building |
| PostgreSQL | 18+ | Application data, task leases, and outbox |
| Redis | 7.0+ | Durable task queue; production uses Redis by default |
| Chromium | Optional | Enables site screenshots when installed on the host |
| Docker + Compose | Optional | Used only for PostgreSQL and Redis |

### Option 1: Native T4C + Containerized Infrastructure (Recommended)

The React console is built by Vite into `internal/webui/dist` and then embedded into the `t4c` binary via `go:embed`. No frontend container or Node.js is needed at runtime.

```bash
# 1. Build the single binary (also builds and embeds the frontend)
make build

# 2. Prepare application config; disable Secure Cookie for local HTTP debugging
cp config.example.yaml config.yaml
export T4C_AUTH_ACCESS_SECRET="$(openssl rand -base64 48)"
export T4C_API_KEY_PEPPER="$(openssl rand -base64 32)"
export T4C_ADMIN_PASSWORD='<initial-admin-password>'
export T4C_COOKIE_SECURE=false

# 3. Run PostgreSQL and Redis in local containers only; bind ports to 127.0.0.1
make infra-up

# 4. Initialize and start the single-node service
./t4c migrate --config config.yaml
./t4c all --config config.yaml
```

Visit <http://localhost:5003>. Database passwords in `config.example.yaml` are for local trials only; in production override them via `T4C_POSTGRES_DSN`, `T4C_REDIS_URL`, and a secret manager, and enable TLS (configure `server.tlsCert` / `server.tlsKey`, or terminate TLS at a reverse proxy).

### Option 2: Install with systemd

```bash
make build
sudo ./deploy/install.sh

sudoedit /etc/t4c/config.yaml /etc/t4c/t4c.env
sudo /opt/t4c/t4c migrate --config /etc/t4c/config.yaml
sudo systemctl enable --now t4c
```

The install script places the binary and external scan assets in `/opt/t4c`, config and `t4c.env` in `/etc/t4c`, and runtime data in `/var/lib/t4c`. Only one `t4c.service` is installed; it runs the complete single-node service. Infrastructure can still be started with `make infra-up`, or you can use host-native PostgreSQL/Redis.

### Optional EASM Integrations

Neo4j, ICP_Query, and GeoIP are not part of the default Docker infrastructure. To use them, connect to external or host-native instances and load the environment variables before starting T4C:

```bash
cp deploy/.env.easm.example deploy/.env.easm
set -a
source deploy/.env.easm
set +a
./t4c all --config config.yaml
```

See [docs/EASM-OPERATIONS.md](docs/EASM-OPERATIONS.md) for detailed configuration and degradation behavior.

## Configuration

Priority is: `config.yaml` → `T4C_*` environment overrides. Common settings:

| Config key | Environment variable | Notes |
| --- | --- | --- |
| `server.listen` | `T4C_SERVER_LISTEN` | Listen address, defaults to `:5003` |
| `server.publicURL` | `T4C_SERVER_PUBLIC_URL` | Public access URL |
| `postgres.dsn` | `T4C_POSTGRES_DSN` | PostgreSQL connection string |
| `postgres.maxOpenConns` | `T4C_POSTGRES_MAX_OPEN_CONNS` | Maximum open connections, defaults to 25 |
| `postgres.maxIdleConns` | `T4C_POSTGRES_MAX_IDLE_CONNS` | Idle connections, defaults to 10 |
| `postgres.connMaxLifetime` | `T4C_POSTGRES_CONN_MAX_LIFETIME` | Connection lifetime, defaults to `30m` |
| `redis.url` | `T4C_REDIS_URL` | Redis connection string |
| `queue.driver` | `T4C_QUEUE_DRIVER` | `redis` or `memory` |
| `auth.accessSecret` | `T4C_AUTH_ACCESS_SECRET` | Access token signing secret, required |
| `auth.apiKeyPepper` | `T4C_API_KEY_PEPPER` | API key hash pepper |
| `auth.bootstrapPassword` | `T4C_ADMIN_PASSWORD` | Admin password on first start; if empty, one is generated randomly and printed |
| `auth.cookieSecure` | `T4C_COOKIE_SECURE` | Should be `true` in HTTPS environments |
| `scan.blackCIDRs` | — | Outbound blocklist |
| `scan.allowPrivate` / `scan.allowLoopback` | `T4C_ALLOW_PRIVATE` / `T4C_ALLOW_LOOPBACK` | Only for authorized internal networks / local labs |
| `scan.maxHosts` / `scan.maxPorts` / `scan.maxRuntime` | — | Task size and duration limits |
| `scanners.nuclei.templatesDir` | `T4C_NUCLEI_TEMPLATES_DIR` | nuclei template directory |
| `tools.chromiumPath` | `T4C_CHROMIUM_PATH` | Chromium executable; auto-detected when empty |
| `github.token` | `T4C_GITHUB_TOKEN` | Required for GitHub search/monitoring |
| `neo4j.uri` | `T4C_NEO4J_URI` | Configure when enabling the relationship graph |

See [config.example.yaml](config.example.yaml) for the full configuration. After changing config, run `./t4c doctor --config config.yaml` to check config, PostgreSQL, Redis, GeoIP, Neo4j, DNS, and template status.

Production `postgres.dsn` should enable TLS (for example `sslmode=require` or `verify-full`) and inject the password through a secret manager.

**Never commit real secrets.** `config.example.yaml` is a template only; systemd deployments should put sensitive overrides in `/etc/t4c/t4c.env` with `0640` permissions or in an external secret manager.

## CLI and Operations

| Command | Description |
| --- | --- |
| `t4c all` | The only run entrypoint: API, embedded console, task consumption, scheduler, and graph projection |
| `t4c migrate` | Run PostgreSQL AutoMigrate, write default policies, and sync PoC plugin metadata |
| `t4c doctor` | Check config, dependencies, queues, resources, and DNS |
| `t4c health` | Process health check, e.g. `--url http://127.0.0.1:5003/healthz` |
| `t4c admin create-user` | Create a user, optionally with `--role viewer/operator/admin` |
| `t4c admin reset-password` | Reset a password |
| `t4c poc sync` | Sync plugin metadata to PostgreSQL |
| `t4c graph rebuild` | Rebuild the Neo4j relationship projection (when the graph is enabled) |
| `t4c version` | Print the version |

### Deployment and Operations

- PostgreSQL migrations start from an empty database: legacy MongoDB data is not imported automatically; when Neo4j is enabled, run `./t4c graph rebuild` once after upgrading.
- systemd: `sudo ./deploy/install.sh` installs the single-node `t4c.service`, the binary, and external assets; config and environment files live in `/etc/t4c/config.yaml` and `/etc/t4c/t4c.env`, and the data directory is `/var/lib/t4c`.
- Before switching/upgrading Redis, run `./scripts/redis-preflight.sh --config config.yaml` to check connectivity, version, AOF, memory policy, and queue depth, and to run `t4c doctor`; add `--require-empty` for migration cutovers.
- Use `./scripts/easm-live-smoke.sh` for online EASM smoke checks; it performs read-only checks by default, and only starts a bounded scan when `EASM_LIVE_SCAN=1` is set.

## API Reference

- OpenAPI 3.1: `/api/v1/openapi.json`
- Documentation entry: `/api/v1/docs`
- Authentication:
  - Browser: HttpOnly cookie `t4c_access`; write requests carry `X-CSRF-Token`.
  - Automation: `X-API-Key`, with scopes `read` / `scan` / `admin`.
- Main resources:
  - Tasks: `/api/v1/tasks`, `/tasks/{id}/events` (SSE)
  - Assets and risks: `/assets`, `/findings`
  - Organizations and EASM: `/organizations/*`, `/domain-lookups`, `/map`
  - Scan policies: `/policies`, `/scopes`, `/fingerprints`, `/poc/plugins`
  - Automation: `/monitors`, `/schedules`, `/github/*`
  - Exports and audit: `/exports`, `/audit-events`, `/system/info`
  - Three-stage chain (v3.5.0): `/{stage}/{overview,organizations,assets,findings,tasks,monitors,schedules,policies,groups}` (stage = `recon|exploit|objectives`), `/exploit/sessions*`, `/exploit/plugins`, `/objectives/{list,summary,artifacts/*,plugins/list}`, and `POST /organizations/{id}/advance-stage`.
- List endpoints uniformly support `page`, `pageSize`, `sort`, `q`, and resource-specific filters.
- Error responses use `application/problem+json` (RFC 7807); health checks are `/healthz` and `/readyz`, and metrics are `/metrics`.

## Security Model

- Argon2id password hashing; 15-minute access JWT and 7-day rotatable refresh tokens by default; refresh-token replay revokes the entire session family.
- Three-tier RBAC (`viewer` / `operator` / `admin`); API keys support `read` / `scan` / `admin` scopes.
- Scanner outbound HTTP uses a safe dialer that validates resolved IPs; loopback, link-local, cloud metadata addresses, and configured blocklists are blocked by default.
- Write requests require a CSRF token by default; security response headers, request IDs, audit logs, and structured logs are enabled by default.
- Write operations are audited; raw ICP evidence is stored separately and never includes provider cookies; candidate domains do not enter the map, graph, or organization statistics until confirmed.
- Scans reject private and loopback addresses by default; only relax this via `scan.allowPrivate` / `scan.allowLoopback` in explicitly authorized internal networks or labs.

## Development and Testing

```bash
make test       # Go tests + frontend typecheck + Vitest
make race       # Go race tests
make lint       # gofmt check + vet + frontend lint/typecheck
make verify     # go mod verify + vet + all tests + frontend build
```

Frontend standalone development:

```bash
cd web
npm ci
npm run dev          # Vite dev server, /api proxied to 127.0.0.1:5003
npm run test:e2e     # Playwright (excluding @visual)
npm run test:visual  # Playwright visual regression
npm run generate:api # Generate types from internal/httpapi/openapi.json
```

CI builds the frontend artifacts, runs Go tests (including race), builds the native `t4c` binary, and validates the infrastructure Compose configuration.

## Repository Layout

```text
cmd/t4c                CLI entrypoint and role dispatch
internal/app           dependency wiring
internal/httpapi       REST / SSE / OpenAPI / auth
internal/store         PostgreSQL/GORM repositories, indexes, and migrations
internal/modules       discovery, webintel, poc, tasking, monitoring,
                       github, reporting, identity, easm, system,
                       exploit, objective (chain SDK registries)
internal/platform      config, logging, queues, netsafe, notifications, ProjectDiscovery adapters
internal/webui         embedded console build artifacts (generated into dist/ at build time)
web/                   React + TypeScript + Vite source, Vitest, Playwright
                       (src/pages/chain, src/components/chain, src/api/chain.ts)
assets/                dictionaries, fingerprints, WIH rules, and nuclei templates
deploy/                infrastructure Compose, systemd units, environment templates, and install scripts
docs/                  architecture, feature parity, scanner differences, EASM operations
scripts/               Redis preflight, EASM online smoke
```

## Known Limitations and Intentional Differences

- 3.0 is a rewrite, not an in-place upgrade: **legacy MongoDB data is not migrated, and the old `/api` is not compatible**; after upgrading, the application database is PostgreSQL 18.
- OS identification uses only naabu service metadata and is omitted when the OS type cannot be determined.
- Screenshots depend on Chromium; if no browser is installed the screenshot step fails and is marked optional without affecting other scans.
- Of the 96 plugins, RDP, CobaltStrike, Shiro CBC/GCM, etc. remain registered extension points; protocol implementations still need to be completed.
- nuclei only runs HTTP templates under `assets/nuclei` by default; interactsh, code, file, and headless templates are disabled by default.
- Result-set / risk cruising is still partially implemented; see [docs/PARITY.md](docs/PARITY.md).
- GitHub search and monitoring require an API token.
- All scan engines and ProjectDiscovery are invoked through in-process SDKs; result timelines and fingerprints differ from nmap / massdns versions, see [docs/SCANNER-DIFFERENCES.md](docs/SCANNER-DIFFERENCES.md).

## Documentation

| Document | Contents |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Runtime roles, module boundaries, task lifecycle, three-stage chain, data model |
| [docs/3-5-0.md](docs/3-5-0.md) | v3.5.0 three-stage chain achievement report and verification matrix |
| [docs/CHAIN-IMPLEMENTATION-PLAN.md](docs/CHAIN-IMPLEMENTATION-PLAN.md) | Authoritative v3.5.0 chain implementation blueprint |
| [docs/CHAIN-TASKS.md](docs/CHAIN-TASKS.md) | T1–T11 chain task tracker and final verification status |
| [docs/PARITY.md](docs/PARITY.md) | Mapping from legacy Flask features to the new implementation |
| [docs/SCANNER-DIFFERENCES.md](docs/SCANNER-DIFFERENCES.md) | Differences between the ProjectDiscovery SDK and legacy scanners |
| [docs/PROJECTDISCOVERY-SDK.md](docs/PROJECTDISCOVERY-SDK.md) | SDK integration and `pdtools` mapping |
| [docs/EASM-OPERATIONS.md](docs/EASM-OPERATIONS.md) | Organizations, domain ownership, map/graph, and the local EASM stack |
| [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md) | Third-party components and rule licenses |

## Disclaimer and License

This project is for lawful authorized security testing only. Users are responsible for ensuring target authorization, data compliance, and operational boundaries; consequences of misuse are borne by the user. See [Disclaimer.md](Disclaimer.md) for full terms.

Source: [github.com/funbinet/t4c](https://github.com/funbinet/t4c) · [codeberg.org/funbinet/t4c](https://codeberg.org/funbinet/t4c)

Code is released under the MIT license, see [LICENSE.md](LICENSE.md). Copyright and license notices for third-party dependencies, dictionaries, fingerprints, WIH rules, and PoC rules are retained in the repository.
