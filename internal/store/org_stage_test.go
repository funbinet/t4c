package store

import (
	"errors"
	"testing"

	"github.com/funbinet/t4c/internal/domain"
)

// resolveStageAdvance is deliberately pure: these tests run without a database
// and lock down the governance contract (sequential transitions, stale-hint
// rejection and terminal-stage behaviour).
func TestResolveStageAdvanceSequential(t *testing.T) {
	cases := []struct {
		name     string
		previous domain.Stage
		from     domain.Stage
		to       domain.Stage
		want     domain.Stage
		wantErr  error
	}{
		{"recon to exploit without hints", domain.StageRecon, "", "", domain.StageExploit, nil},
		{"exploit to objectives without hints", domain.StageExploit, "", "", domain.StageObjectives, nil},
		{"recon to exploit with matching hints", domain.StageRecon, domain.StageRecon, domain.StageExploit, domain.StageExploit, nil},
		{"exploit to objectives with matching hints", domain.StageExploit, domain.StageExploit, domain.StageObjectives, domain.StageObjectives, nil},
		{"invalid from hint is ignored", domain.StageRecon, domain.Stage("stale-view"), "", domain.StageExploit, nil},
		{"invalid to hint is ignored", domain.StageRecon, "", domain.Stage("bogus"), domain.StageExploit, nil},
		{"terminal stage cannot advance", domain.StageObjectives, "", "", "", domain.ErrTerminalStage},
		{"stale from hint conflicts", domain.StageExploit, domain.StageRecon, "", "", domain.ErrStageConflict},
		{"future from hint conflicts", domain.StageRecon, domain.StageExploit, "", "", domain.ErrStageConflict},
		{"skipped to hint rejected", domain.StageRecon, "", domain.StageObjectives, "", domain.ErrInvalidStageTransition},
		{"non-sequential to hint rejected", domain.StageExploit, "", domain.StageExploit, "", domain.ErrInvalidStageTransition},
		{"unnormalized stage cannot advance", "", "", "", "", domain.ErrTerminalStage},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := resolveStageAdvance(tc.previous, tc.from, tc.to)
			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("err = %v, want %v", err, tc.wantErr)
				}
				if got != "" {
					t.Fatalf("stage = %q, want empty on error", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("stage = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestStageGovernanceErrorsAreDistinct(t *testing.T) {
	sentinels := []error{
		domain.ErrStageConflict,
		domain.ErrInvalidStageTransition,
		domain.ErrTerminalStage,
	}
	for i, a := range sentinels {
		for j, b := range sentinels {
			if i != j && errors.Is(a, b) {
				t.Fatalf("sentinel %v unexpectedly wraps %v", a, b)
			}
		}
	}
}
