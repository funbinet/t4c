package domain

type Stage string

const (
	StageRecon      Stage = "recon"      // external attack surface discovery & mapping
	StageExploit    Stage = "exploit"    // controlled exploitation / validation of findings
	StageObjectives Stage = "objectives" // extracted loot, shells, downloads, probes, exports
)

var AllStages = []Stage{StageRecon, StageExploit, StageObjectives}

func (s Stage) Valid() bool {
	switch s {
	case StageRecon, StageExploit, StageObjectives:
		return true
	}
	return false
}

// Next returns the downstream stage, or "" if s is the terminal stage.
func (s Stage) Next() Stage {
	switch s {
	case StageRecon:
		return StageExploit
	case StageExploit:
		return StageObjectives
	default:
		return ""
	}
}

// StageForCategory maps a policy category to a chain stage.
func StageForCategory(c string) Stage {
	if c == PolicyCategoryExploitation {
		return StageExploit
	}
	return StageRecon // vuln-assessment / probing are recon-class; objectives are derived.
}
