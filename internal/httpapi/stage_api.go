package httpapi

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/funbinet/t4c/internal/domain"
	"github.com/funbinet/t4c/internal/modules/exploit"
	"github.com/funbinet/t4c/internal/modules/objective"
	"github.com/funbinet/t4c/internal/platform/httpx"
	"github.com/funbinet/t4c/internal/store"
)

// chainPluginsOnce guarantees the built-in exploit/objective SDK registries are
// populated exactly once per process, even when no tasking engine is wired
// (e.g. in read-only API deployments and contract tests).
var chainPluginsOnce sync.Once

func ensureChainPlugins() {
	chainPluginsOnce.Do(func() {
		_ = exploit.Builtin(nil)
		_ = objective.Builtin(nil)
	})
}

// reconSDKRegistry is the recon-stage SDK inventory (plan §3.1). It is exposed
// through the stage overview so every mode reports its own >=8 SDK set.
func reconSDKRegistry() []map[string]any {
	sdks := []struct {
		name, category, description string
	}{
		{"dnsx", "dns", "Authoritative DNS resolution and record enrichment"},
		{"subfinder", "passive", "Passive subdomain enumeration across public sources"},
		{"naabu", "network", "Port scanning with service and OS fingerprinting"},
		{"httpx", "web", "HTTP probing, technology detection and TLS inspection"},
		{"tlsx", "tls", "Certificate and TLS configuration inspection"},
		{"nuclei", "webintel", "Web fingerprinting and template-driven checks"},
		{"poc", "vuln", "Proof-of-concept plugins that emit vulnerability findings"},
		{"ct-logs", "passive", "Certificate Transparency subdomain and certificate discovery"},
		{"asn", "network", "ASN / BGP netblock and organization range intelligence"},
		{"dnszone", "dns", "AXFR attempt and NSEC zone walk for exhaustive recovery"},
		{"cloud", "cloud", "Exposed bucket and cloud metadata discovery"},
		{"rdns", "dns", "Reverse DNS and PTR sweeps across discovered netblocks"},
		{"endpoints", "web", "API endpoint discovery via wordlists and Wayback archive"},
	}
	out := make([]map[string]any, 0, len(sdks))
	for _, sdk := range sdks {
		out = append(out, map[string]any{
			"name": sdk.name, "type": sdk.category, "category": "recon",
			"severity": "info", "description": sdk.description,
		})
	}
	return out
}

func stagePluginRegistry(stage domain.Stage) []map[string]any {
	ensureChainPlugins()
	switch stage {
	case domain.StageExploit:
		return exploitRegistry()
	case domain.StageObjectives:
		return objectiveRegistry()
	default:
		return reconSDKRegistry()
	}
}

// --- Stage overview ---

// handleStageOverview returns stage-scoped statistics, the AssetKind
// distribution, the owning SDK registry and recent chain activity.
func (s *Server) handleStageOverview(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	counts := map[string]int64{}
	byKind := map[string]int64{}
	orgCounts := map[string]map[string]int64{}
	var recentSessions []domain.ShellSession
	var recentObjectives []domain.Objective
	var recentArtifacts []domain.Artifact
	if s.Store != nil {
		counts = s.Store.ChainCounts(r.Context(), stage)
		byKind = s.Store.ChainKindCounts(r.Context(), stage)
		orgCounts = s.Store.ChainOrgCounts(r.Context(), stage)
		page := store.PageQuery{Page: 1, PageSize: 5}
		recentSessions, _, _ = s.Store.ListSessions(r.Context(), "", "", page)
		recentObjectives, _, _ = s.Store.ListObjectives(r.Context(), "", "", "", page)
		recentArtifacts, _, _ = s.Store.ListArtifacts(r.Context(), "", "", page)
	}
	plugins := stagePluginRegistry(stage)
	next := stage.Next()
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"stage":            stage,
		"label":            stageLabel(stage),
		"description":      stageDescription(stage),
		"nextStage":        next,
		"updatedAt":        time.Now().UTC(),
		"counts":           counts,
		"byKind":           byKind,
		"plugins":          plugins,
		"sdkCount":         len(plugins),
		"organizations":    len(orgCounts),
		"recentSessions":   recentSessions,
		"recentObjectives": recentObjectives,
		"recentArtifacts":  recentArtifacts,
	})
}

func stageLabel(stage domain.Stage) string {
	switch stage {
	case domain.StageExploit:
		return "Exploitation"
	case domain.StageObjectives:
		return "Objectives"
	default:
		return "Reconnaissance"
	}
}

func stageDescription(stage domain.Stage) string {
	switch stage {
	case domain.StageExploit:
		return "Validate recon findings and breach classified assets."
	case domain.StageObjectives:
		return "Extract, inspect, act on and export the produce of a breach."
	default:
		return "Discover and map the external attack surface."
	}
}

// --- Stage organizations ---

// handleStageOrganizations lists discovered organizations annotated with their
// per-stage chain counters. Organizations are discovered once in recon and
// shared across every stage (plan §0.3).
func (s *Server) handleStageOrganizations(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}, "total": 0, "stage": stage})
		return
	}
	query := strings.TrimSpace(r.URL.Query().Get("query"))
	orgs, err := s.Store.ListOrganizations(r.Context(), query, 200)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	counts := s.Store.ChainOrgCounts(r.Context(), stage)
	items := make([]map[string]any, 0, len(orgs))
	for _, org := range orgs {
		c := counts[org.ID]
		current := org.EffectiveStage()
		items = append(items, map[string]any{
			"id": org.ID, "canonicalName": org.CanonicalName, "aliases": org.Aliases,
			"region": org.Region, "uscc": org.USCC, "status": org.Status,
			"defaultPolicyId": org.DefaultPolicyID,
			// "stage" is the stage of the view being browsed; "currentStage" is
			// the organization's durable position in the chain. They can differ
			// when an operator browses a different mode than the org's stage.
			"stage":        stage,
			"currentStage": current,
			"canAdvance":   current.Next() != "",
			"exploited":    c["exploited"],
			"sessions":     c["sessions"],
			"objectives":   c["objectives"],
			"artifacts":    c["artifacts"],
			"tasks":        c["tasks"],
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items), "stage": stage})
}

// --- Stage assets & findings ---

func (s *Server) handleStageAssets(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}, "total": 0, "page": 1, "pageSize": 20, "stage": stage})
		return
	}
	q := httpx.PageQuery(r)
	assets, total, err := s.Store.ListAssetsByStage(r.Context(), stage, r.URL.Query().Get("kind"), strings.TrimSpace(r.URL.Query().Get("organizationId")), q)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"items": assets, "total": total, "page": q.Page, "pageSize": q.PageSize, "stage": stage,
	})
}

func (s *Server) handleStageFindings(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}, "total": 0, "page": 1, "pageSize": 20, "stage": stage})
		return
	}
	q := httpx.PageQuery(r)
	findings, total, err := s.Store.ListFindingsByStage(r.Context(), stage, r.URL.Query().Get("kind"), strings.TrimSpace(r.URL.Query().Get("organizationId")), q)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"items": findings, "total": total, "page": q.Page, "pageSize": q.PageSize, "stage": stage,
	})
}

// --- Automation parity (plan §9) ---

func (s *Server) handleStageMonitors(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	q := httpx.PageQuery(r)
	if s.Store == nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}, "total": 0, "page": q.Page, "pageSize": q.PageSize, "stage": stage})
		return
	}
	items, total, err := s.Store.ListMonitorsByStage(r.Context(), stage, q)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"items": items, "total": total, "page": q.Page, "pageSize": q.PageSize, "stage": stage,
	})
}

func (s *Server) handleCreateStageMonitor(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	var m domain.Monitor
	if !httpx.DecodeJSON(w, r, &m) {
		return
	}
	m.Stage = stage
	if m.Kind == "" {
		m.Kind = stageDefaultTaskKind(stage)
	}
	if strings.TrimSpace(m.Name) == "" {
		m.Name = "Monitor-" + time.Now().Format("20060102-150405")
	}
	if s.Store == nil || s.Scheduler == nil {
		httpx.WriteProblem(w, r, http.StatusServiceUnavailable, "store_unavailable", "automation is unavailable")
		return
	}
	if err := s.Scheduler.CreateMonitor(r.Context(), &m); err != nil {
		httpx.WriteProblem(w, r, http.StatusBadRequest, "monitor_create_failed", err.Error())
		return
	}
	s.Store.AddAudit(r.Context(), domain.AuditEvent{
		Actor: principalFrom(r.Context()).Username, Action: "chain.monitor_create", Resource: m.ID,
		Detail: map[string]any{"stage": stage},
	})
	httpx.WriteJSON(w, http.StatusCreated, m)
}

func (s *Server) handleStageSchedules(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	q := httpx.PageQuery(r)
	if s.Store == nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}, "total": 0, "page": q.Page, "pageSize": q.PageSize, "stage": stage})
		return
	}
	items, total, err := s.Store.ListSchedulesByStage(r.Context(), stage, q)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"items": items, "total": total, "page": q.Page, "pageSize": q.PageSize, "stage": stage,
	})
}

func (s *Server) handleCreateStageSchedule(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	var sc domain.Schedule
	if !httpx.DecodeJSON(w, r, &sc) {
		return
	}
	sc.Stage = stage
	if sc.TaskKind == "" {
		sc.TaskKind = domain.TaskKind(stageDefaultTaskKind(stage))
	}
	if s.Store == nil {
		httpx.WriteProblem(w, r, http.StatusServiceUnavailable, "store_unavailable", "automation is unavailable")
		return
	}
	if err := s.Store.CreateSchedule(r.Context(), &sc); err != nil {
		httpx.WriteProblem(w, r, http.StatusBadRequest, "schedule_create_failed", err.Error())
		return
	}
	s.Store.AddAudit(r.Context(), domain.AuditEvent{
		Actor: principalFrom(r.Context()).Username, Action: "chain.schedule_create", Resource: sc.ID,
		Detail: map[string]any{"stage": stage},
	})
	httpx.WriteJSON(w, http.StatusCreated, sc)
}

func (s *Server) handleStagePolicies(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}, "stage": stage})
		return
	}
	items, err := s.Store.ListPoliciesByStage(r.Context(), stage)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items, "stage": stage})
}

func (s *Server) handleCreateStagePolicy(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	var p domain.Policy
	if !httpx.DecodeJSON(w, r, &p) {
		return
	}
	if strings.TrimSpace(p.Name) == "" {
		httpx.WriteProblem(w, r, http.StatusBadRequest, "invalid_policy", "policy name is required")
		return
	}
	if p.Category == "" {
		switch stage {
		case domain.StageExploit:
			p.Category = domain.PolicyCategoryExploitation
		case domain.StageObjectives:
			p.Category = domain.PolicyCategoryProbing
		default:
			p.Category = domain.PolicyCategoryAttackSurface
		}
	}
	if s.Store == nil {
		httpx.WriteProblem(w, r, http.StatusServiceUnavailable, "store_unavailable", "automation is unavailable")
		return
	}
	if err := s.Store.CreatePolicy(r.Context(), &p); err != nil {
		httpx.WriteProblem(w, r, http.StatusBadRequest, "policy_create_failed", err.Error())
		return
	}
	s.Store.AddAudit(r.Context(), domain.AuditEvent{
		Actor: principalFrom(r.Context()).Username, Action: "chain.policy_create", Resource: p.ID,
		Detail: map[string]any{"stage": stage},
	})
	httpx.WriteJSON(w, http.StatusCreated, p)
}

func (s *Server) handleStageGroups(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	q := httpx.PageQuery(r)
	if s.Store == nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}, "total": 0, "page": q.Page, "pageSize": q.PageSize, "stage": stage})
		return
	}
	items, total, err := s.Store.ListScopesByStage(r.Context(), stage, q)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"items": items, "total": total, "page": q.Page, "pageSize": q.PageSize, "stage": stage,
	})
}

func (s *Server) handleCreateStageGroup(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	var sc domain.Scope
	if !httpx.DecodeJSON(w, r, &sc) {
		return
	}
	if strings.TrimSpace(sc.Name) == "" || len(sc.Targets) == 0 {
		httpx.WriteProblem(w, r, http.StatusBadRequest, "invalid_scope", "name and targets are required")
		return
	}
	if sc.Type != "ip" {
		sc.Type = "domain"
	}
	sc.Stage = stage
	if s.Store == nil {
		httpx.WriteProblem(w, r, http.StatusServiceUnavailable, "store_unavailable", "automation is unavailable")
		return
	}
	if err := s.Store.CreateScope(r.Context(), &sc); err != nil {
		httpx.WriteProblem(w, r, http.StatusBadRequest, "scope_create_failed", err.Error())
		return
	}
	s.Store.AddAudit(r.Context(), domain.AuditEvent{
		Actor: principalFrom(r.Context()).Username, Action: "chain.scope_create", Resource: sc.ID,
		Detail: map[string]any{"stage": stage},
	})
	httpx.WriteJSON(w, http.StatusCreated, sc)
}

func stageDefaultTaskKind(stage domain.Stage) string {
	switch stage {
	case domain.StageExploit:
		return string(domain.TaskExploit)
	case domain.StageObjectives:
		return string(domain.TaskObjective)
	default:
		return string(domain.TaskDomain)
	}
}
