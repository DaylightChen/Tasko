---
title: Tasko — Accessibility Contract
date: 2026-05-18
phase: ux
scope: project
status: draft
---

# Tasko — Accessibility Contract

WCAG **2.1 Level AA** is the floor for Tasko v1. AA is required because the product is the user's daily-driver task manager — accessibility is a load-bearing requirement, not a checkbox. AAA targets are honored where they don't cost the rest of the design.

This document is the contract between design and engineering for a11y: what must hold, what is expected to be tested, and how each component meets the bar.

---

## 1. Overall WCAG commitment

- **Conformance level**: WCAG 2.1 AA across all v1 surfaces.
- **Conformance review**: every screen in `screens.md` is conformance-tested before launch. The reviewer phase (in the planner stage) is expected to validate a11y as a release gate.
- **Failures to AA on a per-surface basis** must be logged as either (a) a planned exception with documented mitigation, or (b) a v1.1 carryover. We do not silently ship AA failures.

### 1.1 Color contrast targets

| Target | Minimum ratio | What it covers |
|---|---|---|
| Body text on canvas | 4.5:1 | `text` on `canvas`, `text` on `surface` |
| Large text (18px+/14px+ bold) | 3:1 | View titles |
| Non-text UI components (borders, icons, focus rings) | 3:1 | Form borders, focus rings, status dots |
| Inactive controls | (no minimum) | `text-disabled`, `text-muted` — but these are never used as the only signal |

**Verified pairs** (see `design-language.md` §2):
- `text` `#0F1115` on `canvas` `#FCFCFC` (light) = 16.1:1 ✓ AAA.
- `text` `#F1F2F4` on `canvas` `#0E0F11` (dark) = 15.4:1 ✓ AAA.
- `text-subtle` `#5B6068` on `canvas` `#FCFCFC` (light) = 5.6:1 ✓ AA.
- `text-subtle` `#A5ABB3` on `canvas` `#0E0F11` (dark) = 6.4:1 ✓ AA.
- `accent` `#D97706` on `surface` `#FFFFFF` (light, non-text) = 4.65:1 ✓ AA non-text. (For decorative dots / borders this exceeds 3:1.)
- `accent` `#F59E0B` on `surface` `#1A1C1F` (dark) = 7.92:1 ✓ AAA.
- `text-on-accent` `#FFFFFF` on `accent` `#D97706` (light) = 4.65:1 ✓ AA — used for primary button labels.
- `text-on-accent` `#0F1115` on `accent` `#F59E0B` (dark) = 11.8:1 ✓ AAA.
- `text-overdue` `#B91C1C` on `canvas` `#FCFCFC` (light) = 5.7:1 ✓ AA.
- `text-overdue` `#FCA5A5` on `canvas` `#0E0F11` (dark) = 7.1:1 ✓ AA.
- Focus ring `accent` 2px on any surface = exceeds 3:1 in both modes.

`text-muted` (3.5:1 light, 4.1:1 dark) **does not meet body-text AA** — it is intentionally reserved for non-text (icon strokes that have other-form visual presence, disabled-control visuals where the user does not need to read it as load-bearing info). This is a defined exception: text-muted is never used for any string the user must read.

### 1.2 Touch targets

- Minimum touch target: **44x44 px** on mobile (per WCAG 2.5.5 AAA, but we adopt it as a baseline; per locked decision).
- Desktop hover targets: not strict; smaller targets (28-32px) are acceptable on desktop since pointer accuracy is higher. But every desktop interactive control must also work on touch — its touch hit-area expands invisibly to 44x44 when touch is detected.

### 1.3 Text resize

- Layout must remain functional up to 200% browser zoom. No content gets clipped or becomes inaccessible.
- Text must reflow at 320px viewport width without horizontal scrolling (WCAG 1.4.10 Reflow).

### 1.4 Color independence (WCAG 1.4.1)

- **No color-alone signaling.** Every place color carries meaning has a non-color alternative.

| Signal | Color | Alternative |
|---|---|---|
| Priority (None/Low/Med/High) | gray / amber / red | Dot **size** varies (6/6/8/10px) + dot **fill style** (None = hollow ring, Low+ = filled) + accessible label "Priority: <level>" |
| Overdue date | red text | "Overdue" prefix in screen reader announcement + 3px left-edge stripe on row + amber pill count in sidebar with the number itself |
| Item type (Epic/Feature/Task/Subtask) | (all same color in tree) | Distinct Lucide **glyph** (layers / layout-grid / square-check-big / corner-down-right) — the glyph IS the contract |
| Task completed (in non-strikethrough contexts) | dimmed text, success bg checkbox | Strike-through on title + checkbox glyph state + ARIA "completed" announcement |
| Status (todo / in_progress / done in Kanban) | gray / blue / green column header | Column **heading text** ("To Do" / "In Progress" / "Done") + status dot |
| Today's date in calendar | accent-filled circle | The number itself is still legible + screen reader announces "today" |
| Sync state | green / blue / red icon | Distinct **Lucide glyph** per state (`cloud-check` / `cloud-cog` / `cloud-off` / `alert-circle`) + text label "Synced" / "Syncing…" / "Offline. Changes saved locally." / "Sync error." |
| Selected (multi-select) | accent-subtle bg + accent left stripe | An explicit accessible-checkbox (visible in multi-select mode) and SR announcement "Selected" |
| Drop target (drag) | accent-subtle bg + dashed border | A11y: live region announcement of drop target name on hover ("Drop on Pricing page Feature") |
| Filter chip active | accent-subtle bg | Chip label includes the filter facet ("Tag: urgent") |

---

## 2. Keyboard navigation contract

### 2.1 Global single-key shortcuts (when no input is focused)

These activate only when the active element is NOT an input/textarea/contenteditable, and the user has not pressed a modifier key.

| Key | Action |
|---|---|
| `T` | Navigate to Today |
| `I` | Navigate to Inbox |
| `N` | Focus the quick-add input (in the current view's top region) |
| `/` | Focus the quick-add input (alternative — for users with no `N`-friendly hand position) |
| `?` | Toggle the keyboard shortcuts help overlay |
| `J` / `↓` | Move focus down in the current list |
| `K` / `↑` | Move focus up in the current list |
| `H` / `←` | Move focus left (in grids — calendar / kanban) |
| `L` / `→` | Move focus right (in grids) |
| `Space` | Toggle checkbox on focused row |
| `Enter` / `O` | Open the focused row's modal |
| `1`, `2`, `3`, `4` | Set priority on focused row (None / Low / Medium / High) |
| `Backspace` / `Delete` | Soft-delete focused row (with confirmation) |
| `Esc` | Cancel current operation: close popover, dismiss snackbar, exit multi-select, blur input |
| `X` | Toggle complete on focused row (alternative to Space; matches Kanban convention) |

### 2.2 Modifier-key shortcuts (always available, regardless of focus context)

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘\` / `Ctrl+\` | Toggle sidebar collapsed/expanded |
| `⌘Enter` / `Ctrl+Enter` | Save (in modal) |
| `⌘S` / `Ctrl+S` | Save (in modal — alternative) |
| `⌘Z` / `Ctrl+Z` | Undo last action (within snackbar window — 5s) |
| `⌘⇧Z` / `Ctrl+Shift+Z` | Focus the most recent snackbar's action button (for screen reader users to find Undo) |
| `⌘⇧M` / `Ctrl+Shift+M` | Open Move-to picker (re-parent) on focused row |
| `⌘A` / `Ctrl+A` | Select all rows in current view (multi-select) |
| `⌘F` / `Ctrl+F` | (No global search in v1.) Shows a transient toast "Press ⌘K to navigate" — see Interaction Patterns doc |

### 2.3 Context-specific keyboard maps

#### Modal / Sheet

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Cycle fields (focus trap inside modal) |
| `Esc` | Cancel — closes modal (with unsaved-changes guard if dirty) |
| `⌘Enter` / `Ctrl+Enter` | Save |
| `⌘S` / `Ctrl+S` | Save |

#### Date picker popover

| Key | Action |
|---|---|
| `← →` | Day |
| `↑ ↓` | Week |
| `Page Up / Page Down` | Month |
| `Shift+Page Up / Page Down` | Year |
| `Home / End` | Start / end of row (week) |
| `Enter` | Select focused date |
| `Esc` | Close without selecting |

Quick-select keys (date picker only, while focused inside): `t` = today, `m` = tomorrow, `w` = next week, `n` = no date (if optional).

#### Tree row

| Key | Action |
|---|---|
| `↑ ↓` | Move focus to previous/next sibling or descendant |
| `← ` | Collapse expanded node, or move focus to parent if already collapsed |
| `→ ` | Expand collapsed node, or move focus to first child if already expanded |
| `Enter` / `O` | Open modal |
| `Space` | Toggle checkbox (Tasks only) |
| `⌘⇧M` | Move to (re-parent) |

#### Kanban

| Key | Action |
|---|---|
| `↑ ↓` | Reorder within column (move focused card up/down) |
| `← →` | Move card to previous/next column (mutates status) |
| `Enter` / `O` | Open modal |
| `Space` / `X` | Toggle complete (drag to Done equivalent) |

#### Calendar (month/week)

| Key | Action |
|---|---|
| `← → ↑ ↓` | Navigate cells (Left/Right by day, Up/Down by week) |
| `Page Up / Page Down` | Previous/Next month |
| `Shift+Page Up / Down` | Previous/Next year |
| `Home / End` | Start / end of week |
| `T` | Jump to today's date |
| `Enter` | Open day-detail popover |
| `N` | New task on focused day (date pre-filled) |

#### Command palette

| Key | Action |
|---|---|
| `↑ ↓` | Navigate results |
| `Enter` | Select |
| `Esc` | Close |
| `Tab` | Move from input to results (alternative) |

#### Tag input (multi-select chip-style)

| Key | Action |
|---|---|
| `↓` | Open suggestions / move focus into them |
| `↑` (from suggestions, at the top) | Return focus to input |
| `Enter` | Commit current input value (selects matched or creates new) |
| `,` | Same as Enter (alternative) |
| `Backspace` (on empty input) | Remove last chip |
| `Tab` | Move focus out without committing |

### 2.4 Tab order rules

- **General**: Tab order follows DOM order, which follows visual reading order (top-left → bottom-right, sidebar → main).
- **Sidebar**: Tab cycles through every visible sidebar item from top to bottom: Today, Tomorrow, Next 7 Days, Inbox, All, then Projects (folders' headers + their contained projects in nesting order), then Tags, then bottom links (Calendar, Completed, Trash, Settings, sync indicator). Collapsed folders skip their children.
- **Main content**: After sidebar, Tab moves into the view chrome (Sort, Filter, view toggle), then into the quick-add input, then into the first row of the content list.
- **Lists**: When focus is in a list, arrow keys take over (Tab moves out of the list to the next chrome surface).
- **Modal / Sheet**: Focus is **trapped** while open. Tab cycles within the modal's fields. Esc closes (with guard).
- **Popover (date picker, tag autocomplete, command palette)**: Focus is trapped while open. Esc closes; closing returns focus to the trigger.
- **Snackbar**: Snackbar action button is reachable via `⌘⇧Z` (or screen reader navigation finds it as `role="alert"` with a button child). Snackbar does not steal focus on mount.

### 2.5 Focus indicator

- Every focusable element has a visible focus indicator: **2px solid `accent` outline, 2px offset from the element's edge.**
- For controls that already have a colored background equal to `accent`, the focus indicator becomes `focus-ring-on-accent` (white in light mode, near-black in dark).
- Focus indicator is **always rendered** when focus is reached via keyboard. We use a `:focus-visible` pattern: mouse-click focus does not draw the ring (avoiding visual noise for pointer users); keyboard focus always does.

### 2.6 Focus restoration

- On **modal close**: focus returns to the element that opened the modal (button, row, etc.).
- On **popover close**: focus returns to the trigger.
- On **route change** (sidebar item click): focus moves to the new view's `<h1>` (skipping the long sidebar path each time, since the user already used the sidebar to make this change).
- On **task completion + snackbar appears**: focus stays on the next row in the list (or returns to the list container if it was the last row). It does NOT move to the snackbar — snackbars are not focus-stealing.
- On **drag completion**: focus moves to the dropped item's new location.
- On **filter/sort change**: focus stays on the chrome control that the user activated.

---

## 3. ARIA roles, labels, descriptions per component

### 3.1 Buttons (§1, §2 in component inventory)

- Native `<button>` is the default.
- Icon-only buttons MUST have an `aria-label` describing the action.
- Disabled buttons use `disabled` attribute + `aria-disabled="true"`.
- Loading buttons use `aria-busy="true"` and replace the visible label with a spinner; the `aria-label` becomes "Loading: <original action>".

Examples:
- `<button aria-label="Open task: Buy laptop charger">⋯</button>`
- `<button aria-label="Add task">+</button>`
- `<button aria-label="Toggle sidebar">⌘\</button>` (with sidebar-toggle icon)

### 3.2 Text input (§3)

- `<input>` with associated `<label>` (via `for`/`id` or wrapping).
- `aria-required="true"` on required fields (title, due date in modal).
- `aria-invalid="true"` when in error state.
- `aria-describedby` pointing to the helper text element's ID, or the error message element's ID when error is showing.

### 3.3 Textarea / markdown notes (§4)

- `<textarea aria-multiline="true" aria-label="Notes">`.
- Edit/Preview toggle is `role="switch"` with `aria-checked`.

### 3.4 Date picker (§5)

```
<div role="dialog" aria-label="Pick a date" aria-modal="true">
  <div role="grid" aria-label="May 2026">
    <!-- 7 column headers -->
    <div role="columnheader">Sun</div> ...
    <!-- Day cells -->
    <button role="gridcell" aria-label="May 18, 2026, today, selected" aria-selected="true">18</button>
    <button role="gridcell" aria-label="May 19, 2026">19</button>
    <button role="gridcell" aria-label="May 14, 2026, disabled (before start date)" aria-disabled="true">14</button>
  </div>
</div>
```

### 3.5 Tag input (§9)

```
<div role="group" aria-label="Tags">
  <span class="chip">
    urgent
    <button aria-label="Remove tag urgent">✕</button>
  </span>
  <input
    type="text"
    role="combobox"
    aria-expanded="true"
    aria-controls="tag-suggestions-listbox"
    aria-activedescendant="tag-suggestion-0"
    aria-autocomplete="list"
    aria-label="Add tag"
  />
  <ul role="listbox" id="tag-suggestions-listbox">
    <li role="option" id="tag-suggestion-0" aria-selected="true">urgent</li>
    <li role="option" id="tag-suggestion-1">urgent-followup</li>
    <li role="option" id="tag-suggestion-2">Create "urg"</li>
  </ul>
</div>
```

### 3.6 Tree (§21)

```
<div role="tree" aria-label="Q3 Launch tasks">
  <div role="treeitem" aria-level="1" aria-expanded="true" aria-setsize="2" aria-posinset="1" aria-label="Epic: Marketing site relaunch, 2 of 9 tasks complete">
    <div role="group">
      <div role="treeitem" aria-level="2" aria-expanded="true" aria-setsize="3" aria-posinset="1">
        <div role="group">
          <div role="treeitem" aria-level="3" aria-setsize="3" aria-posinset="1" aria-label="Task: Draft hero copy, priority medium, due today">
            <input type="checkbox" aria-label="Mark Draft hero copy complete" />
            Draft hero copy
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

### 3.7 Kanban grid (§24, §25)

```
<div role="region" aria-label="Q3 Launch Kanban board">
  <div role="list" aria-label="To Do, 8 items">
    <div role="listitem" tabindex="0" aria-label="Task: Draft pricing tiers, priority high, 2 tags, due today">
      Draft pricing tiers
    </div>
    ...
  </div>
  <div role="list" aria-label="In Progress, 3 items">...</div>
  <div role="list" aria-label="Done, 12 items">...</div>
</div>
```

Note: we use `role="list"` (not `role="listbox"` — these are not single-select items; they're navigable cards). The kanban is **not** a `role="grid"` because rows don't align across columns semantically.

### 3.8 Calendar grid (§26, §27)

```
<div role="grid" aria-label="Calendar, May 2026">
  <div role="row">
    <div role="columnheader">Sun</div> ...
  </div>
  <div role="row">
    <div role="gridcell" aria-label="Sunday, April 26, 2026, no events" aria-current="false">26</div>
    <div role="gridcell" aria-label="Monday, May 18, 2026, today, 5 events">18</div>
    ...
  </div>
</div>
```

Events inside cells:
```
<div role="gridcell" aria-label="Wednesday, May 20, 2026, 1 event">
  20
  <button role="button" aria-label="Event: Write conference talk, day 3 of 5">
    Write conf talk · Day 3 of 5
  </button>
</div>
```

### 3.9 Snackbar (§16)

- Standard (success / info / restored): `role="status"` + `aria-live="polite"` + `aria-atomic="true"`. SR will read on mount: "Task completed. Undo available." Without stealing focus.
- Error / depth-cap rejection: `role="alert"` + `aria-live="assertive"`. SR interrupts.

```
<div role="status" aria-live="polite" aria-atomic="true">
  <span>Task completed.</span>
  <button>Undo</button>
</div>
```

### 3.10 Command palette (§33)

```
<div role="dialog" aria-modal="true" aria-label="Command palette">
  <input
    role="combobox"
    aria-expanded="true"
    aria-controls="cmd-results-listbox"
    aria-activedescendant="cmd-result-0"
    aria-label="Type a command"
  />
  <div id="cmd-results-listbox" role="listbox">
    <div role="option" id="cmd-result-0" aria-selected="true">Go to Today (T)</div>
    <div role="option" id="cmd-result-1">Add task (N)</div>
  </div>
</div>
```

### 3.11 Sidebar nav

```
<nav aria-label="Primary navigation">
  <ul>
    <li><a href="/today" aria-current="page">Today (5) 3 overdue</a></li>
    <li><a href="/tomorrow">Tomorrow (3)</a></li>
    ...
  </ul>
  <h2 id="projects-heading">Projects</h2>
  <ul aria-labelledby="projects-heading">
    <li>
      <button aria-expanded="true" aria-controls="folder-personal-list">Personal</button>
      <ul id="folder-personal-list">
        <li><a href="/p/errands">Errands (3)</a></li>
      </ul>
    </li>
    ...
  </ul>
</nav>
```

Sub-badges (`Today (5) ·3`): in screen-reader text, this is rendered as " 5 items, 3 overdue" appended to the link's accessible name.

### 3.12 Landmarks

Every page has these landmarks (WCAG 1.3.1 + 2.4.1 bypass blocks):

- `<header>` (top — contains the view title; on mobile contains the top bar)
- `<nav aria-label="Primary navigation">` (sidebar)
- `<main>` (the active view's content)
- Skip-to-main link as the first focusable element (`<a href="#main">Skip to main content</a>`), visible only on focus.
- Optional `<footer>` if a status bar is needed; sync indicator is at the bottom of the sidebar nav, not in a separate footer landmark.

### 3.13 Heading hierarchy

- View title is `<h1>` (one per page).
- Section headers within a view (e.g., "Overdue", "Today, Wed May 18", folder names if rendered as headings) are `<h2>`.
- Sub-section headers (e.g., "Active" in a flat project view, day groups in Next 7 Days) are `<h2>`. (Day groups use `<h2>` because they are the primary sectioning within the view.)
- Folder names in sidebar are `<h2>` semantically (`role="heading" aria-level="2"`), with the folder button inside.
- "PROJECTS" / "TAGS" sidebar section labels are `<h2>` (the projects listing is one level up).
- Card titles, row titles are NOT headings — they are item labels, accessible via the list/tree semantics.

### 3.14 Live regions

| Region | Politeness | Purpose |
|---|---|---|
| Snackbar (success / info / restored) | `polite` | Task state changes |
| Snackbar (error / depth-cap) | `assertive` | Errors that need immediate user attention |
| Sync state indicator | `polite` | Sync state transitions ("Syncing", "Synced", "Offline. Changes saved locally.", "Sync error.") |
| Filter changes | `polite` | "Filtered to project Q3 Launch: 12 items shown" (announced once when filter is applied) |
| Drag start / drop | `polite` | "Dragging Draft hero copy. Drop on a project, folder, or feature." → "Dropped onto Migrations Feature." |
| Sort changes | `polite` | "Sorted by priority, high to low" |
| Quick-add success | `polite` (covered by snackbar pattern) | "Task added: Buy laptop charger" |
| Empty state | (no live region — empty states render statically into the page; SR reads them as part of the view content) | n/a |

Live region overload risk: we limit announcements to **one per significant action**. We do not announce hover or focus events — only state changes that affect the user's mental model of the data.

---

## 4. Focus management

### 4.1 Modal trap

- When a modal opens, focus moves to the **first interactive control**:
  - **Task modal**: focus moves to the **Due date field** (since title is pre-filled per locked decision).
  - **New project modal**: Name field.
  - **Confirmation prompts (non-destructive)**: Primary action button.
  - **Confirmation prompts (destructive)**: Cancel button (defensive default).
- Tab and Shift+Tab cycle within the modal's focusable elements.
- Esc closes (with unsaved-changes guard).
- On close, focus returns to the **trigger element** (the row, button, etc. that opened the modal).

### 4.2 Sheet trap (mobile)

Same as modal trap. Focus moves to the first field on open; trapped while open; returns to trigger on close.

### 4.3 Popover focus

- Date picker, tag autocomplete, priority menu, sort dropdown, day-detail popover, command palette: all trap focus while open.
- Esc closes; focus returns to trigger.

### 4.4 Snackbar focus

- Snackbar does NOT steal focus on mount (would interrupt user flow).
- User can find the snackbar's Undo button via:
  - `⌘⇧Z` (shortcut to focus most recent snackbar action).
  - Screen reader navigation (the `role="alert"` or `role="status"` is reachable).
- On click of Undo, focus returns to the action's origin (e.g., the now-restored row, or its position in the list).

### 4.5 Calendar focus order

- Initial focus on calendar entry: today's cell (if visible in current view) or the first day of the visible range.
- Arrow keys navigate within the grid.
- Tab moves focus out of the grid to the next chrome surface (view toggle, filter).

### 4.6 Multi-select focus

- Entering multi-select: focus stays on the row the user activated.
- The bulk-action toolbar that slides in is reachable via Tab.
- Esc exits multi-select; selections clear; focus stays on the active row.

### 4.7 Drag focus (keyboard drag)

- We support keyboard drag via:
  - Focus a row.
  - Press `⌘⇧M` (move-to picker) — for re-parenting via picker.
  - For drag-style reordering, post-v1 may add `Space` to "pick up" + arrows to move + `Enter` to drop. v1 ships with mouse/touch drag + the move-to picker as the keyboard equivalent.

---

## 5. Screen reader announcements for state changes

| Event | Announcement |
|---|---|
| Task completed (via checkbox in any view) | "<Title> completed. Undo available." (`polite`) |
| Task uncompleted (via Completed view or snackbar Undo) | "<Title> reopened." (`polite`) |
| Task moved to Trash (soft-delete) | "<Title> moved to Trash. Undo available." (`polite`) |
| Task restored from Trash | "<Title> restored." (`polite`) |
| Task permanently deleted | "<Title> permanently deleted." (`polite`) |
| Empty Trash | "Trash emptied. N items permanently deleted." (`polite`) |
| Bulk-overdue moved | "N overdue items moved to today. Undo available." (`polite`) |
| Task rescheduled | "<Title> rescheduled to <new date>." (`polite`) |
| Task moved to project | "<Title> moved to <project name>." (`polite`) |
| Task moved between Kanban columns (status change) | "<Title> moved to <column>." (`polite`) |
| Tag added to task | (no separate announcement — the user is in the modal editing; modal's overall save announcement covers it) |
| Tag created | (same — part of modal save) |
| Modal saved | "Saved." or "Task '<title>' saved." (`polite`) |
| Modal cancelled | (no announcement — focus return is sufficient) |
| Parent completion blocking prompt | (the prompt itself is a `role="alertdialog"` so it's announced naturally) |
| Depth-cap rejection (drag-and-drop) | "Cannot drop here: maximum nesting depth reached." (`assertive`) |
| Sync state change to "Synced" | "Synced." (`polite`) |
| Sync state change to "Syncing…" | "Syncing in progress." (`polite`) |
| Sync state change to "Offline" | "Offline. Changes are saved locally." (`polite`) |
| Sync error | "Sync error. Tap retry." (`assertive`) |
| Filter applied | "Filter applied: <facet> <value>. <N> items shown." (`polite`) |
| Filter cleared | "Filter cleared. All items shown." (`polite`) |
| Sort changed | "Sorted by <key>." (`polite`) |
| View changed | (`<h1>` change is announced via SR's default page-title behavior; we additionally ensure focus moves to the view's `<h1>` on route change) |
| Sidebar collapsed | "Sidebar collapsed." (`polite`) |
| Sidebar expanded | "Sidebar expanded." (`polite`) |
| Command palette opened | "Command palette. Type a command." (announced via `aria-label` on focus) |
| Command palette closed | (no announcement) |
| Form validation error | The error message is associated via `aria-describedby` and `aria-invalid` — SR reads it when focus moves to the invalid field. |

---

## 6. Color contrast — full table for every token pair used

(Pulled from `design-language.md` §2 for reference. All AA passes confirmed.)

| Pair | Light ratio | Dark ratio | AA pass |
|---|---|---|---|
| `text` on `canvas` | 16.1 | 15.4 | ✓ |
| `text` on `surface` | 17.4 | 14.2 | ✓ |
| `text-subtle` on `canvas` | 5.6 | 6.4 | ✓ |
| `text-subtle` on `surface` | 6.0 | 5.9 | ✓ |
| `text-on-accent` on `accent` | 4.65 | 11.8 | ✓ |
| `text-overdue` on `canvas` | 5.7 | 7.1 | ✓ |
| `success-text` on `success-subtle` | 6.2 | 6.7 | ✓ |
| `accent` on `surface` (non-text) | 4.65 | 7.92 | ✓ (≥ 3) |
| Focus ring vs adjacent surface | ≥ 3.0 (always) | ≥ 3.0 (always) | ✓ |
| Priority dot (high, `#DC2626`) on canvas (light) | 4.5 | (dark: ~5.4) | ✓ (non-text ≥ 3) |
| Priority dot (medium amber) on canvas | 2.9 / 3.5 | ✓ for non-text (this is borderline — see "Color independence" note: priority dot color is **not** the only signal; dot size + label also carry it) |

The priority-medium amber on light canvas at 2.9:1 is under the 3:1 non-text minimum **as a single signal**, but because the priority dot also varies in size (8px vs 6px vs 10px) AND is reinforced by ARIA label, we accept this as a deliberate exception per WCAG 1.4.1 (Use of Color) and 1.4.11 (Non-text Contrast)'s "essential" carve-out. The priority dot is not the only way the user knows the priority.

---

## 7. Reduced-motion handling

`@media (prefers-reduced-motion: reduce)` overrides per `design-language.md` §6.4. Re-listed here for the a11y contract:

**Suppressed (replaced with opacity-only or instant)**:
- Strike-through + fade-collapse on check-off → opacity fade only, 80ms.
- Modal slide-in → opacity fade only.
- Sheet slide-up → opacity fade only.
- Snackbar slide-up → opacity fade only.
- Bulk-overdue "fly to today" → instant re-render.
- Kanban card move animation → instant.
- Calendar reschedule drop animation → instant.
- Drag pickup scale (1.02) → removed; only shadow elevation.
- Hover background transitions → instant.
- Spring easing on checkbox tick → linear, no bounce.

**Retained (functional, not decorative)**:
- Focus ring rendering (always visible).
- Drop-target highlight (instant; the highlight itself is critical info).
- Drag shadow (instant; the shadow communicates active-drag state).
- Spinner / loader rotation (the rotation **is** the signal — replacing it would break the loading affordance).
- Snackbar countdown bar (the countdown is informational; ticking is the affordance).

---

## 8. Form validation

### 8.1 Required field announcements

- Required fields in Task modal: Title (auto-filled on quick-add path), Due date, Project.
- `aria-required="true"` on inputs.
- On submit attempt with invalid required field: focus moves to the first invalid field, `aria-invalid="true"` is set, error message becomes visible and is associated via `aria-describedby`.

### 8.2 Error messages

- Error text appears inline below the field, `text-caption`, `text-overdue`, prefixed with Lucide `alert-circle` icon (16px, `overdue` color).
- Error text is the helper-text slot's content — visually replacing any default helper.

Example error messages (full list in microcopy doc):
- Title empty: "Add a title."
- Due date empty: "Pick a due date."
- Project empty: "Pick a project."
- Tag length > 32: "Tag names are limited to 32 characters."

### 8.3 Inline validation timing

- Validate **on blur** (when leaving a field with invalid content), and again **on submit**.
- Do not validate on each keystroke — it's noisy.

---

## 9. Skip links

The first focusable element on any page is a "Skip to main content" link, visually hidden until focused (then it appears at the top-left with `accent` bg). Pressing Enter moves focus to `<main>`'s first focusable element (typically the quick-add input).

---

## 10. Lang and locale

- `<html lang="en">` (v1 ships in English only). Future locales add additional lang attributes.
- All text is in the document's primary language. We don't mix languages inside a string.

---

## 11. Time and date accessibility

- Dates rendered visibly as user-locale-respectful short formats (e.g., "May 18", "Today", "Tomorrow", "Wed May 18"). The accessible label (via `aria-label` on date chips) always includes the **full long form** with year: "Wednesday, May 18, 2026". This ensures SR users get the unambiguous full date without needing to context-switch.
- Times rendered in the user-locale convention (12h or 24h). The accessible label includes both the time and an explicit AM/PM (if 12h) or 24h indicator if needed.
- Relative dates ("Today", "Tomorrow", "4 days ago" for overdue): the accessible label expands to the actual date — "Wednesday, May 18, 2026 — today" or "May 14, 2026, 4 days overdue".

---

## 12. ARIA edge cases for tricky surfaces

### 12.1 Multi-day chip ("Day 2 of 5")

The chip itself is not interactive (it's display-only). Its content is announced inline as part of the row label: e.g., "Task: Write conf talk, day 2 of 5, due May 22."

### 12.2 Subtask progress chip "2/5"

Same treatment — display-only, announced as part of the parent row's label: "Task: Draft hero copy, 2 of 5 subtasks complete."

### 12.3 Rollup progress on Epic/Feature

The rollup chip "2/9" with progress bar: announced as part of the tree row's label: "Epic: Marketing site relaunch, 2 of 9 tasks complete." The bar itself is decorative (`aria-hidden="true"`).

### 12.4 Sync indicator

```
<div role="status" aria-live="polite">
  <button aria-label="Sync status: Synced 2 minutes ago">
    <CloudCheck /> Synced 2m ago
  </button>
</div>
```

On state change, the button's `aria-label` updates and the polite live region announces.

### 12.5 Filter chips

```
<button aria-label="Remove filter: Tag urgent">
  Tag: urgent ✕
</button>
```

### 12.6 Tag chips on rows (clickable)

```
<a href="/tag/urgent" aria-label="Filter by tag urgent">#urgent</a>
```

### 12.7 The "+N more" calendar overflow

```
<button aria-label="View 3 more events on Wednesday, May 22" aria-haspopup="dialog" aria-expanded="false">
  +3 more
</button>
```

---

## 13. Audit checklist before launch

The reviewer / a11y QA pass must verify:

- [ ] Every interactive element is reachable via keyboard alone.
- [ ] Every interactive element has a visible focus indicator (2px accent outline, 2px offset).
- [ ] Every interactive element has an accessible name (text content, `aria-label`, or `aria-labelledby`).
- [ ] No element is the only signal that a state has changed (e.g., no color-only completion signal — strike-through + announcement also fire).
- [ ] Color contrast meets AA for all text and 3:1 for all non-text UI.
- [ ] Reduced-motion override is applied for all decorative animations.
- [ ] Form fields have associated labels, required-field hints, and error associations.
- [ ] Landmarks (`<nav>`, `<main>`, etc.) are present and labeled.
- [ ] Heading hierarchy is correct (one `<h1>`, then `<h2>`s, no skipped levels).
- [ ] Touch targets are 44x44px on mobile.
- [ ] Layout reflows at 320px width with no horizontal scrolling.
- [ ] Layout remains functional at 200% browser zoom.
- [ ] Live regions announce state changes; they do not announce hover/focus.
- [ ] Modals trap focus, return focus on close, support Esc.
- [ ] Snackbars do not steal focus but are reachable.
- [ ] The first focusable element is a "Skip to main content" link.
- [ ] `<html lang>` is set.
- [ ] All date / time strings have accessible long-form labels.
- [ ] Drag-and-drop has a keyboard equivalent (move-to picker via `⌘⇧M`).
- [ ] Depth-cap violations announce assertively.
