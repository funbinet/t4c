# UI-AUDIT — T4C Console Surface Map & Reconstruction Plan

Audit date: 2026-11-03 · Scope: `web/src` only (composition, copy, spacing, capitalization, symmetry; no API/behavior changes).
Baseline: React 19 + TS + Vite + Tailwind 4, neon-terminal palette (see `docs/superpowers/specs/2026-11-03-palette-comparison-map.md`).
Verdict: structurally sound, but the surface carries AI-generated styling tells — verbose explainer copy, icon-on-every-button, inconsistent capitalization, cramped controls, and weak alignment discipline.

---

## 0. Global standards (apply to every surface)

| Standard | Rule |
|---|---|
| Capitalization | **ALL CAPS** for every piece of static reading content: page titles, card titles, buttons, dialog titles, tab labels, table headers, nav labels, form labels, section labels, empty-state titles. Dynamic/generated outputs (server values, names, keys, targets, statuses, timestamps, error messages, toasts) render exactly as produced — never force-cased. Implemented via `text-transform: uppercase` at the component layer, not by editing strings. |
| Copy discipline | Delete every explainer description that narrates system internals ("…are the backbone of the T4C attack surface workspace"). Page = title. Dialog = title. Nothing else unless required. |
| Icons | Only where they carry meaning: nav items, search field, status dots, external-link affordance. No icons on text action buttons (Edit/Delete/Run/Stop/Refresh), no icon-only empty states, no decorative stat-tile icons. |
| Spacing | Toolbar rows `gap-3`; selects height-matched (`h-9`) with `min-w` instead of cramped fixed `w-32`; form fields `space-y-2`; dialogs `p-6`, footer `mt-6`; table cells `px-4 py-3`. |
| Alignment | One header pattern (PageHeader), one breadcrumb, one toolbar, one stat grid. Table Actions right-aligned; all else left-aligned. Data pages left-aligned; only full-screen forms (login, change-password, 404) centered. |
| Mobile | Filter toolbars scroll horizontally instead of wrapping into staircases; action groups collapse to a row; tables use the existing card fallback; nothing overflows (e2e already asserts this). |

---

## 1. App shell (sidebar + header)

**Sidebar** (`app-shell.tsx`): 236px, 4 groups / 16 items, lucide icon per item, mono-label group headers, collapse toggle.
Issues: active state is a tinted fill + inset bar (fine) but hover/active contrast is flat; collapse button carries text + icon; mobile drawer duplicates the whole header block; group spacing `mb-4` uneven vs `space-y-0.5` items.
**Header**: 64px glass bar; title + mono-label subtitle (always the same static text — filler); search trigger; user dropdown.
Issues: static subtitle is filler copy on every page; ⌘K badge is a bare bordered span (misaligned); avatar letter tile fine.

## 2. Overview (`/`)
Custom header (not PageHeader) with eyebrow + description + 3 actions (range select, Refresh, "Organization Workspace" link-button). 5 StatTiles with icons/hints; map/graph toggle; 3-pane xl grid; Recent Discoveries / Selected Organization card; Risk Distribution bars; footer chips; truncation notice.
Issues: header duplicates PageHeader role with extra eyebrow icon; Refresh + link button both iconified; stat hints are chatty ("Critical/High 3"); HealthChip ok/not-ok dots nearly identical greens; MiniFact labels sentence case vs StatTile mono; truncation notice narrates internals.

## 3. Organizations (`/organizations`)
PageHeader + 2 actions; search + Refresh + count; DataTable (7 cols); New/Edit/Import dialogs; CSV sample block.
Issues: title/desc/dialog copy verbose; icon on all three actions + row Edit/Delete; Refresh button redundant (queries auto-refetch); count text `11px` orphan right; edit and create dialogs are near-duplicates; dialog descriptions explain graph sync internals.

## 4. Organization Detail (`/organizations/:id`)
Breadcrumb; title + status + region/aliases/USCC line; 6 action buttons (Reverse-Lookup, Add Root Domain, Export, Edit, Delete, Start Scan); 6 StatTiles; 5 tabs; domains tab with checkbox select/confirm + 4 row actions; overview tab with Coverage bars + Risk Breakdown; assets/findings/tasks tabs; 6 dialogs.
Issues: worst offender — 6 wrap-prone buttons; "Reverse-Lookup Filed Domains" is jargon; Coverage bars render 0/1 →100% pseudo-progress (fake data viz); Risk Breakdown duplicates StatTile hints; raw org IDs shown as chips in assets sheet; full-width colons "：" mixed with ":"; helper `Coverage`/`AssetTab`/`FindingTab`/`TaskTab` page-local duplicates.

## 5. Assets (`/assets`)
PageHeader; Exposure/Raw Inventory toggle; search + 2 selects; DataTable; asset Sheet with 2 action buttons, Fact grid, 4 sections; New/Edit Asset dialog.
Issues: toggle labels inconsistent with concept names; sheet "Maintenance Info" section mixes label styles; "URL：" full-width colon; raw organization UUID chips; edit dialog description narrates scan-data guarantees; Fact/Section/KeyValues duplicated from findings-page.

## 6. Risks / Findings (`/findings`)
PageHeader; 3-view toggle; search + severity + kind selects; DataTable + pagination; Sheet with Fact grid, Linked Root Domains, History Timeline, Structured Observations.
Issues: header description narrates dedup logic; EmptyState action is a bare icon; severity select shows raw lowercase enum ("critical" vs "Critical"); sheet sections' label style differs from mono-label standard.

## 7. Tasks (`/tasks`)
PageHeader; origin toggle; search + status + kind selects; DataTable with inline Progress; Details/Stop actions; New Task dialog.
Issues: origin toggle labels chatty; description narrates task-origin semantics; Progress cell shows bar + percent text (redundant); enum values lowercase in selects; dialog description narrates where details appear.

## 8. Task Detail (`/tasks/:id`)
Breadcrumb; title + status + mono meta; 4 action buttons; progress card with 4 Facts; 7 tabs; events stream / steps / 3 observation tabs / 2 finding tabs.
Issues: tab labels mixed case ("IP", "WIH", "Findings"); Live Events tab titles like "Live Events" vs plain "Events"; empty states narrate SSE behavior; steps show "1. domain_brute" raw enum; 4 outline buttons equal weight (Stop should be separated/danger).

## 9. Monitors (`/automation/monitors`)
PageHeader; DataTable; New/Edit dialog with Type/Interval/Target/Asset group/Policy selects.
Issues: sentence-case title; 4 row actions (Edit/Run/Pause/Resume/Delete) each iconified — dominant clutter; dialog description narrates recalculation.

## 10. Schedules (`/automation/schedules`)
Same pattern as monitors; Cron and Start-time conditional fields.
Issues: sentence-case title; iconified row actions; dialog descriptions narrate recalculation; "Schedule type"/"Task type" labels near-identical.

## 11. Scan Policies (`/automation/policies`)
PageHeader; DataTable; New/Edit dialog with 7 checkbox options in a 2-col grid.
Issues: sentence-case title; checkbox labels are raw camelCase keys (`domainBrute`, `portScan`); description column often empty; dialog descriptions narrate defaults.

## 12. Asset Groups (`/automation/groups`)
PageHeader; DataTable (Name/Type/Targets/Created); New/Edit dialog.
Issues: sentence-case title; description filler ("Keep the existing workflow of…"); raw target list truncation; iconified row actions.

## 13. GitHub (`/intelligence/github`)
Tabs Leak Results/Search Tasks/Monitors; 3 DataTables; New Search/Monitor dialog.
Issues: "Leak Results" tab label; button label mutates by tab ("New Monitor"/"New Search"); dialog description narrates token config; iconified row actions.

## 14. Fingerprints (`/intelligence/fingerprints`)
PageHeader; search; DataTable; Add/Edit dialog; Bulk import dialog.
Issues: sentence-case buttons ("Add fingerprint", "Bulk import"); descriptions narrate WIH validation; import textarea unstyled height drift.

## 15. PoC Plugins (`/intelligence/poc`)
PageHeader + Sync; search + type select; DataTable.
Issues: sentence-case title/button; type badges map brute→danger (red misuse — not an error); "Vulnerability / capability" header slash.

## 16. Users (`/admin/users`)
PageHeader; DataTable; New/Edit dialogs.
Issues: sentence-case title; native `<input type=checkbox>` in edit dialog (inconsistent with Checkbox component); "Must change password" column header verbose; edit dialog description narrates password policy.

## 17. API Key (`/admin/api-keys`)
PageHeader; DataTable; New key dialog; secret reveal dialog with Copy.
Issues: "I've saved it" apostrophe button; scopes free-text comma field (misaligned with Badge display); description narrates one-time display.

## 18. Audit Log (`/admin/audit`)
PageHeader; search; DataTable; pagination.
Issues: sentence-case title; long narrating description; otherwise clean.

## 19. Recycle Bin (`/admin/recycle-bin`)
PageHeader; search + type select; DataTable + Restore.
Issues: sentence-case title; description narrates RBAC ("Restoring is restricted to administrators" — RBAC is enforced server-side); Restore button iconified.

## 20. System (`/admin/system`)
Runtime card, links card, scanner versions grid.
Issues: "APIs and monitoring" card title lowercase; hardcoded link rows; scanner grid card borders double (card-in-card).

## 21. Login (`/login`)
Hero (3 layers + liquid border + glow) + glass form card.
Issues: headline gradient highlight good; eyebrow pill lowercase sentence; stats row border-t alignment fine; otherwise compliant with back.md.

## 22. Change Password (`/change-password`)
Centered card, icon tile, 3 fields.
Issues: decorative KeyRound icon tile; conditional description narrates session invalidation; button lowercase.

## 23. Not Found (`*`)
Gradient "404", title, narrating description, button.
Issues: description mentions retired legacy paths (internal history, not user content).

## 24. Shared components
- `PageHeader` — description prop invites narration; will become optional-short.
- `DataTable` — solid; cell padding `px-3 py-3` tight; mobile cards ok.
- `EmptyState` — `action` slot abused for decorative icons on 8 pages.
- `Select` — trigger `h-9` good; item padding uneven; toolbar widths cramped.
- `states.tsx` Loading/Empty/Error — fine after icon removal.
- Pagination — fine.
- `stat-tile` — icon slot to be dropped.
- Duplicated page-local helpers: `Field` ×9 pages, `Fact` ×3, `Section` ×2, `KeyValues` ×2 → consolidate into `components/common/`.

---

## 25. Phases & tasks

### Phase A — Foundations (shared, cascades everywhere)
- A1 Consolidate `Field`, `Fact`, `Section`, `KeyValues` into `components/common/form.tsx` (Field `space-y-2`).
- A2 PageHeader: drop filler descriptions; optional single short line; title Title Case enforced.
- A3 EmptyState: remove icon-as-action misuse (all 8 pages).
- A4 DataTable: `px-4 py-3` cells, header `mono-label` kept, Actions right-aligned.
- A5 Select/toolbar standard: `h-9`, `min-w-36`, `gap-3`; enum options Title Cased via label maps.
- A6 Buttons: strip icons from text action buttons globally; danger styling only on destructive.
- A7 Dialog standard: `p-6`, title-only headers (delete narration), footer `mt-6`.

### Phase B — Shell
- B1 Sidebar: even group spacing, refined active/hover states, collapse button icon-only with tooltip.
- B2 Header: remove static subtitle; align search trigger and ⌘K badge; user menu spacing.
- B3 Breadcrumb component; use on both detail pages.

### Phase C — Overview
- C1 Rebuild header via PageHeader; actions: range select + icon-only Refresh.
- C2 StatTiles: drop icons, tighten hints (title-cased, numeric).
- C3 HealthChip: clear ok/degraded distinction; label Title Case.
- C4 Unify MiniFact with Fact; Risk Distribution bars with mono labels.

### Phase D — List pages (one consistent pattern)
- D1 Organizations; D2 Monitors; D3 Schedules; D4 Policies (humanized capability labels); D5 Asset Groups; D6 Fingerprints; D7 PoC (fix badge misuse); D8 GitHub; D9 Users (Checkbox component); D10 API Keys; D11 Audit; D12 Recycle Bin; D13 System.
Per page: Title Case, strip narration, toolbar standard, row-action decluttering, dialog cleanup.

### Phase E — Detail surfaces
- E1 Organization Detail: action row → toolbar with primary/secondary split, shorten labels; remove Coverage fake-viz; unify Fact grid; drop raw UUID chips.
- E2 Task Detail: tab labels standardized; steps formatted; Stop button danger.
- E3 Assets sheet + E4 Findings sheet: section label standard, drop UUID chips, fix colons.

### Phase F — Auth & edge pages
- F1 Login polish (eyebrow casing); F2 Change Password (remove icon tile, Title Case); F3 404 (remove legacy narration).

### Phase G — Verification
- G1 `npm run typecheck` + `npm test` + `npm run build` + eslint/prettier.
- G2 e2e suite (`npm run test:e2e`) + visual snapshot regeneration note.
- G3 Update README/PROJECT-OVERVIEW/PARITY references (done alongside).

## 26. Rules of engagement
- Skin/composition only: no API calls, routes, permissions, data contracts, or test semantics changed beyond selectors that target deleted copy.
- English UI copy stays English; fix casing/length, not language.
- Every change keeps axe-clean focus order and contrast.
