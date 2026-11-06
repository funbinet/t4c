# T4C Console Design System: Cutting Mat

Single source of truth for the console look. The 2026-11 cutting mat overhaul
replaced the neon terminal theme everywhere. Every screen, primitive, and
visual must follow these rules.

## The three colors

| Token | Hex | Role |
|---|---|---|
| canvas | `#090A08` | The mat. Page background, selection text, text on ink fills. |
| ink | `#2D7B49` | Every glyph. Text, icons, chart drawings, data lines, focus ring, scroll thumb hover. |
| surface | `#0F2516` | Outlines, hairlines, panels, inputs, dialogs, popovers, hover fills, scroll thumb, chart containers. |

Two alpha blends of ink exist and nothing else:

- `--ink-muted` (62 percent ink) for secondary text and axis labels.
- `--ink-faint` (38 percent ink) for placeholders, disabled text, and the major
  background grid lines.

No other hue, tint, white, black, or gray is allowed anywhere, including chart
configs, toast styles, and favicon-adjacent chrome.

## Hard rules

1. **Radius zero.** No rounded corner on any element: cards, buttons, inputs,
   badges, dialogs, chips, scrollbars, chart bars. Only lucide outline glyphs
   keep their curves.
2. **No motion.** No CSS animations, transitions, keyframes, or transforms.
   A global guard in `styles.css` kills animation and transition for every
   element. ECharts options set `animation: false`.
3. **No elevation.** No box shadows, no blur, no backdrop filter, no glow.
4. **Nothing filled at rest.** Buttons are outlined squares with a transparent
   body. The only fills are containers (dialogs, inputs, popovers, the map
   plot), data drawings (bars, progress, pins, nodes), and the hover state.
5. **Hover law.** The only state change is an instant recolor: outline and
   ghost targets fill with `bg-accent` (surface), and text stays ink. There is
   no text color change on hover and no scale or lift.
6. **Icon-only actions.** Every button is a lucide glyph with a `title`,
   `aria-label`, and `sr-only` span. No text on buttons, not even single words.
   `Button` variants all render as outlined squares; ghost has a transparent
   border.
7. **Rows are the click target.** List rows open their detail view through
   `DataTable.onRowClick`. Action cells stop propagation with
   `Column.stopRowClick`.
8. **Severity is fill weight, not hue.** Critical and high draw solid ink,
   medium draws 62 percent ink, low draws 38 percent ink, info draws surface.
   This applies to badges (danger variant uses the ink border, everything else
   the hairline border), risk bars, graph nodes, and map pins.
9. **The mat is always behind everything.** `AppBackground` renders a fixed
   `.mat-grid` layer: 1px surface hairlines every 32px and 1px faint ink lines
   every 128px. `background-size` tiles infinitely, so the grid holds at any
   viewport dimension. Cards sit transparent on the mat; dialogs, inputs, and
   popovers are solid surface. The overlay for modals is canvas at 80 percent.
10. **Centered presentation, symmetric layout.** Stat tiles, card titles, empty
    states, page titles in the header, and the login screen are centered.
    Dense data (table cells, log lines, key value grids) stays left aligned.
    Toolbars split left and right around a centered middle note.

## Primitives contract

| Primitive | Rule |
|---|---|
| `Button` | Outlined square, transparent body, `border-ring` or `border-border` by variant, `hover:bg-accent`. Icon sizes: 9 for `icon`, 8 for small. |
| `Badge` | Outlined chip, transparent body. `danger` variant uses the ink border, all others the hairline. |
| `Card` | Hairline border, transparent body on the mat. |
| `Input` / `Textarea` / `SelectTrigger` | Solid surface body, hairline border, ink focus border, `text-dim` placeholder. |
| `Dialog` / `Sheet` / `Popover` / `Tooltip` / `DropdownMenu` / `SelectContent` | Solid surface body, hairline border, no shadow. |
| `Progress` | Surface track, ink fill, square ends. |
| `Tabs` | Hairline bordered list; the active tab fills with surface. |
| `Checkbox` | Surface body, hairline border, ink border when checked. |
| `Skeleton` | Surface blocks, no pulse. |
| Toaster | Solid surface, ink border, ink text, square corners. |
| Scrollbars | Square, canvas track, surface thumb, ink thumb on hover. |

## Background and logo

`components/layout/app-background.tsx` is one static div, no JavaScript. The
`t4c.png` logo stays: it is drawn with the theme colors on the login screen,
the sidebar, and the favicon.

## Charts

All ECharts instances (surface map, asset graph, risk distribution) use
`animation: false`. Chart text and axis lines draw in ink, muted ink, or faint
ink. Land areas and tooltips use surface with an ink border. Node and pin
severity follows the fill weight law above.

## Verification

`tsc --noEmit`, `vitest run`, and `vite build` must pass after any UI change.
Playwright non-visual suites cover navigation and interaction; visual snapshots
were regenerated after the overhaul. See `docs/UI-AUDIT.md` for the conformance
record.
