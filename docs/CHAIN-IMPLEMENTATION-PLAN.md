# T4C Chain Implementation Plan — Recon → Exploit → Objectives

> Status: Blueprint (single source of truth). Every implementation task is created from this
> document and committed/pushed individually as it completes. The plan MUST stay in sync with
> the code as work proceeds.

---

## 0. Purpose & Scope

T4C is today a single-purpose **External Attack Surface Management (EASM)** console: it
reconnoiters organizations (domains, IPs, sites), maps them, scores risk, and runs tasks.
The product vision is a **three-stage offensive-security chain** in which the output of one
stage feeds the next:

```text
  ┌─────────────────────┐  domains/IPs/creds/endpoints  ┌─────────────────────┐
  │   RECON (EASM)      │ ─────────────────────────────▶ │   EXPLOITATION     │
  │  discover & map     │                                │  validate & breach │
  └─────────────────────┘                                └─────────┬───────────┘
                                                                   │ shells / loot /
                                                                   │ downloads / probes
                                                                   ▼
                                                        ┌─────────────────────┐
                                                        │   OBJECTIVES        │
                                                        │ extract, display,   │
                                                        │ map, export, act    │
                                                        └─────────────────────┘
```

### 0.1 Hard requirement — SDKs per mode

> **Every mode ships a MINIMUM of 8 SDKs.** Recon currently has 7 discovery SDKs and must be
> broadened to ≥8 (this plan takes it to 10). The new **Exploitation** and **Objectives**
> modes each introduce their own dedicated SDK set of **≥8** SDKs. SDKs are mode-owned: the
> exploit SDKs consume recon outputs (domains, IPs, credentials, cookies, endpoints, services)
> and the objective SDKs consume exploit outputs (sessions, loot, shells).

### 0.2 Milestones (commit/push boundary per milestone)

- **Milestone A — Recon broadening & hardening.** Reach ≥8 recon SDKs, add asset
  classification, raise precision. (`T1`, `T2`)
- **Milestone B — Exploitation mode.** Stage foundation, exploit data model, engine, ≥8
  exploit SDKs, APIs, Exploit UI. (`T3`–`T7`)
- **Milestone C — Objectives mode + docs.** Objective data model, ≥8 objective SDKs, session
  re-ignition, artifact management, Objectives UI, documentation, final verify. (`T8`–`T11`)

Each milestone is independently runnable and testable.

### 0.3 Shared principles

- Organizations are **discovered once in Recon** and shared across all stages.
- A **Stage / Mode** (`recon | exploit | objectives`) threads through tasks, findings,
  automation, policies, and UI; the active mode is chosen from a three-icon sidebar toggle.
- Nothing is duplicated per stage except where a derived flag is cheaper (e.g. `Asset.Exploited`).
- All prose and identifiers are in English; code follows existing Go/TS conventions.

---

## 1. Current State (what already exists)

### 1.1 Discovery SDKs (the current "7")

`internal/modules/discovery/` wraps ProjectDiscovery SDKs across these adapters:

| Adapter file | Capability | Stage contribution |
| ------------ | ---------- | ------------------ |
| `dns.go`     | DNS resolution (`dnsx`) | Recon: host resolution |
| `passive.go` | Passive subdomain enumeration (`subfinder`) + FOFA | Recon: subdomains |
| `port.go`    | Port scanning (`naabu`) + service/OS detection | Recon: open ports |
| `http.go`    | HTTP probing (`httpx`) + TLS (`tlsx`) | Recon: web surface |
| `domain.go`  | Target parsing & helpers | Recon: targeting |
| `webintel`   | Web fingerprinting / nuclei | Recon→Exploit bridge |
| `poc`        | PoC plugins (emit `FindingVuln`) | Recon→Exploit bridge |

The plan broadens this to **≥8 recon SDKs** (§3) and adds independent **exploit (§4)** and
**objectives (§5)** SDK sets of ≥8 each.

### 1.2 Tasking pipeline (reused as the chain engine)

- `internal/modules/tasking/engine.go` — `Engine.Submit`, `RunStep`, `enqueueStep`,
  `HandleDelivery`, `StepPlan`, `MergePolicy`. Tasks have a `Kind`
  (`domain`/`ip`/`risk_cruising`/`asset_site_*`/`fofa`/`github`/`wih`), a set of `TaskStep`s,
  and a `PolicyID`.
- `StepPlan(t)` builds an ordered chain per `Kind`, e.g. `domain` →
  `dns → port → http → webintel → poc → stats`. `queueForStep` routes each step to a Redis
  stream (`q.discovery.dns`, `q.discovery.network`, `q.web.fetch`, `q.web.scan`,
  `q.poc.http`, `q.maintenance`, …).
- `executeStep` switches on `step.Kind` (`dns`, `port`, `http`, `webintel`, `wih`, `poc`,
  `fofa`, `github`, `stats`).
- `MergePolicy` applies a `PolicyConfig` (`DomainPolicy`, `IPPolicy`, `SitePolicy`, `POC`,
  `Brute`) onto `TaskOptions`.

### 1.3 Policy framework (already extended in prior work)

- `domain.Policy.Category` with constants `attack-surface | vuln-assessment | probing |
  exploitation` (`internal/domain/models.go`). `NormalizePolicyCategory` +
  `PolicyCategoriesByLabel`.
- `ModulePolicyTemplates()` seeds example policies for `vuln-assessment`, `probing`, and
  `exploitation` (`internal/store/policy.go`).
- `Organization.DefaultPolicyID` (persisted, updatable via governance API) is the fallback
  when a scan is created without an explicit policy.

### 1.4 Sidebar / navigation (the surface to re-shape)

`web/src/components/layout/app-shell.tsx` defines `NavItem`/`NavGroup` and four groups:

- **Attack Surface**: Overview `/`, Organizations `/organizations`, Assets `/assets`,
  Risks `/findings`, Tasks `/tasks`.
- **Automation**: Monitors `/automation/monitors`, Schedules `/automation/schedules`,
  Scan Policies `/automation/policies`, Asset Groups `/automation/groups`.
- **Intelligence**: GitHub, Fingerprints, PoC Plugins.
- **Administration**: Users, API Key, Audit Log, Recycle Bin, System.

### 1.5 Organization detail

`web/src/pages/organization-detail-page.tsx` shows six stat cards + tabs (**Domains, Assets,
Risk, Tasks**) but **no Overview tab**. The plan adds an **Overview** tab as the default,
rendering a centered summary box + the org's own map below the cards.

---

## 2. Stage / Mode Architecture

### 2.1 Definition of a Stage

```go
// internal/domain/stage.go (NEW)
package domain

type Stage string

const (
    StageRecon      Stage = "recon"      // external attack surface discovery & mapping
    StageExploit    Stage = "exploit"    // controlled exploitation / validation of findings
    StageObjectives Stage = "objectives" // extracted loot, shells, downloads, probes, exports
)

var AllStages = []Stage{StageRecon, StageExploit, StageObjectives}

func (s Stage) Valid() bool {
    switch s {
    case StageRecon, StageExploit, StageObjectives:
        return true
    }
    return false
}

// Next returns the downstream stage, or "" if s is the terminal stage.
func (s Stage) Next() Stage {
    switch s {
    case StageRecon:
        return StageExploit
    case StageExploit:
        return StageObjectives
    default:
        return ""
    }
}

// StageForCategory maps a policy category to a chain stage.
func StageForCategory(c string) Stage {
    if c == PolicyCategoryExploitation {
        return StageExploit
    }
    return StageRecon // vuln-assessment / probing are recon-class; objectives are derived.
}
```

### 2.2 How Stage + Asset classification thread through entities

| Entity        | Field added | Meaning |
| ------------- | ----------- | ------- |
| `Task`        | `Stage Stage` (default `recon`) | Which chain link owns the task. |
| `Finding`     | `Stage Stage` | Risk scoped per stage (recon vs exploit). |
| `Asset`       | `Kind AssetKind` | **Classification**: what was found (`domain`, `ip`, `service`, `web`, `api_endpoint`, `credential`, `password`, `session`, `certificate`, `bucket`, `file`). |
| `Asset`       | `Exploited bool`, `ExploitedAt *time.Time` | Derived flag from a successful exploit. |
| `Policy`      | (already `Category`) | Map `Category` → `Stage` via `StageForCategory`. |
| `Monitor`     | `Stage Stage` | Per-stage monitors. |
| `Schedule`    | `Stage Stage` | Per-stage schedules. |
| `Scope` (Asset Groups) | `Stage Stage` | Per-stage asset groups. |

> **Asset classification (new requirement).** Recon no longer collapses everything into a
> generic "asset". Every discovered item is tagged with an `AssetKind` so it can be displayed,
> mapped, and filtered separately (credential vs password vs domain vs API endpoint vs
> service). The classification is derived from the SDK that produced it and the enrichment
> metadata. This classification is what feeds the exploit SDKs (e.g. a `credential` asset
> drives the credential-access exploit SDK; a `session` asset drives session-hijack).

### 2.3 Routing / URL model (frontend)

Recon keeps the existing top-level routes as the default mode; Exploit/Objectives get
mode-prefixed mirrors so deep links and the toggle are explicit:

```text
Recon:      /  /organizations  /assets  /findings  /tasks
            /automation/*  /admin/*  /intelligence/*

Exploit:    /exploit             (overview)
            /exploit/organizations  /exploit/assets  /exploit/findings  /exploit/tasks
            /exploit/automation/monitors|schedules|policies|groups

Objectives: /objectives          (overview)
            /objectives/organizations  /objectives/assets  (the "Produce" view)
            /objectives/tasks
```

A single `ModeContext` (React context + `localStorage` + URL prefix) holds the active `Stage`;
every page reads `mode` and renders the same component with a `stage` prop, so Recon screens
are reused verbatim for Exploit/Objectives with mode-scoped data and labels.

### 2.4 The sidebar toggle (three-icon box)

A centered, icon-only `ModeToggle` is placed at the bottom of the sidebar, immediately above
the **Administration** group and below the other nav groups.

```tsx
// web/src/components/layout/mode-toggle.tsx (NEW)
const STAGES: { stage: Stage; label: string; icon: LucideIcon }[] = [
  { stage: 'recon',      label: 'Reconnaissance', icon: Radar },
  { stage: 'exploit',    label: 'Exploitation',   icon: Crosshair },
  { stage: 'objectives', label: 'Objectives',     icon: Target },
];
```

Clicking a stage navigates to that stage's overview route and persists the choice.

---

## 3. Recon Hardening & Broadening — MINIMUM 8 SDKs

The current discovery layer is effective but has only 7 SDKs. Broaden "super precise recon"
to **at least 8 SDKs** (this plan delivers **10**) behind the existing `discovery` interfaces
so new SDKs drop in without touching the tasking engine, plus precision improvements.

### 3.1 Recon SDK inventory (10, meets the ≥8 minimum)

| # | SDK adapter (file) | Capability | Asset kinds produced |
| - | ----------------- | ---------- | ------------------- |
| 1 | `dns.go` (existing) | DNS resolution (`dnsx`) | `ip`, `domain` |
| 2 | `passive.go` (existing) | Passive subdomain enumeration (`subfinder`) + FOFA | `domain` |
| 3 | `port.go` (existing) | Port scanning (`naabu`) + service/OS detection | `service`, `ip` |
| 4 | `http.go` (existing) | HTTP probing (`httpx`) + TLS (`tlsx`) | `web`, `certificate` |
| 5 | `domain.go` (existing) | Target parsing & helpers | `domain` |
| 6 | `webintel` (existing) | Web fingerprinting / nuclei | `web`, `service` |
| 7 | `poc` (existing) | PoC plugins (emit `FindingVuln`) | `service` |
| 8 | **`ct.go` (NEW)** | Certificate Transparency — enumerate subdomains via crt.sh / CT logs | `domain`, `certificate` |
| 9 | **`asn.go` (NEW)** | ASN / network intelligence — resolve org ASN ranges, BGP, netblocks | `ip` |
| 10 | **`dnszone.go` (NEW)** | DNS zone walk — AXFR attempt + NSEC walk for exhaustive zone recovery | `domain` |
| 11 | **`cloud.go` (NEW, extra)** | Cloud asset discovery — exposed buckets/metadata (S3, OSS, Azure, GCP) | `bucket`, `file` |
| 12 | **`rdns.go` (NEW, extra)** | Reverse DNS & PTR sweep over netblocks | `ip`, `domain` |
| 13 | **`endpoints.go` (NEW, extra)** | API / endpoint discovery — wordlist + Wayback archive URL/path discovery | `api_endpoint`, `web` |

> Reaching **≥8** is mandatory; the plan lists 10 core + 3 extras (13 total) for headroom.

### 3.2 Precision improvements (no new SDK, better orchestration)

- **De-duplication & confidence scoring** across all passive sources before `dns` resolves.
- **Wildcard detection** before brute-force — extended to per-record.
- **Smart host budget** (`hostBudget()`) per org to bound cost.
- **Asset fingerprint confidence** so Overview map pins reflect precision; classification
  (`Asset.Kind`) assigned by the producing SDK + enrichment.

Each new adapter implements the existing `discovery.Resolver` / `PassiveEnumerator` /
`PortScanner` / `HTTPProbe` / `TLSInspector` interface so `StepPlan` and `executeStep` need no
change — only `Engine` wiring + `Submit` options.

---

## 4. Exploitation SDKs — MINIMUM 8 (NEW mode)

Exploitation is a **clone of the Recon console, intelligently designed for breach**. It has
its **own SDK set (≥8)** that consumes Recon outputs. The exploit SDKs read classified Recon
assets and turn validated findings into sessions/loot/objectives.

### 4.1 Exploit SDK inventory (10, meets the ≥8 minimum)

| # | Exploit SDK | Consumes (recon asset kinds) | Action | Objective created on success |
| - | ----------- | --------------------------- | ------ | ---------------------------- |
| 1 | `credential-access` | `credential`, `password`, `service` | Reuse discovered creds to authenticate / open a session | `shell` / `loot` |
| 2 | `session-hijack` | `session`, `cookie` | Replay discovered cookies/session IDs to hijack auth | `shell` |
| 3 | `web-shell` | `web`, `api_endpoint` | Upload/trigger a web shell on a discovered endpoint | `shell` |
| 4 | `rce` | `service`, `web` | Remote code execution via discovered services/CVEs | `shell` |
| 5 | `sqli` | `web`, `api_endpoint` | SQL injection against discovered DB endpoints | `loot` / `download` |
| 6 | `ssrf` | `web`, `api_endpoint` | SSRF to reach internal services / metadata | `loot` |
| 7 | `lfi` | `web`, `file` | Local/remote file inclusion to read config/keys | `loot` |
| 8 | `api-exploit` | `api_endpoint`, `credential` | Abuse broken auth / IDOR / leaked keys | `loot` |
| 9 | `brute` | `service`, `web` | Credential brute-force using built-in username/password wordlists against discovered logins | `credential` (new) |
| 10 | `deserialization` | `web`, `service` | Exploit Java/PHP/.NET deserialization → RCE | `shell` |

Each exploit SDK is a `poc`-style plugin exposing `Meta()` + `Run(targets, opts)` and emits a
`Finding` whose `EffectiveSeverity()` is taken from the plugin `Meta().Severity`. A
**successful** exploit finding flips `Asset.Exploited = true` and creates one or more
`Objective` rows (kind shell/download/loot) plus, when `Shell` is set, opens a `Session`.

### 4.2 Built-in wordlists

`brute` (and `credential-access`) draw from a packaged wordlist of common usernames/passwords
shipped under `internal/modules/exploit/wordlists/` so the framework can brute/crack discovered
logins without external inputs.

---

## 5. Objectives SDKs — MINIMUM 8 (NEW mode, the "Produce" layer)

Objectives consume exploit outputs (sessions, loot, shells) and turn them into extractable,
displayable, mappable, exportable, and actionable results. It has its **own SDK set (≥8)**.

### 5.1 Objective SDK inventory (10, meets the ≥8 minimum)

| # | Objective SDK | Consumes (exploit output) | Action |
| - | ------------- | ------------------------- | ------ |
| 1 | `shell-session` | `Session` | Interactive shell manager: spawn, interact, **re-ignite / re-open** a previously closed session from its recorded protocol+host+port+creds. |
| 2 | `file-exfil` | `Session`, `Artifact` | Download/exfiltrate files & loot from a compromised asset. |
| 3 | `screenshot` | `web`, `Session` | Capture screenshots of accessible interfaces. |
| 4 | `camera-feed` | `web`, `service` | Access IoT cameras / live feeds discovered during recon. |
| 5 | `packet-capture` | `Session`, `service` | Sniff/capture packets on the asset. |
| 6 | `data-export` | `Session`, `loot` | Export structured data (DB dumps, configs) as `Artifact`s. |
| 7 | `lateral-move` | `Session`, `ip` | Pivot to internal hosts discovered via `asn`/`rdns`. |
| 8 | `persistence` | `Session` | Establish persistence on a compromised asset. |
| 9 | `internal-recon` | `Session` | Recon from inside: discover internal hosts/services. |
| 10 | `artifact-collect` | `loot`, `credential`, `key` | Collect & catalog keys, tokens, credentials as `Artifact`s. |

### 5.2 Session re-ignition (explicit requirement)

A closed `Session` is **not** discarded. `shell-session` can **re-ignite** it: the recorded
`Protocol`, `Host`, `Port`, and (where safe) the `AssetID`/`TaskID` are reused to re-open the
same access path. Re-ignition creates a new `Session` row linked to the original via
`ReignitedFrom *string`, and appends to the same command history so playback/audit continues.

### 5.3 Artifact management & actions (explicit requirement)

Every extracted file becomes an `Artifact` (never served via the SPA path; streamed through an
auth-gated download endpoint). The Objectives "Produce" view lists artifacts with **action
buttons** (like other tables): **View**, **Download**, **Delete**, **Export**, and
**Re-run task**. `ObjectiveAction` rows audit every action taken on an objective/produce item
(probe, export, task, note).

---

## 6. Backend Data Model (`ALL TYPES`)

### 6.1 `internal/domain/stage.go` (NEW) — §2.1.

### 6.2 Asset classification — extend `Asset` in `internal/domain/models.go`

```go
type AssetKind string
const (
    AssetDomain       AssetKind = "domain"
    AssetIP           AssetKind = "ip"
    AssetService      AssetKind = "service"
    AssetWeb          AssetKind = "web"
    AssetAPIEndpoint  AssetKind = "api_endpoint"
    AssetCredential   AssetKind = "credential"
    AssetPassword     AssetKind = "password"
    AssetSession      AssetKind = "session"
    AssetCertificate  AssetKind = "certificate"
    AssetBucket       AssetKind = "bucket"
    AssetFile         AssetKind = "file"
)

// on Asset:
//   Kind        AssetKind     `json:"kind"`        // classification from producing SDK
//   Stage       Stage         `json:"stage"`       // owning chain stage (default recon)
//   Exploited   bool          `json:"exploited"`
//   ExploitedAt *time.Time    `json:"exploitedAt,omitempty"`
//   Confidence  float64       `json:"confidence"`  // 0..1 precision score
```

### 6.3 Exploit types — `internal/domain/exploit.go` (NEW)

```go
package domain

type ExploitTaskOptions struct {
    TaskOptions
    ValidateOnly bool `json:"validateOnly"`
    Loot         bool `json:"loot"`
    Shell        bool `json:"shell"`
    MaxSessions  int  `json:"maxSessions"`
}

type ExploitResult struct {
    AssetID     string    `json:"assetId"`
    Plugin      string    `json:"plugin"`
    Success     bool      `json:"success"`
    Severity    string    `json:"severity"`
    Evidence    string    `json:"evidence"`
    ObjectiveID *string   `json:"objectiveId,omitempty"`
    ExecutedAt  time.Time `json:"executedAt"`
}

// ShellSession is an interactive shell/tunnel opened against a compromised asset.
type ShellSession struct {
    ID            string     `gorm:"primaryKey;size:24" json:"id"`
    OrganizationID string    `json:"organizationId"`
    AssetID       string     `json:"assetId"`
    TaskID        string     `json:"taskId"`
    Protocol      string     `json:"protocol"` // ssh | winrm | reverse | web-shell
    State         string     `json:"state"`    // open | closed | expired
    Host          string     `json:"host"`
    Port          int        `json:"port"`
    ReignitedFrom *string    `json:"reignitedFrom,omitempty"`
    CreatedBy     string     `json:"createdBy"`
    OpenedAt      time.Time  `json:"openedAt"`
    ClosedAt      *time.Time `json:"closedAt,omitempty"`
    LastActive    time.Time  `json:"lastActive"`
    SchemaVersion int        `json:"schemaVersion"`
    Lifecycle     `gorm:"embedded"`
}

type ShellCommand struct {
    ID        string    `gorm:"primaryKey;size:24" json:"id"`
    SessionID string    `json:"sessionId"`
    Seq       int       `json:"seq"`
    Command   string    `json:"command"`
    Output    string    `json:"output"`
    ExitCode  int       `json:"exitCode"`
    RunAt     time.Time `json:"runAt"`
}

type Artifact struct {
    ID            string    `gorm:"primaryKey;size:24" json:"id"`
    OrganizationID string   `json:"organizationId"`
    AssetID       string    `json:"assetId"`
    ObjectiveID   string    `json:"objectiveId"`
    TaskID        string    `json:"taskId"`
    Name          string    `json:"name"`
    Kind          string    `json:"kind"` // file | archive | db-dump | config | key
    SizeBytes     int64     `json:"sizeBytes"`
    StoragePath   string    `json:"storagePath"`
    Checksum      string    `json:"checksum"`
    ExportedAt    time.Time `json:"exportedAt"`
    CreatedBy     string    `json:"createdBy"`
    SchemaVersion int       `json:"schemaVersion"`
    Lifecycle     `gorm:"embedded"`
}
```

### 6.4 Objective types — `internal/domain/objective.go` (NEW)

```go
package domain

type ObjectiveKind string
const (
    ObjectiveShell    ObjectiveKind = "shell"
    ObjectiveDownload ObjectiveKind = "download"
    ObjectiveProbe    ObjectiveKind = "probe"
    ObjectiveLoot     ObjectiveKind = "loot"
    ObjectiveFlag     ObjectiveKind = "flag"
)

type Objective struct {
    ID            string         `gorm:"primaryKey;size:24" json:"id"`
    OrganizationID string        `json:"organizationId"`
    AssetID       string         `json:"assetId"`
    TaskID        string         `json:"taskId"`
    SessionID     *string        `json:"sessionId,omitempty"`
    Kind          ObjectiveKind  `json:"kind"`
    Title         string         `json:"title"`
    Detail        string         `json:"detail"`
    Severity      string         `json:"severity"`
    Status        string         `json:"status"` // open | in_progress | closed | exported
    Metadata      map[string]any `gorm:"type:jsonb;serializer:json" json:"metadata,omitempty"`
    DiscoveredAt  time.Time      `json:"discoveredAt"`
    CreatedBy     string         `json:"createdBy"`
    SchemaVersion int            `json:"schemaVersion"`
    Lifecycle     `gorm:"embedded"`
}

type ObjectiveAction struct {
    ID          string    `gorm:"primaryKey;size:24" json:"id"`
    ObjectiveID string    `json:"objectiveId"`
    Kind        string    `json:"kind"` // probe | export | task | note | delete
    Payload     string    `json:"payload"`
    Result      string    `json:"result"`
    Actor       string    `json:"actor"`
    CreatedAt   time.Time `json:"createdAt"`
}
```

### 6.5 Store methods (NEW) — `internal/store/exploit.go` / `internal/store/objective.go`

- `CreateExploitTask`, `ListExploitTasks(ctx, stage, orgID, filters)`, `MarkAssetExploited`.
- `OpenSession`, `CloseSession`, `ReigniteSession`, `ListSessions(ctx, orgID, assetID)`,
  `AppendShellCommand`, `GetSession`.
- `CreateArtifact`, `ListArtifacts(ctx, orgID, objectiveID)`, `GetArtifact` (stream w/ auth).
- `CreateObjective`, `ListObjectives(ctx, orgID, kind, status, stage)`,
  `UpdateObjectiveStatus`, `AddObjectiveAction`, `GetObjective`.
- AutoMigrate + JSONB/index coverage for all new tables.

### 6.6 Engine steps (NEW) — `internal/modules/tasking/steps.go`

| Step kind | Purpose |
| --------- | ------- |
| `exploit` | Run exploit SDKs against classified recon targets; emit `Finding` + flip `Asset.Exploited`; on success create `Objective` (shell/download/loot) and optionally open a `ShellSession`. |
| `postex`  | Post-exploitation: open `ShellSession`, pull `Artifact` loot. |
| `probe`   | Lightweight "probe it" confirmation for objectives. |

`StepPlan` gains `TaskExploit` kinds chaining `recon-inputs → exploit → postex → objectives →
stats`. `queueForStep` adds `q.exploit.http`, `q.postex`, `q.objectives`.

---

## 7. Backend APIs (mode-scoped)

Existing recon endpoints stay. Add `/api/v1/exploit/*` and `/api/v1/objectives/*` mirroring
the recon surface, each accepting/returning `stage`:

- `GET /api/v1/{stage}/overview` — stage-scoped stats + geo + graph seed.
- `GET /api/v1/{stage}/organizations`, `/organizations/:id` (mode-aware summary).
- `GET /api/v1/{stage}/assets`, `/assets/:id` (exploit filters `Exploited`; assets classified by `Kind`).
- `GET /api/v1/{stage}/findings` (risk scoped by stage).
- `POST /api/v1/{stage}/tasks` (create task with `stage` + policy/category).
- `GET/POST /api/v1/exploit/sessions`, `/sessions/:id/command`, `/sessions/:id/reignite`.
- `GET /api/v1/objectives`, `/objectives/:id`, `/objectives/:id/actions` (probe/export/task/delete).
- `GET /api/v1/objectives/artifacts/:id` (authenticated download).
- Automation parity: `/api/v1/{stage}/monitors`, `/schedules`, `/policies`, `/groups` (filtered by `stage`).

Governance `UpdateOrganization` already supports `DefaultPolicyID`; add an `AdvanceStage(orgID,
to Stage)` action validating recon completeness before exploit, and exploit completeness before
objectives.

---

## 8. UI / UX — Every Screen

### 8.1 Shared shell changes

- `ModeContext` + `useMode()` hook.
- `mode-toggle.tsx` three-icon box in sidebar (above Administration).
- Top nav items swap labels/icons per stage (Recon "Attack Surface" → Exploit "Exploitation"
  → Objectives "Objectives"); **Intelligence group hidden in Exploit & Objectives**;
  **Administration always present**.

### 8.2 Recon mode

Unchanged from today (the validated EASM console), **except** the org-detail **Overview tab
becomes the default** (§8.4) and assets are now shown classified by `Kind`.

### 8.3 Exploit mode (mirrors Recon, mode-scoped)

| Route | Screen | Difference from Recon |
| ----- | ------ | --------------------- |
| `/exploit` | Exploitation Overview | Exploited-asset counts, exploit risk, sessions |
| `/exploit/organizations` | Organizations (exploit view) | Orgs with exploited assets; exploit risk |
| `/exploit/assets` | Assets (exploited) | Only `Exploited`; exploit severity; classified |
| `/exploit/findings` | Risks (exploit) | `stage=exploit` findings |
| `/exploit/tasks` | Tasks (exploit) | `stage=exploit`; exploit policy selector |
| `/exploit/automation/*` | Monitors/Schedules/Policies/Groups (exploit) | `stage=exploit` |

Org detail in exploit mode shows an **"Advance to Objectives"** action once exploit coverage
is sufficient.

### 8.4 Organization detail — Overview tab (default, all stages)

Add an **Overview** tab (leftmost, default) to `organization-detail-page.tsx`, rendered below
the six stat cards as a centered panel:

- Org summary (canonical name, region, status, asset/risk counts for the active stage).
- The org's **own map** (risk-colored pins, reuse `surface-map.tsx`).
- Quick "advance to next stage" CTA.

Tabs order: **Overview · Domains · Assets · Risk · Tasks** (Overview default).

### 8.5 Objectives mode ("Produce")

| Route | Screen | Notes |
| ----- | ------ | ----- |
| `/objectives` | Objectives Overview | Counts of shells/loot/downloads/probes by org |
| `/objectives/organizations` | Organizations (objective view) | Orgs with objectives; objective counts |
| `/objectives/assets` | Produce / Assets | Classified assets + per-asset objective actions |
| `/objectives/tasks` | Tasks (objectives) | Tasks that produced objectives |

Asset rows expose **actions**: *Open Shell* (terminal popup + re-ignite), *Probe*,
*Export/Download* (artifact), *Run Task* (spawn follow-up). The terminal popup
(`components/objectives/shell-console.tsx`) opens/ reignites a `ShellSession`, sends commands
to `/sessions/:id/command`, streams `ShellCommand` output. The export drawer lists `Artifact`s
with View/Download/Delete/Export/Re-run action buttons.

---

## 9. Automation parity

`Monitor`, `Schedule`, `Scope` (Asset Groups), `Policy` gain a `Stage` field and per-stage
list/create endpoints. Seed exploit-class policies (already partly done via
`ModulePolicyTemplates`). Schedules/monitors in exploit mode reference exploit tasks;
objectives need no automation (per product decision) but the `Stage` field is reserved.

---

## 10. Build / Verify Strategy

- `go build ./...` and `go vet ./...` must pass.
- `go test ./internal/...` — unit + integration (postgres) for new store/engine code.
- Frontend: `cd web && pnpm typecheck && pnpm build` (embeds into `internal/webui/dist`).
- Docker: `make build` regenerates the embedded console and the backend image.
- Manual smoke: toggle each mode; run a recon task; advance org to exploit; open/re-ignite a
  session; export an artifact.

---

## 11. Implementation Milestones & Task Breakdown

| Milestone | # | Task | Deliverable |
| --------- | - | ---- | ----------- |
| **A** | T1 | Recon broadening SDKs | New recon adapters: `ct`, `asn`, `dnszone`, `cloud`, `rdns`, `endpoints` (takes recon to 10+ SDKs, ≥8) + precision dedup/confidence; wire into `Engine`. |
| **A** | T2 | Asset classification + Stage foundation | `Asset.Kind`/`AssetKind`, `Asset.Confidence`, `Stage` fields on Task/Finding/Asset/Monitor/Schedule/Scope; `stage.go`; `StageForCategory`; AutoMigrate. |
| **B** | T3 | Exploit + Objective data model & store | `exploit.go`, `objective.go` domain types; `store/exploit.go`, `store/objective.go` (incl. `ReigniteSession`); AutoMigrate + indexes. |
| **B** | T4 | Exploit engine | `exploit`/`postex`/`probe` steps, `TaskExploit` kinds, `StepPlan` chains, queues, asset-exploited flip, objective creation, session open. |
| **B** | T5 | Exploit SDKs (≥8) + APIs | 10 exploit SDK plugins; `/api/v1/{stage}/*`, `AdvanceStage`, session command/reignite, artifact download, governance updates. |
| **B** | T6 | Mode shell + toggle | `ModeContext`, `mode-toggle.tsx`, sidebar nav swap, route prefixes, Administration always-on, Intelligence hidden in exploit/objectives. |
| **B** | T7 | Recon reuse + org Overview tab | Mode prop on existing pages; org-detail Overview tab (summary + org map) as default; classified assets. |
| **B** | T8 | Exploit mode screens | Exploit Overview/Organizations/Assets/Risks/Tasks + exploit automation pages (mode-scoped queries). |
| **C** | T9 | Objective SDKs (≥8) + data wiring | 10 objective SDK plugins; session re-ignition; artifact management. |
| **C** | T10 | Objectives mode screens | Objectives Overview/Organizations/Assets(Produce)/Tasks + asset actions (shell/probe/export/run-task) + terminal popup + export drawer. |
| **C** | T11 | Docs + final verify | Update README/ARCHITECTURE; `go build/vet/test`, `pnpm build`; commit & push each task. |

Each task is committed and pushed individually (English messages) as it completes. The three
milestones are independently runnable and testable.

---

## 12. Risks & Decisions

- **Asset duplication**: We do **not** duplicate assets per stage; exploit is a derived state
  (`Asset.Exploited`) over recon assets, and assets are now classified by `Kind` so recon
  outputs are shown separately. Objectives reference assets + sessions.
- **SDK minimum**: Every mode ships ≥8 SDKs (Recon 10+, Exploit 10, Objectives 10). This is a
  hard requirement, not a target.
- **Objectives automation**: intentionally omitted for now; `Stage` reserved for future.
- **Security**: Sessions/artifacts are sensitive — all access is auth-gated, artifacts never
  served via the static SPA path, `ShellCommand` and `ObjectiveAction` are audit-logged, and
  re-ignition reuses recorded (non-secret) connection metadata only.
