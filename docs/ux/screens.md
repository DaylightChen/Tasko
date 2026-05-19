---
title: Tasko — Screens (ASCII Wireframes)
date: 2026-05-18
phase: ux
scope: project
status: draft
---

# Tasko — Screens (ASCII Wireframes)

Every v1 surface, both desktop and mobile variants. Wireframes are deliberately ASCII so they translate to the HTML preview unambiguously. Each screen lists the **tokens applied**, the **keyboard shortcuts active**, and the **interactions** for that surface. The component catalog (`component-inventory.md`) is referenced by section number.

Reading the wireframes:
- `|` and `-` and `+` are container/cell borders.
- `[ ... ]` are interactive controls.
- `( N )` are count badges.
- `· O ·` represents a 20px Lucide icon (the letter is mnemonic; see legend per screen).
- `*` and `.` are texture-only markers used to indicate sub-elements (the actual UI has nothing there — they help the eye in ASCII).
- Spaces matter for column alignment.

---

## Global layout — desktop

```
+----------------------------+-------------------------------------------------------------+
|  SIDEBAR (240px)           |  MAIN CONTENT (flex, min 720px)                             |
|                            |                                                             |
|  [Tasko logo wordmark]     |  View title + view chrome (sort, filter, view toggle)       |
|                            |                                                             |
|  · Sun · Today      (5) ·3 |  ────────────────────────────────────────────────────────── |
|  · Sunrise · Tomorrow (3)  |  Quick-add input                                            |
|  · Cal · Next 7 Days (12)  |                                                             |
|  · Inbox · Inbox     (8)   |  ────────────────────────────────────────────────────────── |
|  · List · All       (47)   |  Scrollable list / grid / calendar / kanban                 |
|                            |                                                             |
|  ── PROJECTS ──        +   |                                                             |
|  · Inbox-row  (8)          |                                                             |
|  · ▾ Personal              |                                                             |
|    · Errands       (3)     |                                                             |
|    · Reading list  (12)    |                                                             |
|  · ▾ Work                  |                                                             |
|    · Q3 Launch     (24)    |                                                             |
|    · Side project  (6)     |                                                             |
|  · 2026 goals      (4)     |                                                             |
|                            |                                                             |
|  ── TAGS ──                |                                                             |
|  · # urgent        (6)     |                                                             |
|  · # waiting       (3)     |                                                             |
|  · # call          (2)     |                                                             |
|                            |                                                             |
|  ── ──                     |                                                             |
|  · Cal · Calendar          |                                                             |
|  · Check · Completed       |                                                             |
|  · Trash · Trash    (5)    |                                                             |
|  · Cog · Settings          |                                                             |
|                            |                                                             |
|  [Sync state row]          |                                                             |
|  · CloudCheck · Synced 1m  |                                                             |
+----------------------------+-------------------------------------------------------------+
```

**Tokens**: sidebar bg=`canvas-subtle` (light) / `canvas-subtle` dark; main bg=`canvas`. Sidebar items use Sidebar nav (§18). Sync indicator at bottom uses §42.

**Keyboard shortcuts active globally**:
- `⌘K` opens command palette
- `⌘\` toggles sidebar collapsed/expanded
- `T` → Today, `I` → Inbox, `N` → New task quick-add (focuses input), `?` → shortcut help overlay
- `/` focuses the quick-add input (alternative to `N` in case `N` triggers other things)
- `g` then `T` / `I` / `C` (calendar) / etc. — secondary single-key navigation (post-v1; v1 ships single-letter only)

**Interactions**:
- Sidebar nav items click → navigate. Drop targets accept Tasks/Items (re-parent) and Projects (reorder/move-to-folder).
- Folder ⋯ menu (on hover): Rename, Delete, New project.
- Project ⋯ menu (on hover): Rename, Delete, Move to folder, Toggle hierarchical.
- Quick-add `+` button at right of "PROJECTS" header → open New Project modal.

---

## Global layout — mobile

```
+-------------------------------------------------------+
|  TOP BAR (56px)                                       |
|  · Menu · [View title]                · Filter · ⋯    |
+-------------------------------------------------------+
|                                                       |
|  Quick-add inline input (top of view)                 |
|  ────────────────────────────────────                 |
|                                                       |
|  Scrollable content                                   |
|                                                       |
|                                                       |
|                                                       |
|                                                       |
|                                                       |
+-------------------------------------------------------+
|  BOTTOM NAV (56px + safe-area)                        |
|  · Sun · · Cal · · ⊕ · · Inbox · · ⋯ ·                |
|  Today   Cal    Add     Inbox   More                  |
+-------------------------------------------------------+
```

**Tokens**: top bar bg=`surface`; bottom nav `surface` + `elevation-1`. Menu icon opens the sidebar as an overlay sheet.

**Keyboard shortcuts**: largely n/a on mobile but Bluetooth keyboard users get the same shortcuts as desktop.

**Interactions**:
- Tap "Menu" → slide-in sidebar from left (overlay sheet, half-width).
- Tap "⊕" in bottom nav → opens task creation sheet.
- Tap "More" → bottom sheet with secondary nav (Next 7 Days, All, Completed, Trash, Tags, Settings).

---

## Screen: Today view (desktop, populated)

```
+-----------------------------------------------------------------------------+
|  Today                                       [Sort: Due ▾] [+ Filter]  ⌘K  |
+-----------------------------------------------------------------------------+
|  + Add task to Inbox by default…                                            |
+-----------------------------------------------------------------------------+
|                                                                             |
|  ▾ Overdue (3)                              [Move all overdue to today]     |
|  ──────────────────────────────────────────────────────────────────────     |
|  ● ○  Pay electric bill                                  May 14 (4d)  ⋯  →  |
|  ● ○  Send invoice to client                             May 16 (2d)  ⋯  →  |
|  ● ○  Reschedule dentist                                 May 17 (1d)  ⋯  →  |
|                                                                             |
|  Today  ───────  Wed, May 18                                                |
|                                                                             |
|  ● ○  Buy laptop charger                                              ⋯  →  |
|  ● ○  Write conf talk            Day 1 of 5                           ⋯  →  |
|  ● ○  Reply to Alice            #waiting   09:00                      ⋯  →  |
|  ● ○  Pricing call with Finance #urgent    11:30                      ⋯  →  |
|  ● ○  Take dog to vet           #call      14:00                      ⋯  →  |
|                                                                             |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Legend**:
- `●` = priority dot (size + color per priority; rendered as `priority-medium` 8px for most rows above)
- `○` = checkbox (Lucide `circle`, 20px)
- `⋯` = hover-only icon button (§2)
- `→` = "Open" chevron-right, hover-only

**Tokens**:
- Overdue strip header text uses `text-h3`; "Move all overdue to today" is a Ghost button (§1 Ghost).
- Overdue rows: 3px `overdue` left-edge bar; date chip text=`text-overdue`. NOT a heavy red row tint (calm-not-cold).
- Today section header is `text-h2` + a `text-small` `text-subtle` date stamp.
- Multi-day chip "Day 1 of 5" gets the `accent-subtle` treatment (start day per §32).
- Tag chips use `tag-bg` + `tag-text`.

**Keyboard shortcuts active on this view**:
- `J` / `K` (or Down/Up arrows) navigate rows.
- `Space` toggles checkbox on focused row.
- `O` or `Enter` opens modal for focused row.
- `N` focuses quick-add input.
- `1`/`2`/`3`/`4` set priority on focused row.
- `T` schedules focused row to Today (no-op if already today; otherwise reschedules).
- `Tab` moves focus into the chrome row (Sort, Filter); `Shift+Tab` back.
- `⌘⇧M` opens Move-to picker on focused row.
- `⌘A` selects all rows in current view (multi-select).
- `Esc` clears multi-selection.
- `Backspace` (when row(s) focused with no input active) → confirm-prompt to soft-delete.

**Interactions** (in priority order):
- Single-click on row title = inline edit title.
- Single-click on date chip = open date popover.
- Single-click on priority dot = open priority menu.
- Single-click on tag chip = navigate to per-tag view.
- Single-click on subtask count chip = open Task modal (focused on subtask section).
- Single-click on "Day N of M" chip = (no-op, it's display-only).
- Single-click on checkbox = complete (per §11 sequence — 200ms strike, 300ms fade-collapse, snackbar "Task completed. Undo." for ~5s).
- Single-click anywhere else on the row = open Task modal.
- Right-click on row = context menu (Open, Edit tags, Move to project…, Duplicate (post-v1 — disabled), Delete).
- Hover row → reveals ⋯ and Open chevron.
- Drag a row → reorder within Today (changes `sort_order`). Cannot cross sections (overdue ↔ today) via drag — that would require changing date.
- Click "Move all overdue to today" → opens Confirmation prompt (§37) "Move 3 overdue items to today?".

---

## Screen: Today view (desktop, empty — non-first-run)

```
+-----------------------------------------------------------------------------+
|  Today                                       [Sort: Due ▾] [+ Filter]       |
+-----------------------------------------------------------------------------+
|  + Add task                                                                 |
+-----------------------------------------------------------------------------+
|                                                                             |
|                                                                             |
|                                                                             |
|                                                                             |
|                       (Lucide sun icon, 48px, text-subtle)                  |
|                                                                             |
|                         Nothing due today.                                  |
|                                                                             |
|                  You're caught up. Enjoy the day.                           |
|                                                                             |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Tokens**: Empty state (§35). Icon=`text-subtle`, headline=`text-h2`, subline=`text-body` `text-subtle`. The sub-line "You're caught up. Enjoy the day." is one of the **warm flourishes** — marked in microcopy doc.

---

## Screen: Today view (desktop, first-run / brand-new install)

```
+-----------------------------------------------------------------------------+
|  Today                                                                      |
+-----------------------------------------------------------------------------+
|  + Add task              ←  start here                                      |
+-----------------------------------------------------------------------------+
|                                                                             |
|                                                                             |
|                                                                             |
|                       (Lucide sunrise icon, 48px)                           |
|                                                                             |
|                       Welcome to Tasko.                                     |
|                                                                             |
|         Add your first task above — type it and press Enter.                |
|                                                                             |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Tokens**: Empty state §35.1 first-run variant. Headline "Welcome to Tasko." is the **second warm flourish** — see microcopy doc.

**The pointer**: a small Lucide `arrow-up` or `arrow-up-left` glyph + the text "start here" alongside the quick-add input, only on first-run (i.e., zero tasks ever created and no projects beyond Inbox).

**Interactions**: as in populated Today, but no rows to interact with. Quick-add input is auto-focused on first paint (so the user can just type).

---

## Screen: Today view (mobile)

```
+-------------------------------------------------+
|  · Menu · Today              ·  Filter  · ⋯ ·   |
+-------------------------------------------------+
|  + Add task                                     |
+-------------------------------------------------+
|                                                 |
|  Overdue (3)         [Move all to today]        |
|  ─────────────────                              |
|  ● ○ Pay electric bill          May 14 (4d)     |
|  ● ○ Send invoice               May 16 (2d)     |
|  ● ○ Reschedule dentist         May 17 (1d)     |
|                                                 |
|  Today, Wed May 18                              |
|  ─────────────────                              |
|  ● ○ Buy laptop charger                         |
|  ● ○ Write conf talk    Day 1 of 5              |
|  ● ○ Reply to Alice     #wait  09:00            |
|  ● ○ Pricing call       #urgent 11:30           |
|  ● ○ Take dog to vet    #call   14:00           |
|                                                 |
|                                                 |
+-------------------------------------------------+
|  · Sun · · Cal · · ⊕ · · Inbox · · ⋯ ·          |
|  Today   Cal    Add     Inbox    More           |
+-------------------------------------------------+
```

**Mobile-only interactions**:
- **Right-swipe** any row → strike-through + completion (§40).
- **Left-swipe** any row → reveals Schedule + Delete drawer (§40).
- **Long-press** row (300ms+) → multi-select mode (rows show selection checkboxes; toolbar appears at top).
- **Tap row** → opens Task modal as a Sheet (§15).
- "Move all to today" → Confirmation Sheet.

---

## Screen: Tomorrow view (desktop)

```
+-----------------------------------------------------------------------------+
|  Tomorrow                                    [Sort: Due ▾] [+ Filter]       |
+-----------------------------------------------------------------------------+
|  + Add task                                                                 |
+-----------------------------------------------------------------------------+
|                                                                             |
|  Thu, May 19                                                                |
|  ──────────────────────────                                                 |
|  ● ○  Send draft to editor                                            ⋯  →  |
|  ● ○  Write conf talk            Day 2 of 5                           ⋯  →  |
|  ● ○  1:1 with manager           #call  10:00                         ⋯  →  |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Differences from Today**:
- No overdue strip (overdue always lives in Today, never Tomorrow).
- No multi-day "start day" emphasis — middle-of-span chip ("Day 2 of 5") gets the neutral treatment.

**Empty state**: "Nothing scheduled for tomorrow." `text-h2`. Subline: "Plan ahead — add a task." (terse, no flourish.)

---

## Screen: Next 7 Days view (desktop)

```
+-----------------------------------------------------------------------------+
|  Next 7 Days                                  [Sort: Due ▾] [+ Filter]      |
+-----------------------------------------------------------------------------+
|  + Add task                                                                 |
+-----------------------------------------------------------------------------+
|                                                                             |
|  Today, Wed May 18  (5)                                                     |
|  ──────────────────────────                                                 |
|  ● ○ Buy laptop charger                                               ⋯  →  |
|  ● ○ Write conf talk             Day 1 of 5                           ⋯  →  |
|  ● ○ Reply to Alice              #waiting   09:00                     ⋯  →  |
|  ● ○ Pricing call                #urgent    11:30                     ⋯  →  |
|  ● ○ Take dog to vet             #call      14:00                     ⋯  →  |
|                                                                             |
|  Tomorrow, Thu May 19  (3)                                                  |
|  ──────────────────────────                                                 |
|  ● ○ Send draft to editor                                             ⋯  →  |
|  ● ○ Write conf talk             Day 2 of 5                           ⋯  →  |
|  ● ○ 1:1 with manager            #call   10:00                        ⋯  →  |
|                                                                             |
|  Fri, May 20  (2)                                                           |
|  ──────────────────────────                                                 |
|  ● ○ Write conf talk             Day 3 of 5                           ⋯  →  |
|  ● ○ Submit expenses                                                  ⋯  →  |
|                                                                             |
|  Sat, May 21  (1) ─────                                                     |
|  ● ○ Write conf talk             Day 4 of 5                           ⋯  →  |
|                                                                             |
|  Sun, May 22 ─ empty                                                        |
|                                                                             |
|  Mon, May 23 ─ empty                                                        |
|                                                                             |
|  Tue, May 24 ─ empty                                                        |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Day-group headers**: `text-h2`, with count badge `(N)` on populated days. Empty days collapse to a single faint row "<Day, date> ─ empty" in `text-subtle`.

**Interactions**: same as Today rows. Reordering only works within a day group.

---

## Screen: Inbox view (desktop — weekly triage emphasis)

```
+-----------------------------------------------------------------------------+
|  Inbox                                       [Sort: Created ▾] [+ Filter]   |
+-----------------------------------------------------------------------------+
|  + Add task                                                                 |
+-----------------------------------------------------------------------------+
|                                                                             |
|  · 8 items waiting to be filed                                              |
|                                                                             |
|  ● ○  Investigate that podcast Alice mentioned                  May 22 ⋯ →  |
|  ● ○  Look into pottery class                                   May 28 ⋯ →  |
|  ● ○  Read the McKinsey paper                                   May 30 ⋯ →  |
|  ● ○  Find a new pair of running shoes              #urgent     Jun 1  ⋯ →  |
|  ● ○  Renew passport                                            Jul 14 ⋯ →  |
|  ● ○  Replace bike chain                                        Jun 5  ⋯ →  |
|  ● ○  Schedule a haircut                                        May 24 ⋯ →  |
|  ● ○  Look up income tax thing                                  Jun 30 ⋯ →  |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**The "8 items waiting to be filed" subline**: appears at the top, in `text-small` `text-subtle`. It's a soft prompt to triage. No CTA — just an informational line. This is the only Inbox-specific affordance.

**Empty state**: "Inbox is clear." `text-h2`, with subline "Quick-add lands here when no project is picked."

---

## Screen: All view (desktop)

```
+-----------------------------------------------------------------------------+
|  All                                          [Sort: Due ▾] [+ Filter]      |
+-----------------------------------------------------------------------------+
|  + Add task                                                                 |
+-----------------------------------------------------------------------------+
|                                                                             |
|  Showing 47 active items across all projects.                               |
|                                                                             |
|  ● ○ Pay electric bill            Personal · Errands       May 14   ⋯  →   |
|  ● ○ Send invoice                 Work · Q3 Launch         May 16   ⋯  →   |
|  ● ○ Buy laptop charger           Inbox                    Today    ⋯  →   |
|  ● ○ Write conf talk              Work · Side project      May 18-22⋯  →   |
|  ● ○ Reply to Alice               Personal · Errands       Today    ⋯  →   |
|  ● ○ Pricing call                 Work · Q3 Launch         Today    ⋯  →   |
|  ...                                                                        |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Differences from Today**: Each row shows a **project breadcrumb** (`Folder · Project`) in `text-small` `text-subtle` between title and date.

---

## Screen: Completed view (desktop)

```
+-----------------------------------------------------------------------------+
|  Completed                                  [Sort: Recently ▾] [+ Filter]   |
+-----------------------------------------------------------------------------+
|                                                                             |
|  Today                                                                      |
|  ─────────                                                                  |
|  ● ✓ Take out trash                       Personal · Errands     09:42  ⋯  |
|  ● ✓ Reply to Bob                         Inbox                  10:18  ⋯  |
|  ● ✓ Standup                              Work · Q3 Launch       11:00  ⋯  |
|                                                                             |
|  Yesterday                                                                  |
|  ─────────                                                                  |
|  ● ✓ Buy milk                             Personal · Errands     Tue 8:14   |
|  ● ✓ Send proposal draft                  Work · Q3 Launch       Tue 17:30  |
|                                                                             |
|  Earlier                                                                    |
|  ─────────                                                                  |
|  ● ✓ Renew gym membership                 Personal              May 12     |
|  ...                                                                        |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Tokens**: completed rows show strike-through title, opacity 0.6. Checkbox state = checked (filled `success`).

**Interactions**:
- Click checkbox = un-check (`status` back to todo). Row instantly returns to its original view (e.g., back to Today if its due date is today).
- ⋯ menu offers: Open, Delete (soft-delete to Trash).

**Empty state**: "Nothing completed yet." subline: "Done tasks land here."

---

## Screen: Trash view (desktop)

```
+-----------------------------------------------------------------------------+
|  Trash                                  [Sort: Recently ▾]    [Empty Trash] |
+-----------------------------------------------------------------------------+
|                                                                             |
|  · 5 items in Trash. Restored items return to their previous state.         |
|                                                                             |
|  · Trash · Old grocery list                            Trashed Tue   ↩  ✕  |
|  · Trash · Outdated planning doc task                  Trashed Mon   ↩  ✕  |
|  · Trash · Reschedule (test)                           Trashed Sun   ↩  ✕  |
|  · Trash · Buy umbrella (cancelled)                    Trashed May 14 ↩ ✕  |
|  · Trash · Old recurring "Daily standup"               Trashed May 10 ↩ ✕  |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Trash-specific tokens**:
- Row layout differs slightly: no checkbox (trash items aren't checkable). Instead, two trailing affordances per row: `↩` (Lucide `arrow-down-left-from-square` = Restore) and `✕` (= Delete permanently).
- "Empty Trash" button at top-right, Destructive variant. Disabled if Trash is empty.
- Each row shows the original item icon (Trash glyph + the item's type letter) so the user knows what type they're restoring.

**Interactions**:
- Click ↩ = restore. Item goes back to its prior state (active or completed).
- Click ✕ = permanent delete with confirmation §37 ("Permanently delete this item?").
- Click "Empty Trash" = confirmation §37 ("Empty Trash? All 5 items will be permanently deleted.")

**Empty state**: "Trash is empty." subline: "Deleted items land here. Restore or permanently delete from here."

---

## Screen: Per-project view (flat, e.g., "Errands")

```
+-----------------------------------------------------------------------------+
|  Errands  (in Personal)                  [List · Kanban]   [Sort ▾] [Filter] |
+-----------------------------------------------------------------------------+
|  + Add task                                                                 |
+-----------------------------------------------------------------------------+
|                                                                             |
|  Active (3)                                                                 |
|  ─────                                                                      |
|  ● ○ Pay electric bill                                       May 14   ⋯  →  |
|  ● ○ Reply to Alice                              #waiting    09:00    ⋯  →  |
|  ● ○ Take dog to vet                             #call       14:00    ⋯  →  |
|                                                                             |
|  Show 6 completed ▾                                                         |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Notes**:
- Project breadcrumb in title ("Errands (in Personal)") shows the folder; if no folder, just "Errands".
- View toggle (List · Kanban) — selected state on List.
- "Show 6 completed ▾" is a Ghost button (§1) that toggles a collapsible block underneath listing recently completed items.

**Empty state**: "No tasks in Errands yet." subline: "Add one above."

---

## Screen: Per-project view (hierarchical Tree, e.g., "Q3 Launch")

```
+-----------------------------------------------------------------------------+
|  Q3 Launch  (in Work)                    [Tree · Kanban]    [Sort ▾] [Filter] |
+-----------------------------------------------------------------------------+
|  + Add Epic                                          + Add Task in project   |
+-----------------------------------------------------------------------------+
|                                                                             |
|  ▾ · Layers · Marketing site relaunch                  2/9   ====-----  ⋯  |
|     ▾ · LayoutGrid · Hero section copy                  1/3  ==--      ⋯   |
|        ● ○ Draft hero copy                              Today          ⋯ → |
|        ● ✓ Brief from PM                                                    |
|        ● ○ Get sign-off from VPM                        May 22         ⋯ → |
|     ▸ · LayoutGrid · Pricing page                       0/4  ----      ⋯   |
|     ▸ · LayoutGrid · FAQ update                         1/2  ==--      ⋯   |
|                                                                             |
|  ▸ · Layers · Backend rewrite                           3/15 ===------ ⋯   |
|                                                                             |
|  ─── Loose tasks in project (no Epic parent) ───                            |
|  ● ○ Update Slack channel topic                            May 19      ⋯ → |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Tree row layout** per §21:
- Chevron (▾/▸), type icon (Layers / LayoutGrid / Task), title, rollup chip + bar (Epic/Feature only), date chip (Tasks only).
- Indent: 24px per level. Vertical guide line drawn at each indent stop.

**"Loose tasks" section**: an italic-free `text-h3` `text-subtle` divider appears below the Epic list if there are Tasks at the project root (i.e., Tasks not under any Epic). Per spec, this is allowed and visible.

**Per-project chrome**:
- View toggle (Tree · Kanban). Selected: Tree.
- "+ Add Epic" creates a top-level Epic in this project. "+ Add Task in project" creates a Task at the project root (no Epic parent). Inside an Epic, hover reveals "+ Add Feature"; inside a Feature, hover reveals "+ Add Task".

**Keyboard**:
- All Tree row shortcuts (§21.4) apply.
- `⌘⇧M` re-parent on focused row.
- Drag a row to re-parent (with depth-cap validation, hover-300ms-expand for collapsed nodes).

**Empty state (hierarchical)**: "No work in Q3 Launch yet." subline: "Add an Epic to start organizing, or a Task to keep it loose."

---

## Screen: Per-project view (Kanban, e.g., "Q3 Launch" — but per spec, Kanban shows only Tasks regardless of project hierarchy)

```
+--------------------------------------------------------------------------------+
|  Q3 Launch  (in Work)             [Tree · Kanban]    [Sort ▾] [Filter]         |
+--------------------------------------------------------------------------------+
|  + Add task                                                                    |
+--------------------------------------------------------------------------------+
|                                                                                |
|   To Do (8)   +      In Progress (3)   +     Done (12)                         |
|   --------           ---------------         --------                          |
|   ┌──────────┐       ┌──────────┐            ┌──────────┐                      |
|   │ Draft     │      │ Pricing   │           │ Brief     │                     |
|   │ pricing   │      │ analysis  │           │ from PM   │                     |
|   │ tiers     │      │           │           │ #urgent   │                     |
|   │ #urgent   │      │ 2/4       │           │           │                     |
|   │ Today     │      │           │           │                                 |
|   └──────────┘       └──────────┘            └──────────┘                      |
|                                                                                |
|   ┌──────────┐       ┌──────────┐            ┌──────────┐                      |
|   │ Hand off  │      │ Sketch    │           │ Slack     │                     |
|   │ to design │      │ layout    │           │ channel   │                     |
|   │ #design   │      │           │           │ Done Mon  │                     |
|   │ Today     │      │ 1/3       │           │                                 |
|   └──────────┘       └──────────┘            └──────────┘                      |
|                                                                                |
|   ┌──────────┐       ┌──────────┐            ┌──────────┐                      |
|   │ Get      │      │ Backend   │           │ Setup     │                     |
|   │ finance  │      │ schema    │           │ analytics │                     |
|   │ sign-off │      │           │           │                                 |
|   └──────────┘       └──────────┘            └──────────┘                      |
|                                                                                |
|   ...                                                                          |
|                                                                                |
|                                                          [Showing recent 50, →]|
+--------------------------------------------------------------------------------+
```

**Kanban card layout** per §25:
- Title (`text-h3`), then meta row: tag chips, subtask progress `2/4`, date chip (only if today or overdue).
- Priority strip on left edge (color per priority).

**Kanban interactions**:
- Drag card between columns = changes `status`. Drag to Done = completion + recurrence next-instance generation (if any) + snackbar "Task completed. Undo.".
- Drag to reorder within a column = `sort_order` change.
- ← → arrows on focused card = move to previous/next column.
- ↑ ↓ arrows = reorder within column.
- Click card = open Task modal.
- `+ Add task` in column header = quick-add with `status` pre-set to that column. (Note: per spec §9.4 #8, the project is **not** auto-filled — the user must still pick a project explicitly. The Kanban-column-context for status pre-fill is an exception specifically for status; project remains empty.)

**Empty state per-column** (§35.4): a faint dashed border + "No items" centered.

**Empty state full-kanban** (no items in any column): "No tasks here yet." subline: "Drag from another project or add one."

---

## Screen: Per-tag view (cross-project flat list)

```
+-----------------------------------------------------------------------------+
|  # urgent                                  [Sort: Due ▾] [+ Filter]         |
+-----------------------------------------------------------------------------+
|                                                                             |
|  6 items tagged "urgent" across all projects.                               |
|                                                                             |
|  ● ○ Pay electric bill           Personal · Errands       May 14 (4d) ⋯ →  |
|  ● ○ Pricing call                Work · Q3 Launch         Today  11:30 ⋯ → |
|  ● ○ Find running shoes          Inbox                    Jun 1       ⋯ →  |
|  ● ○ File expenses               Work · Q3 Launch         May 25      ⋯ →  |
|  ● ○ Backend schema review       Work · Q3 Launch         May 28      ⋯ →  |
|  ● ○ Fix critical bug            Work · Side project      Today  09:00 ⋯ → |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Quick-add behavior**: when on a tag view, quick-add **does NOT pre-fill the tag** (consistent with §9.4 #8 — quick-add doesn't pre-fill anything from view context). The user must add the tag in the modal.

**Empty state**: "No items tagged 'urgent'." subline: "Tag tasks in the Task modal to surface them here."

---

## Screen: Calendar view (month)

```
+-----------------------------------------------------------------------------------+
|  Calendar                                                                          |
|  < May 2026 >                              [Month · Week]    [Filter ▾]            |
+-----------------------------------------------------------------------------------+
|                                                                                    |
|  Sun     Mon       Tue       Wed       Thu      Fri      Sat                       |
|  ─────  ──────    ──────    ──────    ──────   ──────  ──────                      |
|  26      27       28        29        30        1        2                          |
|         | Stand-up         |          |        | Pay rent                          |
|         | (recur)          |          |        | (recurring)                       |
|         |                  |          |        |                                   |
|  ─────  ──────    ──────   ──────    ──────   ──────   ──────                      |
|  3       4         5         6         7        8        9                          |
|         |          |         | 09:00   |         |        |                       |
|         |          |         | Standup |         |        |                       |
|         |          |         |         |         |        |                       |
|  ─────  ──────    ──────    ──────   ──────    ──────   ──────                     |
|  10      11        12        13        14       15       16                         |
|         |          | 09:00   |         | Pay     |        |                       |
|         |          | Standup |         | electric|        |                       |
|         |          |         |         |         |        |                       |
|  ─────  ──────    ──────    ──────    ──────   ──────  ──────                      |
|  17      18 [TODAY]  19      20         21       22       23                         |
|         | 5 items  | 3 items | 09:00   | 2 items | 1 item|                        |
|         | ────── Write conf talk ─────────────────                                  |
|         | 09 Reply| 1:1     |         |         |        |                        |
|         | 11:30   |         |         |         |        |                        |
|         | +2 more | +0 more | +1 more |         |        |                        |
|  ─────  ──────    ──────    ──────    ──────   ──────  ──────                      |
|  24      25        26        27        28        29       30                        |
|                                                                                    |
|  ─────  ──────    ──────    ──────    ──────   ──────  ──────                      |
|  31      1         2         3         4         5        6                         |
|                                                                                    |
+-----------------------------------------------------------------------------------+
```

**Tokens / layout**:
- 7-column grid, weeks as rows. Sunday or Monday first per Settings.
- Each cell: §26 day cell. Today cell: `accent`-filled circle on the date number.
- Multi-day "Write conf talk" span: shown as a continuous bar across May 18, 19, 20, 21, 22. Title on May 18, faint continuation through 21, "Day 5 of 5" emphasis on 22.
- Out-of-month cells (Apr 26-30 and Jun 1-6 in the May grid) shown in `text-muted`, `canvas-subtle` bg.
- Overflow: "+2 more", "+1 more" — click opens Day-detail popover (§34).

**Chrome**:
- "< May 2026 >" — left/right chevrons navigate months; "May 2026" itself click opens a month-year picker.
- Today button (could be added — v1 ships the keyboard shortcut `T` to jump to today's date in calendar).
- View toggle: Month · Week.
- Filter dropdown: by project / by tag (per spec §9.4 #2 — session-only filter chips).

**Keyboard**:
- Arrow keys navigate day cells (Left/Right by day, Up/Down by week).
- `Enter` opens the day-detail popover for the focused day.
- `N` creates a new task with date pre-filled to the focused day.
- `T` jumps to today.
- `Page Up` / `Page Down` previous/next month.
- `Shift + Page Up` / `Page Down` previous/next year.

**Interactions**:
- Drag an event chip to a different day cell = reschedule (mutates due_date). For multi-day spans, the **entire span shifts** (start_date and due_date both move by delta, preserving span length).
- Click an event chip = open Task modal.
- Click "+N more" = day-detail popover (§34).
- Right-click on a day cell = context menu "New task on this day".
- Right-click on an event chip = "Open", "Edit date", "Move to project…", "Delete".

**Empty month**: "No events this month." subline: "Press N to create one on the focused day."

---

## Screen: Calendar view (week)

```
+--------------------------------------------------------------------------------+
|  Calendar                                                                       |
|  < May 18 – May 24, 2026 >              [Month · Week]   [Filter ▾]             |
+--------------------------------------------------------------------------------+
|                                                                                 |
|        Mon 18      Tue 19      Wed 20    Thu 21     Fri 22    Sat 23   Sun 24   |
|        ──────      ──────      ──────    ──────     ──────    ──────   ──────   |
|  ALL  | Write conf talk ─────────────────────────────|                          |
|  DAY  | Buy charger | Send draft|                    | Submit expense|          |
|       | Reply Alice | 1:1 mgr   |                    | Pay rent      |          |
|       |             |           |                    |               |          |
|  ──── ── ────────  ── ────────  ── ─────  ── ──────  ── ──────  ── ──── ── ──── |
|  9 AM | Reply Alice| 1:1 mgr   |          |          |          |    |          |
|  10 AM|            |           |          |          |          |    |          |
|  11 AM| Pricing 11:30          |          |          |          |    |          |
|  12 PM|            |           |          |          |          |    |          |
|  1 PM |            |           |          |          |          |    |          |
|  2 PM | Take dog   |           |          |          |          |    |          |
|       | to vet     |           |          |          |          |    |          |
|  3 PM |            |           |          |          |          |    |          |
|  ...                                                                            |
|                                                                                 |
+--------------------------------------------------------------------------------+
```

**Week view layout**:
- An "all-day" row at the top spans the full grid horizontally, holding all-day items and multi-day spans.
- Below, a time-column-based grid: hours run vertically; each day is a column. Timed items appear as 30-minute blocks anchored at their start time.

**Interactions**:
- Vertical drag of a timed block = re-time (snap to 15-min increments).
- Horizontal drag = move to another day (multi-day spans move entire span).
- Click an item = open modal.

**Keyboard**: similar to month view, with additional Up/Down arrows scrolling vertically through hours.

---

## Screen: Day-detail popover (overflow)

```
+----------------------------------------+
|  Wed, May 22                       ✕  |
|  9 items                                |
+----------------------------------------+
|  ● ○ Buy laptop charger            ⋯ → |
|  ● ○ Write conf talk    Day 5 of 5 ⋯ → |
|  ● ○ Reply to Alice  #wait  09:00  ⋯ → |
|  ● ○ Pricing call   #urgent 11:30  ⋯ → |
|  ● ○ Take dog to vet #call  14:00  ⋯ → |
|  ● ○ Send report draft             ⋯ → |
|  ● ○ Submit expenses               ⋯ → |
|  ● ○ Renew domain                  ⋯ → |
|  ● ○ Reschedule meeting            ⋯ → |
+----------------------------------------+
|  + Add task on May 22                  |
+----------------------------------------+
```

**Tokens**: popover §34. Each row is a full Task list row (§23) — check-off, click-to-edit, ⋯ menu all work in here.

**Mobile variant**: same content rendered as a Sheet.

---

## Screen: Settings view (theme + week-start only)

```
+-----------------------------------------------------------------------------+
|  Settings                                                                   |
+-----------------------------------------------------------------------------+
|                                                                             |
|  APPEARANCE                                                                 |
|  ─────────────                                                              |
|  Theme                                                                      |
|     ◯ Light                                                                 |
|     ◯ Dark                                                                  |
|     ● System (default)                                                      |
|                                                                             |
|  WEEK                                                                       |
|  ─────────                                                                  |
|  Start of week                                                              |
|     ◯ Sunday                                                                |
|     ● Monday (default)                                                      |
|                                                                             |
|                                                                             |
|  ABOUT                                                                      |
|  ─────────                                                                  |
|  Tasko v1.0  ·  Local-first ·  Synced to cloud                              |
|  · ? · View keyboard shortcuts                                              |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Layout**: simple form. Section headers in `text-caption` `text-subtle` all-uppercase letter-spacing-tracked.

**Note**: Per locked decision §9.4 #8, there is **no default-project setting**.

**Mobile variant**: same content, single column, settled spacing.

---

## Screen: Task modal (desktop)

```
+-----------------------------------------------------------------------------+
|  · Add task ·                                                          ✕    |
+-----------------------------------------------------------------------------+
|                                                                             |
|  Title                                                                      |
|  [Buy laptop charger___________________________________________________]    |
|                                                                             |
|  · Required ·                                                               |
|  Due date                                                                   |
|  [📅 Today, May 18 ▾]      [+ Add time]                  · All-day ●        |
|                                                                             |
|  Start date (optional)                                                      |
|  [📅 — none ▾]                                                              |
|                                                                             |
|  · Required ·                                                               |
|  Project                                                                    |
|  [▾ Pick a project (or Inbox)___________________________]                   |
|                                                                             |
|  Tags                                                                       |
|  [ #urgent  #call    Add tag…                          ]                    |
|                                                                             |
|  Priority                                                                   |
|  ( ○ None )  ( · Low )  ( ● Medium )  ( ● High )                            |
|                                                                             |
|  · More ▾                                                                   |
|  ─────────                                                                  |
|  Notes (markdown)                                                           |
|  ┌─────────────────────────────────────────────────────────────────┐        |
|  │                                                                 │        |
|  │                                                                 │        |
|  └─────────────────────────────────────────────────────────────────┘        |
|                                                                             |
|  Recurrence                                                                 |
|  [ Never ▾ ]                                                                |
|                                                                             |
+-----------------------------------------------------------------------------+
|                                          [Cancel]   [Save]                  |
+-----------------------------------------------------------------------------+
```

**Field order, per spec §6.1 + locked decisions**:
1. Title — pre-filled if opened from quick-add.
2. Due date — **focused on open** (the modal's initial focus).
3. Start date (optional, for multi-day items).
4. Project — **required**, **empty by default** (no view-context auto-fill per §9.4 #8).
5. Tags.
6. Priority.
7. (More disclosure) Notes (markdown).
8. (More disclosure) Recurrence.

**Field visibility**: Title, Due date, Start date, Project, Tags, Priority are visible by default. Notes and Recurrence live behind a "More" disclosure to keep the modal scannable. Once Notes or Recurrence are set, they expand and stay visible on subsequent opens of the same modal.

**Required field markers**: small `· Required ·` label in `text-caption` `text-subtle` above the field. On submit, if any required field is empty, the field is highlighted (border=`overdue`) and the helper text becomes an error message.

**Edit modal**: identical layout, but with all fields pre-filled, and an additional "Delete" button (Ghost, with Lucide `trash-2`) in the footer left side. Subtasks section appears in the More disclosure between Notes and Recurrence.

**Keyboard**:
- Tab/Shift+Tab cycles fields.
- `⌘Enter` or `⌘S` saves.
- `Esc` cancels (with unsaved-changes guard).
- Date field: shortcut letters: `t` = today, `m` = tomorrow, `w` = next week, `n` = no date (if optional).

---

## Screen: Task modal — mobile sheet variant

```
+-------------------------------------------------+
|              ──── drag handle ────              |
+-------------------------------------------------+
|  Add task                              ✕        |
+-------------------------------------------------+
|                                                 |
|  Title                                          |
|  [Buy laptop charger________________________]   |
|                                                 |
|  Due date  · Required                           |
|  [📅 Today, May 18 ▾]    [+ time]               |
|                                                 |
|  Start date                                     |
|  [📅 — none ▾]                                  |
|                                                 |
|  Project  · Required                            |
|  [▾ Pick a project (or Inbox)_________]         |
|                                                 |
|  Tags                                           |
|  [ #urgent  Add tag…                  ]         |
|                                                 |
|  Priority                                       |
|  ( ○ None )  ( ● Low )  ( ● Med )  ( ● High )   |
|                                                 |
|  · More ▾                                       |
|                                                 |
|                                                 |
+-------------------------------------------------+
|             [Cancel]      [Save]                |
+-------------------------------------------------+
```

**Sheet-specific**: drag-handle at top, drag down to dismiss. Otherwise same field set as desktop.

---

## Screen: New project modal

```
+-----------------------------------------------------------------------------+
|  · Add project ·                                                        ✕  |
+-----------------------------------------------------------------------------+
|                                                                             |
|  Name  · Required                                                           |
|  [Q3 Launch_____________________________________________________________]   |
|                                                                             |
|  Folder (optional)                                                          |
|  [▾ No folder]                                                              |
|                                                                             |
|  · Use Epic / Feature / Task hierarchy                                      |
|    [ off · on ●]                                                            |
|                                                                             |
|                                                                             |
+-----------------------------------------------------------------------------+
|                                          [Cancel]   [Create project]        |
+-----------------------------------------------------------------------------+
```

**Tokens**:
- "Use Epic / Feature / Task hierarchy" toggle uses a Switch component (which is a variant of a Checkbox we'll add to the catalog if engineering needs it — it's effectively a styled checkbox with a label and a track-and-thumb visual; for v1 acceptable to render as a styled checkbox or a segmented control).
- After creation, the user lands on the new project's view (Tree if hierarchical, List if flat).

**Empty state n/a** (this is a creation surface).

---

## Screen: Folder creation flow

There is no separate full-screen "create folder" — it's a lightweight inline experience invoked from the sidebar.

**Trigger paths**:
1. Click the `+` icon next to "PROJECTS" sidebar section header → menu with "New project" and "New folder".
2. Right-click empty area below projects in sidebar → context menu with same options.
3. ⌘K command palette: "New folder".

**The flow**:
1. An inline editable row appears at the top of the projects section, with the folder icon (Lucide `folder`) on the left and an active text input in the middle (placeholder "Folder name…").
2. User types name + Enter.
3. The folder is created. Cursor focus stays in the sidebar, on the new folder header.

To **move a project into a folder**:
- Drag the project row onto the folder header (folder auto-expands after 300ms hover).
- OR right-click project → "Move to folder…" → submenu listing folders + "New folder…" option.

To **move a project out of a folder**:
- Drag it out, onto the projects section root area (visual cue: dashed `border` line appears where the drop will land).
- OR right-click → "Move to no folder".

**Visual during creation**: the inline edit row uses Text input (§3) chrome inside the sidebar's narrow column. Esc cancels (the row vanishes).

---

## Screen: Command palette (⌘K)

```
                                       (centered on viewport)
              +-----------------------------------------------+
              |  · cmd · Type a command…                   ⌘K |
              +-----------------------------------------------+
              |  RECENT                                       |
              |   ↑ Go to Today                          T    |
              |   ↑ Add task                             N    |
              |   ↑ Go to Q3 Launch                           |
              |                                               |
              |  NAVIGATE                                     |
              |   · Sun · Go to Today                    T    |
              |   · Sunrise · Go to Tomorrow                  |
              |   · Cal · Go to Next 7 Days                   |
              |   · Inbox · Go to Inbox                  I    |
              |   · Cal · Go to Calendar                      |
              |   · Trash · Go to Trash                       |
              |   · Check · Go to Completed                   |
              |                                               |
              |  CREATE                                       |
              |   · Plus · Add task                      N    |
              |   · Plus · Add project                        |
              |   · Plus · New folder                         |
              |   · Plus · Add Epic in Q3 Launch              |
              |                                               |
              |  VIEW                                         |
              |   · Sort by priority                          |
              |   · Sort by due date                          |
              |   · Toggle sidebar                       ⌘\   |
              |   · Show completed                            |
              |                                               |
              |  SETTINGS                                     |
              |   · Settings · Open settings                  |
              |   · Sun/Moon · Switch theme to dark / light  |
              |   · ?      · View keyboard shortcuts     ?    |
              |                                               |
              +-----------------------------------------------+
```

**Behavior**: per §33. Default no-query view shows recent + curated commands. Typing filters fuzzily. Arrow Up/Down navigates, Enter selects, Esc closes.

**Mobile variant**: opens as a full-screen sheet from the top, input field auto-focused.

---

## Screen: Confirmation dialogs

### Parent completion blocking

```
+--------------------------------------------------+
|  Complete all children and continue?             |
+--------------------------------------------------+
|  This task has 3 incomplete subtasks.            |
|  Completing it will mark them all done.          |
|                                                  |
|  [Cancel]               [Complete all]           |
+--------------------------------------------------+
```

### Permanent delete (from Trash)

```
+--------------------------------------------------+
|  Permanently delete?                             |
+--------------------------------------------------+
|  This cannot be undone.                          |
|                                                  |
|  [Cancel]              [Delete forever]          |
+--------------------------------------------------+
```

### Empty Trash

```
+--------------------------------------------------+
|  Empty Trash?                                    |
+--------------------------------------------------+
|  All 5 items in Trash will be permanently        |
|  deleted. This cannot be undone.                 |
|                                                  |
|  [Cancel]              [Empty Trash]             |
+--------------------------------------------------+
```

### Move all overdue to today

```
+--------------------------------------------------+
|  Move 3 overdue items to today?                  |
+--------------------------------------------------+
|  Their due dates will be set to today.           |
|                                                  |
|  [Cancel]               [Move all]               |
+--------------------------------------------------+
```

### Unsaved changes guard (on modal close)

```
+--------------------------------------------------+
|  Discard changes?                                |
+--------------------------------------------------+
|  You have unsaved edits.                         |
|                                                  |
|  [Keep editing]                [Discard]         |
+--------------------------------------------------+
```

**Tokens**: Confirmation prompt §37. Destructive variants use Destructive button styling on the right action. For destructive prompts, the Cancel button is initially focused (Esc cancels).

---

## Screen: Empty states for each major view

| View | Icon | Headline | Subline | Warm? |
|---|---|---|---|---|
| Today (regular) | `sun` | "Nothing due today." | "You're caught up. Enjoy the day." | **Warm flourish #1** |
| Today (first-run) | `sunrise` | "Welcome to Tasko." | "Add your first task above — type it and press Enter." | **Warm flourish #2** |
| Tomorrow | `sunrise` | "Nothing scheduled for tomorrow." | "Plan ahead — add a task." | — |
| Next 7 Days | `calendar-days` | "Nothing in the next seven days." | "A quiet week. Or just unscheduled." | — |
| Inbox | `inbox` | "Inbox is clear." | "Quick-add lands here when no project is picked." | — |
| All | `list` | "No active items." | "Add a task or start a project." | — |
| Completed | `check-circle-2` | "Nothing completed yet." | "Done tasks land here." | — |
| Trash | `trash-2` | "Trash is empty." | "Deleted items land here. Restore or permanently delete from here." | — |
| Per-project (flat) | (project icon) | "No tasks in <Project> yet." | "Add one above." | — |
| Per-project (hierarchical) | (project icon) | "No work in <Project> yet." | "Add an Epic to start organizing, or a Task to keep it loose." | — |
| Per-tag | `hash` | "No items tagged '<tag>'." | "Tag tasks in the Task modal to surface them here." | — |
| Calendar (empty month) | `calendar` | "No events this month." | "Press N to create one on the focused day." | — |
| Kanban (empty board) | `columns-3` | "No tasks here yet." | "Drag from another project or add one." | — |
| Kanban (per-column) | (inline only) | "No items" | (none) | — |
| Filtered-down-to-nothing | `filter` | "No matches." | "Try removing a filter." + "Clear filters" button | — |

---

## Screen: Mobile bottom nav layout

```
+--------------------------------------------+
|                                            |
|         (main content area above)          |
|                                            |
+--------------------------------------------+
|  · Sun ·  · Cal ·  ┌──⊕──┐  · Inbox ·  ·⋯· |
|  Today   Calendar  │ Add │  Inbox      More|
|                    └─────┘                  |
+--------------------------------------------+
  ^safe-area-inset-bottom (iOS home indicator clearance)
```

**Tab states**: selected tab's icon and label are `accent-on-subtle`. Center "Add" tab is slightly elevated — `surface-elevated` bg, `elevation-1`, and the icon is one step larger.

---

## Screen: Sidebar collapsed state (desktop narrow)

```
+----+--------------------------------------------------------------+
|    |  MAIN CONTENT                                                |
|    |                                                              |
|    |                                                              |
| ·≡·|  Today                                  [Sort ▾] [Filter]   |
| ─  |  ───────────────────────────────────────────────────────── |
|    |  + Add task                                                  |
| ·☀│ (selected)                                                   |
|    |                                                              |
| ·↑·|                                                              |
|    |                                                              |
| ·□·|                                                              |
|    |                                                              |
| ·□·|                                                              |
|    |                                                              |
| ·◌·|                                                              |
|    |                                                              |
| ── |                                                              |
|    |                                                              |
| ·F·|                                                              |
|    |                                                              |
| ── |                                                              |
|    |                                                              |
| ·#·|                                                              |
|    |                                                              |
| ── |                                                              |
|    |                                                              |
| ·C·|                                                              |
|    |                                                              |
| ·V·|                                                              |
|    |                                                              |
| ·🗑·|                                                              |
|    |                                                              |
| ·⚙·|                                                              |
|    |                                                              |
| ·☁·|  (sync state — icon only; tooltip on hover)                  |
|    |                                                              |
+----+--------------------------------------------------------------+
```

**Behavior**: Tooltip on hover shows the label + count (e.g., "Today, 5 items, 3 overdue"). Click `·≡·` (top hamburger) or `⌘\` expands back.

---

## Cross-screen annotations

### Keyboard shortcut help overlay (`?`)

A non-modal floating panel appears anchored to the bottom-right of the viewport showing a categorized shortcut reference. Tapping `?` again or `Esc` dismisses.

```
+-------------------------------------------+
|  Keyboard shortcuts                  ✕    |
+-------------------------------------------+
|  NAVIGATE                                 |
|   T   Today                               |
|   I   Inbox                               |
|   N   New task (quick-add)                |
|   /   Focus quick-add input               |
|   ⌘K  Command palette                     |
|   ⌘\  Toggle sidebar                      |
|                                           |
|  ROW (when focused, no input active)      |
|   ↑↓  Move focus                          |
|   Space  Toggle checkbox                  |
|   Enter / O  Open modal                   |
|   1-4 Set priority                        |
|   T   Schedule to today                   |
|   ⌘⇧M Move to project…                    |
|   Backspace  Soft-delete                  |
|                                           |
|  MODAL                                    |
|   ⌘Enter / ⌘S  Save                       |
|   Esc  Cancel                             |
|                                           |
|  CALENDAR                                 |
|   ←→  Day                                 |
|   ↑↓  Week                                |
|   PgUp/PgDn  Month                        |
|   T   Jump to today                       |
|   N   New task on focused day             |
|                                           |
|  GLOBAL                                   |
|   ?   Show / hide this panel              |
+-------------------------------------------+
```

---

## Annotation: Tokens applied across screens

For brevity, the screens above reference token names by their semantic role (e.g., "row hover bg = `canvas-subtle`"). The full token list is in `design-language.md`. Reading the wireframes:
- Backgrounds always come from canvas / surface / surface-elevated.
- Text always from text / text-subtle / text-muted / text-disabled / text-on-accent / text-overdue.
- Borders always from border / border-subtle / border-strong / border-overlay.
- Accent only from accent / accent-hover / accent-pressed / accent-subtle / accent-on-subtle.
- Status colors from priority-* / status-* / overdue / success.
- Motion always from motion-* + ease-*.
- Spacing always from space-1..7.
- Radius always from radius-*.
- Elevation always from elevation-*.

If a screen requires a new token not in design-language.md, that is a bug — file it.
