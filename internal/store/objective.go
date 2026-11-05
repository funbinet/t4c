package store

import (
	"context"
	"time"

	"github.com/funbinet/t4c/internal/domain"
)

func (s *Store) CreateObjective(ctx context.Context, o *domain.Objective) error {
	now := time.Now().UTC()
	if o.ID == "" {
		id, err := domain.NewID()
		if err != nil {
			return err
		}
		o.ID = id
	}
	o.DiscoveredAt = now
	if o.Status == "" {
		o.Status = "open"
	}
	o.SchemaVersion = domain.SchemaVersion
	if err := s.db.WithContext(ctx).Create(o).Error; err != nil {
		return err
	}
	_ = s.AppendGraphOutbox(ctx, "objective", o.ID, domain.OutboxOpUpsert)
	return nil
}

func (s *Store) GetObjective(ctx context.Context, id string) (*domain.Objective, error) {
	var obj domain.Objective
	err := active(s.db.WithContext(ctx)).Where("id = ?", id).First(&obj).Error
	if isNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &obj, nil
}

func (s *Store) ListObjectives(ctx context.Context, orgID string, kind, status string, q PageQuery) ([]domain.Objective, int64, error) {
	q = q.Normalized()
	db := active(s.db.WithContext(ctx)).Model(&domain.Objective{})
	if orgID != "" {
		db = db.Where("organization_id = ?", orgID)
	}
	if kind != "" {
		db = db.Where("kind = ?", kind)
	}
	if status != "" {
		db = db.Where("status = ?", status)
	}
	if q.Search != "" {
		pattern := ilike(q.Search)
		db = db.Where(`(title ILIKE ? ESCAPE '\' OR detail ILIKE ? ESCAPE '\')`, pattern, pattern)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var out []domain.Objective
	err := db.Order("discovered_at DESC, id DESC").Offset((q.Page - 1) * q.PageSize).Limit(q.PageSize).Find(&out).Error
	return out, total, err
}

func (s *Store) UpdateObjectiveStatus(ctx context.Context, id, status string) error {
	res := s.db.WithContext(ctx).Model(&domain.Objective{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("status", status)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.ErrRecordNotFound
	}
	return nil
}

func (s *Store) AddObjectiveAction(ctx context.Context, a *domain.ObjectiveAction) error {
	now := time.Now().UTC()
	if a.ID == "" {
		id, err := domain.NewID()
		if err != nil {
			return err
		}
		a.ID = id
	}
	a.CreatedAt = now
	return s.db.WithContext(ctx).Create(a).Error
}

func (s *Store) ListObjectiveActions(ctx context.Context, objectiveID string, q PageQuery) ([]domain.ObjectiveAction, int64, error) {
	q = q.Normalized()
	db := s.db.WithContext(ctx).Model(&domain.ObjectiveAction{}).Where("objective_id = ?", objectiveID)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var out []domain.ObjectiveAction
	err := db.Order("created_at DESC, id DESC").Offset((q.Page - 1) * q.PageSize).Limit(q.PageSize).Find(&out).Error
	return out, total, err
}
