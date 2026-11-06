// The cutting mat: a static grid behind every screen. Pure CSS, no motion.
export function AppBackground() {
  return <div aria-hidden="true" className="mat-grid pointer-events-none fixed inset-0 -z-10" />
}
