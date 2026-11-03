import { useEffect, useRef } from 'react'

// Blueprint particle field (back.md layer 3): dependency-free canvas —
// green-family dots drifting and linking when close. GPU-cheap, DPR-capped,
// paused on hidden tab, static under prefers-reduced-motion.
export function ParticleField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const context = ctx
    const colors = ['#00fa00', '#39ff14', '#00dd00', '#66ffbb', '#00aa00', '#b4ffb4'] // green family only
    let particles: Array<{ x: number; y: number; vx: number; vy: number; r: number; c: string }> = []
    let width = 0
    let height = 0
    let raf = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(90, Math.max(28, Math.round((width * height) / 16000)))
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        r: 0.8 + Math.random() * 1.6,
        c: colors[Math.floor(Math.random() * colors.length)],
      }))
      if (reduced) draw()
    }

    const LINK_DIST = 110

    function draw() {
      context.clearRect(0, 0, width, height)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dist = Math.hypot(a.x - b.x, a.y - b.y)
          if (dist < LINK_DIST) {
            context.strokeStyle = `rgba(0, 250, 0, ${0.16 * (1 - dist / LINK_DIST)})`
            context.lineWidth = 1
            context.beginPath()
            context.moveTo(a.x, a.y)
            context.lineTo(b.x, b.y)
            context.stroke()
          }
        }
      }
      for (const p of particles) {
        context.globalAlpha = 0.75
        context.fillStyle = p.c
        context.beginPath()
        context.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        context.fill()
      }
      context.globalAlpha = 1
    }

    const tick = () => {
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > width) p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1
      }
      draw()
      raf = requestAnimationFrame(tick)
    }

    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduced) raf = requestAnimationFrame(tick)
    }

    resize()
    if (!reduced) {
      raf = requestAnimationFrame(tick)
      document.addEventListener('visibilitychange', onVisibility)
    }
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
