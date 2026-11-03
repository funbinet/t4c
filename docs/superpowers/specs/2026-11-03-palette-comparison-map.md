# Blueprint Comparison Map — pellete.md + back.md → T4C Console

Audit date: 2026-11-03. Scope: `web/src` only. Blueprint files: `pellete.md` (palette), `back.md` (login hero background).
Current state summary: light corporate blue theme (`#f6f7f9` page, `#214e8a` primary, `#172033` ink, blue-tinted `data-grid`, blue sidebar `#0f1c2e`). None of the dark terminal skin, film grain, glass, liquid borders, glow-follow, particle field, mono labels, scroll progress, or light breather bands exists.

## Surface rows (reconstructed surface map from §2–§5 + back.md; pellete.md has no literal §8 table)

| Surface | Current state | Blueprint target | Gap | Files to change |
|---|---|---|---|---|
| Design tokens (`:root`) | `#f6f7f9/#172033/#214e8a/#e1e5eb`, radius 0.5rem, risk colors red/orange/amber/blue | §2 core palette exact hex; radius 4px register law; green risk scale | Full rewrite | `web/src/styles.css` |
| Page background | `#f6f7f9` flat | `#000000` + film grain overlay (`body::after`, feTurbulence, 0.035, overlay) | Grain missing | `styles.css` |
| Global text / selection | ink `#172033`, selection `#cfe0f7` | ink `#eaffea`, muted `#66cc66`, dim `#3d8c3d`; selection neon `#00fa00` on black text | Colors | `styles.css` |
| Focus ring | `outline 2px #214e8a` | focus ring `#39ff14` (accent-bright) | Color | `styles.css` |
| Hairlines / borders | `#e1e5eb` neutral | `rgba(0,250,0,0.12)` green-tinted | Token | `styles.css` |
| Buttons | `bg-primary #214e8a`, hover `#193f73`, rounded-md | Neon fill `linear-gradient(170deg,#00fa00 0%,#00cc00 100%)`, text `#000000`, hover `#00cc00`, radius 4px; ghost/outline on surface-2 | Gradient fill | `ui/button.tsx` |
| Cards | `bg #fff`, blue hairline, flat shadow | Doc panels `#050505`/`#0a0a0a` + green hairline + glass treatment option | Material | `ui/card.tsx`, `styles.css` |
| Inputs / select / textarea / checkbox | `bg-card #fff`, blue border | Inputs `#111111` (surface-2), green hairline, focus `#39ff14`; checkbox fill `#00fa00` + black check | Colors | `ui/input.tsx`, `ui/select.tsx`, `ui/textarea.tsx`, `ui/checkbox.tsx` |
| Badges | red/orange/amber/blue pastels | Green-family tints + error red for danger only; mono-style | Hue law | `ui/badge.tsx` |
| Progress | `bg-muted`, primary fill | Track `#111111`, fill `#00fa00`; scroll progress bar missing | Add scroll bar | `ui/progress.tsx`, new `ScrollProgress` |
| Dialog / sheet / tooltip / dropdown | white surfaces, slate overlays | `#0a0a0a` surfaces, green hairlines, black overlay, tooltip `#111111` + ink text | Colors | `ui/dialog.tsx`, `ui/sheet.tsx`, `ui/tooltip.tsx`, `ui/dropdown-menu.tsx` |
| Tabs / command palette / skeleton | muted/blue tints | surface-2 tracks, neon selected state, `#111111` skeleton shimmer | Colors | `ui/tabs.tsx`, `ui/command.tsx`, `ui/skeleton.tsx` |
| Sidebar (app shell) | `#0f1c2e` navy, blue active inset shadow | `#000000`/paper with green hairline, active = neon tint fill + neon inset bar, mono group labels | Colors + mono labels | `layout/app-shell.tsx` |
| Header bar | `bg-white/95` | `rgba(0,0,0,0.8)` glass blur + green hairline | Material | `layout/app-shell.tsx` |
| Login hero (back.md) | flat `#10233c` + blue `data-grid` | 3 layers: `--grad-hero` + green `data-grid` (40%) + `<ParticleField>`; `.liquid-border` + `.glow-fx` on section | Layers 1/3, liquid border, glow missing | `pages/login-page.tsx`, new `visuals/particle-field.tsx`, new `common/glow.tsx`, `styles.css` |
| Login form side | `#f4f6f9` light | Black bg, glass card, neon button, error red for form errors only | Colors | `pages/login-page.tsx` |
| World map (ECharts) | light `#f2f5f9` land, white tooltip, blue grid | Dark land `#003d00/#001a00`, neon points, dark tooltip, `.data-grid` green, glass legend | Colors | `visuals/surface-map.tsx` |
| Asset graph (ECharts) | slate lines/labels | Green edges/labels, green-family nodes | Colors | `visuals/asset-graph.tsx` |
| Risk severity colors | red/orange/amber/blue/gray | Green intensity scale; critical = error red (only red allowed) | Hue law | `styles.css`, `visuals/*.tsx` |
| States (loading/empty/error) | red-tinted error box | Error box = error red tints (errors allowed); neutral glass for loading/empty | Colors | `common/states.tsx` |
| Data table | `#fafbfc` header/hover | `#0a0a0a` sticky header, hover `#111111`, mono uppercase header | Colors + mono | `common/data-table.tsx` |
| Mono labels | `.mono` exists, unused | `.mono-label` utility: `#3d8c3d`, uppercase, tracking, mono — used for eyebrows/section labels | Add | `styles.css` + usages |
| Scroll progress bar | missing | Fixed 2px top bar, neon gradient `#00fa00→#39ff14` | Add | new `common/scroll-progress.tsx`, `app-shell.tsx` |
| Reveal-on-scroll | missing | `.reveal` / `.reveal-in` classes, IntersectionObserver hook, reduced-motion safe | Add | `styles.css`, new `common/reveal.tsx` |
| Light breather bands | missing (no marketing sections) | `--grad-light` band class + light tokens for future sections; not-forced into console pages | Add tokens/class only | `styles.css` |
| Gradient text | missing | `.text-gradient` using `--grad-access` (`#00fa00→#39ff14→#ffffff`); login headline highlight word | Add | `styles.css`, `login-page.tsx` |
| Toasts (sonner) | default light | Dark glass toast theme | Colors | `app/providers.tsx` |
| Cursor-follow glow | missing | `useGlowFollow` hook + `.glow-fx` (login hero) | Add | new `common/glow.tsx`, `styles.css` |
| Film grain | missing | `body::after` SVG noise over everything | Add | `styles.css` |

## Missing-from-project checklist (blueprint features with no equivalent — all to be added)

1. Film grain overlay — add `body::after`.
2. Glass material (`.glass`, `--grad-glass`) — add; apply to header, toasts, login card, map legend.
3. Liquid borders (`.liquid-border` conic ring) — add; apply to login hero.
4. Cursor-follow glow (`.glow-fx` + `useGlowFollow`) — add; login hero.
5. `<ParticleField>` — add new component; login hero layer 3.
6. Mono labels (`.mono-label`) — add; nav groups, table headers, stat tiles, hero stats.
7. Scroll progress bar — add; app shell.
8. Reveal-on-scroll — add generic `.reveal` utility + hook; apply to overview stat tiles / page headers.
9. Light breather band tokens + `.light-band` — add tokens/classes for completeness; no console surface forces a light band (blueprint: those are for testimonials/FAQ/CTA marketing sections which don't exist here). Neon never on light — login/form pages go fully dark instead.
10. Gradient text (`.text-gradient`) — add; login headline.
11. Scrollbar styling — green-tinted scrollbar.

## Deliberate interpretations

- `pellete.md` §4 line 51 references gold/orange stops in `.text-gradient`; that contradicts §5 rule 1 (one green hue) and the exact `--grad-access` definition above it. Implementing `--grad-access` (green family) only.
- Risk severity must remain distinguishable but hue law forbids orange/amber/blue: critical/high/medium/low/info → error red / `#00fa00` / `#00cc00` / `#66cc66` / `#3d8c3d`.
- Register law: console is a document/data surface → 4px radii globally; pills kept only for the login eyebrow chip.
- Visual e2e snapshots will differ after reskin; regenerate via `npm run test:visual` (noted in Phase 6).
