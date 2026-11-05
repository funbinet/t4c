package domain

import "testing"

func TestStageValidAndNext(t *testing.T) {
	for _, stage := range AllStages {
		if !stage.Valid() {
			t.Fatalf("%q should be a valid stage", stage)
		}
	}
	for _, stage := range []Stage{"", "bogus", Stage("EXPLOIT")} {
		if stage.Valid() {
			t.Fatalf("%q should be invalid", stage)
		}
	}
	transitions := map[Stage]Stage{
		StageRecon:      StageExploit,
		StageExploit:    StageObjectives,
		StageObjectives: "",
	}
	for from, want := range transitions {
		if got := from.Next(); got != want {
			t.Fatalf("%q.Next() = %q, want %q", from, got, want)
		}
	}
	if StageRecon.String() != "recon" || StageObjectives.String() != "objectives" {
		t.Fatal("Stage.String() must return the plain stage value")
	}
}

func TestOrganizationValidateNormalizesStage(t *testing.T) {
	cases := []struct {
		name  string
		stage Stage
		want  Stage
	}{
		{"empty stage defaults to recon", "", StageRecon},
		{"legacy garbage heals to recon", Stage("legacy-garbage"), StageRecon},
		{"explicit recon preserved", StageRecon, StageRecon},
		{"explicit exploit preserved", StageExploit, StageExploit},
		{"explicit objectives preserved", StageObjectives, StageObjectives},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			org := &Organization{CanonicalName: "Example", Stage: tc.stage}
			if err := org.Validate(); err != nil {
				t.Fatalf("unexpected validation error: %v", err)
			}
			if org.Stage != tc.want {
				t.Fatalf("stage = %q, want %q", org.Stage, tc.want)
			}
		})
	}
}

func TestOrganizationEffectiveStage(t *testing.T) {
	var nilOrg *Organization
	if nilOrg.EffectiveStage() != StageRecon {
		t.Fatal("nil organization should fall back to recon")
	}
	for _, stage := range []Stage{"", Stage("bogus")} {
		if got := (&Organization{Stage: stage}).EffectiveStage(); got != StageRecon {
			t.Fatalf("EffectiveStage(%q) = %q, want recon", stage, got)
		}
	}
	for _, stage := range AllStages {
		if got := (&Organization{Stage: stage}).EffectiveStage(); got != stage {
			t.Fatalf("EffectiveStage(%q) = %q", stage, got)
		}
	}
}
