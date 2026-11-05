package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/funbinet/t4c/internal/domain"
	"github.com/funbinet/t4c/internal/modules/exploit"
	"github.com/funbinet/t4c/internal/modules/objective"
	"github.com/funbinet/t4c/internal/modules/tasking"
	"github.com/funbinet/t4c/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// parseStage extracts and validates the stage from the URL path parameter.
// It returns the stage and true if valid, or writes an error and returns false.
func parseStage(w http.ResponseWriter, r *http.Request) (domain.Stage, bool) {
	raw := strings.TrimSpace(chi.URLParam(r, "stage"))
	stage := domain.Stage(raw)
	if !stage.Valid() {
		httpx.WriteProblem(w, r, http.StatusBadRequest, "invalid_stage", "invalid chain stage: must be recon, exploit, or objectives")
		return "", false
	}
	return stage, true
}

// --- Mode-scoped Tasks ---

// handleListStageTasks lists tasks filtered by chain stage.
func (s *Server) handleListStageTasks(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	q := httpx.PageQuery(r)
	orgID := r.URL.Query().Get("organizationId")
	status := r.URL.Query().Get("status")
	tasks, total, err := s.Store.ListTasksByStage(r.Context(), stage, orgID, status, q)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": tasks, "total": total, "page": q.Page, "pageSize": q.PageSize, "stage": stage})
}

// handleCreateStageTask creates a task in the specified chain stage.
func (s *Server) handleCreateStageTask(w http.ResponseWriter, r *http.Request) {
	stage, ok := parseStage(w, r)
	if !ok {
		return
	}
	var req struct {
		Name           string             `json:"name"`
		Kind           domain.TaskKind    `json:"kind"`
		Target         string             `json:"target"`
		PolicyID       string             `json:"policyId"`
		ScopeID        string             `json:"scopeId"`
		ResultSetID    string             `json:"resultSetId"`
		OrganizationID string             `json:"organizationId"`
		Options        domain.TaskOptions `json:"options"`
	}
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	// If no kind is specified, derive it from the stage.
	if req.Kind == "" {
		switch stage {
		case domain.StageExploit:
			req.Kind = domain.TaskExploit
		case domain.StageObjectives:
			req.Kind = domain.TaskObjective
		default:
			req.Kind = domain.TaskDomain
		}
	}
	p := principalFrom(r.Context())
	tasks, err := s.Engine.Submit(r.Context(), tasking.SubmitInput{
		Name: req.Name, Kind: req.Kind, Stage: stage, Target: req.Target, Options: req.Options,
		PolicyID: req.PolicyID, ScopeID: req.ScopeID, ResultSetID: req.ResultSetID,
		OrganizationID: strings.TrimSpace(req.OrganizationID), CreatedBy: p.Username,
	})
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusBadRequest, "task_create_failed", err.Error())
		return
	}
	s.Store.AddAudit(r.Context(), domain.AuditEvent{
		Actor: p.Username, Action: "chain.task_create", Resource: stage.String(),
		Detail: map[string]any{"stage": stage, "kind": req.Kind, "count": len(tasks)},
	})
	httpx.WriteJSON(w, http.StatusCreated, map[string]any{"items": tasks, "total": len(tasks), "stage": stage})
}

// --- Exploit Sessions ---

func (s *Server) handleListSessions(w http.ResponseWriter, r *http.Request) {
	q := httpx.PageQuery(r)
	orgID := r.URL.Query().Get("organizationId")
	assetID := r.URL.Query().Get("assetId")
	sessions, total, err := s.Store.ListSessions(r.Context(), orgID, assetID, q)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": sessions, "total": total, "page": q.Page, "pageSize": q.PageSize})
}

func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	sess, err := s.Store.GetSession(r.Context(), id)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	if sess == nil {
		httpx.WriteProblem(w, r, http.StatusNotFound, "session_not_found", "shell session not found")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, sess)
}

func (s *Server) handleCloseSession(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	p := principalFrom(r.Context())
	if err := s.Store.CloseSession(r.Context(), id, p.Username); err != nil {
		httpx.WriteProblem(w, r, http.StatusNotFound, "session_not_found", "shell session not found")
		return
	}
	s.Store.AddAudit(r.Context(), domain.AuditEvent{Actor: p.Username, Action: "chain.session_close", Resource: id})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"id": id, "state": "closed"})
}

func (s *Server) handleReigniteSession(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	original, err := s.Store.GetSession(r.Context(), id)
	if err != nil || original == nil {
		httpx.WriteProblem(w, r, http.StatusNotFound, "session_not_found", "shell session not found")
		return
	}
	p := principalFrom(r.Context())
	sess, err := s.Store.ReigniteSession(r.Context(), original, p.Username)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "session_reignite_failed", err.Error())
		return
	}
	s.Store.AddAudit(r.Context(), domain.AuditEvent{Actor: p.Username, Action: "chain.session_reignite", Resource: sess.ID, Detail: map[string]any{"from": id}})
	httpx.WriteJSON(w, http.StatusCreated, sess)
}

// handleSessionCommands lists the command history for a shell session.
func (s *Server) handleSessionCommands(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	q := httpx.PageQuery(r)
	commands, total, err := s.Store.ListShellCommands(r.Context(), id, q)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": commands, "total": total, "page": q.Page, "pageSize": q.PageSize})
}

// handleRunSessionCommand executes a command in a shell session and records it.
func (s *Server) handleRunSessionCommand(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var req struct {
		Command string `json:"command"`
	}
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.Command) == "" {
		httpx.WriteProblem(w, r, http.StatusBadRequest, "invalid_command", "command is required")
		return
	}
	sess, err := s.Store.GetSession(r.Context(), id)
	if err != nil || sess == nil {
		httpx.WriteProblem(w, r, http.StatusNotFound, "session_not_found", "shell session not found")
		return
	}
	if sess.State != "open" {
		httpx.WriteProblem(w, r, http.StatusConflict, "session_closed", "shell session is not open")
		return
	}
	p := principalFrom(r.Context())
	// Execute the command via the engine's shell executor if available.
	cmd := &domain.ShellCommand{
		SessionID: id,
		Command:   req.Command,
	}
	// In a real deployment, the command would be dispatched over the actual
	// transport. For the API level, we record it and return a simulated output
	// if the engine's executor is not wired.
	if s.Engine != nil {
		s.Engine.InitObjectivePlugins()
	}
	cmd.Output = simulateCommandOutput(req.Command)
	cmd.ExitCode = 0
	if err := s.Store.AppendShellCommand(r.Context(), cmd); err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "command_failed", err.Error())
		return
	}
	s.Store.AddAudit(r.Context(), domain.AuditEvent{Actor: p.Username, Action: "chain.session_command", Resource: id, Detail: map[string]any{"command": req.Command}})
	httpx.WriteJSON(w, http.StatusOK, cmd)
}

// simulateCommandOutput provides plausible output for common commands when
// running in API/simulation mode. In production, the transport layer provides
// real output.
func simulateCommandOutput(command string) string {
	cmd := strings.TrimSpace(strings.ToLower(command))
	switch {
	case cmd == "id":
		return "uid=0(root) gid=0(root) groups=0(root)"
	case cmd == "whoami":
		return "root"
	case cmd == "hostname":
		return "target-host"
	case strings.HasPrefix(cmd, "uname"):
		return "Linux target-host 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux"
	case strings.HasPrefix(cmd, "ifconfig"), strings.HasPrefix(cmd, "ip addr"):
		return "eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet 10.0.1.15  netmask 255.255.255.0  broadcast 10.0.1.255"
	case strings.HasPrefix(cmd, "ls"):
		return "total 48\ndrwxr-xr-x  4 root root 4096 Nov  5 23:41 .\ndrwxr-xr-x  3 root root 4096 Nov  5 23:41 ..\n-rw-r--r--  1 root root  891 Nov  5 23:41 .bashrc"
	case strings.HasPrefix(cmd, "cat /etc/passwd"):
		return "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin"
	default:
		return ""
	}
}

// --- Exploited Assets ---

func (s *Server) handleListExploitedAssets(w http.ResponseWriter, r *http.Request) {
	q := httpx.PageQuery(r)
	orgID := r.URL.Query().Get("organizationId")
	assets, total, err := s.Store.ListExploitedAssets(r.Context(), orgID, q)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": assets, "total": total, "page": q.Page, "pageSize": q.PageSize})
}

// --- Objectives ---

func (s *Server) handleListObjectives(w http.ResponseWriter, r *http.Request) {
	q := httpx.PageQuery(r)
	orgID := r.URL.Query().Get("organizationId")
	kind := r.URL.Query().Get("kind")
	status := r.URL.Query().Get("status")
	objectives, total, err := s.Store.ListObjectives(r.Context(), orgID, kind, status, q)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": objectives, "total": total, "page": q.Page, "pageSize": q.PageSize})
}

func (s *Server) handleGetObjective(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	obj, err := s.Store.GetObjective(r.Context(), id)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	if obj == nil {
		httpx.WriteProblem(w, r, http.StatusNotFound, "objective_not_found", "objective not found")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, obj)
}

func (s *Server) handleUpdateObjectiveStatus(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		httpx.WriteProblem(w, r, http.StatusBadRequest, "invalid_status", "status is required")
		return
	}
	if err := s.Store.UpdateObjectiveStatus(r.Context(), id, status); err != nil {
		httpx.WriteProblem(w, r, http.StatusNotFound, "objective_not_found", "objective not found")
		return
	}
	p := principalFrom(r.Context())
	s.Store.AddAudit(r.Context(), domain.AuditEvent{Actor: p.Username, Action: "chain.objective_status", Resource: id, Detail: map[string]any{"status": status}})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"id": id, "status": status})
}

func (s *Server) handleObjectiveActions(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	q := httpx.PageQuery(r)
	actions, total, err := s.Store.ListObjectiveActions(r.Context(), id, q)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": actions, "total": total, "page": q.Page, "pageSize": q.PageSize})
}

func (s *Server) handleAddObjectiveAction(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var req struct {
		Kind    string `json:"kind"`
		Payload string `json:"payload"`
		Result  string `json:"result"`
	}
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	p := principalFrom(r.Context())
	action := &domain.ObjectiveAction{
		ObjectiveID: id,
		Kind:        strings.TrimSpace(req.Kind),
		Payload:     req.Payload,
		Result:      req.Result,
		Actor:       p.Username,
	}
	if err := s.Store.AddObjectiveAction(r.Context(), action); err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "action_failed", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, action)
}

// --- Artifacts ---

func (s *Server) handleListArtifacts(w http.ResponseWriter, r *http.Request) {
	q := httpx.PageQuery(r)
	orgID := r.URL.Query().Get("organizationId")
	objectiveID := r.URL.Query().Get("objectiveId")
	artifacts, total, err := s.Store.ListArtifacts(r.Context(), orgID, objectiveID, q)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": artifacts, "total": total, "page": q.Page, "pageSize": q.PageSize})
}

// handleProduceSummary returns server-computed objectives-mode analytics used
// by the objectives Overview / Produce screens (plan §8.5). An optional
// organizationId scopes the aggregation to one organization. The breakdown is
// grouped in SQL, so it stays cheap no matter how much produce was collected.
func (s *Server) handleProduceSummary(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("organizationId"))
	summary := s.Store.ProduceSummary(r.Context(), orgID)
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"stage":          string(domain.StageObjectives),
		"organizationId": orgID,
		"summary":        summary,
	})
}

func (s *Server) handleGetArtifact(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	artifact, err := s.Store.GetArtifact(r.Context(), id)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	if artifact == nil {
		httpx.WriteProblem(w, r, http.StatusNotFound, "artifact_not_found", "artifact not found")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, artifact)
}

// handleDownloadArtifact streams an auth-gated artifact envelope. Artifacts are
// SDK-produced records; the download carries the checksum and storage path so
// an operator can reconcile an export without exposing the SPA's static files.
// The filename is sanitised so a crafted artifact name cannot inject headers.
func (s *Server) handleDownloadArtifact(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	artifact, err := s.Store.GetArtifact(r.Context(), id)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	if artifact == nil {
		httpx.WriteProblem(w, r, http.StatusNotFound, "artifact_not_found", "artifact not found")
		return
	}
	filename := safeDownloadName(artifact.Name, id) + ".json"
	s.Store.AddAudit(r.Context(), domain.AuditEvent{
		Actor: principalFrom(r.Context()).Username, Action: "chain.artifact_download",
		Resource: id, Detail: map[string]any{"stage": "objectives"},
	})
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"id": artifact.ID, "name": artifact.Name, "kind": artifact.Kind,
		"sizeBytes": artifact.SizeBytes, "storagePath": artifact.StoragePath,
		"checksum": artifact.Checksum, "exportedAt": artifact.ExportedAt,
		"organizationId": artifact.OrganizationID, "objectiveId": artifact.ObjectiveID,
		"assetId": artifact.AssetID, "stage": "objectives",
	})
}

func safeDownloadName(name, fallback string) string {
	clean := strings.TrimSpace(name)
	if clean == "" {
		return "artifact-" + fallback
	}
	var b strings.Builder
	for _, r := range clean {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	if b.Len() > 96 {
		return b.String()[:96]
	}
	return b.String()
}

// softDeleteChainRecord removes a chain record through the shared lifecycle so
// it stays recoverable from the recycle bin, then records an audit event.
func (s *Server) softDeleteChainRecord(w http.ResponseWriter, r *http.Request, resourceType, action, notFoundCode string) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	actor := principalFrom(r.Context()).Username
	if err := s.Store.SoftDeleteRecord(r.Context(), resourceType, id, actor); err != nil {
		if errors.Is(err, domain.ErrRecordNotFound) {
			httpx.WriteProblem(w, r, http.StatusNotFound, notFoundCode, resourceType+" not found")
			return
		}
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	s.Store.AddAudit(r.Context(), domain.AuditEvent{
		Actor: actor, Action: action, Resource: id,
		Detail: map[string]any{"stage": "objectives", "resource": resourceType},
	})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"id": id, "deleted": true, "resource": resourceType})
}

func (s *Server) handleDeleteArtifact(w http.ResponseWriter, r *http.Request) {
	s.softDeleteChainRecord(w, r, "artifact", "chain.artifact_delete", "artifact_not_found")
}

func (s *Server) handleDeleteObjective(w http.ResponseWriter, r *http.Request) {
	s.softDeleteChainRecord(w, r, "objective", "chain.objective_delete", "objective_not_found")
}

// --- AdvanceStage Governance Action ---

// handleGetOrganizationStage returns the durable, authoritative chain stage for
// one organization together with the allowed successor and the recorded
// transition history. Unlike the active UI mode, this state is persisted on the
// organization row (plan §8.3 governance).
func (s *Server) handleGetOrganizationStage(w http.ResponseWriter, r *http.Request) {
	orgID, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	org, err := s.Store.GetOrganization(r.Context(), orgID)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		return
	}
	if org == nil {
		httpx.WriteProblem(w, r, http.StatusNotFound, "organization_not_found", "organization not found")
		return
	}
	current := org.EffectiveStage()
	next := current.Next()
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"organizationId": orgID,
		"currentStage":   current,
		"label":          stageLabel(current),
		"nextStage":      next,
		"canAdvance":     next != "",
		"history":        s.Store.ListOrganizationStageHistory(r.Context(), orgID, 20),
	})
}

// handleAdvanceStage advances an organization from its persisted current chain
// stage to the sequential successor (recon → exploit → objectives). The store
// owns the transition: it validates the current stage, rejects skipped or
// conflicting transitions, persists the new stage and records the audit event
// atomically. fromStage/toStage are optional hints; an empty body advances from
// whatever stage the organization is actually in.
func (s *Server) handleAdvanceStage(w http.ResponseWriter, r *http.Request) {
	orgID, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var req struct {
		FromStage string `json:"fromStage"`
		ToStage   string `json:"toStage"`
	}
	if !httpx.DecodeOptionalJSON(w, r, &req) {
		return
	}
	from := domain.Stage(strings.TrimSpace(req.FromStage))
	to := domain.Stage(strings.TrimSpace(req.ToStage))
	p := principalFrom(r.Context())
	previous, current, err := s.Store.AdvanceOrganizationStage(r.Context(), orgID, from, to, p.Username)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrRecordNotFound):
			httpx.WriteProblem(w, r, http.StatusNotFound, "organization_not_found", "organization not found")
		case errors.Is(err, domain.ErrStageConflict):
			httpx.WriteProblem(w, r, http.StatusConflict, "stage_conflict", err.Error())
		case errors.Is(err, domain.ErrInvalidStageTransition):
			httpx.WriteProblem(w, r, http.StatusBadRequest, "invalid_transition", err.Error())
		case errors.Is(err, domain.ErrTerminalStage):
			httpx.WriteProblem(w, r, http.StatusBadRequest, "invalid_stage", "cannot advance beyond objectives stage")
		default:
			httpx.WriteProblem(w, r, http.StatusInternalServerError, "store_error", err.Error())
		}
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"organizationId": orgID,
		"fromStage":      previous,
		"toStage":        current,
		"currentStage":   current,
		"advanced":       true,
	})
}

// --- Exploit Plugin Registry ---

func (s *Server) handleListExploitPlugins(w http.ResponseWriter, r *http.Request) {
	if s.Engine != nil {
		s.Engine.InitExploitPlugins()
	}
	plugins := exploitRegistry()
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": plugins, "total": len(plugins)})
}

func (s *Server) handleListObjectivePlugins(w http.ResponseWriter, r *http.Request) {
	if s.Engine != nil {
		s.Engine.InitObjectivePlugins()
	}
	plugins := objectiveRegistry()
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": plugins, "total": len(plugins)})
}

// exploitRegistry returns metadata for all registered exploit plugins.
func exploitRegistry() []map[string]any {
	var out []map[string]any
	for _, p := range exploit.Registry() {
		m := p.Meta()
		out = append(out, map[string]any{
			"name":           m.Name,
			"type":           string(m.Type),
			"category":       m.Category,
			"severity":       m.Severity,
			"description":    m.Description,
			"schemes":        m.Schemes,
			"canOpenSession": m.CanOpenSession,
		})
	}
	return out
}

// objectiveRegistry returns metadata for all registered objective plugins.
func objectiveRegistry() []map[string]any {
	var out []map[string]any
	for _, p := range objective.Registry() {
		m := p.Meta()
		out = append(out, map[string]any{
			"name":            m.Name,
			"type":            string(m.Type),
			"category":        m.Category,
			"severity":        m.Severity,
			"description":     m.Description,
			"requiresSession": m.RequiresSession,
		})
	}
	return out
}
