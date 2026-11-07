# UI Audit: Three Color Outline Conformance Record

Audit date: 2026-11 (cutting mat overhaul) · Scope: `web/src`.
Design system: `docs/UI-ENHANCEMENT.md`. This record supersedes the earlier
neon terminal audit that lived on this page.

Result: the overhaul is complete across primitives, screens, chain views, and
visuals. Typecheck, unit tests, and the production build pass.

## What was swept

| Area | Change |
|---|---|
| Tokens | `styles.css` rewritten: three colors (canvas `#090A08`, ink `#2D7B49`, surface `#0F2516`) plus two ink alpha blends, radius zero, global animation and transition kill, square scrollbars, ink selection. |
| Background | `app-background.tsx` renders nothing: the background is the bare canvas. An earlier cutting mat grid (32px hairlines, 128px majors) was removed because it made content hard to read. The particle field, film grain, gradient hero, and data grid layer were deleted before that. |
| Effects deleted | `particle-field.tsx`, `glow.tsx`, `reveal.tsx`, `scroll-progress.tsx` removed with all imports. |
| Geometry | Every `rounded-*` class removed across 40 plus files; scrollbars and chart bars square. |
| Motion | Every `transition-*`, `duration-*`, `animate-*`, `backdrop-blur`, hover scale and translate removed; ECharts `animation: false`; spinners replaced by static icons. |
| Elevation | Every shadow and glow removed; modal overlay is canvas at 80 percent. |
| Buttons | All variants are outlined squares that fill with surface on hover. Every icon action button is the uniform 36px `size-9` square. The remaining text buttons (sign in, create, import, export, queue, view all, cancel, confirm, log, select all, done, save, advance, apply, run, re-ignite, download, view, produce, change password, remove, account) converted to icon-only with `sr-only` labels. |
| Rows | List rows remain the click target via `DataTable.onRowClick`; action cells stop propagation. |
| Severity | Badges, risk bars, graph nodes, and map pins draw severity as fill weight of ink: solid, 62 percent, 38 percent, surface. The legacy red and green hex scales are gone from all three chart configs. |
| Containers | Nothing is filled at rest. Cards, inputs, chips, facts, code blocks, error boxes, and skeletons are outlined rectangles on the canvas. Dialogs, sheets, popovers, tooltips, and toasts render a canvas body with a hairline border. |
| Copy | Decorative login tagline removed; error and empty states draw with ink and hairlines only. |

## Screen status

All screens follow the design system: overview, organizations, organization
detail, assets, findings, tasks, task detail, monitors, schedules, policies,
asset groups, GitHub, fingerprints, PoC plugins, users, API keys, recycle bin,
system, audit, login, change password, 404, and the chain screens (overview,
organizations, tasks, task detail, assets, findings, produce, objective
workflow, automation, breakdown).

## Mode isolation and shell cleanup sweep

Follow-up sweep after the v3.5.0 chain release, focused on strict stage
isolation and outline uniformity. Typecheck, unit tests, and the production
build pass.

| Area | Change |
|---|---|
| Login | Stripped to gradient canvas, logo, `T4C` wordmark, two fields, one icon sign-in. Footer and copy removed. |
| Sidebar | `ModeToggle` moved out of the nav groups to the bottom of the sidebar (desktop and mobile), above the collapse control. |
| Chain overview | Screen toolbar and chain progress card removed; card titles centered with inline mono counts; arrow and "View all" buttons removed. |
| Chain organizations | Toolbar replaced by a left search and right filter around a centered exploitable-organization headline; Produce row action links to stage assets. |
| Organization detail | Reworked to be mode-aware end to end: recon keeps its six workspace counters, full recon mutations and map/graph overview; exploit and objectives render stage-scoped counters, breached assets or objectives, sessions or artifacts, stage findings and stage tasks. Recon-only interactions (confirm domains, ICP, edit, delete, export) never render in stage modes; stage modes expose only Play. All stage queries carry `organizationId`. |
| Outlines | Verified single 1px `--surface` hairline on every container; no alpha borders, no shadow outlines anywhere. |

## Known follow-ups

- The temporary compat color tokens in `styles.css` (`mint`, `dim`, `brand`)
  resolve to the three colors and can be retired once no class references
  remain.
- `docs/superpowers/specs/2026-11-03-palette-comparison-map.md` is a historical
  blueprint record and describes the neon theme; the cutting mat doc above is
  authoritative.
