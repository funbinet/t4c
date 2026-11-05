import { STAGE_META, type Stage } from '@/app/mode'
import type { FilterOption } from '@/components/common/screen-toolbar'
import { Badge } from '@/components/ui/badge'

/**
 * Shared vocabulary for the dedicated exploit/objectives screens. Keeping the
 * labels, filter option lists and badge-variant rules in one place means every
 * mode screen classifies assets, findings and tasks identically to the rest of
 * the console (plan §2.2 / §8.3 / §8.5).
 */

export type BadgeVariant = 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'info'

// AssetKind values (internal/domain/models.go). The "exploited" pseudo-kind is
// reserved for the derived breached state and is surfaced with its own label.
export const KIND_LABELS: Record<string, string> = {
  domain: 'Domain',
  ip: 'IP Address',
  service: 'Service',
  web: 'Web Application',
  api_endpoint: 'API Endpoint',
  credential: 'Credential',
  password: 'Password',
  session: 'Session',
  certificate: 'Certificate',
  bucket: 'Storage Bucket',
  file: 'File',
  site: 'Site',
  url: 'URL',
  cidr: 'CIDR Block',
  exploited: 'Exploited',
  unknown: 'Unclassified',
}

export const KIND_FILTERS: FilterOption[] = [
  { value: '', label: 'All asset kinds' },
  ...Object.entries(KIND_LABELS)
    .filter(([value]) => value !== 'exploited' && value !== 'unknown')
    .map(([value, label]) => ({ value, label })),
]

export const FINDING_KIND_LABELS: Record<string, string> = {
  vuln: 'Vulnerability',
  nuclei: 'Nuclei Template',
  wih: 'Web Intelligence',
  file_leak: 'File Leak',
  protocol: 'Protocol Exposure',
  exploit: 'Exploit Result',
  objective: 'Objective Result',
}

export const FINDING_KIND_FILTERS: FilterOption[] = [
  { value: '', label: 'All risk kinds' },
  ...Object.entries(FINDING_KIND_LABELS).map(([value, label]) => ({ value, label })),
]

export const SEVERITY_FILTERS: FilterOption[] = [
  { value: '', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'info', label: 'Info' },
]

export const TASK_STATUS_FILTERS: FilterOption[] = [
  { value: '', label: 'All statuses' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'partial', label: 'Partial' },
  { value: 'failed', label: 'Failed' },
  { value: 'canceled', label: 'Canceled' },
]

export const OBJECTIVE_STATUS_OPTIONS: FilterOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'closed', label: 'Closed' },
  { value: 'exported', label: 'Exported' },
]

// Task kinds valid for each stage (internal/domain/models.go). Used by the
// stage-scoped "New Task" dialog so exploit/objectives never offer recon kinds.
export const STAGE_TASK_KINDS: Record<Stage, { value: string; label: string }[]> = {
  recon: [
    { value: 'domain', label: 'Domain Discovery' },
    { value: 'ip', label: 'IP / Network' },
    { value: 'risk_cruising', label: 'Risk Cruising' },
    { value: 'asset_site_update', label: 'Site Sync' },
    { value: 'asset_wih_update', label: 'Web Intelligence' },
  ],
  exploit: [
    { value: 'exploit', label: 'Exploit Validation' },
    { value: 'exploit_brute', label: 'Credential Brute Force' },
    { value: 'exploit_inject', label: 'Injection Exploit' },
  ],
  objectives: [
    { value: 'objective', label: 'Objective Probe' },
  ],
}

export function humanize(value?: string): string {
  if (!value) return '—'
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function kindLabel(kind?: string): string {
  return KIND_LABELS[kind || ''] || humanize(kind)
}

export function findingKindLabel(kind?: string): string {
  return FINDING_KIND_LABELS[kind || ''] || humanize(kind)
}

export function severityVariant(severity?: string): BadgeVariant {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'danger'
    case 'medium':
      return 'warning'
    case 'low':
      return 'info'
    default:
      return 'outline'
  }
}

export function statusVariant(status?: string): BadgeVariant {
  switch (status) {
    case 'succeeded':
    case 'active':
    case 'confirmed':
    case 'done':
    case 'exported':
    case 'open':
      return 'success'
    case 'running':
    case 'queued':
    case 'in_progress':
      return 'info'
    case 'failed':
    case 'rejected':
    case 'expired':
      return 'danger'
    case 'partial':
    case 'paused':
      return 'warning'
    default:
      return 'outline'
  }
}

export function confidencePercent(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  const pct = value <= 1 ? value * 100 : value
  return `${Math.round(pct)}%`
}

export function stageScreenTitle(mode: Stage, screen: string): string {
  return `${STAGE_META[mode].shortLabel} · ${screen}`
}

// Small stage identity chip used in every chain screen toolbar so the active
// link of the three-stage chain is always visible.
export function StagePill({ stage }: { stage: Stage }) {
  return (
    <Badge variant="outline" className="border-[rgba(0,250,0,0.35)] text-mint">
      {STAGE_META[stage].shortLabel} stage
    </Badge>
  )
}
