# T4C — Brand, Origins, Structure, Design, and How It Works

This document is the single starting point for understanding the entire project:
what it is called, where it comes from, how the repository is organized, the
design decisions behind it, and the exact mechanics of how it does its work.

---

## 1. Brand identity

| Element | Value |
| --- | --- |
| Product name | **T4C** |
| Tagline | *An authorization-first platform for external attack surface management (EASM)* |
| Publishing brand | **Funbinet** — `https://github.com/funbinet` |
| Code module | `github.com/funbinet/t4c` (Go module path) |
| Version | `3.0.0` (`version.txt`, Makefile `VERSION`) |
| License | MIT (`LICENSE`, `LICENSE.md`), plus an explicit usage disclaimer (`Disclaimer.md`) |
| Console title | "T4C" (`web/index.html`) |
| Logo mark | The `t4c.png` logo shown on the login screen, sidebar, and favicon, drawn with the theme colors |
| Visual language | Cutting mat theme: canvas `#090A08`, ink `#2D7B49`, surface `#0F2516`, two ink alpha blends, radius zero, no motion, no shadows, static grid background. See `docs/UI-ENHANCEMENT.md` and `docs/UI-AUDIT.md` |
| Voice | Authorization-first: authorized use only, evidence, traceability, ownership |

The product positions itself around one rule stated everywhere from the README
to the login screen: **only scan what you are authorized to scan.**

---

## 2. Authorship and lineage

- **Original T4C (1.x/2.x):** created by **tophant** (TophantTechnology) in 2023
  and released under the MIT license. The legacy stack was Python + Flask +
  MongoDB + Celery with external nmap/massdns-style scanners. `LICENSE.md`
  carries the original MIT copyright notice, and `Disclaimer.md` mirrors the
  upstream disclaimer in English: this is a tool for authorized security
  testing; operators are legally responsible for how they use it.
- **T4C 3.0 (this repository, `t4c`):** a ground-up Go rewrite published by
  the **Funbinet** project (`github.com/funbinet/t4c` module; working
  remotes `github.com/funbinet/t4c` and `codeberg.org/funbinet/t4c`).
  It preserves the T4C product concept and dictionary assets but shares **no
  runtime lineage** with the Flask codebase — no Python, no MongoDB, no
  Celery, no CLI wrappers around nmap or massdns.
- Third-party scanning capability comes from the **ProjectDiscovery** Go SDKs
  (subfinder, dnsx, naabu, httpx, katana, nuclei, tlsx), attributed in
  `docs/THIRD_PARTY_NOTICES.md` and pinned in `go.mod`. They are linked
  **in-process**, never shelled out to.

---

## 3. Project structure

```
.
├── cmd/t4c/                 # Single entry point: server ("all"), "migrate", "doctor" CLIs
├── internal/
│   ├── app/                 # Wiring: config → store → queues → modules → HTTP server
│   ├── httpapi/             # REST + SSE + OpenAPI 3.1; auth, RBAC, CSRF, RFC 7807 errors
│   ├── store/               # GORM repositories over PostgreSQL; soft delete; outbox
│   ├── domain/              # Shared domain types (Task, Asset, Organization, Finding…)
│   ├── modules/
│   │   ├── discovery/       # Subdomain/DNS/port/HTTP steps via ProjectDiscovery SDKs
│   │   ├── webintel/        # Fingerprinting, WIH secrets, file leaks, spider, screenshots, nuclei
│   │   ├── poc/             # 96 Go-native plugins: HTTP PoCs, sniffers, brute checks
│   │   ├── tasking/         # Task state machine: StepPlan, worker, events, retries
│   │   ├── easm/            # Organizations, ICP attribution, confidence, projections
│   │   ├── monitoring/      # Scheduler for periodic monitors/schedules
│   │   ├── github/          # GitHub code-search monitors for leaked secrets/domains
│   │   ├── reporting/       # CSV/XLSX report export
│   │   └── identity/        # Users, sessions, API keys, RBAC
│   ├── platform/
│   │   ├── config/          # YAML config + T4C_* env overrides
│   │   ├── jobs/            # Redis Streams queue with retries, leases, DLQ
│   │   ├── netsafe/         # Network safety policy: private-range/SSRF blocking
│   │   ├── pdtools/         # Sole mapping of netsafe policy → ProjectDiscovery options
│   │   ├── security/        # Argon2id, JWT/refresh sessions, API keys, CSRF
│   │   ├── geoip/           # MaxMind GeoIP for the world map
│   │   └── notify/          # DingTalk/Feishu/WeCom/email/webhook notifications
│   └── webui/               # go:embed of the built SPA (internal/webui/dist)
├── web/                     # React 19 + TypeScript + Vite console (web/src), e2e (web/e2e)
├── assets/                  # finger.json fingerprints, webapp.json rules, WIH rules, dicts
├── deploy/                  # docker compose for Postgres/Redis, systemd unit, install.sh
├── docs/                    # ARCHITECTURE, PARITY, SCANNER-DIFFERENCES, EASM ops, this file
└── scripts/                 # Preflight/smoke helpers (e.g. redis-preflight.sh)
```

## 4. Design decisions

| Decision | Why |
| --- | --- |
| **Modular monolith, single binary** | One `t4c` process serves the API, workers, scheduler, and graph projector. Simplest secure deployment; no microservice sprawl. |
| **Embedded React SPA** | `go:embed` of `web/dist` means one artifact to ship; tests assert the embed is real (`TestEmbeddedFrontendIncludesBuiltAssets`). |
| **PostgreSQL as the single source of truth** | Replaces the legacy MongoDB. GORM + AutoMigrate; strict schema; strong consistency for assets/findings. |
| **Canonical assets + observations** | Scanners never mutate reality; they append **observations** with source + timestamps. Canonical asset rows are derived and re-derivable; deletion is soft (recycle bin) and scan rediscovery restores items automatically. |
| **Transactional outbox** | Domain events (task events, graph changes) are written in the same DB transaction as state changes, then relayed to Redis Streams — no lost or phantom events. |
| **Redis Streams queues with leases** | Durable queues (`q.discovery.*`, `q.web.*`, `q.poc.*`, `q.icp`, …) with retries, lease/heartbeat, and a dead-letter queue; `queue.driver: memory` exists only for throwaway local runs. |
| **In-process ProjectDiscovery SDKs** | `pdtools` is the *only* place where `netsafe` policy maps onto SDK options — proxy, DNS, rate limits, and scope enforcement apply uniformly. No CLI wrappers. |
| **Organization-first EASM model** | `Organization → filed root domains → subdomains → IPs → services → findings`. Ownership is proven via ICP filings with a source+confidence model: `high` auto-confirms, `medium` needs a human click, `low` never reaches the map/graph. |
| **Neo4j is a rebuildable projection** | The relationship graph is derived from an outbox feed and can be discarded and rebuilt with `t4c graph rebuild`. If Neo4j is down, the console degrades gracefully. |
| **GeoIP, never faked** | The world map plots located assets; unlocated assets are counted and labeled, never assigned fake coordinates. |
| **RBAC + scoped API keys + audit** | Three roles (admin/operator/viewer), API keys with scopes, CSRF on cookie-authenticated writes, audit log on mutations, sensitive fields masked per role. |
| **Safety by default** | `netsafe` blocks loopback/link-local/private/cloud-metadata targets; scans refuse private ranges unless explicitly allowed; SSRF protections on user-supplied URLs; secrets (ICP cookies, tokens) come only from env/read-only files and are never logged. |

---

## 5. Working strategy

### 5.1 Task lifecycle

`POST /api/v1/tasks` → engine persists the task + **StepPlan** → outbox →
Redis queue → worker executes **one step at a time** → each step emits events
and observations → finalize.

```
queued → running ─┬─→ succeeded
                  ├─→ partial   (an OPTIONAL step failed)
                  └─→ failed    (a CRITICAL step failed: dns/port/http/stats)
```

### 5.2 Step plans (from `internal/modules/tasking/engine.go`, `StepPlan`)

| Task kind | Step sequence |
| --- | --- |
| **domain** (EASM scan) | `dns` → [`port` if enabled] → `http` → `webintel`*(optional)* → [`poc` if plugins selected]*(optional)* |
| **ip** | [`port` if enabled] → `http` → `webintel`*(optional)* → [`poc`]*(optional)* |
| **risk_cruising** | `http` → [`poc`]*(optional)* |
| **asset_site_add / asset_site_sync** | `http` → `webintel`*(optional)* |

Critical steps: `dns`, `port`, `http`, `stats` — failing them fails the task.
Optional steps: `webintel`, `poc` — failing them yields `partial` with the
reason recorded. Progress is reported step-by-step over SSE.

### 5.3 Queue topology

Each step's work is dispatched onto its own stream
(`q.discovery.subdomain`, `q.port`, `q.http`, `q.webintel`, `q.poc`, `q.icp`,
…). The `monitoring` scheduler enqueues recurring monitors/schedules onto the
same queues, so one worker pool serves interactive and periodic work with the
same retry/dead-letter semantics.

### 5.4 The EASM workflow

1. **Import or create an organization** (CSV or form) with root domains.
2. **Attribution:** Chinaz (HTML) resolves *domain → registrant*; the optional
   ICP_Query sidecar resolves *registrant → all filed domains* (the
   "reverse lookup"). Each candidate edge gets a **source + confidence**.
3. **Confirm:** operators confirm or reject candidate domains; only confirmed
   domains join the attack surface and the map/graph.
4. **Scan:** "Start Scan" creates one `domain` task per confirmed root domain
   (UI caps selection at 10); results are folded back into the org's assets
   and risks via shared-IP/CDN edges (marked as such).
5. **Watch:** monitors re-run tasks on intervals; findings feed
   notifications (DingTalk/Feishu/WeCom/email/webhook) and exports.

---

## 6. How it does it (capability mechanics)

- **Subdomain enumeration:** subfinder passive sources, filtered by scope and
  merged with DNS observations.
- **DNS resolution:** dnsx for A/AAAA/CNAME; unresolvable hosts are recorded,
  not silently dropped.
- **Port scanning:** naabu with configurable port sets + rate limits; TLS
  probing via tlsx feeds certificate subjects back into discovery.
- **HTTP probing:** httpx with the netsafe dialer (private-range/SSRF
  blocking), capturing titles, status, tech headers, and response bodies.
- **Fingerprinting:** two layers — (a) `assets/webapp.json` +
  `assets/finger.json` keyword/header/icon rules (literal Chinese match values
  are intentional matching data), and (b) DB-stored fingerprint rules with a
  boolean expression DSL evaluated per response.
- **Sensitive info (WIH):** regex rules (`assets/rules/wih_rules.yml`) detect
  ID cards, phone numbers, JWTs, cloud access keys, webhooks; exclusion rules
  suppress known-noisy paths. Matching is id + target + content based.
- **File leaks:** dictionary probes for backup archives, repos, and admin
  paths (`.git`, `.zip`, consoles) with response-size/no-screenshot guards.
- **Spidering:** katana (in-process) within scope; screenshots via chromedp
  headless Chrome.
- **Vulnerability checks:** nuclei SDK with HTTP-only templates, plus the
  **96 Go-native plugins** (40 HTTP PoCs, 28 sniffers, 28 brute checks) that
  produce deduplicated findings with severity and evidence.
- **GitHub intelligence:** search + periodic monitors over public code for
  owned domains/keywords, with deduplicated leak history.
- **Reporting:** CSV/XLSX exports per organization; notification templates in
  English, risk-severity colored.

---

## 7. Operating and verifying

```bash
make build          # build SPA + Go binary (requires Go 1.27+, Node 22+)
./t4c migrate --config config.yaml
./t4c all           # server + workers + scheduler + projector
./t4c doctor        # config, DB, queue, DNS, GeoIP, Neo4j diagnostics

make verify         # go mod verify, vet, tests, frontend lint + typecheck + tests
make race           # race-detector test run
make infra-up       # docker compose: PostgreSQL + Redis only

cd web && npm run test:e2e          # Playwright (needs a running server)
npm run test:visual -- --update-snapshots   # regenerate visual snapshots
```

Docs: `docs/ARCHITECTURE.md` (authoritative design), `docs/PARITY.md`
(legacy → new feature mapping), `docs/SCANNER-DIFFERENCES.md` (behavior
differences vs nmap/massdns-era tools), `docs/EASM*.md` (organization and
attribution operations). The two `docs/superpowers/specs/*` files are
historical design notes; where they disagree with `ARCHITECTURE.md`,
`ARCHITECTURE.md` wins.

