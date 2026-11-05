package objective

import (
	"context"
	"sync"

	"github.com/funbinet/t4c/internal/domain"
)

// PluginType classifies an objective SDK plugin by its post-exploitation action.
type PluginType string

const (
	TypeShellSession  PluginType = "shell_session"   // maintain / re-ignite interactive shells
	TypeFileExfil     PluginType = "file_exfil"      // download files from compromised hosts
	TypeScreenshot    PluginType = "screenshot"      // capture desktop / web screenshots
	TypePacketCapture PluginType = "packet_capture"  // sniff network traffic
	TypeDataExport    PluginType = "data_export"     // dump databases / configs
	TypeLateralMove   PluginType = "lateral_move"    // pivot to internal hosts
	TypePersistence   PluginType = "persistence"     // establish persistence mechanisms
	TypeInternalRecon PluginType = "internal_recon"   // map internal network / services
	TypeArtifactCollect PluginType = "artifact_collect" // collect forensic artifacts
	TypeCredentialHarvest PluginType = "credential_harvest" // harvest credentials from memory/registry
)

// Target describes a compromised asset to operate on during the objective stage.
type Target struct {
	AssetID      string
	OrganizationID string
	SessionID    string // active shell session, if any
	Protocol     string // ssh | winrm | reverse | web-shell
	Host         string
	Port         int
	Username     string
	Kind         domain.AssetKind
	Tags         []string
	Metadata     map[string]any
}

// Meta describes an objective plugin's identity.
type Meta struct {
	Name        string
	Type        PluginType
	Category    string
	Severity    string
	Description string
	// RequiresSession indicates the plugin needs an active shell session.
	RequiresSession bool
}

// EffectiveSeverity returns the plugin's declared severity or a default.
func (m Meta) EffectiveSeverity() string {
	if m.Severity != "" {
		return m.Severity
	}
	switch m.Type {
	case TypePersistence, TypeLateralMove, TypeCredentialHarvest:
		return "critical"
	case TypeDataExport, TypeFileExfil, TypePacketCapture:
		return "high"
	case TypeShellSession, TypeScreenshot, TypeInternalRecon, TypeArtifactCollect:
		return "medium"
	default:
		return "medium"
	}
}

// Result captures the outcome of an objective action.
type Result struct {
	Success   bool
	Target    string
	Evidence  string
	Severity  string
	Artifacts []ArtifactInfo // artifacts to persist
	Objectives []ObjectiveHint // additional objectives to create
	Data      map[string]any
}

// ArtifactInfo describes an artifact produced by the objective plugin.
type ArtifactInfo struct {
	Name      string
	Kind      string // file | archive | db-dump | config | key | screenshot | capture
	Data      []byte // raw content (for small artifacts)
	Path      string // relative storage path
	Checksum  string
}

// ObjectiveHint suggests a follow-up objective.
type ObjectiveHint struct {
	Kind     domain.ObjectiveKind
	Title    string
	Detail   string
	Severity string
}

// Plugin is the interface every objective SDK must implement.
type Plugin interface {
	Meta() Meta
	Run(ctx context.Context, target Target) (Result, error)
}

var (
	registryMu sync.RWMutex
	registry   = map[string]Plugin{}
)

func Register(p Plugin) {
	registryMu.Lock()
	defer registryMu.Unlock()
	registry[p.Meta().Name] = p
}

func Registry() []Plugin {
	registryMu.RLock()
	defer registryMu.RUnlock()
	out := make([]Plugin, 0, len(registry))
	for _, p := range registry {
		out = append(out, p)
	}
	return out
}

func Find(name string) Plugin {
	registryMu.RLock()
	defer registryMu.RUnlock()
	return registry[name]
}

func PluginsByType(t PluginType) []Plugin {
	registryMu.RLock()
	defer registryMu.RUnlock()
	var out []Plugin
	for _, p := range registry {
		if p.Meta().Type == t {
			out = append(out, p)
		}
	}
	return out
}
