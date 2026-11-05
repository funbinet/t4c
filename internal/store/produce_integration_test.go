package store

import (
	"testing"

	"github.com/funbinet/t4c/internal/domain"
)

// TestProduceSummaryAggregatesObjectivesAndArtifacts verifies the server-side
// breakdown that powers the objectives-mode Produce analytics: totals,
// distributions, extracted byte volume and per-organization scoping. It uses
// the shared Postgres test store and therefore skips unless a DSN is provided.
func TestProduceSummaryAggregatesObjectivesAndArtifacts(t *testing.T) {
	st, ctx := newPostgresTestStore(t)

	objectives := []*domain.Objective{
		{OrganizationID: "org-a", Kind: domain.ObjectiveShell, Title: "shell a", Severity: "high", Status: "open"},
		{OrganizationID: "org-a", Kind: domain.ObjectiveLoot, Title: "loot a", Severity: "critical", Status: "exported"},
		{OrganizationID: "org-b", Kind: domain.ObjectiveProbe, Title: "probe b", Severity: "low", Status: "closed"},
	}
	for _, o := range objectives {
		if err := st.CreateObjective(ctx, o); err != nil {
			t.Fatal(err)
		}
	}

	artifacts := []*domain.Artifact{
		{OrganizationID: "org-a", Name: "dump.sql", Kind: "db-dump", SizeBytes: 2048, Checksum: "abc123"},
		{OrganizationID: "org-a", Name: "config.ini", Kind: "config", SizeBytes: 512, Checksum: ""},
		{OrganizationID: "org-b", Name: "key.pem", Kind: "key", SizeBytes: 256, Checksum: "def456"},
	}
	for _, a := range artifacts {
		if err := st.CreateArtifact(ctx, a); err != nil {
			t.Fatal(err)
		}
	}

	summary := st.ProduceSummary(ctx, "")
	if summary.Objectives != 3 {
		t.Fatalf("objectives = %d, want 3", summary.Objectives)
	}
	if summary.Exported != 1 {
		t.Fatalf("exported = %d, want 1", summary.Exported)
	}
	if summary.ByStatus["open"] != 1 || summary.ByStatus["closed"] != 1 || summary.ByStatus["exported"] != 1 {
		t.Fatalf("byStatus = %v", summary.ByStatus)
	}
	if summary.ByKind["shell"] != 1 || summary.BySeverity["critical"] != 1 {
		t.Fatalf("byKind = %v, bySeverity = %v", summary.ByKind, summary.BySeverity)
	}
	if summary.Artifacts != 3 {
		t.Fatalf("artifacts = %d, want 3", summary.Artifacts)
	}
	if summary.TotalBytes != 2048+512+256 {
		t.Fatalf("totalBytes = %d, want %d", summary.TotalBytes, 2048+512+256)
	}
	if summary.Checksummed != 2 {
		t.Fatalf("checksummed = %d, want 2", summary.Checksummed)
	}
	if summary.ArtifactsByKind["db-dump"] != 1 || summary.ArtifactsByKind["key"] != 1 {
		t.Fatalf("artifactsByKind = %v", summary.ArtifactsByKind)
	}

	scoped := st.ProduceSummary(ctx, "org-a")
	if scoped.Objectives != 2 || scoped.Artifacts != 2 || scoped.TotalBytes != 2048+512 {
		t.Fatalf("org-a scoped summary = %+v", scoped)
	}
	if scoped.Exported != 1 {
		t.Fatalf("org-a exported = %d, want 1", scoped.Exported)
	}
}

// TestProduceSummaryExcludesDeletedProduce confirms soft-deleted objectives
// and artifacts drop out of the analytics through the shared active() filter.
func TestProduceSummaryExcludesDeletedProduce(t *testing.T) {
	st, ctx := newPostgresTestStore(t)

	o := &domain.Objective{OrganizationID: "org-x", Kind: domain.ObjectiveFlag, Title: "flag", Severity: "medium", Status: "open"}
	if err := st.CreateObjective(ctx, o); err != nil {
		t.Fatal(err)
	}
	a := &domain.Artifact{OrganizationID: "org-x", Name: "flag.txt", Kind: "file", SizeBytes: 128, Checksum: "ghi789"}
	if err := st.CreateArtifact(ctx, a); err != nil {
		t.Fatal(err)
	}

	before := st.ProduceSummary(ctx, "")
	if before.Objectives != 1 || before.Artifacts != 1 {
		t.Fatalf("before delete = %+v", before)
	}

	if err := st.SoftDeleteRecord(ctx, "objective", o.ID, "operator"); err != nil {
		t.Fatal(err)
	}
	if err := st.SoftDeleteRecord(ctx, "artifact", a.ID, "operator"); err != nil {
		t.Fatal(err)
	}

	after := st.ProduceSummary(ctx, "")
	if after.Objectives != 0 || after.Artifacts != 0 || after.TotalBytes != 0 {
		t.Fatalf("after delete = %+v", after)
	}
}
