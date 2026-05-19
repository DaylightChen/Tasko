---
title: Tasko — Interaction Patterns
date: 2026-05-18
phase: ux
scope: project
status: draft
---

# Tasko — Interaction Patterns

Cross-cutting interaction rules — the ones that span surfaces. The component inventory describes per-component behavior; this doc describes the **policies and conventions** that apply across the product.

These rules are binding contracts. A surface that breaks one of them is a bug, not a creative liberty.

---

## 1. Drag-and-drop rules

### 1.1 What's draggable, from where to where

| Item type | Draggable from | Draggable to |
|---|---|---|
| Task (in any list view) | Today list, Inbox list, project list (flat or tree), per-tag list, Calendar event chip, Kanban card | Re-order within view; calendar cell (reschedule); Kanban column (status mutate); sidebar project row (move to project); sidebar folder header (move to that folder's project picker — opens picker); tree row Feature (re-parent) |
| Epic | Project tree (top-level Epic row) | Re-order within project (other Epics at same level); not draggable across projects in v1 (move via picker) |
| Feature | Project tree (under an Epic) | Re-order within Epic; drag to another Epic in same project (re-parent); drag to project root (re-parent to top level) |
| Subtask | Within Task modal only | Re-order within parent Task's subtask list |
| Project | Sidebar projects section | Re-order within section; drop on a folder header (move into folder); drop on the top-level area (move out of folder) |
| Folder | Sidebar folders | Re-order folders within the section. Folders are one level deep — cannot contain other folders. |
| Calendar event chip | Day cell or week-view time block | Another day cell (reschedule); within week view, vertical drag changes time |
| Kanban card | Column body | Another column (status mutate); within column (reorder); cannot drag out of Kanban view (post-v1 may allow card → sidebar project to move project) |

### 1.2 Ghost behavior

- On drag start: an `elevation-drag` shadow appears on a near-replica of the source item, scaled 1.02 with opacity 0.95. The ghost follows the pointer.
- The source row dims to opacity 0.4. A faint pulsing placeholder rectangle replaces it during drag (`accent-subtle` tint, `motion-medium` cycle).
- For multi-day spans in the calendar: the entire bar lifts and follows as a single drag entity (not split into 5 chips).
- Reduced-motion: no 1.02 scale on ghost; no placeholder pulse; shadow alone communicates the lift.

### 1.3 Drop target highlighting

- Hovered drop zones (kanban column body, sidebar folder, calendar cell, tree-row parent, task list insert position) render:
  - bg=`accent-subtle`,
  - dashed `accent` outline 2px.
- For drop-position indicators (between two existing items): a 2px solid `accent` horizontal line at the insertion point.
- For collapsed containers (tree node, sidebar folder): hovering with the ghost for 300ms auto-expands the container so the user can drop into a nested target.
- Auto-expand is cancelled if the ghost leaves the container before 300ms.

### 1.4 Depth-cap validation visualization

- A drop that would create > 4 levels (Epic → Feature → Task → Subtask) is rejected:
  - The hover outline becomes `overdue` solid 2px instead of `accent` dashed.
  - The cursor changes to `no-drop`.
  - Releasing does nothing.
  - A snackbar (assertive) appears: "Can't move there: would exceed nesting depth."

The depth-cap constraint also applies to the move-to picker (`⌘⇧M`): invalid destinations are disabled in the suggestion list with a small "too deep" annotation.

### 1.5 Auto-scroll near viewport edges

- When the drag ghost is within 40px of the viewport's top, bottom, left, or right edge, the relevant scroll container scrolls in that direction at a velocity proportional to proximity:
  - 40-30px proximity → slow scroll.
  - 30-15px → medium.
  - 15-0px → fast.
- This applies to the sidebar (vertical scroll), main view (vertical scroll), and kanban board (horizontal scroll for the column row).

### 1.6 Cancel via Esc

- Pressing Esc during a drag cancels the drag — ghost disappears, source row returns to opacity 1.0, no state mutation.
- A `polite` live region announces "Drag cancelled."

### 1.7 Live announcements during drag

- On drag start: "Dragging '<Title>'. Drop on a project, folder, or feature." (`polite`)
- On hover over valid target: "Drop on <target name>." (announced once per target, throttled)
- On hover over invalid target: "Cannot drop on <target name>: would exceed nesting depth." (`polite`)
- On drop success: "Dropped onto <target>."
- On drop reject (depth cap): assertive announcement as above.

---

## 2. Hover affordances

The product surfaces hidden affordances on hover. The rule is: **hover never adds new content; it only reveals controls that were already implicitly present.**

| Surface | Hover reveals |
|---|---|
| Task list row | ⋯ icon button (right side, before Open chevron); "Open" chevron (right edge); on mobile (long-press) → multi-select mode |
| Tree row | Same as task list row + "+ Add Feature" / "+ Add Task" on parent containers |
| Kanban card | (No hover affordances — cards are already concise; click opens modal) |
| Sidebar folder header | ⋯ icon button (right side) |
| Sidebar project row | ⋯ icon button (right side) |
| Sidebar smart list / system view | (No hover affordances — these aren't editable) |
| Trash row | Restore icon ↩, Delete-forever icon ✕ (these are always visible, not hover-only — they're the row's primary actions in Trash) |
| Calendar event chip | (No hover affordances beyond a subtle bg shift to `canvas-subtle` indicating clickability) |
| Calendar day cell | "+N more" appears at the bottom when overflow exists — that's always visible, not hover; on hover the cell tints slightly to indicate "click to focus/open" |
| Filter chip | X icon visible on hover (or always on touch); chip itself dismissable on click |
| Tag chip on row | (No hover affordances; click navigates) |
| Subtask row in Task modal | Drag handle (left), Delete X (right) |

### 2.1 Hover timing

- Tooltips appear after **500ms hover**.
- Hover affordances (⋯, Open chevron) appear **instantly** on hover-in.
- Hover affordances disappear with a **120ms grace period** on hover-out — so the user can move from row to the ⋯ icon without it vanishing.

### 2.2 Touch devices

- No hover state on touch — affordances that were hover-only on desktop must have a touch equivalent.
- For task rows on mobile, the equivalent is: tap the row → opens modal (no ⋯ menu); swipe-left → reveals action drawer; long-press → enters multi-select.

---

## 3. Selection model

### 3.1 Single-select (default)

- Clicking a row selects it (visually: `accent-subtle` bg).
- Clicking another row clears the previous selection and selects the new one.
- Clicking outside any row in a view clears selection.
- Esc clears selection.

### 3.2 Multi-select (gated)

Multi-select is **explicitly entered**, not implicit. Users don't accidentally end up in multi-select.

#### Desktop multi-select

| Action | Effect |
|---|---|
| Click row | Single-select (replaces previous). |
| Shift+click row | Extends selection from the previously selected row to this row (range, contiguous). Enters multi-select if not already in. |
| ⌘+click (Mac) / Ctrl+click (Win) row | Toggles this row in the current selection (non-contiguous). Enters multi-select if not already in. |
| ⌘A / Ctrl+A | Select all rows in the current view. Enters multi-select. |
| Esc | Clears selection, exits multi-select. |

When 2+ rows are selected, a **bulk-actions toolbar slides in at the top of the view** (above the quick-add bar, below the view title):

```
+---------------------------------------------------------------+
|  4 selected · Move to… · Delete · Mark complete · Cancel       |
+---------------------------------------------------------------+
```

Toolbar buttons:
- **Move to…** — opens move-to picker (typeahead, lists projects).
- **Delete** — soft-delete all to Trash (with confirmation if 5+ items).
- **Mark complete** — check-off all (with parent-completion prompt aggregated if applicable).
- **Cancel** — exit multi-select.

#### Mobile multi-select

| Action | Effect |
|---|---|
| Long-press (300ms+) row | Enters multi-select; row is selected. Other rows show selection checkboxes. |
| Tap rows (in multi-select) | Toggle selection. |
| Tap "Cancel" in top bar | Exit multi-select. |
| Tap outside any row | (No-op — to prevent accidental loss of selection on a small screen.) |

### 3.3 What's multi-selectable

- Task list rows in flat views (Today, Tomorrow, Next 7 Days, Inbox, All, per-project flat, per-tag, Completed).
- Tree rows (with restrictions — bulk-selection across types is disabled; you can't multi-select an Epic with a Task).
- Kanban cards within a single column.
- Trash items.

### 3.4 What's NOT multi-selectable

- Calendar event chips (per spec — calendar drag-reschedule is per-item).
- Sidebar items (projects, folders, tags) — these aren't bulk-operable in v1.
- Subtasks (only inside a single Task modal — no need for bulk).

### 3.5 Selection persistence

- Selection clears on:
  - Pressing Esc.
  - Clicking "Cancel" in the toolbar.
  - Navigating to a different view.
  - Reloading the page.
- Selection persists across:
  - Sort/filter changes within the same view (selected rows that no longer match filter become hidden but stay in the selection set — when filter clears, they re-appear selected).

---

## 4. Keyboard shortcuts master table

(Full table — referenced in accessibility.md, restated here for ease.)

### 4.1 Global (always available)

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘\` / `Ctrl+\` | Toggle sidebar |
| `⌘Z` / `Ctrl+Z` | Undo most recent action (within snackbar window) |
| `⌘⇧Z` / `Ctrl+Shift+Z` | Focus most recent snackbar's action button |
| `⌘F` / `Ctrl+F` | (No global search.) Shows transient toast "Use ⌘K to navigate." |
| `?` | Toggle keyboard shortcuts help overlay |

### 4.2 Mode: no input focused (single-key navigation)

| Shortcut | Action |
|---|---|
| `T` | Go to Today |
| `I` | Go to Inbox |
| `N` | Focus quick-add input |
| `/` | Focus quick-add input (alternative) |
| `J` / `↓` | Move focus down in list |
| `K` / `↑` | Move focus up in list |
| `H` / `←` | Move focus left in grid |
| `L` / `→` | Move focus right in grid |
| `Space` | Toggle checkbox on focused row |
| `X` | Toggle complete on focused row (alternative; matches Kanban convention) |
| `Enter` / `O` | Open modal for focused row |
| `1` / `2` / `3` / `4` | Set priority on focused row |
| `T` | Schedule focused row to today |
| `Backspace` / `Delete` | Soft-delete focused row (with confirmation) |
| `Esc` | Cancel current operation |

### 4.3 Mode: input focused

- Most single-keys are typed into the input.
- `Esc` blurs the input.
- `Tab` / `Shift+Tab` cycle to next focusable.
- `Enter` triggers the input's submit behavior (e.g., quick-add → opens modal; tag input → commits typed value).

### 4.4 Mode: modal / sheet open

| Shortcut | Action |
|---|---|
| `Tab` / `Shift+Tab` | Cycle fields (focus trapped) |
| `Esc` | Cancel — close modal (with guard if dirty) |
| `⌘Enter` / `Ctrl+Enter` | Save |
| `⌘S` / `Ctrl+S` | Save |

### 4.5 Mode: row context, with row selected (single or multi)

Single-row selected:

| Shortcut | Action |
|---|---|
| `⌘⇧M` / `Ctrl+Shift+M` | Open Move-to picker |
| `Enter` / `O` | Open modal |
| (others as in 4.2) | |

Multi-row selected: same plus toolbar actions are keyboard-accessible via Tab.

### 4.6 Mode: command palette open

| Shortcut | Action |
|---|---|
| `↑` / `↓` | Navigate results |
| `Enter` | Select |
| `Esc` | Close |
| `Tab` | Move from input to results (alternative to ↓) |

### 4.7 Mode: calendar focused

| Shortcut | Action |
|---|---|
| `← →` | Navigate days |
| `↑ ↓` | Navigate weeks |
| `Page Up` / `Page Down` | Previous/Next month |
| `Shift+Page Up` / `Page Down` | Previous/Next year |
| `T` | Jump to today |
| `Home` / `End` | Start / end of week |
| `Enter` | Open day-detail popover |
| `N` | New task on focused day |

### 4.8 Mode: kanban focused

| Shortcut | Action |
|---|---|
| `↑` / `↓` | Reorder card within column |
| `←` / `→` | Move card to previous/next column (status mutate) |
| `Enter` / `O` | Open modal |
| `Space` / `X` | Toggle complete |

### 4.9 Mode: tree focused

| Shortcut | Action |
|---|---|
| `↑` / `↓` | Move focus to previous/next visible row |
| `←` | Collapse, or move to parent if already collapsed |
| `→` | Expand, or move to first child if already expanded |
| `Enter` / `O` | Open modal |
| `Space` | Toggle checkbox (Tasks only) |

### 4.10 Mode: tag input focused

| Shortcut | Action |
|---|---|
| `↓` | Open / move into suggestions |
| `↑` (at top of suggestions) | Return focus to input |
| `Enter` / `,` | Commit current input value (select matched or create new) |
| `Backspace` (on empty input) | Remove last chip |
| `Tab` | Move out without committing |
| `Esc` | Close suggestions |

### 4.11 Mode: date picker focused

| Shortcut | Action |
|---|---|
| `← →` | Day |
| `↑ ↓` | Week |
| `Page Up` / `Page Down` | Month |
| `Shift+Page Up` / `Page Down` | Year |
| `Home` / `End` | Start / end of week |
| `Enter` | Select |
| `Esc` | Close |
| `t` | Quick: today |
| `m` | Quick: tomorrow |
| `w` | Quick: next week |
| `n` | Quick: no date (if field is optional) |

### 4.12 Conflict resolution

The hybrid system means single-key letters (`T`, `I`, `N`, `O`, etc.) and modifier-combos (`⌘K`, `⌘⇧M`) coexist by mode:

- **Single-keys** only fire when no input is focused. They are suppressed if focus is in a text input, textarea, or contenteditable.
- **Modifier-combos** always fire (with the exception of intra-input combos like `⌘B` in a textarea — `⌘B` triggers markdown bold, NOT some app-level shortcut).
- `⌘K` in a textarea triggers the markdown link helper. Outside a textarea, `⌘K` opens the command palette. The user gets contextual behavior.

---

## 5. Modal stacking policy

**One modal open at a time.** Per spec §7.11 and the locked decisions.

- Opening a new modal when one is already open:
  - If the open modal is in a clean state (no dirty fields): close it silently, open the new one.
  - If the open modal is dirty: show the "Discard changes?" guard (§14.6 in component inventory). User picks Discard or Keep editing.
    - On Discard: close the prior modal, open the new one.
    - On Keep editing: cancel the new-modal-open request entirely.
- A confirmation prompt opened **from** another modal (e.g., Delete confirmation triggered from the Edit Task modal) is the one allowed stacking. The confirmation appears on top of the underlying modal, but it's a small confirmation dialog (§37 in inventory) — not a full modal. The underlying modal is dimmed slightly. On confirmation close, the underlying modal regains focus.
- Snackbars are not modals — they coexist with modals.
- The command palette is treated as a modal (it traps focus). Opening it from within another modal triggers the same Discard-changes guard.

---

## 6. Loading / error / optimistic-update conventions

Tasko is **local-first** with **background cloud sync**. The interaction model assumes the local store is the source of truth at write-time; sync is a separate concern that catches up asynchronously.

### 6.1 Default: optimistic update

- User performs an action (check off task, edit title, drag-reschedule).
- The UI updates **immediately** — no spinner, no waiting.
- The local store commits the change synchronously (or as good as).
- A background sync request fires.
- The user moves on, unaware of the sync.

### 6.2 Sync state indicator

A small row at the bottom of the sidebar (§42 in inventory) shows the current sync state:

- **Synced just now** / **Synced 2m ago** — calm, green-ish (`success` icon).
- **Syncing…** — gentle rotating icon.
- **Offline. Changes saved locally.** — `cloud-off` icon, no alarm.
- **Sync error. Tap to retry.** — `alert-circle` icon, `overdue` color.

This is a **calm-not-cold** indicator. It doesn't punish the user for being offline; it tells them what's happening.

### 6.3 Loading states (when local-first can't paint instantly)

- **Initial app boot** — show skeleton loaders (§36 in inventory) on the view that's loading. Skeletons appear if the load exceeds **300ms**; faster than that, no skeleton (would flash).
- **Navigating to a project with 500+ items** — virtualization handles it; visible rows render instantly, off-screen rows render as the user scrolls. No spinner.
- **Tree expansion of a deep node** — if the node has > 50 children, show inline spinner for 100ms+ until children render.

Spinners are sparing. The local-first ethos is: if there's a spinner, something is genuinely slow, and that's a bug.

### 6.4 Errors (sync rollback)

When an optimistic write fails on the sync round trip and the server rejects it:

1. The local store rolls back the change.
2. The row briefly tints `overdue-subtle` (~600ms) to indicate the visual revert.
3. A snackbar (assertive) appears: "Couldn't save. Try again." with no auto-undo (the action is already reverted; "Try again" is the path forward — clicking re-applies the write).

If rollback would lose user input that's hard to reconstruct (e.g., a long Notes edit), the snackbar's "Try again" stays available for longer (10s vs 5s) and the row's data is restored from before the rejected write.

### 6.5 Sync conflict (engineering owns the resolution semantics)

Per spec §7.2, conflict resolution is engineering's call. From the UX side:

- **Non-conflicting concurrent edits** (e.g., user changes title on device A, user changes priority on device B): both writes merge silently. The user sees both effects when they next view the item.
- **Conflicting concurrent edits** on the same field: engineering picks a strategy (last-write-wins, CRDT, manual conflict UI). UX commits that:
  - If a write is dropped, the user is informed via a non-blocking snackbar: "Changes from another device overwrote your edit. Tap to view."
  - If both writes are merged successfully, no notification is needed.

### 6.6 Offline behavior

- All read operations work offline (data is local).
- All write operations work offline (writes go to local store, sync queue queues the change for when network returns).
- The sync indicator shows "Offline. Changes saved locally." — calm, neutral.
- When network returns, the queue replays. Each successful sync may or may not trigger a snackbar — by default, no snackbar (silence is the goal). If there were errors in the replay queue (e.g., the server rejected something), a snackbar surfaces.

---

## 7. Animation token reuse

Animation choices map to specific tokens. The map is authoritative; new motion must reuse a token, not invent one.

| Motion | Duration token | Easing token | Reduced motion fallback |
|---|---|---|---|
| Checkbox tick (visual draw) | `motion-fast` | `ease-spring-soft` | Linear, no bounce |
| Strike-through draw on row | `motion-base` | `ease-standard` | Opacity-only, `motion-instant` |
| Fade-and-collapse on completion | `motion-medium` | `ease-accelerate` | Opacity-only, `motion-instant` |
| Snackbar slide-up | `motion-medium` | `ease-decelerate` | Opacity-only |
| Snackbar slide-down (auto-dismiss) | `motion-medium` | `ease-accelerate` | Opacity-only |
| Modal open (backdrop + content) | `motion-medium` | `ease-decelerate` | Opacity-only |
| Modal close | `motion-fast` | `ease-accelerate` | Opacity-only |
| Sheet open (mobile, slide-up) | `motion-medium` | `ease-decelerate` | Opacity-only |
| Sheet close | `motion-fast` | `ease-accelerate` | Opacity-only |
| Sidebar collapse/expand (width transition) | `motion-base` | `ease-standard` | Instant |
| Sidebar item selection bg | `motion-fast` | `ease-standard` | Instant |
| Row hover bg | `motion-fast` | `ease-standard` | Instant |
| Drag pickup (shadow + scale) | `motion-fast` | `ease-decelerate` | Shadow only, no scale |
| Drag release / snap | `motion-base` | `ease-standard` | Instant snap |
| Drop-target highlight | `motion-fast` | `ease-standard` | Instant |
| Bulk-overdue "fly to today" | `motion-slow` | `ease-standard` | Instant re-render |
| Kanban card move (column swap) | `motion-base` | `ease-standard` | Instant reflow |
| Tree node expand/collapse | `motion-base` | `ease-standard` | Instant |
| Calendar reschedule drop animation | `motion-base` | `ease-standard` | Instant snap |
| View transition (sidebar → main route change) | `motion-fast` | `ease-standard` | Instant |
| Mobile swipe-drawer reveal | `motion-fast` | `ease-standard` | Instant |
| Filter chip dismiss | `motion-fast` | `ease-accelerate` | Instant |
| Skeleton shimmer | `motion-slow` cycle | `ease-standard` | Static (no shimmer) |
| Theme switch (system → app re-paint) | `motion-fast` | `ease-standard` | Instant |
| Validation error inline appear | `motion-fast` | `ease-decelerate` | Instant |

All durations / easings are defined in `design-language.md` §6. No surface invents its own.

---

## 8. Mobile gestures

### 8.1 Right-swipe-to-complete

- On any task list row, swipe right with finger.
- Threshold: 30% of row width must be exceeded for the gesture to register.
- Below threshold: row snaps back.
- At threshold: checkbox auto-toggles (same behavior as tapping check), then snackbar "Task completed. Undo." appears.
- The right-swipe distance is **not** a continuous progressive reveal — it's a discrete commit at threshold.

### 8.2 Left-swipe-to-action-drawer

- On any task list row, swipe left with finger.
- Reveals a drawer with 2 action buttons: Schedule, Delete (Mail-style).
- Threshold: 50% of row width to "stay open" after release; otherwise snaps back.
- Tap on action: drawer slides closed, action fires.
- Tap outside the row: drawer closes.
- Only one row's drawer can be open at a time — opening another closes the first.

### 8.3 Long-press

- Long-press a row (300ms+) → enters multi-select mode.
- Long-press an icon button → shows its tooltip (since touch has no hover).
- Long-press a sidebar item → (no-op in v1 — reserved for future affordances).

### 8.4 Pull-to-refresh — disabled in v1

- The vertical-swipe-down gesture at the top of a view is **suppressed** in v1.
- Sync is automatic and background — there's no manual refresh affordance.
- The native browser pull-to-refresh is also suppressed at the app surface so it doesn't accidentally trigger a page reload.
- Rationale: pull-to-refresh implies "the data might be stale, refresh it." But our local-first model means data is always live from the local store; the sync indicator handles the rare case of sync failure.

### 8.5 Pinch / zoom

- Pinch-to-zoom is allowed (we don't block it — that's an a11y anti-pattern).
- The app's responsive layout is not designed for zoom > 200% but should remain functional.

### 8.6 Drag on mobile

- Drag-and-drop on touch: a long-press (300ms) initiates drag mode (in place of multi-select on rows that are draggable; the conflict is resolved by **double-tap-and-hold to drag**, distinguishing from long-press-to-select).
- Reality check for v1: drag-on-touch is complex. v1 ships with the **move-to picker** (`⌘⇧M` on desktop, or `⋯ → Move to project…` on mobile) as the canonical re-parent flow. Touch drag is a nice-to-have, deferred unless engineering finds it lightweight.

---

## 9. Empty-state hierarchy

There are three distinct kinds of "nothing to show":

### 9.1 The view is genuinely empty (no items at all)

Use the empty-state component (§35 in inventory) per view. Each view has a tailored headline + subline; see microcopy doc §5.

Example: Inbox with zero items shows "Inbox is clear." / "Quick-add lands here when no project is picked."

### 9.2 The view has items but filters exclude them all

Use a **different** empty-state variant: "No matches." / "Try removing a filter." + a "Clear filters" button. This is critical — it tells the user they have data, just nothing matching, and offers an out.

### 9.3 The view is loading (skeletons)

Use skeleton loaders. After load:
- If real content arrives → fade-in real content.
- If load completed and content is empty → fade to the appropriate empty state.

The user should never see the skeletons followed by a confusing "nothing here?" with no context.

### 9.4 First-run vs returning-user empty

The Today view's empty state has two variants:
- **First-run** (zero tasks ever created in the system + no user projects): the warm-flourish welcome variant.
- **Returning user, just no tasks today**: "Nothing due today. You're caught up. Enjoy the day."

The detection is binary: do they have any user-created task in the system, ever (active, completed, or trashed)? If yes → returning user. If no → first-run.

---

## 10. The "no global search" affordance

Per locked decision: v1 has **no global search**. The command palette (⌘K) is the discoverability story.

Users will press ⌘F / Ctrl+F expecting search. We resolved to:

**Show a small toast on ⌘F / Ctrl+F press:**
- Text: "Use ⌘K to navigate." (terse, instructive, no apology)
- Appears as a transient snackbar variant (3s auto-dismiss, no action button).
- Subsequent ⌘F presses within 60 seconds: silent (no repeat toast — once is enough).

Alternative considered: silently no-op. Rejected because it leaves the user wondering if something's broken. The one-time toast is a lightweight education affordance.

The keyboard shortcut help overlay (`?`) also makes this clear — under GLOBAL, it lists `⌘K  Command palette` and explicitly omits `⌘F`.

---

## 11. Confirmation policy

When should a destructive action prompt for confirmation?

| Action | Confirm? | Why |
|---|---|---|
| Soft-delete a single task (sends to Trash) | Yes | Standard expectation; takes 1 click to confirm. |
| Soft-delete a parent with children | Yes (mentions count) | User should see the blast radius. |
| Bulk soft-delete (multi-select Delete) | Yes (if 5+ items) | 1-4 items: no confirm (Undo via snackbar is enough). 5+: confirm. |
| Permanent delete from Trash (single) | Yes | This cannot be undone. |
| Empty Trash | Yes (with item count) | Heavy action. |
| Complete a parent with incomplete children | Yes (the locked "parent completion blocking" prompt) | User intent ambiguity. |
| Move all overdue to today | Yes (with count) | Bulk operation, blunt instrument. |
| Move task to another project | No | Reversible, snackbar Undo covers it. |
| Reschedule task | No | Reversible. |
| Change priority | No | Reversible. |
| Delete a folder (preserves projects) | Yes | The user should know projects move to top level. |
| Delete a project with tasks | Yes (with task count) | Tasks go to Trash with project; user sees scope. |
| Discard unsaved modal changes | Yes (only if dirty) | Standard guard. |
| Sign out / Reset data | n/a in v1 (no accounts, no data reset surface) | — |

### 11.1 Confirmation defaults

For destructive confirmations:
- Cancel is the initially focused button.
- Esc cancels.
- Primary action requires explicit click or Tab+Enter.

For non-destructive ("Move all overdue", "Complete all and continue"):
- Primary action is initially focused.
- Esc cancels.
- Enter activates primary.

---

## 12. Undo policy

Undo is offered via snackbar for actions that:
1. Are easily reversible (no data loss, just a state flip).
2. Were initiated in one click and might have been mistaken.

| Action | Snackbar undo? | Window |
|---|---|---|
| Task completion | Yes | 5s |
| Soft-delete | Yes | 5s |
| Restore from Trash | No | (the user is in Trash deliberately — re-deleting is fine, undo not needed) |
| Permanent delete | No (no undo possible) | — |
| Empty Trash | No (no undo possible) | — |
| Bulk overdue moved | Yes | 5s |
| Reparent (drag) | Yes | 5s |
| Reschedule (drag in calendar / date chip) | (No snackbar with Undo button, but `⌘Z` works within 5s — Tasko maintains a 1-step undo for any user action) | 5s |
| Move task to project | Yes | 5s |
| Multi-select bulk move | Yes | 5s |
| Multi-select bulk complete | Yes | 5s |
| Folder rename | Yes via `⌘Z` (no visible snackbar — too noisy) | 5s |
| Project rename | Yes via `⌘Z` | 5s |
| Sort/Filter changes | No (changing them back is the undo) | — |
| Settings changes (theme, week-start) | No (changing them back is the undo) | — |

### 12.1 `⌘Z` global undo

Tasko maintains a **single-step undo history** for the most recent user action, regardless of whether a snackbar surfaced it. Pressing `⌘Z` within 5 seconds of the action reverses it.

Multi-step undo (5-10 step history) is **post-v1**.

---

## 13. Optimistic update edge cases

Some user actions trigger cascading state changes. The optimistic pattern still applies, but with care:

### 13.1 Completing a recurring task → auto-generating next instance

- Optimistic: user checks off recurring task.
- Local store: marks current instance done, generates next instance with new date.
- UI: row disappears from active view; if next instance is today, it appears in Today (rare); otherwise, the user's view updates without the task; sidebar counts update.
- Snackbar: "Task completed. Next: <date>." — provides confirmation that the recurrence advanced.
- On sync error rollback: local rolls back both the completion AND the new instance. Snackbar: "Couldn't save. Try again."

### 13.2 Soft-deleting a parent with children

- Optimistic: parent + all descendants get `trashed_at` stamped in one atomic local operation.
- UI: parent row + visible descendants all collapse.
- Snackbar: "<Title> and N items moved to Trash. Undo."

### 13.3 Bulk operations (multi-select)

- Optimistic: all selected rows' changes apply locally in one operation.
- UI: rows animate out (or update) together.
- Snackbar: "<N> tasks <action>. Undo." with appropriate verb.
- On rollback: all rows restore; snackbar "Couldn't save. Try again." replaces.

---

## 14. Right-click context menus

A right-click (or two-finger tap on touch trackpad) on certain surfaces opens a context menu:

| Surface | Menu items |
|---|---|
| Task list row | Open, Edit tags, Move to project…, Reschedule (date submenu), Set priority (priority submenu), Duplicate (disabled in v1), Delete |
| Tree row (Task) | Same as above + Move to parent… |
| Tree row (Epic / Feature) | Open, Rename, Add Feature / Add Task (depending), Mark complete, Move (to parent), Delete |
| Kanban card | Same as Task list row |
| Sidebar Project | Rename, Move to folder, Toggle hierarchical, Delete project |
| Sidebar Folder | Rename, Delete folder, New project in folder |
| Sidebar Inbox | (Disabled — Inbox is immutable) |
| Sidebar Tag | (Disabled in v1 — no tag management UI) |
| Calendar day cell | New task on this day |
| Calendar event chip | Open, Edit date…, Move to project…, Delete |
| Trash row | Restore, Delete forever |

Context menus follow the Dropdown component (§8). Keyboard equivalent on row: `Menu` key or `Shift+F10`.

---

## 15. Bottom-edge interaction policy (mobile)

The bottom 56px of the mobile viewport is dedicated to the bottom nav. The 16px above it is reserved as a snackbar landing zone. Content does not interact below the snackbar zone — any scrollable content stops at the nav top edge.

Swipe gestures on rows must not be confused with the bottom-nav gesture; the bottom nav has its own touch zones.

---

## 16. Inline-vs-modal editing summary

Per locked decision, Linear/Things-style inline editing is the default. Modal opens only when the user wants the full editing surface.

| Field | Inline edit | Modal |
|---|---|---|
| Title | Click on title text in row | Yes (modal also supports) |
| Date (single) | Click date chip → date popover | Yes |
| Date (start + due, multi-day) | Click date chip → date popover (allows extending end-date inline; setting a start where there was none requires the modal) | Yes |
| Time | Click time portion of date chip (if present) → time picker; or via date popover | Yes |
| Priority | Click priority dot → priority menu | Yes |
| Tags | ⋯ menu → Edit tags → inline tag input on row | Yes |
| Project | Not inline — opens move-to picker via `⌘⇧M` or right-click "Move to project…" | Yes |
| Notes (markdown) | Not inline — only in modal | Yes |
| Recurrence | Not inline — only in modal | Yes |
| Subtasks | Not inline (Subtasks are a Task modal affair) | Yes |

The principle: **simple fields edit inline; structured fields edit in modal**.

---

## 17. Touch + pointer hybrid

Many users will have a touch-capable laptop or use a stylus. The product detects input modality at runtime:

- Mouse / trackpad: hover affordances apply.
- Touch (finger): hover affordances do NOT apply; equivalent touch gestures (long-press, swipe) substitute.
- Pen / stylus: treated as pointer with sub-pixel precision; hover applies; swipe gestures recognize.

Engineering note: rely on `PointerEvent` API to disambiguate. Pure `MouseEvent` / `TouchEvent` paths are fallback only.

---

## 18. Loading and visibility of the sync state

The sync state indicator at the sidebar bottom is **always visible** when the sidebar is expanded. When collapsed (icon-only sidebar), the indicator becomes a single icon at the bottom of the icon list; tooltip on hover shows status.

The indicator NEVER becomes a banner or full-width header. It is intentionally peripheral — sync is background, not foreground.

---

## 19. Open questions for engineering

(Captured for the engineering phase.)

1. **Single-step undo state model**: where does the 5-second-window undo state live (in-memory only, IndexedDB row, sync-aware)? UX commits that `⌘Z` reverses the last user-mutating action; engineering picks the implementation.
2. **Drag-on-touch — is it cheap enough to ship?** If yes, follow §8.6's double-tap-and-hold pattern. If not, the move-to picker is the canonical re-parent on mobile and drag is desktop-only.
3. **Conflict resolution UX surface**: if engineering picks last-write-wins, no UI is needed. If engineering picks "manual conflict UI", we'll need a new modal — out of v1 UX scope until that choice is made.
4. **Sync queue retry strategy**: how aggressive should retries be? UX commits the indicator transitions; the cadence is engineering.
5. **Skeleton thresholds**: 300ms is the design rule, but engineering may find that real local-first loads are always sub-100ms; in that case, skeletons may never appear in v1 (a happy outcome). Don't ship them eagerly.
