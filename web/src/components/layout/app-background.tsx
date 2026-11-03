import { ParticleField } from '@/components/visuals/particle-field'

// Global backdrop — the login hero layer stack used app-wide (docs/UI-AUDIT.md §0):
// --grad-hero gradient + data-grid hairlines + drifting particle field.
// Rendered once at the router level, fixed behind every route; page roots stay transparent.
export function AppBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: 'var(--grad-hero)' }} />
      <div className="data-grid absolute inset-0 opacity-40" />
      <ParticleField className="absolute inset-0 size-full" />
    </div>
  )
}
