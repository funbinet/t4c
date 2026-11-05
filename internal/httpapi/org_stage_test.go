package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/funbinet/t4c/internal/domain"
	"github.com/go-chi/chi/v5"
)

type stageStateBody struct {
	OrganizationID string `json:"organizationId"`
	CurrentStage   string `json:"currentStage"`
	Label          string `json:"label"`
	NextStage      string `json:"nextStage"`
	CanAdvance     bool   `json:"canAdvance"`
	History        []struct {
		FromStage string `json:"fromStage"`
		ToStage   string `json:"toStage"`
		Actor     string `json:"actor"`
	} `json:"history"`
}

type advanceBody struct {
	OrganizationID string `json:"organizationId"`
	FromStage      string `json:"fromStage"`
	ToStage        string `json:"toStage"`
	CurrentStage   string `json:"currentStage"`
	Advanced       bool   `json:"advanced"`
}

// TestOrganizationStageEndpoints exercises the full HTTP governance surface:
// reading the durable stage, advancing with an empty body, rejecting stale or
// skipped transitions, and exposing the recorded history.
func TestOrganizationStageEndpoints(t *testing.T) {
	st, ctx := newHTTPTestStore(t)
	s := &Server{Store: st}
	router := chi.NewRouter()
	router.Get("/organizations/{id}/stage", s.handleGetOrganizationStage)
	router.Post("/organizations/{id}/advance-stage", s.requireWrite(s.handleAdvanceStage))

	org := &domain.Organization{CanonicalName: "HTTP Stage Governance Org"}
	if err := st.CreateOrganization(ctx, org); err != nil {
		t.Fatal(err)
	}
	stageURL := "/organizations/" + org.ID + "/stage"
	advanceURL := "/organizations/" + org.ID + "/advance-stage"

	readState := func() stageStateBody {
		t.Helper()
		rec := requestWithPrincipal(t, http.MethodGet, stageURL, "", router)
		if rec.Code != http.StatusOK {
			t.Fatalf("GET stage status = %d body=%s", rec.Code, rec.Body.String())
		}
		var state stageStateBody
		if err := json.Unmarshal(rec.Body.Bytes(), &state); err != nil {
			t.Fatal(err)
		}
		return state
	}
	postAdvance := func(body string) (int, string) {
		t.Helper()
		rec := requestWithPrincipal(t, http.MethodPost, advanceURL, body, router)
		return rec.Code, rec.Body.String()
	}

	state := readState()
	if state.CurrentStage != "recon" || state.NextStage != "exploit" || !state.CanAdvance || len(state.History) != 0 {
		t.Fatalf("initial state = %+v", state)
	}

	// An empty body must advance from the persisted stage (no hint required).
	code, body := postAdvance("")
	if code != http.StatusOK {
		t.Fatalf("empty-body advance status = %d body=%s", code, body)
	}
	var advanced advanceBody
	if err := json.Unmarshal([]byte(body), &advanced); err != nil {
		t.Fatal(err)
	}
	if advanced.FromStage != "recon" || advanced.ToStage != "exploit" || advanced.CurrentStage != "exploit" || !advanced.Advanced {
		t.Fatalf("advance = %+v", advanced)
	}

	state = readState()
	if state.CurrentStage != "exploit" || state.NextStage != "objectives" || len(state.History) != 1 {
		t.Fatalf("state after first advance = %+v", state)
	}
	if state.History[0].FromStage != "recon" || state.History[0].ToStage != "exploit" || state.History[0].Actor == "" {
		t.Fatalf("history[0] = %+v", state.History[0])
	}

	// A stale fromStage hint is a conflict, not a silent skip.
	if code, body = postAdvance(`{"fromStage":"recon"}`); code != http.StatusConflict {
		t.Fatalf("stale hint status = %d body=%s", code, body)
	}
	// A non-sequential toStage hint is rejected.
	if code, body = postAdvance(`{"toStage":"recon"}`); code != http.StatusBadRequest {
		t.Fatalf("skipped stage status = %d body=%s", code, body)
	}

	// Matching hints advance to the terminal stage.
	if code, body = postAdvance(`{"fromStage":"exploit","toStage":"objectives"}`); code != http.StatusOK {
		t.Fatalf("second advance status = %d body=%s", code, body)
	}
	state = readState()
	if state.CurrentStage != "objectives" || state.NextStage != "" || state.CanAdvance || len(state.History) != 2 {
		t.Fatalf("terminal state = %+v", state)
	}
	if code, body = postAdvance(""); code != http.StatusBadRequest {
		t.Fatalf("terminal advance status = %d body=%s", code, body)
	}

	// Unknown organizations are reported as not found on both endpoints.
	missing := "/organizations/" + domain.MustID()
	if rec := requestWithPrincipal(t, http.MethodGet, missing+"/stage", "", router); rec.Code != http.StatusNotFound {
		t.Fatalf("GET missing org status = %d", rec.Code)
	}
	if rec := requestWithPrincipal(t, http.MethodPost, missing+"/advance-stage", "", router); rec.Code != http.StatusNotFound {
		t.Fatalf("POST missing org status = %d", rec.Code)
	}
}
