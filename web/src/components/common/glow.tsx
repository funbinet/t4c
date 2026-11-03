import { useEffect, useRef } from 'react'

// Cursor-follow glow (back.md): RAF-throttled pointermove writes the cursor
// position into --glow-x/--glow-y and toggles .is-glowing near the element,
// driving the .glow-fx::after ring.
export function useGlowFollow<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    let lastEvent: PointerEvent | null = null

    const apply = () => {
      frame = 0
      const event = lastEvent
      if (!event) return
      const rect = el.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const near =
        event.clientX >= rect.left - 120 &&
        event.clientX <= rect.right + 120 &&
        event.clientY >= rect.top - 120 &&
        event.clientY <= rect.bottom + 120
      el.style.setProperty('--glow-x', `${x}px`)
      el.style.setProperty('--glow-y', `${y}px`)
      el.classList.toggle('is-glowing', near)
    }

    const onMove = (event: PointerEvent) => {
      lastEvent = event
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const onLeave = () => el.classList.remove('is-glowing')

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return ref
}
