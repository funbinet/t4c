package objective

import "testing"

// TestBuiltinRegistryMinimum locks the objectives half of the plan's hard SDK
// requirement: >= 8 dedicated objective SDKs (plan §5.1 / T9).
func TestBuiltinRegistryMinimum(t *testing.T) {
	plugins := Builtin(nil)
	if len(plugins) < 8 {
		t.Fatalf("objective builtin registry has %d plugins, want >= 8", len(plugins))
	}
	seen := make(map[string]bool, len(plugins))
	for _, p := range plugins {
		m := p.Meta()
		if m.Name == "" {
			t.Error("objective plugin has an empty name")
		}
		if seen[m.Name] {
			t.Errorf("duplicate objective plugin name %q", m.Name)
		}
		seen[m.Name] = true
		if m.Type == "" {
			t.Errorf("objective plugin %q has no type", m.Name)
		}
		if m.Category == "" {
			t.Errorf("objective plugin %q has no category", m.Name)
		}
		if m.Description == "" {
			t.Errorf("objective plugin %q has no description", m.Name)
		}
		if m.EffectiveSeverity() == "" {
			t.Errorf("objective plugin %q has no effective severity", m.Name)
		}
	}
	if len(Registry()) < 8 {
		t.Errorf("global registry has %d plugins after Builtin()", len(Registry()))
	}
}

func TestBuiltinRegistryLookup(t *testing.T) {
	Builtin(nil)
	for _, name := range []string{
		"shell_session", "file_exfil", "screenshot", "packet_capture",
		"data_export", "lateral_move", "persistence", "internal_recon",
		"artifact_collect", "credential_harvest",
	} {
		if Find(name) == nil {
			t.Errorf("Find(%q) returned nil", name)
		}
	}
	if len(PluginsByType(TypeShellSession)) == 0 {
		t.Error("PluginsByType(TypeShellSession) returned no plugins")
	}
}

// A shell-capable plugin must declare RequiresSession so the engine only runs
// it against assets that have an active session (plan §5).
func TestSessionDependentPluginsDeclareRequirement(t *testing.T) {
	Builtin(nil)
	found := false
	for _, p := range Registry() {
		if p.Meta().Type == TypeShellSession {
			found = true
			if !p.Meta().RequiresSession {
				t.Errorf("plugin %q is a shell-session SDK but does not declare RequiresSession", p.Meta().Name)
			}
		}
	}
	if !found {
		t.Error("no shell-session plugin registered")
	}
}

func TestBuiltinRegistryIsIdempotent(t *testing.T) {
	Builtin(nil)
	first := len(Registry())
	Builtin(nil)
	if second := len(Registry()); second != first {
		t.Fatalf("registry grew from %d to %d after a second Builtin() call", first, second)
	}
}
