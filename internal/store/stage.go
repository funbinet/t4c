package store

import (
	"context"

	"github.com/funbinet/t4c/internal/domain"
	"gorm.io/gorm"
)

// stagePredicate returns the SQL predicate used to scope a record set to a
// chain stage. Records written before Stage was introduced have an empty
// column and are treated as recon-owned, so recon screens never lose data.
func stagePredicate(stage domain.Stage) (string, []any) {
	if stage == domain.StageRecon {
		return "COALESCE(stage, '') IN ('', ?)", []any{string(domain.StageRecon)}
	}
	return "stage = ?", []any{string(stage)}
}

func applyStage(db *gorm.DB, stage domain.Stage) *gorm.DB {
	condition, args := stagePredicate(stage)
	return db.Where(condition, args...)
}

// ListAssetsByStage returns classified assets for a chain stage. Exploit and
// objectives scopes only expose assets that have been successfully breached;
// recon exposes the full discovered surface (including legacy rows).
func (s *Store) ListAssetsByStage(ctx context.Context, stage domain.Stage, kind string, q PageQuery) ([]domain.Asset, int64, error) {
	if q.Sort == "" || q.Sort == "createdAt:desc" {
		q.Sort = "lastSeen:desc"
	}
	q = q.Normalized()
	db := active(s.db.WithContext(ctx)).Model(&domain.Asset{})
	switch stage {
	case domain.StageExploit, domain.StageObjectives:
		db = db.Where("exploited = ?", true)
	default:
		db = applyStage(db, stage)
	}
	if kind != "" {
		db = db.Where("kind = ?", kind)
	}
	if q.Search != "" {
		pattern := ilike(q.Search)
		db = db.Where(`(key ILIKE ? ESCAPE '\' OR data->>'title' ILIKE ? ESCAPE '\' OR display_name ILIKE ? ESCAPE '\')`,
			pattern, pattern, pattern)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var out []domain.Asset
	err := db.Order(OrderClause(q.Sort)).Offset((q.Page - 1) * q.PageSize).Limit(q.PageSize).Find(&out).Error
	return out, total, err
}

// ListFindingsByStage returns findings scoped to a chain stage.
func (s *Store) ListFindingsByStage(ctx context.Context, stage domain.Stage, kind string, q PageQuery) ([]domain.Finding, int64, error) {
	q = q.Normalized()
	db := applyStage(s.db.WithContext(ctx).Model(&domain.Finding{}), stage)
	if kind != "" {
		db = db.Where("kind = ?", kind)
	}
	if q.Search != "" {
		pattern := ilike(q.Search)
		db = db.Where(`(title ILIKE ? ESCAPE '\' OR target ILIKE ? ESCAPE '\')`, pattern, pattern)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var out []domain.Finding
	err := db.Order(OrderClause(q.Sort)).Offset((q.Page - 1) * q.PageSize).Limit(q.PageSize).Find(&out).Error
	return out, total, err
}

func (s *Store) ListMonitorsByStage(ctx context.Context, stage domain.Stage, q PageQuery) ([]domain.Monitor, int64, error) {
	q = q.Normalized()
	db := applyStage(active(s.db.WithContext(ctx)).Model(&domain.Monitor{}), stage)
	if q.Search != "" {
		db = db.Where(`name ILIKE ? ESCAPE '\'`, ilike(q.Search))
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var out []domain.Monitor
	err := db.Order(OrderClause(q.Sort)).Offset((q.Page - 1) * q.PageSize).Limit(q.PageSize).Find(&out).Error
	return out, total, err
}

func (s *Store) ListSchedulesByStage(ctx context.Context, stage domain.Stage, q PageQuery) ([]domain.Schedule, int64, error) {
	q = q.Normalized()
	db := applyStage(active(s.db.WithContext(ctx)).Model(&domain.Schedule{}), stage)
	if q.Search != "" {
		db = db.Where(`name ILIKE ? ESCAPE '\'`, ilike(q.Search))
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var out []domain.Schedule
	err := db.Order(OrderClause(q.Sort)).Offset((q.Page - 1) * q.PageSize).Limit(q.PageSize).Find(&out).Error
	return out, total, err
}

func (s *Store) ListScopesByStage(ctx context.Context, stage domain.Stage, q PageQuery) ([]domain.Scope, int64, error) {
	q = q.Normalized()
	db := applyStage(active(s.db.WithContext(ctx)).Model(&domain.Scope{}), stage)
	if q.Search != "" {
		db = db.Where(`name ILIKE ? ESCAPE '\'`, ilike(q.Search))
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var out []domain.Scope
	err := db.Order(OrderClause(q.Sort)).Offset((q.Page - 1) * q.PageSize).Limit(q.PageSize).Find(&out).Error
	return out, total, err
}

// ListPoliciesByStage filters policies by the stage their policy category
// belongs to (StageForCategory). Objectives intentionally has no automation.
func (s *Store) ListPoliciesByStage(ctx context.Context, stage domain.Stage) ([]domain.Policy, error) {
	policies, err := s.ListPolicies(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Policy, 0, len(policies))
	for _, policy := range policies {
		if domain.StageForCategory(policy.Category) == stage {
			out = append(out, policy)
		}
	}
	return out, nil
}

// ChainCounts returns the headline counters for a stage overview.
func (s *Store) ChainCounts(ctx context.Context, stage domain.Stage) map[string]int64 {
	counts := map[string]int64{}
	condition, args := stagePredicate(stage)
	count := func(key string, db *gorm.DB) {
		var n int64
		if err := db.Count(&n).Error; err == nil {
			counts[key] = n
		}
	}
	count("assets", s.db.WithContext(ctx).Model(&domain.Asset{}).Where("deleted_at IS NULL").Where(condition, args...))
	count("findings", s.db.WithContext(ctx).Model(&domain.Finding{}).Where(condition, args...))
	count("tasks", s.db.WithContext(ctx).Model(&domain.Task{}).Where(condition, args...))
	count("organizations", s.db.WithContext(ctx).Model(&domain.Organization{}).Where("deleted_at IS NULL"))
	count("exploited", active(s.db.WithContext(ctx)).Model(&domain.Asset{}).Where("exploited = ?", true))
	count("sessions", active(s.db.WithContext(ctx)).Model(&domain.ShellSession{}))
	count("openSessions", active(s.db.WithContext(ctx)).Model(&domain.ShellSession{}).Where("state = ?", "open"))
	count("objectives", active(s.db.WithContext(ctx)).Model(&domain.Objective{}))
	count("artifacts", active(s.db.WithContext(ctx)).Model(&domain.Artifact{}))
	// Exploit and objectives overviews are driven by breached assets, not by
	// the recon-only stage column on assets.
	if stage == domain.StageExploit || stage == domain.StageObjectives {
		counts["assets"] = counts["exploited"]
	}
	return counts
}

// ChainKindCounts returns the AssetKind distribution for a stage, used by the
// asset classification strip on the chain overview screens.
func (s *Store) ChainKindCounts(ctx context.Context, stage domain.Stage) map[string]int64 {
	var rows []struct {
		Kind  string
		Count int64
	}
	db := active(s.db.WithContext(ctx)).Model(&domain.Asset{}).
		Select("COALESCE(kind, 'unknown') AS kind, COUNT(*) AS count")
	condition, args := stagePredicate(stage)
	if stage == domain.StageExploit || stage == domain.StageObjectives {
		db = db.Where("exploited = ?", true)
	} else {
		db = db.Where(condition, args...)
	}
	if err := db.Group("COALESCE(kind, 'unknown')").Scan(&rows).Error; err != nil {
		return map[string]int64{}
	}
	out := make(map[string]int64, len(rows))
	for _, row := range rows {
		out[row.Kind] = row.Count
	}
	return out
}

// ChainOrgCounts returns per-organization chain counters. Asset ownership is
// stored in the asset's JSONB data (organizationId); every other chain entity
// has a first-class organization_id column.
func (s *Store) ChainOrgCounts(ctx context.Context, stage domain.Stage) map[string]map[string]int64 {
	out := map[string]map[string]int64{}
	add := func(key string, rows []chainOrgRow) {
		for _, row := range rows {
			if row.OrganizationID == "" {
				continue
			}
			if out[row.OrganizationID] == nil {
				out[row.OrganizationID] = map[string]int64{}
			}
			out[row.OrganizationID][key] += row.Count
		}
	}
	var rows []chainOrgRow
	if err := s.db.WithContext(ctx).Model(&domain.ShellSession{}).
		Select("organization_id AS organization_id, COUNT(*) AS count").
		Where("deleted_at IS NULL").Group("organization_id").Scan(&rows).Error; err == nil {
		add("sessions", rows)
	}
	rows = nil
	if err := s.db.WithContext(ctx).Model(&domain.Objective{}).
		Select("organization_id AS organization_id, COUNT(*) AS count").
		Where("deleted_at IS NULL").Group("organization_id").Scan(&rows).Error; err == nil {
		add("objectives", rows)
	}
	rows = nil
	if err := s.db.WithContext(ctx).Model(&domain.Artifact{}).
		Select("organization_id AS organization_id, COUNT(*) AS count").
		Where("deleted_at IS NULL").Group("organization_id").Scan(&rows).Error; err == nil {
		add("artifacts", rows)
	}
	rows = nil
	if err := s.db.WithContext(ctx).Model(&domain.Task{}).
		Select("organization_id AS organization_id, COUNT(*) AS count").
		Where("stage = ?", string(stage)).Group("organization_id").Scan(&rows).Error; err == nil {
		add("tasks", rows)
	}
	rows = nil
	if err := s.db.WithContext(ctx).Model(&domain.Asset{}).
		Select("COALESCE(data->>'organizationId', '') AS organization_id, COUNT(*) AS count").
		Where("deleted_at IS NULL AND exploited = ?", true).
		Group("COALESCE(data->>'organizationId', '')").Scan(&rows).Error; err == nil {
		add("exploited", rows)
	}
	return out
}

type chainOrgRow struct {
	OrganizationID string
	Count          int64
}
