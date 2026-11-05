package httpapi

import (
	"strings"
	"testing"

	"github.com/funbinet/t4c/internal/domain"
)

// TestStageSDKMinimums enforces the plan's hard requirement (§0.1 / §12):
// every chain stage must ship at least 8 dedicated SDKs. The stage overview
// exposes exactly this registry, so a regression that drops a plugin fails the
// build instead of silently shipping an under-powered mode.
func TestStageSDKMinimums(t *testing.T) {
	const minimum = 8
	for _, stage := range domain.AllStages {
		plugins := stagePluginRegistry(stage)
		if len(plugins) < minimum {
			t.Fatalf("stage %q ships %d SDKs, want >= %d", stage, len(plugins), minimum)
		}
		seen := make(map[string]bool, len(plugins))
		for _, plugin := range plugins {
			name, _ := plugin["name"].(string)
			typ, _ := plugin["type"].(string)
			category, _ := plugin["category"].(string)
			description, _ := plugin["description"].(string)
			if name == "" {
				t.Errorf("stage %q has an SDK with an empty name", stage)
			}
			if seen[name] {
				t.Errorf("stage %q has duplicate SDK name %q", stage, name)
			}
			seen[name] = true
			if typ == "" {
				t.Errorf("stage %q SDK %q has no type", stage, name)
			}
			if description == "" {
				t.Errorf("stage %q SDK %q has no description", stage, name)
			}
			if category == "" {
				t.Errorf("stage %q SDK %q has no category", stage, name)
			}
		}
	}
}

// TestStageSDKRegistriesAreIsolated verifies each stage owns its own SDK set:
// recon discovery adapters must not leak into the exploit or objectives
// registries (plan §0.1 "SDKs are mode-owned").
func TestStageSDKRegistriesAreIsolated(t *testing.T) {
	recon := sdkNames(stagePluginRegistry(domain.StageRecon))
	exploit := sdkNames(stagePluginRegistry(domain.StageExploit))
	objectives := sdkNames(stagePluginRegistry(domain.StageObjectives))

	if len(recon) < 8 || len(exploit) < 8 || len(objectives) < 8 {
		t.Fatalf("registry sizes recon=%d exploit=%d objectives=%d", len(recon), len(exploit), len(objectives))
	}
	if _, ok := recon["subfinder"]; !ok {
		t.Error("recon registry lost the subfinder adapter")
	}
	for _, name := range []string{"sqli", "rce", "credential_access"} {
		if _, ok := exploit[name]; !ok {
			t.Errorf("exploit registry lost %q", name)
		}
	}
	for _, name := range []string{"shell_session", "file_exfil", "artifact_collect"} {
		if _, ok := objectives[name]; !ok {
			t.Errorf("objective registry lost %q", name)
		}
	}
	// Discovering SDKs are recon-only; they must not be reported as exploit SDKs.
	for _, name := range []string{"subfinder", "dnsx", "ct-logs"} {
		if _, ok := exploit[name]; ok {
			t.Errorf("recon SDK %q leaked into the exploit registry", name)
		}
	}
}

// TestSafeDownloadName guards the auth-gated artifact download against header
// injection and path traversal through a crafted artifact name.
func TestSafeDownloadName(t *testing.T) {
	cases := []struct {
		name     string
		fallback string
		want     string
	}{
		{"config.json", "id1", "config.json"},
		{"  ", "id2", "artifact-id2"},
		{"../../etc/passwd", "id3", ".._.._etc_passwd"},
		{"report\r\nX-Injected: yes", "id4", "report__X-Injected__yes"},
	}
	for _, tc := range cases {
		if got := safeDownloadName(tc.name, tc.fallback); got != tc.want {
			t.Errorf("safeDownloadName(%q) = %q, want %q", tc.name, got, tc.want)
		}
	}
	long := safeDownloadName(strings.Repeat("a", 200), "id")
	if len(long) != 96 {
		t.Errorf("long filename length = %d, want 96", len(long))
	}
}

func sdkNames(plugins []map[string]any) map[string]struct{} {
	out := make(map[string]struct{}, len(plugins))
	for _, plugin := range plugins {
		if name, ok := plugin["name"].(string); ok {
			out[name] = struct{}{}
		}
	}
	return out
}
