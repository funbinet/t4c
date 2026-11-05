package store

import (
	"context"

	"github.com/funbinet/t4c/internal/domain"
	"gorm.io/gorm"
)

// ProduceSummary is the server-computed analytics for the objectives-mode
// Produce surface (plan §8.5): objective distributions by status/kind/severity,
// artifact totals and extracted byte volume. It is computed with grouped SQL so
// the cost is independent of how much produce a campaign has collected, and it
// honours the shared soft-delete lifecycle so deleted produce is excluded.
type ProduceSummary struct {
	Objectives      int64            `json:"objectives"`
	Exported        int64            `json:"exported"`
	ByStatus        map[string]int64 `json:"byStatus"`
	ByKind          map[string]int64 `json:"byKind"`
	BySeverity      map[string]int64 `json:"bySeverity"`
	Artifacts       int64            `json:"artifacts"`
	TotalBytes      int64            `json:"totalBytes"`
	Checksummed     int64            `json:"checksummed"`
	ArtifactsByKind map[string]int64 `json:"artifactsByKind"`
}

type produceGroupRow struct {
	Label string
	Count int64
}

// produceGroupCount returns the COUNT(*) distribution of a column, folding
// empty values into an "unknown" bucket so the UI always has a stable key.
func produceGroupCount(db *gorm.DB, column string) map[string]int64 {
	expr := "COALESCE(NULLIF(" + column + ", ''), 'unknown')"
	var rows []produceGroupRow
	if err := db.Select(expr + " AS label, COUNT(*) AS count").
		Group(expr).Scan(&rows).Error; err != nil {
		return map[string]int64{}
	}
	out := make(map[string]int64, len(rows))
	for _, row := range rows {
		out[row.Label] = row.Count
	}
	return out
}

// ProduceSummary aggregates objectives and artifacts, optionally scoped to a
// single organization. Every query filters deleted_at IS NULL through active().
func (s *Store) ProduceSummary(ctx context.Context, orgID string) ProduceSummary {
	summary := ProduceSummary{
		ByStatus:        map[string]int64{},
		ByKind:          map[string]int64{},
		BySeverity:      map[string]int64{},
		ArtifactsByKind: map[string]int64{},
	}

	objectives := func() *gorm.DB {
		db := active(s.db.WithContext(ctx)).Model(&domain.Objective{})
		if orgID != "" {
			db = db.Where("organization_id = ?", orgID)
		}
		return db
	}
	artifacts := func() *gorm.DB {
		db := active(s.db.WithContext(ctx)).Model(&domain.Artifact{})
		if orgID != "" {
			db = db.Where("organization_id = ?", orgID)
		}
		return db
	}

	count := func(db *gorm.DB) int64 {
		var n int64
		if err := db.Count(&n).Error; err != nil {
			return 0
		}
		return n
	}

	summary.Objectives = count(objectives())
	summary.Exported = count(objectives().Where("status = ?", "exported"))
	summary.ByStatus = produceGroupCount(objectives(), "status")
	summary.ByKind = produceGroupCount(objectives(), "kind")
	summary.BySeverity = produceGroupCount(objectives(), "severity")

	summary.Artifacts = count(artifacts())
	summary.Checksummed = count(artifacts().Where("checksum <> ?", ""))
	summary.ArtifactsByKind = produceGroupCount(artifacts(), "kind")

	var sumRow struct {
		Total int64
	}
	if err := artifacts().Select("COALESCE(SUM(size_bytes), 0) AS total").Scan(&sumRow).Error; err == nil {
		summary.TotalBytes = sumRow.Total
	}

	return summary
}
