# Implementation Plan — Blueprint Skin (pellete.md §2–§5 + back.md)

Rules: skin-only change. No content, copy, structure, layout-logic, or functionality changes. Tokens defined once in `web/src/styles.css` `:root` with exact blueprint values; components reference tokens (`bg-primary`, `var(--…)`), never hardcoded hex.

## Step 1 — Tokens & global styles (`web/src/styles.css`)
- Replace `:root` values: `--background:#000000`, `--foreground:#eaffea`, `--card:#0a0a0a`, `--popover:#0a0a0a`, `--primary:#00fa00`, `--primary-foreground:#000000`, `--secondary:#111111`, `--muted:#111111`, `--muted-foreground:#66cc66`, `--accent:#111111`, `--destructive:#ff6b6b`, `--border:rgba(0,250,0,0.12)`, `--input:rgba(0,250,0,0.16)`, `--ring:#39ff14`, `--radius:4px`.
- Add blueprint tokens: `--brand:#003d00`, `--brand-600:#005c00`, `--accent-600:#00cc00`, `--accent-bright:#39ff14`, `--mint:#b4ffb4`, `--dim:#3d8c3d`, light-band set (`#e6f7f0 #d9ede5 #00a870 #00c896 #0a1a12 #001a00`), extended greens.
- Add exact §4 gradients as variables (`--grad-access`, `--grad-button`, `--grad-light`, `--grad-rule-dark`, `--grad-rule-light`, `--grad-rule-fade`, `--grad-hero`, `--grad-glass`).
- Rewrite `data-grid` to `rgba(0,250,0,0.05)`; selection `#00fa00` + black text; focus ring `#39ff14`; green-tinted scrollbar; risk classes on new scale; `.mono-label`; `.text-gradient`; `.glass`; `.doc-panel`; `.light-band`; `.liquid-border` (+`@property --lb-angle`, `lb-spin`); `.glow-fx` (+`--glow-x/y`, `.is-glowing`); `.reveal`/`.reveal-in`; film grain `body::after`; `.scroll-progress` bar.

## Step 2 — New components
- `web/src/components/visuals/particle-field.tsx` — per back.md: green-family colors, LINK_DIST 110, density `min(90,max(28,area/16000))`, DPR≤2, visibilitychange pause, reduced-motion static, cleanup.
- `web/src/components/common/glow.tsx` — `useGlowFollow` RAF-throttled pointermove → `--glow-x/--glow-y` + `.is-glowing`.
- `web/src/components/common/scroll-progress.tsx` — fixed 2px neon gradient bar, rAF-throttled, works for window and `xl` main-container scrolling.
- `web/src/components/common/reveal.tsx` — `useReveal` IntersectionObserver adding `.reveal-in` (reduced-motion safe).

## Step 3 — UI primitives reskin (token refs only)
`ui/button.tsx` (neon gradient default + hover `--accent-600`, black text, link = mint underline), `ui/badge.tsx` (green tints + error red danger), `ui/card.tsx` (doc panel + hairline), `ui/input.tsx`, `ui/textarea.tsx`, `ui/select.tsx`, `ui/checkbox.tsx` (neon fill + black check), `ui/progress.tsx` (neon fill), `ui/tabs.tsx`, `ui/command.tsx`, `ui/dialog.tsx`, `ui/sheet.tsx`, `ui/dropdown-menu.tsx`, `ui/tooltip.tsx`, `ui/skeleton.tsx`, `ui/separator.tsx`.

## Step 4 — Layout & shared
`layout/app-shell.tsx` (black sidebar, paper content, glass header, mono group labels, neon active state, ScrollProgress mount, body-level glass), `common/data-table.tsx`, `common/states.tsx`, `common/stat-tile.tsx`, `common/page-header.tsx`, `common/pagination.tsx`, `common/confirm-dialog.tsx` (inherits tokens), `app/providers.tsx` (dark toast theme).

## Step 5 — Pages & visuals
- `pages/login-page.tsx` — back.md hero exactly: `glow-fx liquid-border` section, `--grad-hero` + `data-grid` 40% + `ParticleField` layers, gradient-text headline highlight, glass form side, neon submit, error red only for errors. Hook up `useGlowFollow`.
- `visuals/surface-map.tsx`, `visuals/asset-graph.tsx` — dark ECharts palettes from tokens.
- Page-level hardcoded colors: `overview-page.tsx`, `system-page.tsx`, `findings-page.tsx`, `assets-page.tsx`, `task-detail-page.tsx`, `change-password-page.tsx`, `not-found-page.tsx`, `organizations-page.tsx`, `organization-detail-page.tsx`, `tasks-page.tsx`, `recycle-bin-page.tsx` — swap slate/white/hex classes to tokens.
- `index.html` — `theme-color` → `#000000`.

## Step 6 — Verify
`npm run typecheck`, `npm test`, `npm run build`, then re-audit vs comparison map; regenerate visual snapshots note.
