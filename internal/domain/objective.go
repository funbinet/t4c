package domain

import "time"

type ObjectiveKind string

const (
	ObjectiveShell    ObjectiveKind = "shell"
	ObjectiveDownload ObjectiveKind = "download"
	ObjectiveProbe    ObjectiveKind = "probe"
	ObjectiveLoot     ObjectiveKind = "loot"
	ObjectiveFlag     ObjectiveKind = "flag"
)

type Objective struct {
	ID             string         `gorm:"primaryKey;size:24" json:"id"`
	OrganizationID string         `json:"organizationId"`
	AssetID        string         `json:"assetId"`
	TaskID         string         `json:"taskId"`
	SessionID      *string        `json:"sessionId,omitempty"`
	Kind           ObjectiveKind  `json:"kind"`
	Title          string         `json:"title"`
	Detail         string         `json:"detail"`
	Severity       string         `json:"severity"`
	Status         string         `json:"status"` // open | in_progress | closed | exported
	Metadata       map[string]any `gorm:"type:jsonb;serializer:json" json:"metadata,omitempty"`
	DiscoveredAt   time.Time      `json:"discoveredAt"`
	CreatedBy      string         `json:"createdBy"`
	SchemaVersion  int            `json:"schemaVersion"`
	Lifecycle      `gorm:"embedded"`
}

func (Objective) TableName() string { return "objectives" }

type ObjectiveAction struct {
	ID          string    `gorm:"primaryKey;size:24" json:"id"`
	ObjectiveID string    `json:"objectiveId"`
	Kind        string    `json:"kind"` // probe | export | task | note | delete
	Payload     string    `json:"payload"`
	Result      string    `json:"result"`
	Actor       string    `json:"actor"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (ObjectiveAction) TableName() string { return "objective_actions" }
