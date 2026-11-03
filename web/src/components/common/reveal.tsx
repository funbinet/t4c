import { useEffect, useRef } from 'react'

// Reveal-on-scroll: adds .reveal-in when the element enters the viewport.
// Static by default under prefers-reduced-motion (CSS keeps it visible).
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') {
      el.classList.add('reveal-in')
      return
    }
    const onEntries = (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-in')
          observer.unobserve(entry.target)
        }
      }
    }
    const observer = new IntersectionObserver(onEntries, {
      threshold: 0.08,
      rootMargin: '0px 0px -40px 0px',
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}
