# T4C v3.5.0 — Chain Implementation Task Tracker

Source of truth: `docs/CHAIN-IMPLEMENTATION-PLAN.md` (Recon → Exploit → Objectives).
Status legend: [ ] pending · [~] in progress · [x] done · [!] blocked

> **Status: COMPLETE.** All milestones A/B/C and tasks T1–T11 are implemented,
> verified, committed and pushed. See [`docs/3-5-0.md`](3-5-0.md) for the full
> achievement report, the verification matrix and the commit history.

## Milestone A — Recon broadening & asset classification (T1–T2)

- [x] **T1 — Recon broadening SDKs.** `internal/modules/discovery/` adapters:
      `ct.go`, `asn.go`, `dnszone.go`, `cloud.go`, `rdns.go`, `endpoints.go`.
      All implement existing `Resolver`/`PassiveEnumerator` seams with graceful
      degradation and internal timeouts. Wired into `Engine.Broaden *Broadeners`
      + opt-in `TaskOptions.Broaden` / `PolicyConfig.Broaden` (default off) via a
      `broaden` step in `StepPlan`/`executeStep`/`queueForStep` on
      `q.discovery.broaden`. Recon registry now exposes 13 SDKs (≥8).
- [x] **T2 — Asset classification + Stage foundation.** `internal/domain/stage.go`
      (`Stage`, `StageForCategory`, `StageForTaskKind`, `Next`, `AllStages`);
      extended `AssetKind` with `bucket`, `api_endpoint`, `credential`, `password`,
      `session`, `file`, `exploited`; added `Asset.Confidence`, `Asset.Stage`,
      `Asset.Exploited/ExploitedAt`; `Stage` column on
      `Task/Finding/Monitor/Schedule/Scope`; AutoMigrate + indexes.

## Milestone B — Exploitation mode (T3–T8)

- [x] **T3 — Exploit + Objective data model & store.** `internal/domain/exploit.go`
      (`ExploitTaskOptions`, `ExploitResult`, `ShellSession`, `ShellCommand`,
      `Artifact`), `internal/domain/objective.go` (`ObjectiveKind`, `Objective`,
      `ObjectiveAction`); `internal/store/exploit.go`, `internal/store/objective.go`
      with sessions/reignite/artifacts; AutoMigrate + indexes.
- [x] **T4 — Exploit engine.** `exploit`/`postex`/`probe` steps in
      `internal/modules/tasking/`; `TaskExploit` kinds (`exploit`, `exploit_brute`,
      `exploit_inject`, `objective`); `StepPlan` chains; queues
      `q.exploit.http` / `q.exploit.postex` / `q.objectives.probe`; asset
      exploited flip; objective creation; session open; 10 exploit + 10 objective
      SDK plugins.
- [x] **T5 — Exploit SDKs (≥8) + stage APIs.** 10 exploit SDK plugins
      (credential-access, session-hijack, web-shell, rce, sqli, ssrf, lfi,
      api-exploit, brute, deserialization);
      `/api/v1/{stage}/tasks`; `/api/v1/exploit/sessions` (+ `/command`,
      `/reignite`, `/close`); objectives list/actions/artifacts + auth-gated
      download; `AdvanceStage` governance action; OpenAPI documentation.
- [x] **T6 — Mode shell + toggle.** `ModeContext`/`useMode()`; three-icon
      `mode-toggle.tsx` above Administration; nav label/icon swap per stage;
      Intelligence hidden in exploit/objectives; route prefixes
      `/exploit/*`, `/objectives/*`.
- [x] **T7 — Recon reuse + org Overview tab.** Stage prop threading on existing
      pages; org-detail **Overview** tab (default, leftmost) with summary +
      chain progress banner + org-scoped risk map + advance CTA; classified asset
      kinds in tables; typed chain API layer.
- [x] **T8 — Exploit mode screens + backend parity.** Dedicated chain pages for
      `/exploit/*` and `/objectives/*` (Overview, Organizations, Assets/Produce,
      Findings, Tasks, Automation); generic stage-scoped REST endpoints
      (`/{stage}/overview|organizations|assets|findings|monitors|schedules|policies|groups`);
      `Stage` threaded through legacy task creation; OpenAPI + generated types.

## Milestone C — Objectives mode + docs (T9–T11)

- [x] **T9 — Objective SDKs (≥8) + data wiring.** 10 objective SDK plugins
      (shell-session with re-ignition, file-exfil, screenshot, packet-capture,
      data-export, lateral-move, persistence, internal-recon, artifact-collect,
      credential-harvest); session re-ignition backend; auth-gated artifact
      download envelope; soft-delete lifecycle for `artifact` and `objective`
      with Recycle Bin recoverability; SDK contract tests enforcing ≥8 per stage.
- [x] **T10 — Objectives mode screens.** `/objectives` overview/organizations/
      assets (Produce view with Open Shell / Probe / Export / Run Task) / tasks;
      `shell-console.tsx` terminal popup; `export-drawer.tsx`; plus
      `ObjectiveWorkflow` (status transitions + operator action timeline),
      `ProduceBreakdown`, server-computed `GET /objectives/summary` analytics and
      console-wide lint/prettier hardening.
- [x] **T11 — Docs + final verify.** `docs/3-5-0.md` achievement report;
      README/ARCHITECTURE/PARITY updates; this tracker refreshed;
      `go build ./...`, `go vet ./...`, `go test ./internal/...`,
      `pnpm typecheck && pnpm lint && pnpm build && pnpm test`; final commit + push.

## Guardrails (checked every task)

- [x] English-only code/commits/docs; conventional commits; push after each green task.
- [x] Never regress the 9 shipped fixes (timeouts/reaper, org mapping, skeletons,
      clickable rows, icon tabs, real PoC severity, risk distribution, map pins,
      selectable policies).
- [x] Broadening is opt-in (`TaskOptions.Broaden` / `PolicyConfig.Broaden`, default off).
- [x] Per-step/per-task timeouts + zombie reaper respected; new steps register budgets.
- [x] Artifacts/sessions auth-gated; never served from the SPA path.
- [x] Every stage ships ≥8 dedicated SDKs (13 / 10 / 10), enforced by contract tests.

## Final verification results

| Check | Result |
| --- | --- |
| `go build ./...` | PASS |
| `go vet ./...` | PASS |
| `go test ./internal/...` | PASS (Postgres integration tests skip without `T4C_TEST_POSTGRES_DSN`) |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS (eslint + prettier check) |
| `pnpm build` | PASS (embeds into `internal/webui/dist`) |
| `pnpm test` | PASS (9 tests) |

## Post-plan hardening (after T1–T11)

- [x] **H1 — Durable stage governance.** `AdvanceStage` previously only wrote an
      audit event; the organization's stage is now persisted on
      `Organization.Stage`, backfilled by `Migrate()`, validated with a
      compare-and-swap guard, exposed by `GET /organizations/{id}/stage`
      (with audit-derived transition history) and surfaced in the console.
      Pure unit tests + Postgres integration tests + OpenAPI contract added.
      See [`docs/3-5-0.md`](3-5-0.md) §11.
