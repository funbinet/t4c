import type { Role } from './access'

export function formatTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US', { hour12: false })
}

export function formatNumber(value?: number | null): string {
  return new Intl.NumberFormat('en-US').format(value ?? 0)
}

export function relativeTime(value?: string | null): string {
  if (!value) return '—'
  const delta = Date.now() - new Date(value).getTime()
  if (Number.isNaN(delta)) return value
  const minutes = Math.max(0, Math.floor(delta / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.floor(hours / 24)} d ago`
}

export function riskLabel(risk?: string): string {
  return (
    ({ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' } as Record<string, string>)[
      risk || ''
    ] ||
    risk ||
    'Unknown'
  )
}

export function statusLabel(status?: string): string {
  const labels: Record<string, string> = {
    queued: 'Queued',
    running: 'Running',
    succeeded: 'Succeeded',
    partial: 'Partial',
    failed: 'Failed',
    canceled: 'Canceled',
    active: 'Active',
    paused: 'Paused',
    candidate: 'Candidate',
    confirmed: 'Confirmed',
    rejected: 'Rejected',
    done: 'Done',
  }
  return labels[status || ''] || status || '—'
}

export function roleLabel(role?: Role): string {
  return ({ viewer: 'Viewer', operator: 'Operator', admin: 'Admin' } as Record<string, string>)[role || ''] || role || '—'
}

export function policySummary(config?: Record<string, any>): string {
  if (!config) return '—'
  const groups = ['domain', 'ip', 'site'].flatMap((key) => Object.entries(config[key] || {}))
  return (
    groups
      .filter(([, value]) => value === true)
      .map(([key]) => key)
      .join(' · ') || 'None enabled'
  )
}
