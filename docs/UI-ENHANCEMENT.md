# UI Enhancement Guide

Single source of truth for the console restyle. Global principles apply to every
screen; each screen has its own section describing what was changed (or what to
change when we work on it). Update the per-screen section as each screen is
rebuilt, and keep new screens consistent with the global rules.

Design language: neon terminal. Black canvas, green phosphor accents, mono
labels, hard 4px radii, restrained motion. Do NOT modify the AppBackground
(gradient, grid, particles) — it is approved as final.

## Global Principles (apply to every screen)

1. **Centered presentation.** Stat content, card titles, empty states, page
   titles, and the sidebar are centered. Dense tabular data (table cells, log
   lines, key-value grids) stays left-aligned for scanability; headers and
   summary content center.
2. **No text-only buttons.** Every Button carries a lucide icon. One-word text
   is allowed next to the icon when the icon alone is ambiguous (Create, Save,
   Import). Pure actions that are visually identifiable are icon-only with a
   `title` tooltip and an `sr-only` label.
3. **Icon-first controls.** Toolbar actions: `size="icon"` (header zone uses
   `size-9`, in-page toolbars `size-8`). Row actions: `variant="outline"`
   `size-8` icon-only. Destructive row actions add
   `text-destructive hover:text-destructive`.
4. **Hover feedback everywhere.** Outline and ghost buttons glow on hover
   (`border-accent` + green shadow). Cards lift and glow on hover. Sidebar
   links highlight as centered pills. Transitions are 150-200ms; respect the
   global reduced-motion media query.
5. **Hierarchy: severity first.** The most important number leads. Green is the
   chrome accent; severity colors (critical/high/medium/low/info) carry
   meaning and are never used decoratively.
6. **Symmetry.** Toolbar zones split left/right around a centered page title.
   Card headers center their titles; counts and badges sit beside the title,
   centered as a group.
7. **Compact labels.** Filter/range controls use short tokens (24H, 7D, 30D,
   90D, ALL) that fit one line. Uppercase via CSS tracking, never by
   transforming user data such as usernames.
8. **Icon vocabulary.** Plus = create, Upload/FileUp = import, Download =
   export, Pencil = edit, Trash2 = delete, Play/Pause/Square = run/pause/stop,
   RotateCcw = retry, ArchiveRestore = restore, X = cancel/close/dismiss,
   RefreshCw = sync/refresh, Search = lookup/details, Eye = view, History =
   history, FileText = evidence, Globe = global view, Map/Network = map/graph
   views, CircleUserRound = account.
9. **Dialogs.** Footer: X icon-only cancel on the left, submit button with
   icon + one word on the right. ConfirmDialog: X icon cancel, Trash2 +
   existing confirm label on the destructive action.
10. **Sidebar.** Fully centered in both expanded and collapsed modes. Section
    titles and nav items center as pills; collapsed items become compact
    `size-9` pills with tooltips, distributed evenly across the full sidebar
    height (`justify-evenly`).

## Overview (implemented)

- Header (in AppShell): centered uppercase page title; refresh icon button
  with rotate/spin animation, size-matched (`size-8`) to Search and the range
  filter; range filter compact labels (24H/7D/30D/90D/ALL) in a `w-20 h-8`
  trigger; username rendered normal-case (exactly as saved); avatar is
  CircleUserRound.
- Vital-signs row: 5 StatTiles at the very top (no page heading above them).
  2x2 grid + full-width fifth on mobile, 5-across on desktop. Each tile:
  centered mono label, dominant tabular value, dim hint line, semantic icon
  accent (Building2, Globe, ShieldAlert, Workflow, Activity) that lights up
  green on hover, hover lift + green glow.
- Main band: Organizations at Risk as a narrow left rail
  (`clamp(220px,20vw,300px)`); Surface Map takes the dominant center. Org rows
  are centered (name + risk badge, counts below). Map is centered via ECharts
  `layoutCenter: ['50%','50%']`, `layoutSize: '115%'`, roamable.
- Map card controls: Map/Graph segmented toggle as icon buttons (Map, Network)
  with tooltips; health chips centered right; "Global" reset is a Globe
  icon-only button. Graph is intentionally disabled until an organization is
  selected; endpoint `/organizations/{id}/graph` verified.
- Bottom band: Recent Discoveries (or Selected Organization facts) and Risk
  Distribution side by side, 50/50 on `lg`, stacked below on mobile. Order on
  mobile: stats, orgs, map, discoveries, distribution.
- Footnote row and truncated-data notice remain below the bands.

## Login (to update when we rework this screen)

Centered auth card on the AppBackground. Sign In submit now carries a LogIn
icon. Planned: stronger brand mark, inline validation states, terminal-style
status line.

## Change Password (to update when we rework this screen)

Submit carries a KeyRound icon. Planned: password-strength meter in terminal
style, requirement checklist.

## Organizations (to update when we rework this screen)

Toolbar: Upload icon-only (Import CSV), Plus icon-only (New Organization).
Row actions: Pencil/Trash2 icon-only outline `size-8`. Empty state: FileUp +
Import. Dialog footers follow the global dialog rule. Planned: org cards with
risk sparkline, inline status.

## Organization Detail (partially updated)

Header actions: Play (Start Scan), Search with spin while pending (ICP
Lookup), Plus (Add Root Domain), Download (Export), Pencil (Edit), Trash2
(Delete) — all icon buttons. Domain rows: FileText (Evidence), Pencil, Trash2,
X (Remove candidate). History rows: History icon. All six dialogs follow the
global dialog rule. StatTiles here can adopt the same icon accents as
Overview in the next pass.

## Assets (partially updated)

View toggle: Globe (Exposure) / List (Raw Inventory) icon segmented control.
Toolbar: Plus icon-only (New Asset). Row and sheet actions: Pencil/Trash2
icon-only. Editor dialog follows the global dialog rule. Planned: asset type
glyphs in the table, severity-tinted hover.

## Risks / Findings (partially updated)

View toggle: ShieldAlert (Current Risks) / History / FileText (Raw Scans)
icon segmented control. Planned: severity histogram card, evidence drawer
restyle.

## Tasks (partially updated)

View toggle: Crosshair (Attack Surface) / List (All Tasks) icon segmented
control. Toolbar: Plus icon-only (New Task). Row actions: Search (Details),
Square (Stop). Dialog follows the global dialog rule. Planned: progress bars
with animated fill, per-kind task glyphs.

## Task Detail (partially updated)

Header actions: Download (Export), RefreshCw (Sync), Square (Stop),
RotateCcw (Retry) icon buttons. Planned: terminal-style live log stream,
timeline of task events.

## Monitors (partially updated)

Toolbar: Plus icon-only (New Monitor). Row actions: Pencil, Play (Run),
Pause/Play state toggle, Trash2 — icon-only outline `size-8`. Dialog follows
the global dialog rule.

## Schedules (partially updated)

Toolbar: Plus icon-only (New Schedule). Row actions: Pencil/Trash2 icon-only.
Dialog follows the global dialog rule.

## Scan Policies (partially updated)

Toolbar: Plus icon-only (New Policy). Row actions: Pencil/Trash2 icon-only.
Dialog follows the global dialog rule.

## Asset Groups / Scopes (partially updated)

Toolbar: Plus icon-only (New Asset Group). Row actions: Pencil/Trash2
icon-only. Dialog follows the global dialog rule.

## Fingerprints (partially updated)

Toolbar: Upload icon-only (Bulk Import), Plus icon-only (New Fingerprint).
Row actions: Pencil/Trash2 icon-only. Both dialogs follow the global dialog
rule.

## GitHub (partially updated)

Toolbar: Plus icon-only (New Monitor / New Search). Row actions:
Pencil/Trash2 icon-only. Dialog follows the global dialog rule. Planned: leak
result cards with severity emphasis.

## PoC Plugins (partially updated)

Toolbar: RefreshCw icon-only (Sync Metadata) with spin while pending.
Planned: plugin cards with kind glyphs.

## Users (partially updated)

Toolbar: Plus icon-only (New User). Row actions: Pencil/Trash2 icon-only.
Both dialogs follow the global dialog rule.

## API Keys (partially updated)

Toolbar: Plus icon-only (New Key). Row action: X icon-only (Revoke). Secret
dialog: Copy icon-only, KeyRound + Done. Create dialog follows the global
dialog rule.

## Audit Log (to update when we rework this screen)

No buttons today. Planned: actor/target two-column terminal view, filter
chips.

## Recycle Bin (partially updated)

Row action: ArchiveRestore icon-only outline `size-8`. Planned: type-grouped
view with restore-all.

## System (to update when we rework this screen)

Planned: health wallboard with per-service tiles mirroring Overview StatTiles.

## 404 / Not Found (updated)

ArrowLeft + "Overview" button, centered composition.
