# UI Enhancement Guide

Single source of truth for the console restyle. Global principles apply to every
screen; each screen has its own section describing what was changed (or what to
change when we work on it). Update the per-screen section as each screen is
rebuilt, and keep new screens consistent with the global rules.

Design language: neon terminal. Black canvas, green phosphor accents, mono
labels, hard 4px radii, restrained motion. Do NOT modify the AppBackground
(gradient, grid, particles) — it is approved as final.

## Global Principles (apply to every screen)

1. **Outline icons only.** Every icon is a lucide outline glyph. Never fill an
   icon body. The account mark is an outline `UserRound` inside a bordered
   circular chip, not a solid avatar.
2. **Icon-button color.** Outline, ghost, and secondary icon buttons are mint
   green by default and turn white on hover (implemented as a `compoundVariants`
   rule in `button.tsx`). Filled default buttons keep a black glyph on the
   duller green gradient. Destructive icon buttons stay red.
3. **Duller filled buttons.** The primary action gradient is the muted
   `--grad-button` (`#00c853 → #00963e`) with a reduced glow. Neon green remains
   for borders, accents, and severity chrome, not for large filled buttons.
4. **No text-only buttons, no underlined actions.** Every Button carries a
   lucide icon. One-word text is allowed next to the icon when the icon alone is
   ambiguous (Create, Save, Import). Pure actions are icon-only with a `title`
   tooltip and an `sr-only` label. Clickable text is not a pattern: rows are the
   click target (`DataTable.onRowClick`), and action cells stop propagation via
   `Column.stopRowClick`.
5. **Centered presentation.** Stat content, card titles, empty states, page
   titles, and the sidebar are centered. Dense tabular data (table cells, log
   lines, key-value grids) stays left-aligned for scanability; headers and
   summary content center.
6. **Hover feedback everywhere.** Outline and ghost buttons glow on hover
   (`border-accent` + green shadow) and their icon turns white. Cards lift and
   glow on hover. Sidebar links highlight with a background pop only — never an
   outline or ring. Transitions are 150-200ms; respect the global
   reduced-motion media query.
7. **Hierarchy: severity first.** The most important number leads. Green is the
   chrome accent; severity colors (critical/high/medium/low/info) carry
   meaning and are never used decoratively.
8. **Symmetry.** Toolbar zones split left/right around a centered page title.
   Card headers center their titles; counts and badges sit beside the title,
   centered as a group.
9. **Compact labels.** Filter/range controls use short tokens (24H, 7D, 30D,
   90D, ALL) that fit one line. Uppercase via CSS tracking, never by
   transforming user data such as usernames.
10. **Icon vocabulary.** Plus = create, Upload/FileUp = import, Download =
    export, Pencil = edit, Trash2 = delete, Play/Pause/Square = run/pause/stop,
    RotateCcw = retry, ArchiveRestore = restore, X = cancel/close/dismiss,
    RotateCw = single-direction refresh (one full spin per click), Search =
    lookup/details, Eye = view, History = history, FileText = evidence, Globe =
    global view, Map/Network = map/graph views, UserRound = account.
11. **Dialogs.** Footer: X icon-only cancel on the left, submit button with
    icon + one word on the right. ConfirmDialog: X icon cancel, Trash2 +
    existing confirm label on the destructive action. Dialog close X is mint
    with a white hover.
12. **Sidebar.** Uniform 36px hitboxes in both modes, no outline/ring. Collapsed:
    icon-only, centered in its square, distributed evenly across the full
    sidebar height (`justify-evenly`), tooltip on hover. Expanded: every pill is
    the same width (full content width minus symmetric padding), content is
    left-aligned inside that centered pill, and section labels share the same
    left padding as item text. Hover and active states are background fills
    only. The logo/name is a link home.
13. **Screen toolbar (`ScreenToolbar`).** No screen carries an in-page title —
    the header title is the only page title. Every list screen starts with the
    three-column toolbar from `components/common/screen-toolbar.tsx`:
    `[expanding outline Search icon button] [centered count/status note]
    [filter icon buttons + action icon buttons]`. Filters are icon-only
    outline `FilterDropdown` buttons that open a popup and close again when an
    option is chosen; the trigger never shows the selected value. Actions sit
    at the far right on the same line.

## Header & Global Search (implemented)

- Header grid stays `[left zone] [centered page title] [right cluster]`. The
  right cluster order is exactly `[refresh] [search] [range filter] [account]`.
- Refresh, Search, and the range filter are **ghost icon buttons — no border
  box**, matching the sidebar icon look: muted icon, mint hover glow
  (`hover:bg-[rgba(0,250,0,0.06)]`), white icon on hover.
- Refresh uses `RotateCw` — one circular arrow, one arrowhead. Each click runs
  `.refresh-spin` for exactly 1s, then `queryClient.invalidateQueries()`
  refreshes every active query on the current page.
- Search opens the command palette. The popup has no divider line under the
  input; it uses the same rounded border/card surface as the other dialogs,
  with a mint search glyph and a mint/white close X.
- Range filter is an **icon-only ghost `Filter` button** (no visible range
  text, no box). Clicking it opens a dropdown popup of 24H/7D/30D/90D/ALL
  tokens with a check mark on the active one; selecting a range applies it and
  closes the popup. Shown on Overview only.
- Account keeps the saved username exactly (normal-case) and uses an outline
  `UserRound` inside a bordered circular chip. The chip/icon turns white on
  hover.
- Global search covers organizations, domains, assets, findings, tasks,
  monitors, and schedules. Backend `SearchResult` and the OpenAPI schema carry
  `monitors`/`schedules`; the palette groups them with Activity/CalendarClock
  icons and routes to the corresponding pages.

## Overview (implemented)

- Vital-signs row: 5 StatTiles at the very top (no page heading above them).
  2x2 grid + full-width fifth on mobile, 5-across on desktop. Each tile:
  centered mono label, dominant tabular value, dim hint line, semantic icon
  accent (Building2, Globe, ShieldAlert, Workflow, Activity) that lights up
  green on hover, hover lift + green glow.
- Above-the-fold band: the stat row and the Organizations + Surface Map band are
  wrapped in a section with `xl:min-h-[calc(100dvh-7rem)]`; the band is
  `flex-1`, so the map reaches the bottom of the viewport with the same 24px
  gutter used above the stat tiles.
- Main band: Organizations at Risk as a narrow left rail
  (`clamp(220px,20vw,300px)`); Surface Map takes the dominant center. Org rows
  are centered (name + risk badge, counts below). Map is centered via ECharts
  `layoutCenter: ['50%','50%']`, `layoutSize: '115%'`, roamable.
- Map card controls: Map/Graph segmented toggle as icon buttons (Map, Network)
  with tooltips; health chips centered right; "Global" reset is a Globe
  icon-only button. Graph is intentionally disabled until an organization is
  selected; endpoint `/organizations/{id}/graph` verified.
- Below-the-fold band: Recent Discoveries (or Selected Organization facts) and
  Risk Distribution start after the viewport with `mt-4` spacing, so they are
  reached by scrolling and never crowd the map.
- Footnote row and truncated-data notice remain below the bands.

## Login (implemented)

- One uniform screen: no left/right split, divider, liquid-border animation, or
  separate panel background. A single centered column on the global
  AppBackground.
- Top block: clickable logo + T4C name (signed-in → `/`, signed-out → reload
  `/login`), the statement "Start from the organization and see every layer of
  external exposure." with the `hover-juggle` animation, and one short
  supporting line.
- Sign-in card: centered "Console Sign-In" eyebrow and "Enter The Attack Surface
  Workspace" heading; only the username/password fields and the Sign In button.
  Removed the initial-password sentence, the bottom warning sentence, the
  authorized-testing badge, and the left footer stats.
- Sign In uses the duller filled button gradient. Footer is exactly
  `© 2026 T4C · Funbinet`.

## Change Password (to update when we rework this screen)

Submit carries a KeyRound icon. Planned: password-strength meter in terminal
style, requirement checklist.

## Organizations (implemented)

- No in-page "Organizations" title; the header title is the only page title.
- Top toolbar is a three-column grid: outline Search icon button on the left,
  the organization count centered, Import CSV (outline Upload) and New
  Organization (filled Plus) on the right, all at the same `h-9` height.
- Search is an outline icon button that expands an outlined, transparent inline
  field of the same height, with autofocus and an X to collapse/clear it. The
  count stays centered in the toolbar while the field is open.
- The whole organization row is clickable and keyboard-activatable (Enter/Space)
  and opens the detail page. The organization name is plain text, not a link and
  not underlined. The action cell is marked `stopRowClick` so Edit/Delete do not
  navigate.
- Row actions: Pencil/Trash2 icon-only outline `size-8`. Empty state: FileUp +
  Import. Dialog footers follow the global dialog rule.
- Planned: org cards with risk sparkline, inline status.

## Organization Detail (implemented)

Header actions: Play (Start Scan) — **always clickable**; the scan dialog
lists confirmed root domains and, when none are confirmed, walks through
Add Domain → ICP Lookup → Confirm → Play instead of being a dead button.
Other actions: Search with spin while pending (ICP Lookup), Plus (Add Root
Domain), Download (Export), Pencil (Edit), Trash2 (Delete) — all icon
buttons. Domain rows: FileText (Evidence), Pencil, Trash2, X (Remove
candidate). History rows: History icon. All six dialogs follow the global
dialog rule.

Tab bar: **icon + text triggers, centered** as a group (`mx-auto w-full
max-w-4xl justify-center`, `min-w-32 px-5` triggers) — Overview
(LayoutDashboard), Root Domains (Globe), Assets (Crosshair), Risks
(ShieldAlert), Tasks (Workflow).

Overview tab is a full workspace, not just a risk list: Surface Summary
facts, Risk Breakdown, Recent Assets, Current Risks, and Scan History &
Tasks — with "View all" jumps to the matching tab. Assets/risks/tasks
queries are always enabled so the overview is populated on arrival.

## Assets (implemented)

Uses `ScreenToolbar`. Left: Globe/List exposure toggle + expanding Search
icon button. Center: asset count. Right: New Asset (Plus, inventory view
only) **before** the filter icon buttons — FilterDropdown for type and (in
exposure view) risk. Row and sheet actions: Pencil/Trash2 icon-only. Editor
dialog follows the global dialog rule.

## Risks / Findings (implemented)

Uses `ScreenToolbar`. Left: ShieldAlert/History/FileText view toggle +
expanding Search icon button. Right: severity and type `FilterDropdown`s.
Severity histogram card and evidence drawer restyle remain planned.

## Tasks (implemented)

Uses `ScreenToolbar`. Left: Crosshair/List origin toggle + expanding Search
icon button. Right: **New Task (Plus) first, then the status and type
FilterDropdowns**. Row actions: Search (Details), Square (Stop). Dialog
follows the global dialog rule.

## Task Detail (partially updated)

Header actions: Download (Export), RefreshCw (Sync), Square (Stop),
RotateCcw (Retry) icon buttons. Planned: terminal-style live log stream,
timeline of task events.

## Monitors (implemented)

Uses `ScreenToolbar`: expanding Search icon button (client-side filter over
name/target), centered count, New Monitor (Plus) on the right. Row actions:
Pencil, Play (Run), Pause/Play state toggle, Trash2 — icon-only outline
`size-8`. Dialog follows the global dialog rule.

## Schedules (implemented)

Uses `ScreenToolbar`: expanding Search icon button, centered count, New
Schedule (Plus) on the right. Row actions: Pencil/Trash2 icon-only. Dialog
follows the global dialog rule.

## Scan Policies (implemented)

Uses `ScreenToolbar`: expanding Search icon button (client-side filter),
centered count, New Policy (Plus) on the right. Row actions:
Pencil/Trash2 icon-only. Dialog follows the global dialog rule.

## Asset Groups / Scopes (implemented)

Uses `ScreenToolbar`: expanding Search icon button, centered count, New
Asset Group (Plus) on the right. Row actions: Pencil/Trash2 icon-only.
Dialog follows the global dialog rule.

## Fingerprints (implemented)

Uses `ScreenToolbar`: expanding Search icon button on the left; Bulk Import
(Upload, outline) and New Fingerprint (Plus) aligned right on the same
line. Row actions: Pencil/Trash2 icon-only. Both dialogs follow the global
dialog rule.

## GitHub (implemented)

No in-page title. The three selection tabs are **icons only** (Eye = Leak
Results, Search = Search Tasks, Activity = Monitors) in the toolbar's left
zone, on the same line as the New Monitor/New Search (Plus) button on the
right. Row actions: Pencil/Trash2 icon-only. Dialog follows the global
dialog rule.

## PoC Plugins (implemented)

Uses `ScreenToolbar`: expanding Search icon button on the left; on the
right, Sync Metadata (RefreshCw, outline, spin while pending) and the type
`FilterDropdown` aligned on one line. Planned: plugin cards with kind
glyphs.

## Users (implemented)

Uses `ScreenToolbar`: expanding Search icon button (client-side filter),
centered count, New User (Plus) on the right. Row actions:
Pencil/Trash2 icon-only. Both dialogs follow the global dialog rule.

## API Keys (implemented)

Uses `ScreenToolbar`: expanding Search icon button, centered count, New Key
(Plus) on the right. Row action: X icon-only (Revoke). Secret dialog: Copy
icon-only, KeyRound + Done. Create dialog follows the global dialog rule.

## Audit Log (implemented)

Uses `ScreenToolbar`: expanding Search icon button (server-side query) on
the left; **Sync Logs** (RefreshCw, outline, spin while fetching) on the
right, mirroring the Plugins Sync Metadata button. Planned: actor/target
two-column terminal view.

## Recycle Bin (implemented)

Uses `ScreenToolbar`: expanding Search icon button on the left, type
`FilterDropdown` icon button on the right. Row action: ArchiveRestore
icon-only outline `size-8`. Planned: type-grouped view with restore-all.

## System (title removed)

No in-page title; the screen content (Runtime, APIs & Monitoring, Scanner
SDKs cards) is unchanged.

## 404 / Not Found (updated)

ArrowLeft + "Overview" button, centered composition.
