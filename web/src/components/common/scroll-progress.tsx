import { useEffect, useRef, useState } from 'react'

// Neon scroll progress bar: tracks the scroll container (the <main> overflow
// pane on xl, otherwise the document) and fills left→right.
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let frame = 0

    function findScroller(): HTMLElement[] {
      const main = document.querySelector('main')
      if (main && main.scrollHeight > main.clientHeight + 1) return [main, document.documentElement]
      return [document.documentElement]
    }

    function update() {
      frame = 0
      const bar = barRef.current
      if (!bar) return
      let max = 0
      let value = 0
      for (const el of findScroller()) {
        const elMax = el.scrollHeight - el.clientHeight
        if (elMax > max) {
          max = elMax
          value = el.scrollTop
        }
      }
      const progress = max > 0 ? Math.min(1, value / max) : 0
      bar.style.transform = `scaleX(${progress})`
      setVisible(progress > 0.01)
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div
      ref={barRef}
      className={visible ? 'scroll-progress' : 'scroll-progress opacity-0'}
      style={{ transform: 'scaleX(0)' }}
      aria-hidden="true"
    />
  )
}
