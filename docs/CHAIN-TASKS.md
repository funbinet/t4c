# T4C v3.5.0 — Chain Implementation Task Tracker

Source of truth: `docs/CHAIN-IMPLEMENTATION-PLAN.md` (Recon → Exploit → Objectives).
Status legend: [ ] pending · [~] in progress · [x] done · [!] blocked

## Milestone A — Recon broadening & asset classification (T1–T2)

- [ ] **T1 — Recon broadening SDKs.** New `internal/modules/discovery/` adapters:
      `ct.go` (crt.sh Certificate Transparency), `asn.go` (RDAP/ASN netblocks),
      `dnszone.go` (AXFR + NSEC walk), `cloud.go` (S3/OSS/Azure/GCP bucket probing),
      `rdns.go` (PTR sweep), `endpoints.go` (Wayback + wordlist endpoint discovery).
      All implement existing `Resolver`/`PassiveEnumerator` seams with graceful
      degradation and internal timeouts. Wire into `Engine.Broaden *Broadeners`
      + opt-in `TaskOptions.Broaden` / `PolicyConfig.Broaden` (default off) via a
      new `broaden` step in `StepPlan`/`executeStep`/`queueForStep`.
- [ ] **T2 — Asset classification + Stage foundation.** `internal/domain/stage.go`
      (`Stage`, `StageForCategory`, `Next`); extend `AssetKind` with `bucket`,
      `api_endpoint`, `credential`, `password`, `session`, `file`, `exploited`;
      add `Asset.Confidence`, `Asset.Stage`, `Asset.Exploited/ExploitedAt`;
      `Stage` column on `Task/Finding/Monitor/Schedule/Scope`; AutoMigrate + indexes.

## Milestone B — Exploitation mode (T3–T8)

- [ ] **T3 — Exploit + Objective data model & store.** `internal/domain/exploit.go`
      (`ExploitTaskOptions`, `ExploitResult`, `ShellSession`, `ShellCommand`,
      `Artifact`), `internal/domain/objective.go` (`ObjectiveKind`, `Objective`,
      `ObjectiveAction`); `internal/store/exploit.go`, `internal/store/objective.go`
      with sessions/reignite/artifacts; AutoMigrate + indexes.
- [ ] **T4 — Exploit engine.** `exploit`/`postex`/`probe` steps in
      `internal/modules/tasking/`; `TaskExploit` kinds; `StepPlan` chains
      `recon-inputs → exploit → postex → objectives → stats`; queues
      `q.exploit.http` / `q.postex` / `q.objectives`; asset exploited flip;
      objective creation; session open.
- [ ] **T5 — Exploit SDKs (≥8) + stage APIs.** 10 exploit SDK plugins
      (credential-access, session-hijack, web-shell, rce, sqli, ssrf, lfi,
      api-exploit, brute, deserialization) with packaged wordlists;
      `/api/v1/{stage}/overview|organizations|assets|findings|tasks|automation/*`;
      `/api/v1/exploit/sessions` (+ `/command`, `/reignite`);
      `/api/v1/objectives/artifacts/:id` authenticated download; `AdvanceStage`
      governance action.
- [ ] **T6 — Mode shell + toggle.** `ModeContext`/`useMode()`; three-icon
      `mode-toggle.tsx` above Administration; nav label/icon swap per stage;
      Intelligence hidden in exploit/objectives; route prefixes
      `/exploit/*`, `/objectives/*`.
- [ ] **T7 — Recon reuse + org Overview tab.** Stage prop threading on existing
      pages; org-detail **Overview** tab (default, leftmost) with summary +
      org-scoped risk map + advance CTA; classified asset kinds in tables.
- [ ] **T8 — Exploit mode screens.** `/exploit` overview/organizations/assets
      (Exploited only)/findings/tasks + automation pages reusing shared
      components with `stage` prop.

## Milestone C — Objectives mode + docs (T9–T11)

- [ ] **T9 — Objective SDKs (≥8) + data wiring.** 10 objective SDK plugins
      (shell-session with re-ignition, file-exfil, screenshot, camera-feed,
      packet-capture, data-export, lateral-move, persistence, internal-recon,
      artifact-collect); session re-ignition backend; artifact management.
- [ ] **T10 — Objectives mode screens.** `/objectives` overview/organizations/
      assets (Produce view with Open Shell / Probe / Export / Run Task) / tasks;
      `shell-console.tsx` terminal popup; probe panel; export drawer.
- [ ] **T11 — Docs + final verify.** README/ARCHITECTURE/PARITY updates;
      `go build ./...`, `go vet ./...`, `go test ./internal/modules/...`,
      `pnpm -C web typecheck && pnpm -C web build`; final commit + push.

## Guardrails (checked every task)

- English-only code/commits/docs; conventional commits; push after each green task.
- Never regress the 9 shipped fixes (timeouts/reaper, org mapping, skeletons,
  clickable rows, icon tabs, real PoC severity, risk distribution, map pins,
  selectable policies).
- Broadening is opt-in (`TaskOptions.Broaden` / `PolicyConfig.Broaden`, default off).
- Per-step/per-task timeouts + zombie reaper respected; new steps register budgets.
- Artifacts/sessions auth-gated; never served from the SPA path.
