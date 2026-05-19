---
title: Tasko — Component Inventory
date: 2026-05-18
phase: ux
scope: project
status: draft
---

# Tasko — Component Inventory

Every reusable UI primitive in v1. Each entry includes purpose, all states (default / hover / focus / active / disabled / loading / error / empty / selected as applicable), keyboard behavior, ARIA roles, and edge cases. Tokens referenced here are defined in `design-language.md`.

Conventions in this doc:
- **Tokens** are wrapped in backticks (e.g., `accent`, `surface`).
- **Visual treatment** is described as token assignments per state.
- **Behavior** lists keyboard, ARIA, and edge cases.

---

## 1. Button

### 1.1 Purpose
The primary action affordance. Used for "Save", "Delete", "Empty Trash", "Create project", etc.

### 1.2 Variants
- **Primary** — `accent` fill, `text-on-accent` text. Used for the most important action in a surface. One primary per surface at rest.
- **Secondary** — `surface` fill, `border` border, `text` text. Default for non-critical actions.
- **Ghost** — transparent fill, `text` text. Used in dense surfaces (toolbars, modal footers' "Cancel").
- **Destructive** — `overdue` (`#DC2626` light / `#EF4444` dark) fill, `text-on-accent` text. Used for permanent delete confirmations only.

### 1.3 Sizes
- **sm** — 28px height, `space-3` (12px) horizontal padding, `text-small-strong`.
- **md** (default) — 36px height, `space-4` (16px) horizontal padding, `text-body-strong`.
- **lg** — 44px height (touch-target minimum on mobile), `space-5` (24px) horizontal padding, `text-body-strong`.

Radius: `radius-sm` (6px) for sm/md; `radius-md` (8px) for lg.

### 1.4 States

| State | Primary | Secondary | Ghost | Destructive |
|---|---|---|---|---|
| Default | bg=`accent`, text=`text-on-accent` | bg=`surface`, border=`border`, text=`text` | bg=transparent, text=`text` | bg=`overdue`, text=`text-on-accent` |
| Hover | bg=`accent-hover` | bg=`canvas-subtle`, border=`border-strong` | bg=`canvas-subtle` | darken 8% |
| Focus | + `focus-ring` 2px outline 2px offset | same | same | same |
| Active (pressed) | bg=`accent-pressed`, scale 0.98 | bg=`canvas`, border=`border-strong`, scale 0.98 | bg=`canvas`, scale 0.98 | darken 12% |
| Disabled | bg=`text-disabled`, text=`text-on-accent` 60% opacity; cursor `not-allowed` | bg=`surface`, border=`border-subtle`, text=`text-disabled` | text=`text-disabled` | same as primary disabled |
| Loading | replace label with 16px Lucide `loader-2` spinning; button still focused; click suppressed | same | same | same |

### 1.5 Keyboard / ARIA
- `role="button"` (native `<button>` recommended).
- `aria-disabled="true"` when disabled (also disables click).
- `aria-busy="true"` when loading.
- Enter and Space activate.
- Tab order: follows DOM order.
- Tooltip: if button has icon only or label needs disambiguation, attach via `aria-label` or `aria-describedby`.

### 1.6 Edge cases
- A primary button that is disabled because a form field is invalid must have its disabled reason surfaced as an `aria-describedby` reference to the invalid field's error message.
- Destructive buttons in a confirmation modal must not be the auto-focused element. Cancel (or a neutral action) holds initial focus.

---

## 2. Icon button

### 2.1 Purpose
A button whose label is a Lucide icon only. Used in row hover (⋯ menu trigger), dismiss (X on filter chip), view toggles, modal close.

### 2.2 Sizes
- **sm** — 28x28px target, 16px icon.
- **md** (default) — 32x32px target, 20px icon.
- **lg** — 44x44px (mobile touch target), 24px icon.

Radius: `radius-sm`. Background transparent at rest; `canvas-subtle` on hover.

### 2.3 States

| State | Visual |
|---|---|
| Default | bg=transparent, icon stroke=`text-subtle` |
| Hover | bg=`canvas-subtle`, icon=`text` |
| Focus | + `focus-ring` 2px outline 2px offset |
| Active | bg=`border`, icon=`text` |
| Disabled | icon=`text-disabled`, no bg change on hover, cursor `not-allowed` |
| Selected (e.g., in view-toggle group) | bg=`accent-subtle`, icon=`accent-on-subtle` |

### 2.4 Keyboard / ARIA
- Native `<button>` with `aria-label="<action>"` always.
- Tooltip recommended on hover (after 500ms delay).
- Enter and Space activate.

### 2.5 Edge cases
- Icon-only buttons in mobile **must** be at least 44x44px touch area, even if the icon itself is 20px.

---

## 3. Text input (single-line)

### 3.1 Purpose
Single-line free text. Used in: quick-add bar, task title in modal, project name, search-like inputs (command palette is one).

### 3.2 Structure
- Optional label above (in `text-small-strong`, `text-subtle`).
- Input field — `surface-sunken` bg, `border` border, `text` text, `text-muted` placeholder.
- Helper text below (in `text-caption`, `text-subtle`).
- Error message replaces helper text when invalid (in `text-caption`, `text-overdue`, prefix Lucide `alert-circle` 16px).

### 3.3 Dimensions
- Desktop: 36px height. Mobile: 44px height.
- Padding: `space-3` (12px) horizontal, vertical centered.
- Radius: `radius-sm`.
- Font: `text-body` desktop, mobile body.

### 3.4 States

| State | Visual |
|---|---|
| Default | border=`border`, bg=`surface-sunken` |
| Hover | border=`border-strong` |
| Focus | border=`accent`, + `focus-ring` 2px outline 2px offset; bg=`surface` |
| Filled (has value) | border=`border`, text=`text` |
| Disabled | bg=`canvas-subtle`, text=`text-disabled`, cursor `not-allowed` |
| Read-only | bg=`canvas`, border=`border-subtle` (still focusable for copy) |
| Error | border=`overdue`, error helper text visible |
| Loading (rare — async validation) | spinner replaces trailing icon |

### 3.5 Keyboard / ARIA
- Native `<input type="text">` with `<label>` association (either wrapping or `for`/`id`).
- `aria-describedby` to helper or error message ID.
- `aria-invalid="true"` when in error state.
- `aria-required="true"` for required fields (title, due date).
- Esc clears focus (only if input is in a modal/popover that consumes Esc — see Modal §16).

### 3.6 Edge cases
- Quick-add bar special: Enter triggers modal-open (per spec §6.1). The input is never submitted on its own.

---

## 4. Textarea (markdown notes)

### 4.1 Purpose
Multi-line free text with markdown support. Used only in the Task modal's "Notes" field.

### 4.2 Modes
- **Edit mode** (default when focused) — plain monospaced-friendly textarea, markdown syntax visible.
- **Render mode** (default when unfocused with content present) — rendered markdown preview.
- Toggling: click anywhere in the rendered preview to enter edit mode. Click outside to commit and re-render. A toolbar toggle ("Edit" / "Preview") exists for explicit control.

### 4.3 Visual
- Min height 88px desktop, 112px mobile. Auto-grows.
- Max height 320px desktop with internal scroll.
- Border, padding, focus same as text input. Font: `text-body` for plain text; rendered markdown uses inline `text-mono` for backticks/code blocks.

### 4.4 States
Same set as text input. Loading state n/a — markdown render is local-synchronous.

### 4.5 Keyboard / ARIA
- `<textarea>` with `aria-multiline="true"` (implicit).
- Tab inserts a tab character only if `shift+tab` is held; otherwise Tab moves focus out (a11y default).
- `⌘B` / `⌘I` / `⌘K` (link): when textarea has focus, these wrap selection with `**`, `*`, `[](url)` respectively. ⌘K conflicts with command palette — in textarea context, ⌘K = link helper. Outside textarea, ⌘K = command palette.
- Markdown shortcuts ([Enter] after `-` continues list, etc.) follow common-practice. Tracked under Open Questions for engineering.

### 4.6 Edge cases
- Rendered markdown checklists (`- [ ] foo`) are display-only — they are not subtasks (per spec §4.3). They render as visual checkboxes but clicking them does nothing.
- Links open in a new tab.
- Pasted images: not supported in v1.

---

## 5. Date picker popover

### 5.1 Purpose
Pick a date. Used in Task modal due/start fields, calendar reschedule, sort-by-date filter.

### 5.2 Trigger
A "date chip" button (see Date chip variants in §10 component below). Clicking it opens the popover anchored beneath.

### 5.3 Structure
- Mini-calendar grid: month header with `< >` arrows; weekday labels (S M T W T F S, respecting `week-start` setting); day grid.
- Quick-select row above the grid: "Today", "Tomorrow", "Next week", "No date" (only if field is optional). Each is a small button.
- Footer: "Clear" (only if field is optional + a value is set), close on outside-click or Esc.

### 5.4 States

| State | Visual |
|---|---|
| Today's date cell | text=`accent`, bordered `border-strong` (visible regardless of selection) |
| Selected date cell | bg=`accent`, text=`text-on-accent` |
| Hover | bg=`canvas-subtle` |
| Focus (keyboard nav) | + `focus-ring` 2px |
| Disabled (e.g., dates before `start_date` for the due field) | text=`text-disabled`, cursor `not-allowed` |
| Out-of-month (previous/next month overflow) | text=`text-muted` |

### 5.5 Keyboard / ARIA
- `role="dialog"` on the popover container.
- `aria-label="Pick a date"`.
- Arrow keys move focus across days (Left/Right by day, Up/Down by week).
- Page Up / Page Down jump by month.
- Shift+Page Up / Page Down by year.
- Home / End jump to start/end of row.
- Enter selects.
- Esc closes without selecting.
- Focus traps inside popover; on close, returns to trigger.

### 5.6 Edge cases
- "Today" highlight is **always** drawn on today's cell, regardless of selection. Lets the user orient.
- If `start_date` is set, dates before it are disabled in the due-date picker.
- Mobile: opens as a bottom sheet (see §16, Sheet), not as a popover anchored to trigger.

---

## 6. Time picker

### 6.1 Purpose
Pick a time-of-day. Used in Task modal `due_time` (optional).

### 6.2 Form
- Two-column scroll wheel: hour (00–23 or 01–12 + AM/PM depending on locale; v1 ships with the device locale's hour convention), minute (00, 15, 30, 45 — 15-min increments).
- A free-text 24h input ("HH:MM") below the wheel allows precise entry.
- "Clear" button to remove the time (item reverts to all-day).

### 6.3 States
Standard input states. Selected cell in the wheel: bg=`accent-subtle`, text=`accent-on-subtle`.

### 6.4 Keyboard / ARIA
- `role="dialog"`.
- Up/Down arrows scrub the focused wheel.
- Tab moves between hour wheel, minute wheel, free-text input, action buttons.
- Esc closes.

### 6.5 Edge cases
- 15-minute granularity is a deliberate constraint. Users wanting "09:07" type it in the free-text field.

---

## 7. Date + time combined picker

### 7.1 Purpose
A combined surface used when the user wants to set both date and time in one motion (the Task modal's due field offers this).

### 7.2 Form
- Date picker on the left.
- Time picker on the right.
- Right side is collapsed by default with an "Add time" toggle ("+" affordance). Clicking expands the time section.
- "All-day" toggle near the time section: when on, time is cleared.

### 7.3 Keyboard / ARIA
- Tab order: quick-select → date grid → time toggle (+ Add time) → time wheel (if visible) → all-day toggle → action buttons.
- All other rules from §5 and §6.

### 7.4 Edge cases
- Removing the time (clicking "Clear time") sets due_time = null without disturbing due_date.

---

## 8. Dropdown / select menu

### 8.1 Purpose
A list of mutually exclusive options. Used in sort dropdown, project picker, recurrence frequency picker.

### 8.2 Structure
- Trigger button (looks like a Secondary button) with chevron-down on the right.
- Menu popover anchored beneath, `elevation-2`, `radius-md`, `surface` bg.
- Each item: 32px row desktop, 44px mobile, with optional left-side icon, label, and optional right-side check or trailing meta.

### 8.3 States

| State | Visual |
|---|---|
| Item default | text=`text`, bg=`surface` |
| Item hover | bg=`canvas-subtle` |
| Item focus | bg=`canvas-subtle`, + `focus-ring` inside row |
| Item selected | text=`text`, check (Lucide `check`) on the right; bg unchanged |
| Item disabled | text=`text-disabled` |
| Menu loading (rare — async fetch of items) | menu shows a centered spinner |
| Menu empty (no options match filter, e.g., typeahead) | helper text "No matches" centered |

### 8.4 Keyboard / ARIA
- `role="combobox"` on trigger if typeahead is supported, otherwise `role="button"`.
- Menu: `role="listbox"` with `role="option"` children.
- `aria-haspopup="listbox"`, `aria-expanded` toggles.
- Arrow keys navigate, Enter selects, Esc closes, Home/End jump.
- First-letter typing jumps to next matching item (typeahead — keep it cheap).
- Focus returns to trigger on close.

### 8.5 Edge cases
- If the menu would render below the viewport, flip it above the trigger.
- Long lists scroll within the menu (max height 320px desktop, ~50% viewport mobile).

---

## 9. Multi-select tag input (chip-style with autocomplete)

### 9.1 Purpose
The Tags field in the Task modal. Allows attaching multiple tags, with autocomplete from existing tags and inline new-tag creation. (Per spec §9.4 #3, this is a dedicated field — `#tag` in title is literal.)

### 9.2 Structure
- A horizontal flow of tag chips (one per selected tag), plus an inline text input that grows.
- Chips: `radius-full`, `tag-bg` bg, `tag-text` text, 24px height. Each chip has a small Lucide `x` (12px) on the right to remove.
- The trailing text input prompts "Add tag…" placeholder. Optional leading `#` is accepted (`urgent` and `#urgent` resolve to the same tag).

### 9.3 Autocomplete behavior
- As the user types, a dropdown appears below the input listing tags whose name contains the typed substring (case-insensitive).
- If no match exists, the dropdown shows a "Create '<typed name>'" row at the bottom.
- Pressing Enter on a matched suggestion selects it; pressing Enter when only "Create '<x>'" is shown creates the new tag and attaches it.
- Selecting a tag adds a chip and clears the input.

### 9.4 States

| State | Visual |
|---|---|
| Default (no chips, focused) | input shows placeholder |
| With chips | chips render left of input; input still focusable |
| Focus | container shows `focus-ring`; dropdown opens on input focus and any keypress |
| Disabled | chips render `text-disabled`; input not focusable |
| Error (e.g., max chips exceeded — not in v1, but reserve) | container border=`overdue`, helper text below |

### 9.5 Keyboard / ARIA
- Container `role="group"` with `aria-label="Tags"`.
- Each chip is a button with `aria-label="Remove tag <name>"` on its X icon.
- Inline input: arrow Down opens dropdown / moves focus into it. Arrow Up at the top of the dropdown returns focus to input.
- Backspace on empty input removes the last chip.
- Enter on input commits the typed value (selects matched or creates new).
- Tab moves out of the field entirely (does not commit).
- Comma key also commits the current input value (in case user prefers).

### 9.6 Edge cases
- **Creating a tag that already exists (case-insensitive)** resolves to the existing tag — does not create a duplicate. Display uses the existing tag's casing.
- **Max tag length** — soft limit 32 chars. Beyond, error message: "Tag names are limited to 32 characters." See microcopy doc.
- Tags can be added to the chip list even if the user later cancels the modal — they are not created in the system until the modal saves.

---

## 10. Priority menu

### 10.1 Purpose
Pick a priority (None / Low / Medium / High). Surfaced inline in task rows (click priority dot) and in Task modal.

### 10.2 Structure
- A small popover with 4 rows: None, Low, Medium, High.
- Each row: priority dot (per `design-language.md` §2.7), label, optional keyboard shortcut hint on the right (e.g., `1`, `2`, `3`, `4`).
- Current selection has a check (`check`) on the right.

### 10.3 Keyboard / ARIA
- Same as Dropdown (§8).
- Single-key shortcuts: `1` = None, `2` = Low, `3` = Medium, `4` = High when the menu is open. Also `1`/`2`/`3`/`4` work as global single-key when no input focused **and** a task row is selected, applying priority to that row.

### 10.4 Edge cases
- The priority dot in row context (see §27, Task list row) is a click-to-edit affordance — clicking opens this menu anchored to the dot.

---

## 11. Checkbox (task row checkbox)

### 11.1 Purpose
Mark a task as done (sets `status = done`, stamps `completed_at`).

### 11.2 Visual
- 20px diameter, `radius-full` (circular).
- Unchecked: 1.5px stroke, `text-subtle` color, `surface` bg.
- Hover: stroke `text`, slight `accent-subtle` bg tint.
- Focus: + `focus-ring` 2px outline 2px offset.
- Checked: filled `success` bg, white `check` glyph (Lucide `check`, 14px, 2px stroke).
- Indeterminate (used for parent items with some-but-not-all subtasks complete — display-only on Tasks, never user-set): 8x2 horizontal bar centered.
- Disabled (e.g., a row deep in completed view that can't be re-checked): stroke `text-disabled`, no hover state.

### 11.3 Keyboard / ARIA
- Native `<input type="checkbox">` with `<label>` association.
- `role="checkbox"`, `aria-checked` reflects state.
- Space toggles. (Tab moves focus to it; the row's keyboard handler also accepts `X` to toggle when the row is "selected" — see Interaction Patterns doc.)
- After check, an `aria-live="polite"` announcement: "<Title> completed. Undo available."

### 11.4 Behavior
On check:
1. 200ms strike-through draws across the title.
2. Row fades to opacity 0 and collapses (~300ms).
3. Bottom-anchored snackbar appears: "Task completed. Undo." auto-dismisses ~5s.
On uncheck (via snackbar or Completed view):
1. Instant revert — no animation. Item reappears in its prior place.

### 11.5 Edge cases
- **Parent completion blocking**: if a parent (Task with subtasks, Feature with child Tasks, Epic with child Features) is checked and has incomplete children, the check is intercepted: show Confirmation prompt (§29) — "Complete all children and continue?" — until user confirms or cancels. If confirmed, all descendants are marked done in the same operation.
- **Recurring item**: check generates the next instance silently. No prompt. (See microcopy doc for the snackbar variant.)

---

## 12. Subtask checkbox (smaller variant)

### 12.1 Purpose
Subtask completion within Task modal.

### 12.2 Visual
- 16px diameter, otherwise identical visual rules to the main checkbox.
- Lives inside the Task modal's subtask list.

### 12.3 Keyboard / ARIA
Same as §11.

### 12.4 Edge cases
- Subtask status is binary `{todo, done}` only — no indeterminate state needed (subtasks have no children).
- Toggling a subtask does **not** trigger a snackbar (the subtask is inside a modal — too noisy).

---

## 13. Card

A generic surface used for kanban cards, project cards (settings or rare collection views), and any "tile" presentation.

### 13.1 Visual
- `surface` bg, `radius-md` (8px), `elevation-1` at rest, `elevation-2` on hover.
- Internal padding: `space-3` (12px).
- Border: `border-subtle` 1px (helps in dark mode where shadows are softer).

### 13.2 States

| State | Visual |
|---|---|
| Default | `elevation-1`, `surface` bg |
| Hover | `elevation-2`, `surface-elevated` bg |
| Focus (keyboard) | + `focus-ring` 2px outline 2px offset |
| Selected (multi-select) | + 2px `accent` left-edge stripe, bg `accent-subtle` |
| Dragging | `elevation-drag`, scale 1.02, slight opacity 0.95 |
| Drop target (under a hovered drag) | dashed `accent` outline 2px |

### 13.3 Keyboard / ARIA
- A card that is itself the interactive surface is `role="button"` with `aria-label` summarizing its content (e.g., "Task: Draft pricing tiers, due tomorrow, medium priority").
- Cards in a kanban column form a `role="listbox"`-like grouping (see kanban card section §28).

---

## 14. Modal (centered, desktop)

### 14.1 Purpose
Editing surfaces that warrant focused attention: New Task / Edit Task, New Project, Confirmation dialogs, Settings (subviews if they grow).

### 14.2 Structure
- Backdrop: `scrim`, fades in `motion-fast`.
- Container: `surface` bg, `radius-lg` (12px), `elevation-3`, centered, max-width 560px (Task modal) or 480px (confirmations).
- Header: title (`text-h1`), close icon button (Lucide `x`) on top-right.
- Body: `space-6` (32px desktop) padding.
- Footer: right-aligned action buttons, secondary on the left of primary.
- Optional "More" disclosure section near the footer for fields that don't need to be visible at first.

### 14.3 States

| State | Visual |
|---|---|
| Open (default) | shown, focus trapped, backdrop visible |
| Opening | scale from 0.96 to 1.0 + slight rise + opacity fade, `motion-medium` `ease-decelerate`. Backdrop fade `motion-fast` |
| Closing | reverse, `motion-fast` `ease-accelerate` |
| Loading inside body (e.g., async save) | submit button enters Loading state (§1.4); body content unchanged |
| Error inside body | inline error message below the relevant field |

### 14.4 Keyboard / ARIA
- `role="dialog"` (or `alertdialog` for confirmations), `aria-modal="true"`, `aria-labelledby="<title id>"`.
- Focus trap inside the modal. On open, focus moves to the **first interactive field** for new-item modals, or to the **primary action button** for confirmation modals. Exception: Task modal opens with focus on the **due-date field** (per spec §6.1 — title is pre-filled).
- Esc closes (cancels). For confirmations with a destructive primary action, Esc still closes (cancel). The primary action is never auto-focused for destructive flows.
- Clicking the backdrop closes (cancels). For modals with unsaved changes, prompt before closing (see §29.3).
- On close, focus returns to the trigger element.

### 14.5 Modal stacking policy
**One modal at a time.** Opening a second modal (e.g., quick-add while a Task modal is open) commits or cancels the prior modal first — show a small prompt "Discard changes?" if the prior modal has unsaved state. (Per spec §7.11.)

### 14.6 Edge cases
- **Unsaved changes guard** — if the modal's form has any dirty field and the user attempts to close, show a tiny inline prompt at the bottom of the modal: "Discard changes?" with [Discard] [Keep editing] buttons. Esc on the prompt cancels the close.

---

## 15. Sheet (slide-up bottom, mobile)

### 15.1 Purpose
The mobile equivalent of Modal. Same content, different transport. Used on phone form factor for Task modal, Confirmation, etc.

### 15.2 Structure
- Anchored to the bottom of the viewport, full width.
- Drag-handle (4px height, 32px width, `border-strong`, `radius-full`) centered at the top.
- Top corners `radius-lg` (12px). Bottom flush with viewport.
- Backdrop: `scrim`.
- Height: content-driven up to 90% viewport. Scrolls internally if content overflows.
- Header, body, footer same as Modal (header keeps title + X; footer pinned to bottom).

### 15.3 States
- Open (resting), Opening (slide-up `motion-medium` `ease-decelerate`), Closing (slide-down `motion-fast` `ease-accelerate`), Dragging-down (follow finger).
- If the user drags the sheet down past 30% of its height, release dismisses; otherwise it snaps back.

### 15.4 Keyboard / ARIA
Same as Modal. The drag-handle is `role="button"` with `aria-label="Drag to dismiss"` (a tap on it also dismisses, in case of accessibility setting).

### 15.5 Edge cases
- When the sheet contains a text input (e.g., new task title), the keyboard pushes the sheet upward — the bottom action buttons must stay visible. Use safe-area-inset-bottom CSS.
- Reduced motion: sheet opens with opacity fade only.

---

## 16. Snackbar

### 16.1 Purpose
Brief, low-attention notification with optional undo. Used for: task completed, task deleted (soft), task restored, bulk-overdue moved, sync state changes, parent-completion confirmation, depth-cap violation feedback.

### 16.2 Structure
- Bottom-anchored, 16px from bottom edge desktop, above bottom nav on mobile.
- Centered horizontally (desktop), full-width minus `space-4` margins (mobile).
- `surface-elevated` bg, `elevation-3`, `radius-md` (8px).
- Content: optional leading icon (16px), message text (`text-body`), trailing action button (text-only, `accent` text, e.g., "Undo").
- Auto-dismiss ~5 seconds (5000ms). Manual dismiss on action click or X icon (if no action).

### 16.3 Variants

| Variant | Leading icon | Action |
|---|---|---|
| Success / completed | Lucide `check-circle-2`, `success` | "Undo" |
| Deleted (soft) | Lucide `trash-2`, `text-subtle` | "Undo" |
| Restored | Lucide `arrow-down-left-from-square`, `text-subtle` | (none) |
| Bulk action | Lucide `archive`, `text-subtle` | "Undo" (if reversible) |
| Sync error | Lucide `alert-circle`, `overdue` | "Retry" |
| Sync state info | Lucide `cloud-check`, `success` | (none) |
| Depth-cap violation | Lucide `alert-circle`, `overdue` | (none) |

### 16.4 States
- Entering: slide-up from below with opacity fade, `motion-medium` `ease-decelerate`.
- Resting: visible with a 5s countdown (subtle 1px linear progress bar at the bottom edge — `text-subtle` — that ticks down, optional).
- Hovered: pause auto-dismiss. Resume on un-hover.
- Action-clicked: dismiss immediately, action handler invoked.
- Exiting: slide-down with opacity fade, `motion-fast` `ease-accelerate`.

### 16.5 Stacking
At most one snackbar visible at a time. If a new one arrives, the previous one finishes its exit animation first (~120ms), then the new one enters. Snackbars do not queue beyond depth 2 — older ones are dropped if a third arrives within 200ms.

### 16.6 Keyboard / ARIA
- `role="status"` with `aria-live="polite"` for normal variants.
- `role="alert"` with `aria-live="assertive"` for error / depth-cap variants.
- Action button is keyboard-focusable; **on mount, focus is NOT stolen** (snackbar is non-interruptive). However, the user can `Shift+Esc` or `Cmd+Shift+Z` to focus the most recent snackbar's action (see Keyboard Shortcuts).
- Esc dismisses the focused snackbar without triggering the action.

### 16.7 Edge cases
- Reduced motion: opacity fade only.
- If the snackbar would overlap a modal/sheet, it floats above the modal's backdrop (z-index higher).

---

## 17. Tooltip

### 17.1 Purpose
A small label that appears on hover/focus of an icon-only or terse control, explaining its purpose.

### 17.2 Visual
- `surface-elevated` bg (or for high contrast, an inverted dark `text` bg + light text — pick one; v1 ships with the `surface-elevated` + 1px `border` variant for parity in light/dark).
- `radius-sm` (6px), `space-2` padding, `text-caption`.
- Drop shadow `elevation-1`.

### 17.3 Behavior
- Appears after 500ms hover or instantly on keyboard focus.
- Dismisses on hover-out or focus-out, with a 100ms grace period.
- Positions: prefers below the trigger; flips to above if no room.

### 17.4 Keyboard / ARIA
- The tooltip itself is announced via the trigger's `aria-describedby` (or `aria-label` if there's no other accessible name).
- Tooltips are **never** the only accessible name for a control — every interactive element has an `aria-label` or visible label too.

### 17.5 Edge cases
- Touch devices: no hover, so tooltips appear on long-press (300ms+). They dismiss on touch-end.

---

## 18. Sidebar nav item

### 18.1 Purpose
A row in the left sidebar pointing to a view (Today, Inbox, project, etc.).

### 18.2 Structure
- Height 32px desktop, 44px mobile.
- Left: optional 20px Lucide icon (`text-subtle`).
- Middle: label (`text-body-strong`, `text`).
- Right: optional count badge `(N)` (`text-small-strong`, `text-subtle`) and overdue sub-badge (see §18.4).

### 18.3 States

| State | Visual |
|---|---|
| Default | bg=transparent, text=`text`, icon=`text-subtle` |
| Hover | bg=`canvas-subtle` |
| Focus | bg=`canvas-subtle`, + `focus-ring` 2px outline (inset) |
| Selected (current view) | bg=`accent-subtle`, text=`accent-on-subtle`, icon=`accent-on-subtle` |
| Disabled | text=`text-disabled`, icon=`text-disabled` |
| Drop target (drag a task or project over it) | dashed `accent` outline + `accent-subtle` bg tint |

### 18.4 Count badge variants

- **Plain count**: `(5)` — `text-small-strong`, `text-subtle`. Used on Inbox, Today, Tomorrow, Next 7 Days, project lists when no overdue items.
- **Today with overdue**: `(5) ·3` or `Today (5)` + small amber pill with `3` to its right. The amber pill is `radius-full`, `accent` bg, `text-on-accent` text, 16px height, 4px horizontal padding. (Used on Today sidebar item only when overdue count > 0.)

Example layout: `Today (5)`, then 4px gap, then amber pill `3`.

### 18.5 Keyboard / ARIA
- Native `<a>` or `<button>` depending on whether it's a navigation link.
- `aria-current="page"` when selected.
- Tab order: top to bottom in the sidebar.
- The overdue sub-badge is announced as part of the row label: "Today, 5 items, 3 overdue."

### 18.6 Edge cases
- Long labels truncate with ellipsis. Tooltip on hover shows full name.

---

## 19. Folder header (collapsible)

### 19.1 Purpose
A sidebar grouping header. Contains projects beneath when expanded.

### 19.2 Structure
- 32px row.
- Left: Lucide `chevron-down` (expanded) / `chevron-right` (collapsed), 16px.
- Middle: folder icon (`folder` collapsed / `folder-open` expanded), then label.
- Right: hover-only ⋯ icon button for rename / delete / new project inside folder.

### 19.3 States

| State | Visual |
|---|---|
| Default | text=`text-subtle`, icon=`text-subtle` |
| Hover | bg=`canvas-subtle`, ⋯ icon visible |
| Focus | + `focus-ring` |
| Expanded | chevron points down; child projects render below |
| Collapsed | chevron points right; children hidden |
| Drop target | dashed `accent` outline + `accent-subtle` bg + after 300ms hover, **auto-expand** (so user can drop into a nested project) |

### 19.4 Keyboard / ARIA
- `role="button"` with `aria-expanded` toggling.
- Right-arrow expands; Left-arrow collapses; Enter / Space toggle.
- Up/Down arrows move focus to neighboring sidebar items (skip child projects when collapsed).

### 19.5 Edge cases
- Folders are one level only — they cannot contain other folders.
- Right-click opens context menu: Rename, Delete folder (does NOT delete the projects inside — they relocate to top level), New project in folder.

---

## 20. Project row (collapsible if has children)

### 20.1 Purpose
A sidebar row representing a Project (under the Projects section, optionally nested under a folder).

### 20.2 Structure
Same as Sidebar nav item §18, plus:
- If hierarchical and has children visible in sidebar (not in v1 — projects in sidebar don't expand to show items; only folders expand), a chevron prefix. **In v1, project rows in sidebar are non-expanding.** The project's items are seen inside the project view, not in the sidebar.
- Left: project's optional color dot (8px, `radius-full`) OR Lucide icon (if assigned) OR no icon (default).
- Inbox is a fixed sidebar item, styled identically to other project rows but pinned at the top of the Projects section (or in its own slot above; see screens doc).

### 20.3 States
Same as Sidebar nav item §18. Drop target accepts: a Task (re-parent to this project), another Project (reorder).

### 20.4 Edge cases
- Inbox cannot be reordered, deleted, or moved into a folder. Its sidebar row has no ⋯ menu.
- Right-click on user-created projects: Rename, Delete project, Move to folder, Duplicate? (Duplicate is post-v1 — not in v1.)

---

## 21. Tree row (Item — Epic / Feature / Task)

### 21.1 Purpose
A row in the project tree view representing an Epic, Feature, or Task. Depth is indicated by indentation + a depth-aware vertical guide line.

### 21.2 Structure (left-to-right)
1. **Indent** — 24px per level. Level 0 = Epic, Level 1 = Feature, Level 2 = Task. (Level 3 = Subtask — only inside Task modal, not in tree.)
2. **Expand chevron** — 16px Lucide `chevron-right` (collapsed) / `chevron-down` (expanded). Hidden if item has no children. Clickable area 24x24px.
3. **Type icon** — 20px Lucide per item type (see design language §7 — `layers` Epic, `layout-grid` Feature, checkbox-style for Task).
4. **Checkbox** (Tasks only) — Tasks have a real checkbox here. Epics and Features show their type icon + the rollup progress.
5. **Title** — `text-body`, `text` color. Click to inline-edit.
6. **Inline meta (right side)** — date chip if date is meaningful (Tasks only typically), tag chips (up to 2 + overflow "+N"), priority dot, multi-day chip, rollup progress (Epics/Features only).
7. **Hover affordances** — ⋯ icon button + `chevron-right` "Open" icon (opens modal).

### 21.3 States

| State | Visual |
|---|---|
| Default | text=`text` |
| Hover | bg=`canvas-subtle`, ⋯ and chevron-open visible |
| Focus | + `focus-ring` 2px outline (inset) |
| Selected (single-select) | bg=`accent-subtle`, text unchanged |
| Multi-selected | bg=`accent-subtle` + 2px left-edge `accent` stripe |
| Completed | strike-through, text=`text-subtle` (only visible in Completed view or under "show completed" toggle in tree) |
| Trashed | not shown in tree (only in Trash view) |
| Dragging | row visually replaced by drag ghost; original row dims to 0.4 opacity |
| Drop target (re-parent) | dashed `accent` outline; if a collapsed Epic/Feature, hover 300ms auto-expands |
| Depth-cap rejection (drop would exceed 4 levels) | outline turns `overdue`, drop disallowed cursor |
| Loading (e.g., expanding a node with many children) | inline 16px spinner next to chevron until loaded |

### 21.4 Keyboard / ARIA
- The tree is `role="tree"`, rows are `role="treeitem"` with `aria-level`, `aria-expanded` where applicable, and `aria-setsize` / `aria-posinset` for screen readers.
- Up/Down arrows move focus between siblings (and into expanded children).
- Left arrow collapses (or moves focus to parent if already collapsed).
- Right arrow expands (or moves focus to first child if already expanded).
- Enter opens the modal (same as clicking the "Open" chevron).
- `O` opens the modal (single-key when row focused, no input active).
- Space toggles the checkbox (Tasks only).
- `⌘⇧M` opens the Move-to picker (re-parent).

### 21.5 Edge cases
- **Rollup progress display** (Epics + Features): a small chip on the right showing `2/9` and a 32px-wide progress bar underneath the chip (or to the left of). Color: `text-subtle` for the bar background, `accent` for the filled portion. Hidden if the item has no children.
- **Depth cap** (3 levels in tree + 1 subtask in modal = 4 levels total): the create-child affordance on a Feature is hidden if doing so would exceed the cap (i.e., that Feature already has Tasks as children — a child Feature would not be added under it). Engineering may model this loosely; the UX must visibly hint when an action is blocked.
- **Indentation guide line**: a 1px `border-subtle` vertical line drawn at each level's indent stop, helping the user trace the hierarchy.

---

## 22. Subtask row (within Task detail)

### 22.1 Purpose
A row inside the Task modal's "Subtasks" section.

### 22.2 Structure
- 32px row.
- Left: drag handle (Lucide `move`, 16px, visible only on hover), checkbox (16px — see §12), title text (`text-body`).
- Right: hover-only Lucide `x` for delete.

### 22.3 States
- Default, hover (bg=`canvas-subtle`, drag handle + delete icon appear), focus, completed (strike-through, `text-subtle`).
- An "add subtask" inline row at the bottom: `+` icon + ghosted "Add subtask…" text. Clicking enters edit mode (inline text input).

### 22.4 Keyboard / ARIA
- Each subtask `role="checkbox"` (the row's checkbox + title is the labeling).
- Enter in the "add subtask" input creates the subtask and immediately starts a new "add subtask" row beneath.
- Esc cancels the in-progress new subtask.
- Up/Down arrows move focus between subtask rows.

### 22.5 Edge cases
- Subtasks reorder via drag handle (within the Task modal only).
- Subtasks cannot be promoted to Tasks via UI in v1 (post-v1 affordance).

---

## 23. Task list row (in views like Today / Inbox / per-project flat)

### 23.1 Purpose
The workhorse row used in flat list views: Today, Tomorrow, Next 7 Days, Inbox, All, per-project (flat), per-tag, Completed.

### 23.2 Structure (left to right)
1. **Priority dot** (8px, see §10 + design-language §2.7) — click to edit (opens priority menu).
2. **Checkbox** (20px, see §11).
3. **Title** — `text-body`. Click to inline-edit.
4. **Multi-day chip** (if applicable) — right edge of the title group: "Day 2 of 5" — see §32.
5. **Date chip** — only shown when meaningful: today, tomorrow, overdue, or > 7 days out. Inline-clickable to open date popover.
6. **Tag chips** — up to 2 visible, with "+N" overflow chip. Each clickable to navigate to per-tag view; "+N" expands.
7. **Subtask progress** — small `2/5` chip if Task has subtasks.
8. **Hover affordances** — ⋯ icon button + "Open" chevron-right (right-most).

### 23.3 Density
- Desktop: ~38–40px tall ("cozy"). Mobile: ~44px ("comfortable").
- Internal horizontal padding: `space-4` (16px) on both sides.
- Internal vertical gap between text and meta chips: `space-2` (8px).

### 23.4 States

| State | Visual |
|---|---|
| Default | bg=transparent, text=`text` |
| Hover | bg=`canvas-subtle`, ⋯ and Open chevron visible |
| Focus | + `focus-ring` (inset, 2px) |
| Selected (single) | bg=`accent-subtle` |
| Multi-selected | bg=`accent-subtle` + 2px left-edge `accent` stripe |
| Overdue (in Overdue section) | left edge: 3px `overdue` bar; date chip text=`text-overdue`; subtle `overdue-subtle` tint NOT applied to the row bg (avoid heavy red) |
| Multi-day mid-span | left edge: 3px subtle `accent-subtle` bar (less prominent than overdue); chip on right "Day 2 of 5" |
| Completed (shown via "show completed" toggle) | strike-through, opacity 0.6 |
| Loading (e.g., optimistic save in flight) | inline 12px spinner next to the date chip (rare — local-first defaults are optimistic; we only show a spinner if a sync error rolls back) |
| Error (rollback after sync failure) | row briefly tints `overdue-subtle` (~600ms), then a snackbar appears |
| Dragging | original dims to 0.4, drag ghost follows pointer |
| Drop target (re-order) | thin `accent` line drawn between rows at the drop position |

### 23.5 Inline edits
- **Title** — single click on title text enters inline edit. Enter saves, Esc cancels.
- **Date chip** — click opens date picker popover.
- **Priority dot** — click opens priority menu.
- **Tag chip** — click navigates to per-tag view. **To edit tags inline**, use the row's ⋯ menu → Edit tags, which opens a small inline tag input on the row (no full modal).
- **Checkbox** — toggles completion.
- **Anywhere else on the row** — opens the full Task modal (per locked decision).

### 23.6 Keyboard / ARIA
- Each row `role="listitem"` inside a `role="list"` container.
- Up/Down arrows move focus.
- Enter or `O` opens modal.
- Space toggles checkbox.
- `1`/`2`/`3`/`4` set priority on focused row.
- `T` schedules to Today (date chip change).
- `⌘⇧M` opens Move-to picker.
- Delete/Backspace (with confirm) sends to Trash.
- Multi-day chip is announced as "Day 2 of 5" in screen reader.

### 23.7 Edge cases
- Long titles: truncate with ellipsis. Tooltip on hover shows full text. The full text is accessible in the modal.
- Very many tags: only first 2 visible + `+N`. `+N` is a button that, on click, expands the row's tag chips into a wrapping layout temporarily (or routes to a small inline overflow popover).
- Recurring icon: a tiny 12px `repeat` icon appears between title and date chip if `recurrence` is set.

---

## 24. Kanban column header

### 24.1 Purpose
The top of each kanban column ("To Do", "In Progress", "Done").

### 24.2 Structure
- Title (`text-h3`, `text`) + count badge `(N)` (`text-small-strong`, `text-subtle`).
- Add affordance: small `+` icon button at the right (creates a new task with status pre-set to this column).
- Optional collapse caret (post-v1 — column collapse).
- Status indicator: 8px dot at left of title using `status-todo` / `status-in-progress` / `status-done`.

### 24.3 States

| State | Visual |
|---|---|
| Default | bg=`canvas-subtle`, sticky to top during column scroll |
| Hover | + icon button visible |
| Focus | + icon button focused as needed |
| Drop target (drag over) | column body tint `accent-subtle`, header subtly highlights |
| Done column collapsed (post-v1) | shows only count + caret |

### 24.4 Keyboard / ARIA
- Header `role="heading"` with `aria-level="3"`.
- Column body `role="list"` with `aria-label="<column name>, N items"`.

---

## 25. Kanban card

### 25.1 Purpose
A card in the Kanban view representing a Task. **Only `type=task` items render here** (per spec §9.4 #1). Epics, Features, Subtasks do not appear in Kanban.

### 25.2 Structure (top-to-bottom, with priority on left edge)
- **Priority left-edge dot/bar** — a 2px or 3px tall colored strip running the full left edge of the card, color from `priority-*` tokens. `priority-none` = no strip rendered.
- **Body** (with 12px left padding to clear the strip):
  - Top row: title (`text-h3`, can wrap up to 2 lines, then ellipsis on 3rd).
  - Meta row (below title, separated by `space-2` (8px)):
    - Up to 2 tag chips. "+N" overflow if more.
    - Subtask progress chip `2/5` if subtasks exist.
    - Date chip — **only shown if overdue or today** (per locked decision). Tomorrow / later: no date shown.

### 25.3 Visual
- `surface` bg, `radius-md` (8px), `elevation-1` at rest, `elevation-2` on hover.
- Min height 64px desktop, 72px mobile.
- Width = column width minus column-internal padding.

### 25.4 States

| State | Visual |
|---|---|
| Default | as described |
| Hover | `elevation-2`, `surface-elevated` bg, slight scale (none — kanban cards stay still on hover) |
| Focus | + `focus-ring` 2px outline 2px offset |
| Selected (multi-select) | `accent` left-edge stripe replaces priority stripe (priority is still readable in the title row by virtue of priority chip) — wait, priority is critical info. **Resolved**: when multi-selected, the left edge becomes a 4px `accent` stripe, and the priority indicator moves inline next to the title as a 8px dot. |
| Dragging | `elevation-drag`, scale 1.02, opacity 0.95, original card dims to 0.2 |
| Drop target above/below | a thin `accent` line drawn between adjacent cards at the drop position |
| Overdue (in any column other than Done) | date chip uses `overdue-subtle` bg and `overdue-text` text |
| Completed (in Done column) | title text=`text-subtle`; no strike-through (since the column itself communicates done-ness) |

### 25.5 Keyboard / ARIA
- `role="listitem"` inside the column's listbox.
- `aria-label="<title>, priority <level>, <N> tags, <subtask progress if any>"`.
- Enter or `O` opens modal.
- `← →` arrows move the card to the previous/next column (mutates status).
- `↑ ↓` arrows reorder within column.
- `X` toggles complete (alternative to dragging to Done).

### 25.6 Edge cases
- A Task with a future date is shown in the column matching its status but with no date chip (per spec). Filter chips above the board let users narrow to "overdue" or other date subsets.
- The Done column can grow very long. v1 ships with simple vertical scroll + an optional "Showing recent 50, [show all]" affordance after 50 items.

---

## 26. Calendar day cell (month view)

### 26.1 Purpose
One day cell in the month calendar grid.

### 26.2 Structure
- Cell dimensions: equal width per column (1/7 of grid width), min 96px height desktop. Grows to fit content up to a soft cap (then "+N more" appears).
- Top-left: day number (`text-small-strong`). Today is `accent` color in a 24px circle filled `accent-subtle` (or the inverse — `accent` filled, `text-on-accent` text — pick one). v1 ships with the **filled accent circle** treatment.
- Top-right: optional micro-glyph for "has multi-day item" or other ambient indicators. (None in v1 — keep clean.)
- Body: stack of calendar event chips (see §27), most-significant first.
- Footer (if overflow): "+N more" link styled as `text-caption`, `accent`.

### 26.3 States

| State | Visual |
|---|---|
| Default | bg=`surface`, border-bottom + border-right = `border-subtle` (creates grid lines) |
| Hover | bg=`canvas-subtle` |
| Focused (keyboard) | + 2px `accent` outline (inset) |
| Today | day number is the special accent-filled circle |
| Out-of-month (prev/next month days shown for grid completeness) | text=`text-muted`, bg=`canvas-subtle` |
| Drop target (drag an item over) | bg=`accent-subtle`, day number's circle becomes `accent` |
| Weekend (Sat/Sun) | (v1 ships without a distinct weekend tint — too noisy. Reserved as a v1.1 setting.) |

### 26.4 Keyboard / ARIA
- Each cell `role="gridcell"` with `aria-label="<full date>, <N events>"`.
- The grid container is `role="grid"` with `aria-label="Month of <month> <year>"`.
- Arrow keys navigate cells (Left/Right by day, Up/Down by week).
- Enter opens a day-detail popover (see §31) for that day.
- `N` creates a new task with date pre-filled to focused day (single-key).

### 26.5 Edge cases
- A multi-day span renders as a continuous bar across multiple cells — see §27.

---

## 27. Calendar event chip (month view)

### 27.1 Purpose
A bar inside a day cell representing one Item with that due date (or one day in a multi-day span).

### 27.2 Variants

#### 27.2.1 Timed (all-day = false)
- Layout: time prefix + title.
- Time prefix: 4-char fixed-width text (`09:00`), `text-small-strong`, `text`.
- Title: `text-small`, `text`. Truncates with ellipsis.
- Priority left border: 2px wide left border in `priority-*` color. `priority-none` = no border.
- Background: transparent (chips sit in their own neutral row); on hover bg=`canvas-subtle`.

#### 27.2.2 All-day (timed = false, single-day)
- Layout: title only.
- Title: `text-small`, `text`.
- Priority left border: same as timed.
- Background: same as timed.

#### 27.2.3 Multi-day span
- Layout: continuous horizontal bar spanning multiple day cells.
- First day: shows title (`text-small`, `text`) + small chip "Day 1 of 5" on the right edge.
- Middle days: thin continuation bar, faint (`tag-bg` color) — visually communicates the span without re-stating the title. The bar's height is 18–20px.
- Last day: small chip "Day 5 of 5" on the right edge; title repeats if there's room (truncates otherwise).
- Priority left border: only drawn on the first-day cell.
- Start day gets a subtle `elevation-1` on the chip / accent on chip ("start" emphasis). End day gets a subtle accent on chip too ("due" emphasis). Middle days are quietest.

### 27.3 States

| State | Visual |
|---|---|
| Default | as described |
| Hover | bg=`canvas-subtle`, chip slightly elevates |
| Focus (keyboard) | + `focus-ring` outline |
| Overdue | the chip's title text = `text-overdue`, priority border replaced with `overdue` 2px border; row tinted faintly `overdue-subtle` |
| Completed | strike-through title, opacity 0.6 (only visible in Completed-overlay calendar view, post-v1) |
| Dragging | the chip detaches as a ghost following the pointer; original chip dims |
| Dropping on a new day cell | calendar reschedules — see flow doc |

### 27.4 Keyboard / ARIA
- `role="button"` with full `aria-label="<title>, <date or span>, priority <level>"`.
- Enter opens modal.
- Esc cancels a focused drag.

### 27.5 Edge cases
- A day cell with 8+ chips collapses to show only first 4 + "+N more" (configurable; 4 is the v1 default for desktop, 2 for mobile).
- Time prefix is shown in 24h format by default. Users with 12h-preference locale settings see "9:00 AM" instead (but the chip still fits — width is reserved).

---

## 28. Calendar week-view event block

### 28.1 Purpose
A time-positioned event in the week view. Different from a month-view chip — it occupies vertical space proportional to duration. v1's duration model is "all-day or timed-with-no-explicit-duration," so:
- Timed items render as a fixed 30-minute block at their start time.
- All-day items render in an all-day strip at the top of each day column (similar to chips in the month view).
- Multi-day spans render in the all-day strip, spanning across day columns.

### 28.2 Visual
- A 30-min block: `accent-subtle` bg, `accent` left-border (or use status colors if we want to indicate `status` — v1 ships using **priority** for the left-border same as month view, and the column's day header takes care of the day context). Title + time-of-day inside.
- Borders, radius, hover same as the month event chip.

### 28.3 States, keyboard, ARIA
Inherit from §27 with these additions:
- Vertical drag changes time (snap to 15-min increments).
- Horizontal drag (across days) changes date.

---

## 29. Filter chip (dismissable)

### 29.1 Purpose
A chip that appears above a view to show an active filter, with an X to dismiss.

### 29.2 Visual
- `radius-full` (pill), `tag-bg` bg (or `accent-subtle` if filter is an "important" type — color-coded to filter category), `tag-text` text.
- Label format: `<facet>: <value>` (e.g., "Tag: urgent", "Project: Q3 Launch", "Priority: High").
- Trailing Lucide `x` (12px) icon button.
- Height: 24px (desktop) / 32px (mobile).

### 29.3 States
- Default, hover (bg darkens slightly), focus (`focus-ring`), removing-animation (fade-out 120ms).

### 29.4 Keyboard / ARIA
- Each chip is a `<button>` with `aria-label="Remove filter: <facet>: <value>"`.
- Delete/Backspace also removes the focused chip.

### 29.5 Edge cases
- Filters are session-only (per spec). On reload, they're cleared.
- A "Clear all" link appears next to the chip strip when 2+ chips are active.

---

## 30. Sort dropdown

A specific instance of Dropdown §8.

- Trigger: ghost button with "Sort: <current>" label + chevron-down. Lucide `arrow-down-narrow-wide` icon prefix.
- Options: "Due date (earliest)" [default], "Priority (high to low)", "Title (A–Z)", "Created (newest)".

Same keyboard/ARIA as Dropdown. Sort selection is session-only (per spec).

---

## 31. Tab / icon-toggle group (project view switcher)

### 31.1 Purpose
The toggle between List view ↔ Kanban view (and Tree view in hierarchical projects) for a given project. Per locked decision: icon-only toggle group, persists last-chosen-view per project.

### 31.2 Structure
- Horizontal group of 2 (flat project: List, Kanban) or 3 (hierarchical project: Tree, List, Kanban — though tree is the default for hierarchical; we ship with Tree + Kanban only for hierarchical projects since the flat "List" inside a hierarchical project is rarely useful in v1; UX intentionally keeps it to 2 buttons).

**v1 final**: flat projects show List ↔ Kanban; hierarchical projects show Tree ↔ Kanban. The List icon is `list`; the Tree icon is `list-tree`; the Kanban icon is `columns-3`. The orchestrator can adjust this in v1.1 if hierarchical projects need a flat-list fallback view.

- Each button: icon button §2 size sm (28px), with a connected group border:
  - First button: rounded left corners only.
  - Last button: rounded right corners only.
  - Middle: square borders.
- Selected button: bg=`accent-subtle`, icon=`accent-on-subtle`.
- Unselected: transparent, icon=`text-subtle`.

### 31.3 Keyboard / ARIA
- Container `role="tablist"`, each button `role="tab"`, with `aria-selected`.
- Tab content area (the view itself) is the panel; `aria-controls` references it.
- Left/Right arrows move selection between tabs.
- Tab key moves focus out of the group entirely.

### 31.4 Edge cases
- If a flat project's `is_hierarchical` is toggled on later (v1 supports this — project may become hierarchical), the toggle group updates accordingly.

---

## 32. Multi-day chip ("Day N of M")

### 32.1 Purpose
A small chip on multi-day Items showing where in the span we are.

### 32.2 Visual
- `radius-full`, neutral surface (`tag-bg`), `tag-text` text, `text-caption`, height 20px.
- Content: "Day N of M". If start day → "Day 1 of M" with a subtle `accent-subtle` background tint and `accent-on-subtle` text. If last day → "Day M of M" with same accent treatment.
- Middle days: plain `tag-bg`.

### 32.3 Placement
- In Task list rows: right of title, left of date chip.
- In Tree rows: same.
- In calendar event chips (month view): right edge of the first/last day's chip; middle days do not display the chip (just a continuation bar).

### 32.4 Edge cases
- If span length M ≥ 99 (extremely unlikely), chip shows "Day N of 99+" truncation.

---

## 33. Command palette modal (⌘K)

### 33.1 Purpose
Discoverability + power-user fast path. Per locked decision, **there is no global search in v1**; ⌘K is the discoverability surface.

### 33.2 Structure
- Centered modal, max-width 560px, `radius-lg`, `elevation-3`.
- Top: large text input (no border, no chrome, just `text-h2`-sized input field with a leading Lucide `command` icon and placeholder "Type a command…").
- Below: scrolling list of results — commands matching the typed substring (fuzzy match).
- Each row: command label (`text-body`) + right-aligned keyboard shortcut (`text-mono`) if any + optional left-side icon.
- Categories: results group under faint section headers ("Navigate", "Create", "View", "Settings"). Section headers are `text-caption`, `text-subtle`, `space-3` top padding.

### 33.3 Initial state (no query typed)
- Shows recent commands (last 5) + a curated list: "Go to Today", "Go to Inbox", "Add task", "Add project", "Open settings", "View shortcuts".

### 33.4 States

| State | Visual |
|---|---|
| Default (empty input) | recent + curated list |
| Typing | filtered list, top result highlighted (focused via arrow keys) |
| Empty results | "No matching commands. Try a different word." |
| Loading | (n/a — commands are local synchronous) |
| Focused row | bg=`accent-subtle`, text=`text` |
| Disabled command | text=`text-disabled`, not selectable |

### 33.5 Keyboard / ARIA
- `role="dialog"`, `aria-modal="true"`.
- Input has `aria-controls` pointing to the result list ID and `aria-activedescendant` reflecting the focused row.
- Arrow Up/Down navigate results, Enter selects, Esc closes.
- Tab is captured to move from input to the result list (or use Down).
- The input has `aria-label="Type a command"`.

### 33.6 Edge cases
- Pressing ⌘F (would-be global search) shows a tooltip / one-line hint in the palette's empty state: "There is no global search yet. Use the command palette to navigate." See Microcopy doc and Interaction Patterns doc — we resolved to show a transient toast/tooltip "Use ⌘K to navigate" if the user presses ⌘F.

---

## 34. Day-detail popover (for "+N more" calendar overflow)

### 34.1 Purpose
Shows the full list of items for a single day when the calendar cell has overflow.

### 34.2 Structure
- A popover anchored to the day cell (or as a sheet on mobile).
- Header: date (`text-h2`) + small subtitle like "Wednesday, May 22".
- Body: scrolling list of full-fidelity task rows for that day (the same row component as Today view, §23).
- Footer: "Add task on this day" affordance (creates a new task with date pre-set).

### 34.3 Visual
- `surface` bg, `radius-lg`, `elevation-3`, max-width 360px desktop, full-width sheet on mobile.

### 34.4 Behavior
- Each row is a full Task list row with check-off, click-to-edit inline, etc. — same affordances as elsewhere.
- Closing the popover (outside click, Esc) returns to the calendar view.

### 34.5 Keyboard / ARIA
- `role="dialog"`, `aria-modal="false"` (it's anchored, not a true modal).
- Focus trap optional; Tab moves through rows; Esc closes.
- The "+N more" link is `aria-haspopup="dialog"`, `aria-expanded`.

---

## 35. Empty state

### 35.1 Purpose
The content shown when a view has zero items to display. Each view has a distinct, terse empty state. The Today first-run variant is one of the two warm-flourish strings.

### 35.2 Structure
- Centered vertically and horizontally in the available content area.
- Icon: Lucide, 48px, `text-subtle`. (Chosen per view; see microcopy doc.)
- Headline: `text-h2`, `text`.
- Subline: `text-body`, `text-subtle`.
- Optional CTA: secondary button (or, for the first-run case, a pointer/arrow hint to the quick-add input above).

### 35.3 Variants (each defined in screens + microcopy docs)
- Today empty (regular)
- Today empty (first-run — warm flourish)
- Tomorrow empty
- Next 7 Days empty
- Inbox empty
- All empty
- Completed empty
- Trash empty
- Per-project empty (flat)
- Per-project empty (hierarchical — different copy emphasizing structure)
- Per-tag empty (rare — happens if a tag's last item was completed/deleted)
- Calendar empty month (no events at all)
- Kanban empty column (per-column empty state — see §35.4)

### 35.4 Per-column empty in Kanban
- A faint dashed border outline, `text-subtle` "No items" centered, `text-caption`. Smaller than full-view empties.

### 35.5 Filtered-down-to-nothing (separate from empty)
- A view with filter chips applied that produces zero results uses a **different** empty state: "No matches. Try removing a filter." + a "Clear filters" button. (Per Interaction Patterns doc.)

---

## 36. Skeleton loaders

### 36.1 Purpose
Stand-in placeholders during initial app load or post-navigation while data resolves. Local-first means most loads are sub-100ms; skeletons appear if a load exceeds 300ms.

### 36.2 Visual
- Rounded rectangles in `border-subtle` color, animated with a soft shimmer (low-opacity gradient sweep, `motion-slow` cycle, `ease-standard`). Reduced motion disables the shimmer; rectangles render statically.
- Shapes mimic the layout of the content they replace:
  - Task list rows: 1 short bar (priority dot) + 1 longer bar (title) + 1 small bar (date chip).
  - Sidebar: row-shaped bars.
  - Kanban column: column heading bar + 3 card-shaped rectangles.
  - Calendar: a grid of cells with 2 chip bars each.

### 36.3 States
- Visible (data still loading) → fades out, replaced by actual content, `motion-base`.

### 36.4 ARIA
- Skeleton containers carry `aria-busy="true"` and `aria-live="polite"` so SR users hear "Loading" when entering the surface, and don't get noise from each shimmer frame.

---

## 37. Confirmation prompt

### 37.1 Purpose
A modal-style prompt for destructive or hierarchy-altering actions: parent completion blocking, permanent delete, "Move all overdue to today", "Empty Trash".

### 37.2 Structure
- Smaller modal: 400px max-width.
- Title: `text-h2`. Body: `text-body`, `text-subtle`. Footer: Cancel (Ghost or Secondary) on the left, primary action button on the right.
- Destructive variants use the Destructive button style.

### 37.3 Variants

| Trigger | Title | Body | Primary action label |
|---|---|---|---|
| Parent completion blocking | "Complete all children and continue?" | "This item has N incomplete children. Completing it will mark them all done." | "Complete all and continue" |
| Permanent delete | "Permanently delete N items?" | "This cannot be undone." | "Delete forever" (Destructive) |
| Empty Trash | "Empty Trash?" | "All N items in Trash will be permanently deleted." | "Empty Trash" (Destructive) |
| Move all overdue | "Move N overdue items to today?" | (Body shows scope.) | "Move all" |
| Unsaved changes on modal close | "Discard changes?" | "You have unsaved edits." | "Discard" (Destructive) + "Keep editing" (cancel) |
| Depth cap exceeded | (uses Snackbar, not a confirmation modal — see §16.3) | — | — |

### 37.4 Behavior
- Primary action is **not** auto-focused for destructive variants. Cancel holds initial focus.
- For non-destructive ("Move all overdue", "Parent completion"), primary action is focused.
- Esc cancels.

---

## 38. Drag ghost + drop target highlight

### 38.1 Drag ghost
- Visual representation that follows the pointer during drag.
- Mirrors the source row/card with `elevation-drag` shadow, scale 1.02, opacity 0.95.
- The original row dims to opacity 0.4 (or replaces with a placeholder rectangle that pulses faintly — same `accent-subtle` color, `motion-medium` cycle).

### 38.2 Drop target highlight
- The hovered drop zone (column body, sidebar folder, calendar cell, tree row, kanban column) renders:
  - bg=`accent-subtle`,
  - dashed `accent` outline 2px,
  - if the target needs to expand (collapsed folder or tree node), auto-expand after 300ms hover.
- Drop position indicators (between rows): a 2px solid `accent` line at the insertion point.
- **Depth-cap violation**: outline becomes `overdue` solid 2px, no-drop cursor.

### 38.3 Cancel
- Esc during drag cancels the drag — ghost dismisses, original row returns, no mutation.

### 38.4 Auto-scroll
- When the drag ghost is within 40px of the viewport top/bottom (or sidebar/column edges), the scroll container scrolls toward that edge at a velocity proportional to proximity.

### 38.5 Reduced motion
- The drag ghost itself **does not** apply the 1.02 scale under reduced motion (only the elevation shadow).
- Drop highlight is instant (no transition).
- The placeholder pulse on the original row is disabled.

---

## 39. Mobile bottom nav

### 39.1 Purpose
The primary navigation on phone-sized devices. 5 tabs.

### 39.2 Tabs
1. **Today** — Lucide `sun`.
2. **Calendar** — Lucide `calendar`.
3. **Quick-add** — Lucide `plus-circle`, sized one step larger (28px icon), visually emphasized as the central tab (slight raise — `elevation-1`).
4. **Inbox** — Lucide `inbox`.
5. **More** — Lucide `more-horizontal` (opens a sheet with: All, Next 7 Days, Completed, Trash, Tags, Settings, Projects list).

### 39.3 Visual
- 56px tall + safe-area-inset-bottom padding.
- `surface` bg, `elevation-1` (top shadow).
- Each tab: icon centered, label below in `text-caption`.
- Selected tab: icon and label `accent-on-subtle`, with a small 4px tall `accent` indicator bar above the tab (optional — v1 ships with **color change only**; no bar).

### 39.4 States
- Default, hover (n/a on touch), selected, pressed (slight scale 0.96 on tap with `motion-fast`).

### 39.5 Keyboard / ARIA
- `role="navigation"` container, each tab `role="link"` or `role="button"`.
- `aria-current="page"` on selected.
- Touch target minimum 44x44px.

### 39.6 Edge cases
- The center "Quick-add" tab does not navigate — it opens the task-creation sheet directly.
- Bottom nav is **not** rendered on desktop or on tablet wider than 768px (the sidebar replaces it).

---

## 40. Mobile swipe action drawer

### 40.1 Purpose
A row's revealed actions when the user swipes left on a task row (mobile only). Per locked decision, this is the Mail-style left-swipe.

### 40.2 Structure
- Two action buttons revealed from the right edge:
  - **Schedule** — Lucide `calendar`, `accent-subtle` bg, `accent-on-subtle` icon.
  - **Delete** — Lucide `trash-2`, `overdue-subtle` bg, `overdue-text` icon (note: this is soft-delete to Trash, NOT permanent).
- Each action 88px wide (touch-friendly).
- A right-swipe (opposite direction) completes the task immediately (no drawer — just check + animation).

### 40.3 States
- Resting (drawer hidden), Revealing (drawer width grows with swipe), Resting-revealed (drawer fully open after release if the swipe passed a threshold), Triggered (action button tapped — drawer slides closed + action fires).
- Swipe-back closes the drawer.

### 40.4 Behavior
- Swipe distance threshold: 50% of row width to "stay open." Below that, snaps back.
- Tapping outside the swiped row closes it (closes drawer).
- Only one row's drawer is open at a time. Opening another closes the previous.

### 40.5 Keyboard / ARIA
- Not keyboard-accessible (this is a touch-only affordance). Equivalent keyboard actions: the row's ⋯ menu (which holds Schedule, Delete, etc.), `T` for schedule-to-today, Delete key for soft-delete.
- ARIA: the drawer's action buttons are within the same row's container; they become discoverable when revealed but, on screen readers without swipe-emulation, the user uses the row's actions menu instead.

### 40.6 Edge cases
- Reduced motion: drawer reveal is instant (no slide animation).

---

## 41. Sidebar (collapsed state for narrow desktop / pinned use)

### 41.1 Purpose
A narrow icon-only variant of the sidebar for desktop users who want more horizontal canvas. Toggle via the sidebar's hamburger-toggle button (top of sidebar) or via `⌘\` keyboard shortcut.

### 41.2 Visual
- Width: 56px (vs ~240px expanded).
- Icons only, no labels. Each sidebar item is an icon button (size md). Tooltip on hover shows label + count.
- Count badges become micro-badges (a 6px dot in `accent` for non-zero counts, with the exact number revealed on hover/focus).

### 41.3 States
Same as expanded sidebar (default, hover, focus, selected, drop-target).

### 41.4 Behavior
- Collapsing/expanding is animated with `motion-base` (slide-width). Reduced motion: instant.
- The user's preference is remembered.

---

## 42. Sync state indicator (sidebar bottom)

### 42.1 Purpose
Surfaces the local-first/cloud-sync state. Lives at the bottom of the sidebar.

### 42.2 Visual
- A small row: Lucide icon + label, in `text-caption`, `text-subtle`.
- Variants:
  - **Synced** — `cloud-check`, `success`, label "Synced just now" / "Synced 2m ago" / etc.
  - **Syncing** — `cloud-cog` rotating slowly, label "Syncing…"
  - **Offline** — `cloud-off`, `text-subtle`, label "Offline. Changes saved locally."
  - **Sync error** — `alert-circle`, `overdue`, label "Sync error. Tap to retry."

### 42.3 States
Default, hover (background highlights, click triggers retry on error variant), focus.

### 42.4 Keyboard / ARIA
- Native button with `aria-label` describing current state.
- Announcement on state change uses `aria-live="polite"`.

### 42.5 Edge cases
- Collapsed sidebar: shows only the icon. Tooltip shows the full status text.

---

## 43. Component coverage check

Components above cover every v1 surface. Specifically:

- All Item types: Tree row (§21), Task list row (§23), Kanban card (§25), Calendar chip (§27, §28), Subtask row (§22).
- All views: Sidebar nav (§18), Folder (§19), Project row (§20), Today / Tomorrow / etc. via Task list row + Empty state (§35).
- All entry points: Modal (§14), Sheet (§15), Snackbar (§16), Tooltip (§17), Confirmation prompt (§37), Day-detail popover (§34), Command palette (§33).
- All editing affordances: inline (within row §21, §23), modal (full Task), and per-field popovers (Date §5, Time §6, Date+Time §7, Priority §10, Tag input §9).
- All cross-cutting: Button (§1), Icon button (§2), Text input (§3), Textarea (§4), Dropdown (§8), Checkbox (§11, §12), Filter chip (§29), Sort dropdown (§30), Toggle group (§31), Multi-day chip (§32), Skeleton loaders (§36), Drag visuals (§38).
- Mobile-specific: Bottom nav (§39), Swipe drawer (§40), Sheet (§15).
- System indicators: Sync indicator (§42), Sidebar collapsed (§41).

Any future addition (e.g., a tag-management surface for v1.1) extends this inventory.
