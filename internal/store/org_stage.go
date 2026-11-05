package store

import (
	"context"
	"fmt"
	"time"

	"github.com/funbinet/t4c/internal/domain"
	"gorm.io/gorm"
)

// OrganizationStageTransition is one recorded recon → exploit → objectives
// advancement for an organization. Transitions are derived from the audit log,
// so no additional table or migration is required.
type OrganizationStageTransition struct {
	FromStage domain.Stage `json:"fromStage"`
	ToStage   domain.Stage `json:"toStage"`
	Actor     string       `json:"actor"`
	At        time.Time    `json:"at"`
}

// resolveStageAdvance is the pure governance rule behind an advancement: the
// successor must be sequential, an optional from hint must match the persisted
// stage (optimistic concurrency), and an optional to hint must equal the
// successor. Keeping it free of database access makes the rule unit-testable.
func resolveStageAdvance(previous, from, to domain.Stage) (domain.Stage, error) {
	current := previous.Next()
	if current == "" {
		return "", domain.ErrTerminalStage
	}
	if from.Valid() && from != previous {
		return "", fmt.Errorf("%w: organization is at %q, not %q", domain.ErrStageConflict, previous, from)
	}
	if to.Valid() && to != current {
		return "", fmt.Errorf("%w: next stage must be %q, got %q", domain.ErrInvalidStageTransition, current, to)
	}
	return current, nil
}

// AdvanceOrganizationStage atomically advances an organization to the next
// chain stage. The persisted stage is the single source of truth: the caller
// cannot skip a stage or advance an organization twice concurrently.
//
//   - from is an optional optimistic-concurrency hint. When it is a valid
//     stage it must equal the persisted current stage, otherwise
//     domain.ErrStageConflict is returned (guards a stale client).
//   - to is optional. When valid it must equal the sequential successor of the
//     current stage, otherwise domain.ErrInvalidStageTransition is returned.
//   - An organization already at objectives returns domain.ErrTerminalStage.
//
// On success the new stage is persisted, a chain.advance_stage audit event is
// written, and the previous and resulting stages are returned.
func (s *Store) AdvanceOrganizationStage(ctx context.Context, orgID string, from, to domain.Stage, actor string) (domain.Stage, domain.Stage, error) {
	var previous, current domain.Stage
	if orgID == "" {
		return "", "", domain.ErrRecordNotFound
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var org domain.Organization
		if err := active(tx).Where("id = ?", orgID).First(&org).Error; err != nil {
			if isNotFound(err) {
				return domain.ErrRecordNotFound
			}
			return err
		}

		// Capture the raw column value for the compare-and-swap guard so legacy
		// rows (empty/NULL stage) are handled without a separate backfill here.
		rawStage := org.Stage
		previous = org.EffectiveStage()
		resolved, err := resolveStageAdvance(previous, from, to)
		if err != nil {
			return err
		}
		current = resolved

		now := time.Now().UTC()
		// Compare-and-swap on the raw stage value makes concurrent advances
		// safe on every supported driver: only one transaction can move a given
		// stage forward, the loser sees zero rows affected.
		result := tx.Model(&domain.Organization{}).
			Where("id = ? AND deleted_at IS NULL AND COALESCE(stage, '') = ?", orgID, string(rawStage)).
			Updates(map[string]any{"stage": string(current), "updated_at": now})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return fmt.Errorf("%w: stage changed concurrently, retry", domain.ErrStageConflict)
		}
		return nil
	})
	if err != nil {
		return "", "", err
	}

	s.AddAudit(ctx, domain.AuditEvent{
		Actor:    actor,
		Action:   "chain.advance_stage",
		Resource: orgID,
		Detail: map[string]any{
			"fromStage": string(previous),
			"toStage":   string(current),
		},
	})
	return previous, current, nil
}

// ListOrganizationStageHistory returns the recorded stage transitions for an
// organization, newest first. It reads the audit log, so it is consistent with
// AdvanceOrganizationStage without extra schema. A store error yields an empty
// (never nil) slice so callers can serialize it directly.
func (s *Store) ListOrganizationStageHistory(ctx context.Context, orgID string, limit int) []OrganizationStageTransition {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	var events []domain.AuditEvent
	if err := s.db.WithContext(ctx).Model(&domain.AuditEvent{}).
		Where("resource = ? AND action = ?", orgID, "chain.advance_stage").
		Order("created_at DESC").Limit(limit).Find(&events).Error; err != nil {
		return []OrganizationStageTransition{}
	}
	out := make([]OrganizationStageTransition, 0, len(events))
	for _, event := range events {
		transition := OrganizationStageTransition{Actor: event.Actor, At: event.CreatedAt}
		if event.Detail != nil {
			if value, ok := event.Detail["fromStage"].(string); ok {
				transition.FromStage = domain.Stage(value)
			}
			if value, ok := event.Detail["toStage"].(string); ok {
				transition.ToStage = domain.Stage(value)
			}
		}
		out = append(out, transition)
	}
	return out
}
