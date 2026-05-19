# Task 06 — Components: rows, pickers, and sidebar primitives

## Goal

Implement the row, chip, and sidebar-shaped components: Checkbox, SubtaskCheckbox, Card, Filter chip, Sort dropdown, View toggle (icon-toggle group for List/Tree/Kanban), Multi-day chip, Sidebar nav item, Folder header, Project row, Sync footer (static — replaces UX §42), Quick-add input, TaskListRow (the workhorse). Each follows the same folder pattern from task-05 (`index.tsx`, `styles.module.css`, `__tests__/<Name>.test.tsx`). TaskListRow is the biggest component in this task — it composes priority dot (click → priority menu, stubbed to a no-op callback this task), checkbox, title with inline-edit affordance, multi-day chip, date chip (click → date popover, stubbed), tag chips (clickable to nav), subtask progress chip, hover affordances (⋯ + Open chevron). `lib/date-fmt.ts` and `lib/a11y.ts` (announcer) also ship here.

## Context files

- `docs/ux/component-inventory.md` — sections 11 (Checkbox), 12 (Subtask checkbox), 13 (Card), 18 (Sidebar nav item), 19 (Folder header), 20 (Project row), 23 (Task list row — read every subsection carefully), 29 (Filter chip), 30 (Sort dropdown), 31 (Tab / icon-toggle group / View toggle), 32 (Multi-day chip), 35 (Empty state — already exists; we use it), 38 (Drag visuals — task-10 wires; the row's `dragging` state is here as CSS rules), 40 (Mobile swipe drawer — ships in this task as a CSS-driven gesture-friendly variant of the row).
- `docs/ux/design-language.md` — tokens. Especially §2.7 priority dots (None=6px hollow, Low=6px filled gray, Medium=8px filled amber, High=10px filled red — size + color + ring style each carry meaning), §3.1 row heights, §7 item-type icons (Lucide `layers` / `layout-grid` / `square-check-big`).
- `docs/ux/accessibility.md` — §1.4 color independence (priority dot also varies size + ring), §2.1 keyboard map per surface, §2.5 focus indicator, §3.6 tree row ARIA (we won't fully use this until task-09 — task-06 builds TaskListRow with `role="listitem"`), §11 date accessible long-form labels, §12 ARIA edge cases (multi-day chip, subtask progress, +N more, tag chips on rows).
- `docs/ux/microcopy.md` — §2 quick-add placeholders (per view — passed as prop), §8 tooltips, §9 sort dropdown, §10 filter chip labels, §29 ARIA long-form patterns.
- `docs/ux/screens.md` — Today view (the canonical TaskListRow rendering with priority dot, multi-day chip, date chip, tag chips, hover ⋯ and Open chevron). Per-project flat. Inbox view. Calendar overflow (not built here, but the day-detail popover in task-14 uses TaskListRow inside).
- `docs/ux/interaction-patterns.md` — §2 hover timing (instant reveal, 120ms grace on hover-out), §3 selection model (single-select bg=`accent-subtle`; multi-selected adds left-stripe), §8 mobile swipe (right=complete, left=action drawer), §16 inline-vs-modal editing (single click on title → inline edit; click date chip → popover; click priority dot → menu; click tag chip → navigate; click anywhere else → modal).
- `docs/engineering/2026-05-18-code-architecture.md#4-6-component-skeleton----tasklistrow` — TaskListRow prop type contract.
- `docs/engineering/2026-05-18-frontend-architecture.md#5-component-layer` — folder structure + CSS-Module + data-attr pattern.

## Downstream dependencies

- **Task 07** builds the actual date picker, time picker, priority menu, and tag input — TaskListRow's `onClickDate`, `onClickPriority`, `onClickTag` callbacks pass through to those popovers wired in views. For task-06, the callbacks are pure props (parent decides what happens).
- **Task 08** wires TaskListRow into Today / Tomorrow / Next 7 Days / Inbox / All. Sidebar count badges, sort dropdown, filter chips wire to the URL search params via TanStack Router.
- **Task 09** builds TreeRow — a sibling component to TaskListRow that uses many of the same internal pieces (priority dot, type icon, title inline-edit, multi-day chip, date chip). Some logic might be hoisted into `lib/` helpers (e.g., a `usePriorityDot` / `useDateChip` hook) — task-09 will refactor if helpful, but task-06 just ships TaskListRow.
- **Task 10** adds drag handles to TaskListRow via `useSortable`; the row already accepts a `data-state="dragging"` and a `data-state="drop-target"` via CSS. Wire those in task-10.
- **Task 12** uses Sort dropdown + Filter chip in Trash view.

## Steps

1. **Library helpers (build first — these are imported by multiple components)**:
   - `apps/web/src/lib/date-fmt.ts`:
     ```ts
     import { LocalDate, LocalTime } from '@tasko/types';
     // Locale-aware short form: "May 18", "Today", "Tomorrow", "Wed May 18", "May 14 (4d)" for overdue.
     export function formatDateChip(date: LocalDate, today: LocalDate, weekStart: 'sun' | 'mon'): { short: string; long: string; overdueDays?: number };
     // Long form for aria-label: "Wednesday, May 18, 2026", "Wednesday, May 18, 2026 — today", "Wednesday, May 18, 2026, 4 days overdue".
     export function formatDateLong(date: LocalDate, today: LocalDate): string;
     export function formatTimeChip(time: LocalTime): string;     // "09:00" / "9:00 AM" per locale convention (v1: use the device locale's hour convention; default 24h if not detectable; verify via Intl.DateTimeFormat)
     export function formatRelativeForGroup(date: LocalDate, today: LocalDate): string;  // "Today", "Tomorrow", "Wed May 18"
     export function todayLocal(): LocalDate;                     // YYYY-MM-DD from device clock
     ```
   - `apps/web/src/lib/a11y.ts`:
     ```ts
     // Singleton live-region announcer. Creates a hidden div in the document body on first call.
     export function announce(text: string, politeness?: 'polite' | 'assertive'): void;
     ```
     Implementation: lazy-create a `div[role="status"][aria-live="polite"]` and a `div[role="alert"][aria-live="assertive"]`, both `position: absolute; left: -10000px;`. On call, set the appropriate div's `textContent` after a tick (so SR fires).
2. **Checkbox** (`components/checkbox/`) — per §11. 20px diameter, `radius-full`, 1.5px stroke. Unchecked = stroke `text-subtle` on `surface`; hover = stroke `text` + faint `accent-subtle` bg tint; focus = + ring; checked = filled `success` + white `check` glyph (Lucide `Check`, 14px stroke 2). Indeterminate = 8×2 horizontal bar centered. Disabled = stroke `text-disabled`.
   - Animation on check: 200ms strike-through + 300ms fade-collapse — but the **strike-through and fade are owned by the PARENT row, not the Checkbox itself**. The Checkbox component just toggles its filled state with `motion-fast` + `ease-spring-soft`. Document this in the Checkbox JSDoc.
   - Props: `checked`, `indeterminate`, `onChange`, `aria-label` (required), `size: 'sm' | 'md'` (sm = 16px for subtask, md = 20px for task), `disabled`.
   - ARIA: native `<input type="checkbox">` with `<label>` association. `role="checkbox"`, `aria-checked` reflects state. Space toggles. After check, the **row** (task-08) calls `announce("<Title> completed. Undo available.", 'polite')` — the Checkbox itself does not announce.
3. **SubtaskCheckbox** (`components/subtask-checkbox/`) — Checkbox with `size: 'sm'`. No animation (subtask is inside a modal — too noisy). Same ARIA shape.
4. **Card** (`components/card/`) — per §13. Generic surface. `surface` bg, `radius-md`, `elevation-1` rest / `elevation-2` hover, `space-3` padding, `border-subtle` 1px. Props: `selected?: boolean`, `dragging?: boolean`, `children`. States via data-attr: `[data-state="hover"]`, `[data-state="dragging"]`, `[data-state="selected"]`. Used by kanban-card (task-15) and project cards (post-v1).
5. **Filter chip** (`components/filter-chip/`) — per §29. Pill (`radius-full`), `tag-bg` or `accent-subtle` bg, label `<facet>: <value>` (e.g., "Tag: urgent"), trailing 12px Lucide `X` icon button. Height 24px desktop / 32px mobile. ARIA: `<button aria-label="Remove filter: <facet>: <value>">`. Delete/Backspace also removes when focused. Props: `facet`, `value`, `onRemove`, `tone?: 'neutral' | 'accent'` (default neutral).
6. **Sort dropdown** (`components/sort-dropdown/`) — per §30. Ghost-button trigger "Sort: <current>" with Lucide `ArrowDownNarrowWide` prefix + chevron-down. Options per microcopy §9: "Due date (earliest)" (default), "Priority (high to low)", "Title (A–Z)", "Created (newest)". Trash defaults to "Recently trashed"; Completed defaults to "Recently completed". Use Dropdown from task-05 underneath. Props: `value`, `onChange`, `options: SortOption[]`.
7. **View toggle** (`components/view-toggle/`) — per §31. Connected group of 2 or 3 icon-buttons. ARIA: container `role="tablist"`, each button `role="tab"` with `aria-selected`, `aria-controls` references the view panel. Left/Right arrows move selection. Selected button: `accent-subtle` bg + `accent-on-subtle` icon. Props: `options: Array<{ value: string; icon: LucideIcon; label: string; }>`, `value`, `onChange`. Hierarchical projects use Tree + Kanban; flat use List + Kanban (per UX §31.2 + task-09 wires).
8. **Multi-day chip** (`components/multi-day-chip/`) — per §32. Small pill `radius-full`, `tag-bg` bg, `tag-text` text, `text-caption`, 20px height. Content: "Day N of M". If N=1 (start day) or N=M (end day): use `accent-subtle` bg + `accent-on-subtle` text. Middle days: plain. ARIA: announced as part of row label, not separately interactive. Truncation: "Day N of 99+" if M ≥ 99. Props: `day: number`, `total: number`.
9. **Sidebar nav item** (`components/sidebar-nav-item/`) — per §18. Height 32px desktop / 44px mobile. Left: optional 20px Lucide icon (`text-subtle`). Middle: label (`text-body-strong`, `text`). Right: optional count badge `(N)` + an optional amber overdue sub-badge "·O" (Today only when overdue > 0 — render as a `radius-full` `accent` bg 16px-height pill with `text-on-accent` text 4px horizontal padding). States: default / hover / focus / selected (`accent-subtle` bg + `accent-on-subtle` text+icon) / disabled / drop-target (dashed accent outline). Native `<a>` (for routes) with `aria-current="page"` when selected. The amber sub-badge is appended to the link's accessible name: `aria-label="Today, 5 items, 3 overdue"`. Props: `to: string`, `icon?: LucideIcon`, `label: string`, `count?: number`, `overdueCount?: number`, `selected: boolean`. Replace task-04's inline placeholder.
10. **Folder header** (`components/folder-header/`) — per §19. 32px row, left chevron (down/right) 16px Lucide, then folder icon (`folder` / `folder-open`) + label. Right: hover-only ⋯ icon button. `role="button"` + `aria-expanded`. Arrow keys: Right → expand, Left → collapse, Enter / Space → toggle. Up/Down → move focus to neighbors (skip children when collapsed). Right-click → context menu (Rename / Delete folder / New project in folder). Drop target accepts a Project (auto-expand after 300ms hover during drag — handled in task-10). Props: `name`, `expanded`, `onToggle`, `onRename`, `onDelete`, `onNewProject`, `children`. Replace task-04's inline placeholder.
11. **Project row** (`components/project-row/`) — per §20. Same shape as SidebarNavItem, plus optional 8px color dot or icon on the left, plus a context menu (Rename / Delete project / Move to folder / Toggle hierarchical). Inbox: no context menu (per §20.4). Inbox is pinned visually but rendered as a normal Project row with `isInbox: true` disabling the menu. Replace task-04's inline placeholder.
12. **Sync footer** (`components/sync-footer/`) — per the binding-resolution drop of UX §42. A static row at the bottom of the sidebar showing:
    ```
    Tasko v1.0 · Local files in <data-dir>
    ```
    `text-caption`, `text-subtle`. The data-dir comes from `useQuery({ queryKey: ['health'], queryFn: ...api.health... })` which task-04 already wires. Right-click: copy the data-dir to clipboard (just one menu item: "Copy data dir path"). Not load-bearing; nice to have.
13. **Quick-add input** (`components/quick-add-input/`) — per `screens.md` "quick-add input" + microcopy §2. A row at the top of every list view: a TextInput-shaped input with a leading 20px `PlusCircle` Lucide icon and a placeholder per the view's context (passed as prop). Pressing Enter triggers `onCommit(title)` (the view's handler opens the Task modal with the title pre-filled). Pressing Escape blurs. Props: `placeholder`, `onCommit`, `autoFocus?: boolean`. The `N` keybinding (task-18) calls a `useFocusRef` to focus this input on the current view.
14. **TaskListRow** (`components/task-list-row/`) — per §23. The largest component this task. Props per `code-architecture.md` §4.6:
    ```tsx
    export interface TaskListRowProps {
      item: Item;
      isFocused?: boolean;
      isSelected?: boolean;
      isMultiSelected?: boolean;
      showProjectBreadcrumb?: boolean;
      density?: 'cozy' | 'comfortable';
      todayLocalDate: LocalDate;       // passed by parent for date-chip rendering / multi-day chip calc
      project?: { name: string; folder?: { name: string } };  // for breadcrumb display in All view
      onClick?: () => void;                          // anywhere-else on row → open modal
      onToggleCheckbox?: () => void;
      onTitleClickInlineEdit?: () => void;
      onTitleCommitInlineEdit?: (newTitle: string) => void;
      onDateClick?: () => void;                       // → date popover
      onPriorityClick?: () => void;                   // → priority menu
      onTagClick?: (tagId: TagId) => void;            // → navigate to per-tag view
      onSubtaskChipClick?: () => void;                // → open modal focused on subtask section
      onMenuOpen?: () => void;                        // ⋯ context menu
      onOpenChevronClick?: () => void;                // → open modal
    }
    ```
    Internal layout (left → right):
    1. **Priority dot** — 8px button, color + size per priority token. Clickable (`aria-label="Priority: <level>"`).
    2. **Checkbox** (Checkbox from step 2).
    3. **Title** — single-click enters inline edit (renders a TextInput inline with autoFocus, Enter saves, Esc cancels). When not editing, `<span>{title}</span>` with `data-state="inline-editable"` for hover affordances. Title text uses `text-body`.
       - Inline-edit pattern: parent owns the editing state via `inlineEditMode?: boolean` prop + `onTitleCommitInlineEdit(newTitle)` callback. Component-level: when prop is true, render TextInput; else render `<span>`.
    4. **Recurring icon** — tiny 12px Lucide `Repeat` between title and date chip if `item.recurrence != null`.
    5. **Multi-day chip** (component from step 8) — appears if `item.start_date !== null && item.start_date !== item.due_date`. Compute `day` as `daysBetween(start_date, today) + 1`, `total` as `daysBetween(start_date, due_date) + 1`.
    6. **Date chip** — only shown when meaningful: today / tomorrow / overdue / > 7 days out. Click → `onDateClick`. ARIA long-form label via `formatDateLong`.
    7. **Tag chips** — up to 2 visible (rendered as small Pill buttons with `text-small` `tag-text` on `tag-bg`, clickable to navigate). "+N" overflow button if more than 2; click → expand inline (a small inline popover that just renders the rest of the chips; task-06 ships the basic inline-expand; if it's overly fiddly, render a Tooltip listing the extras and require modal for full editing).
    8. **Subtask progress chip** — small `<N>/<M>` chip in `text-small` `text-subtle` only when subtasks exist. Click → `onSubtaskChipClick` (open modal at subtask section).
    9. **Hover affordances** — ⋯ IconButton + 16px `ChevronRight` "Open" IconButton at the right edge. Visible on hover-in instantly, disappear on hover-out with 120ms grace (per interaction-patterns §2.1).
    
    **States** — `data-state="hover|focus|selected|multi-selected|overdue|multi-day|completed|loading|error|dragging|drop-target"`. CSS rules per §23.4.
    
    **ARIA**: `role="listitem"` inside a `role="list"` parent (the view supplies). `aria-label` is the long-form per microcopy §29:
    `Task: "<Title>", priority <level>, due <date>, <N> tags<, recurring><, day <N> of <M>><, in <Project>>` — composed from props.
    
    **Keyboard** (when `isFocused`): Space toggles checkbox (calls `onToggleCheckbox`). Enter or O opens modal (calls `onClick`). 1/2/3/4 sets priority (calls `onPriorityClick` with a hint — task-08 wires the hint into a direct PATCH). T schedules to today (calls a new prop `onScheduleTodayKeyboard`; if absent, no-op). Delete/Backspace → `onMenuOpen` then "Delete" (or, simpler: parent handles via the row's selected state; the row just exposes a `onDeleteRequest` prop). For task-06, expose enough callbacks that task-08 can wire each shortcut.
    
    **Mobile swipe (per §40)** — implement the gesture via PointerEvents. Right-swipe ≥ 30% width: triggers `onToggleCheckbox`. Left-swipe ≥ 50% width: reveals the action drawer (two action buttons "Schedule" + "Delete" — calls `onScheduleSwipe` and `onDeleteSwipe` respectively when tapped). Above-threshold = drawer stays open after release; below = snaps back. Ships, NOT QA-targeted.
    
    **Reduced motion**: strike-through + fade-collapse skipped — opacity-only `motion-instant`. The drawer slide-reveal is instant.
15. **Tests** — per component. The TaskListRow test is the largest:
    - Default render: priority dot color matches priority; checkbox at correct state; title rendered; tag chips count rendered.
    - Inline edit: click title → TextInput appears with autofocus; type new title + Enter → `onTitleCommitInlineEdit('new title')`; Esc cancels.
    - Date chip: only renders when meaningful (today / tomorrow / overdue / > 7 days). For a task due tomorrow + sort by due_asc, the chip shows "Tomorrow"; ARIA long-form is "Thursday, May 19, 2026".
    - Multi-day: with start_date != due_date, the multi-day chip renders with correct day/total.
    - Tag chips: 3 tags rendered → 2 visible + "+1" overflow.
    - Hover affordances: hover the row → ⋯ and Open chevron appear; un-hover → disappear with 120ms delay.
    - Keyboard: focus + Space → `onToggleCheckbox`; focus + Enter → `onClick`; focus + O → `onClick`.
    - ARIA label includes the priority / date / tags count.
    - Overdue: `data-state` includes `overdue`; date chip text uses overdue token.
    - Mobile swipe-right → `onToggleCheckbox` fired (simulate via PointerEvents).
    - Inline tag-chip click → `onTagClick(tagId)` not `onClick` (event stop-propagation).
16. **Update sidebar in task-04 to use the real components** — replace any remaining inline placeholders in `apps/web/src/components/sidebar/` with `SidebarNavItem`, `FolderHeader`, `ProjectRow`, `SyncFooter`. Verify the count badges on Today (with overdue sub-badge) still work using `useItems({ view: 'today' })`.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — all new component tests pass; TaskListRow test covers the cases enumerated in step 15.
- [ ] Sidebar in task-04's app now uses real `SidebarNavItem` / `FolderHeader` / `ProjectRow` / `SyncFooter` — visual regression should be zero (the inline placeholders styled the same way).
- [ ] Today sidebar nav item shows `Today (N) ·O` when overdue > 0; the amber pill is the rendered `accent`-bg badge.
- [ ] Manual: render a Storybook-shaped story file or render TaskListRow in a dev-only sandbox view — confirm priority dot sizes (6/6/8/10 px), date chip + recurring icon + multi-day chip + tag chips all render per `screens.md` Today view.
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/web/src/lib/date-fmt.ts`, `apps/web/src/lib/a11y.ts`
  - `apps/web/src/components/checkbox/` (+ test)
  - `apps/web/src/components/subtask-checkbox/` (+ test)
  - `apps/web/src/components/card/` (+ test)
  - `apps/web/src/components/filter-chip/` (+ test)
  - `apps/web/src/components/sort-dropdown/` (+ test)
  - `apps/web/src/components/view-toggle/` (+ test)
  - `apps/web/src/components/multi-day-chip/` (+ test)
  - `apps/web/src/components/sidebar-nav-item/` (+ test)
  - `apps/web/src/components/folder-header/` (+ test)
  - `apps/web/src/components/project-row/` (+ test)
  - `apps/web/src/components/sync-footer/` (+ test)
  - `apps/web/src/components/quick-add-input/` (+ test)
  - `apps/web/src/components/task-list-row/` — index.tsx (the largest), styles.module.css, `__tests__/TaskListRow.test.tsx`
- Modified:
  - `apps/web/src/components/sidebar/index.tsx` and its sub-files — use the real components.
