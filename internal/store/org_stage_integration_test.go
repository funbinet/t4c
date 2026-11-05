package store

import (
	"context"
	"errors"
	"testing"

	"github.com/funbinet/t4c/internal/domain"
)

func newStageTestOrg(t *testing.T, st *Store, ctx context.Context, name string) *domain.Organization {
	t.Helper()
	org := &domain.Organization{CanonicalName: name}
	if err := st.CreateOrganization(ctx, org); err != nil {
		t.Fatal(err)
	}
	return org
}

func TestAdvanceOrganizationStagePersistsSequentialTransitions(t *testing.T) {
	st, ctx := newPostgresTestStore(t)
	org := newStageTestOrg(t, st, ctx, "Stage Persistence Org")
	if org.Stage != domain.StageRecon {
		t.Fatalf("new organization stage = %q, want recon", org.Stage)
	}

	from, to, err := st.AdvanceOrganizationStage(ctx, org.ID, "", "", "operator")
	if err != nil {
		t.Fatalf("first advance: %v", err)
	}
	if from != domain.StageRecon || to != domain.StageExploit {
		t.Fatalf("first advance = %q → %q, want recon → exploit", from, to)
	}
	stored, err := st.GetOrganization(ctx, org.ID)
	if err != nil || stored == nil {
		t.Fatalf("reload: org=%v err=%v", stored, err)
	}
	if stored.Stage != domain.StageExploit {
		t.Fatalf("persisted stage = %q, want exploit", stored.Stage)
	}

	from, to, err = st.AdvanceOrganizationStage(ctx, org.ID, "", "", "operator")
	if err != nil {
		t.Fatalf("second advance: %v", err)
	}
	if from != domain.StageExploit || to != domain.StageObjectives {
		t.Fatalf("second advance = %q → %q, want exploit → objectives", from, to)
	}
	stored, err = st.GetOrganization(ctx, org.ID)
	if err != nil || stored == nil || stored.Stage != domain.StageObjectives {
		t.Fatalf("persisted stage = %v, want objectives (err=%v)", stored, err)
	}

	if _, _, err := st.AdvanceOrganizationStage(ctx, org.ID, "", "", "operator"); !errors.Is(err, domain.ErrTerminalStage) {
		t.Fatalf("terminal advance err = %v, want ErrTerminalStage", err)
	}
}

func TestAdvanceOrganizationStageRejectsInvalidRequests(t *testing.T) {
	st, ctx := newPostgresTestStore(t)
	org := newStageTestOrg(t, st, ctx, "Stage Guard Org")

	if _, _, err := st.AdvanceOrganizationStage(ctx, org.ID, domain.StageExploit, "", "operator"); !errors.Is(err, domain.ErrStageConflict) {
		t.Fatalf("stale from hint err = %v, want ErrStageConflict", err)
	}
	if _, _, err := st.AdvanceOrganizationStage(ctx, org.ID, "", domain.StageObjectives, "operator"); !errors.Is(err, domain.ErrInvalidStageTransition) {
		t.Fatalf("skipped to hint err = %v, want ErrInvalidStageTransition", err)
	}
	if _, _, err := st.AdvanceOrganizationStage(ctx, domain.MustID(), "", "", "operator"); !errors.Is(err, domain.ErrRecordNotFound) {
		t.Fatalf("missing org err = %v, want ErrRecordNotFound", err)
	}
	stored, err := st.GetOrganization(ctx, org.ID)
	if err != nil || stored == nil || stored.Stage != domain.StageRecon {
		t.Fatalf("rejected requests must not change stage: org=%v err=%v", stored, err)
	}
}

func TestAdvanceOrganizationStageRecordsHistory(t *testing.T) {
	st, ctx := newPostgresTestStore(t)
	org := newStageTestOrg(t, st, ctx, "Stage History Org")
	if _, _, err := st.AdvanceOrganizationStage(ctx, org.ID, "", "", "alice"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := st.AdvanceOrganizationStage(ctx, org.ID, "", "", "bob"); err != nil {
		t.Fatal(err)
	}
	history := st.ListOrganizationStageHistory(ctx, org.ID, 10)
	if len(history) != 2 {
		t.Fatalf("history length = %d, want 2", len(history))
	}
	// Newest first.
	if history[0].FromStage != domain.StageExploit || history[0].ToStage != domain.StageObjectives || history[0].Actor != "bob" {
		t.Fatalf("history[0] = %+v, want exploit → objectives by bob", history[0])
	}
	if history[1].FromStage != domain.StageRecon || history[1].ToStage != domain.StageExploit || history[1].Actor != "alice" {
		t.Fatalf("history[1] = %+v, want recon → exploit by alice", history[1])
	}
	if other := st.ListOrganizationStageHistory(ctx, domain.MustID(), 10); len(other) != 0 {
		t.Fatalf("history for unrelated org = %d, want 0", len(other))
	}
}

func TestMigrationBackfillsLegacyOrganizationStage(t *testing.T) {
	st, ctx := newPostgresTestStore(t)
	org := newStageTestOrg(t, st, ctx, "Legacy Stage Org")
	if err := st.db.WithContext(ctx).Model(&domain.Organization{}).
		Where("id = ?", org.ID).UpdateColumn("stage", "").Error; err != nil {
		t.Fatal(err)
	}
	if err := st.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	var raw string
	if err := st.db.WithContext(ctx).Raw(`SELECT stage FROM organizations WHERE id = ?`, org.ID).Scan(&raw).Error; err != nil {
		t.Fatal(err)
	}
	if raw != string(domain.StageRecon) {
		t.Fatalf("backfilled stage = %q, want recon", raw)
	}
}
