# Task 15 — Calendar week view + per-project Kanban view

## Goal

Two views in one task because each is medium-sized and both consume earlier infrastructure (filter chips from task-14 reused for week; dnd-kit from task-10 wired for kanban; task modal from task-07 + recurrence from task-11 for completion via Done column).

1. **Calendar week view** at `/calendar/week`: an all-day strip at the top (full-width spanning across day columns, holds all-day items + multi-day spans) + a time-grid below (hours run vertically; each day a column; timed items render as 30-min blocks anchored at start time). View toggle Month↔Week. Same filter chips as month (including "Show completed"). **Reschedule via click → modal only — drag is CUT for v1.**
2. **Per-project Kanban view** at `/project/$id/kanban`: 3 fixed columns To Do / In Progress / Done, only `type === 'task'` items (Epics/Features/Subtasks excluded per §9.4 #1). Drag a card between columns → status mutates (status drag IS allowed; only calendar drag is CUT). Drag within a column → reorder. Card layout per UX §25 (priority left-edge stripe, title + meta row with tags + subtask progress + date chip when today/overdue). Done column shows "Showing recent 50, [Show all]" affordance after 50 items. Empty board + empty column states per microcopy.

## Context files

- `docs/ux/component-inventory.md#28-calendar-week-view-event-block`, §24 kanban column header, §25 kanban card, §31 view toggle, §35.4 per-column empty.
- `docs/ux/screens.md` — calendar week, per-project Kanban.
- `docs/ux/flows.md` — §8 kanban use, §9 calendar week (drag CUT — adapt the click → modal flow).
- `docs/ux/microcopy.md` — §24 calendar view copy (week range header "<Mon DD> – <Mon DD>, <Year>"), §25 kanban view copy (To Do / In Progress / Done / per-column empty / whole-board empty / Done column "Showing recent 50, [Show all]"), §7 snackbar "Status: <In Progress / Done / To Do>." per drag commit.
- `docs/ux/accessibility.md` — §3.7 kanban grid ARIA (`role="region"` + per-column `role="list"`; cards `role="listitem"`); §2.3 kanban keyboard map (↑↓ reorder within column; ←→ move card to previous/next column = status mutate; Enter / O modal; Space / X toggle complete).
- `docs/ux/interaction-patterns.md` — §1.3 (no drag-on-touch refinement here; kanban is desktop-primary), §14 right-click on kanban card.
- `docs/engineering/2026-05-18-feature-mapping.md#6-3-kanban-view`, §8.2 week view.
- `docs/engineering/2026-05-18-open-questions.md#0-binding-resolutions-user-2026-05-18` — #1.1 calendar drag CUT (re-confirm), #1.3 Done column overflow at threshold.
- `docs/brainstorm/product-spec.md#6-8-kanban-view`, §9.4 #1 (Kanban shows only Tasks).

## Downstream dependencies

- **Task 17** (SSE) — multi-tab updates cross both views.
- **Task 18** consolidates keyboard registry (kanban + calendar week-specific keys land in the registry).
- **Task 19** virtualizes Kanban columns when > 50 cards per column.

## Steps

### Part A — Calendar week view

1. **Route** — `apps/web/src/routes/calendar.week.tsx` renders `<CalendarWeekView />`.
2. **Week range state** — URL search param `?week=<YYYY-MM-DD>` (Monday or Sunday of the week per `week_start`). Chevron navigation moves the week by ±7 days.
3. **Layout** — `apps/web/src/views/calendar-view/week.tsx`:
   - Header: `< <Mon DD> – <Mon DD>, <Year> >` (microcopy §24 week range header) + view toggle (Month · Week) + filter chips bar (reused from task-14's `CalendarFiltersBar`).
   - Body grid: a top "all-day" strip + a time-column grid.
   - All-day strip: for each day column (7 cols), render any item whose `due_time === null` OR whose multi-day span includes that day. Multi-day spans render as continuous bars across days (same logic as month view — adapt the chip layout). Each chip is the same `CalendarEventChip` from task-14 but with the appropriate "compact" variant prop.
   - Time grid: 24 rows (hours 0-23) × 7 columns (days). Each cell is empty unless a timed item starts in that hour. Implement using a CSS grid with `grid-template-rows: repeat(24, var(--hour-row-height))`. Timed items render as `CalendarWeekBlock` components positioned via inline `style={{ gridRow: <hourIndex>, gridColumn: <dayIndex>, height: '...' }}`.
4. **CalendarWeekBlock component** — `apps/web/src/components/calendar-week-block/`:
   - Per UX §28: a 30-minute block at the start time, `accent-subtle` bg + `accent` left-border (or use priority for the left border same as month per UX §28 second sentence — pick **priority for left-border** for visual consistency with month chips). Title + time-of-day inside.
   - Click → opens Task modal.
   - Right-click → context menu.
   - **No drag** for reschedule or re-time in v1 (per binding resolution #1.1 — though the original UX §28.3 mentioned vertical-drag-to-retime + horizontal-drag-to-reschedule, both are CUT for v1).
   - ARIA: `role="button"` with full label.
5. **Filter chips** — reuse `CalendarFiltersBar` from task-14. "Show completed" toggles inclusion of completed items in both the all-day strip and time grid.
6. **Keyboard nav** — arrow keys move focus across day cells in the all-day strip; ↑↓ scroll the time grid (which is a separate scrollable container). `T` jumps to today (or this week if today is in another week, navigate week + focus today's column). `N` opens Task modal with date pre-filled (and time pre-filled if the focus is on a specific hour).
7. **Empty week** — when no items in the visible range: empty state "No events this week." (a small variant; v1 ships "No events this month." for month; for week, use the same shape with adapted subline "A quiet week.").
8. **Tests** — `apps/web/src/views/calendar-view/__tests__/week-view.test.tsx`:
   - Seed items: 2 timed (9am, 11:30am), 1 all-day, 1 multi-day spanning Mon-Fri. Render the week view at the appropriate Monday. Assert each renders correctly: 2 timed blocks at their hour rows; 2 chips in the all-day strip; multi-day bar spans 5 columns.
   - Filter to a project → only that project's events.
   - Click a timed block → modal opens with that item.
   - `T` jumps to current week.
   - "Show completed" toggles inclusion.
   - Smoke test: NO drag listener on `CalendarWeekBlock` (per CUT).

### Part B — Per-project Kanban view

9. **Route** — `apps/web/src/routes/project.$id.kanban.tsx` already exists as a stub (task-09); fill with `<KanbanView projectId={id} />`.
10. **Data** — `apps/web/src/views/project-view/kanban-view.tsx`:
    - `useItems({ view: 'project', project_id: id, include_completed: true })` — Kanban needs done items for the Done column.
    - Client-side filter: only `item.type === 'task'` (Kanban shows only Tasks per §9.4 #1).
    - Group into 3 columns by `status`. Within each column, sort by `sort_order` ascending.
    - Done column: slice to first 50 by default; "Show all" link expands.
11. **Kanban column** — `apps/web/src/components/kanban-column/` (per UX §24):
    - Header: title (`text-h3`) + count badge `(N)` (`text-small-strong`) + `+` IconButton on the right (creates a new Task with `status` pre-set to this column AND project pre-filled — destination-context exception per §9.4 #8 + interaction-patterns §6.4). Status indicator dot at left.
    - Body: a `role="list"` of `KanbanCard` items.
    - Per UX §35.4 per-column empty: faint dashed border + "No items" centered (smaller than full-view empty state).
12. **Kanban card** — `apps/web/src/components/kanban-card/` (per UX §25):
    - Priority left-edge stripe (full-height, 2 or 3 px wide per priority); `priority-none` = no stripe.
    - Title (`text-h3`, can wrap up to 2 lines with ellipsis on 3rd).
    - Meta row: up to 2 tag chips + "+N" overflow, subtask progress chip `2/5` if subtasks, date chip ONLY if overdue or today (per UX §25.2). Tomorrow / later: no date chip on the card.
    - States per §25.4: default / hover / focus / selected (multi-select) / dragging / overdue / completed.
    - Multi-selected variant: 4px `accent` left-edge stripe replaces priority stripe; priority moves inline as an 8px dot next to title (per UX §25.4 — the resolution there).
    - Click → opens Task modal.
    - Right-click → context menu (Open / Edit tags / Move to project… / Reschedule / Set priority / Delete) — same as Task list row.
    - ARIA: `role="listitem"` with full `aria-label` per microcopy §29.
13. **Kanban view layout** — 3 columns, horizontal CSS grid with equal column widths (or a flex with min-width per column). Sticky column headers when scrolling within a column (each column body is independently scrollable when content overflows vertically).
14. **Drag-and-drop** — wire `@dnd-kit/sortable` from task-10:
    - Each column body is a `useDroppable` with `id: column.status` and `accepts: 'kanban-card'`.
    - Each card is `useSortable` with `data: { itemId, status }`.
    - On drop: if cross-column → PATCH `status` to new column's status (optimistic via `useOptimisticMutation`); snackbar "Status: <In Progress / Done / To Do>." (microcopy §7). Drop on Done → COMPLETES the task (server's PATCH path detects status=done → if recurrence != null, atomic complete-recurring per task-11, returns `{completed, next}`, snackbar "Task completed. Next: <date>." with Undo).
    - On drop within same column → PATCH `sort_order`.
    - Drag visuals from task-10's `<DragOverlay>` apply.
    - Reduced-motion: no scale on drag pickup; instant drop snap.
15. **Keyboard nav** — focused card:
    - `↑↓` reorder within column (PATCH sort_order, optimistic FLIP).
    - `←→` move card to previous/next column (PATCH status). Drop on Done → completion sequence.
    - `Enter` / `O` opens modal.
    - `Space` / `X` toggles complete (drag-to-Done equivalent).
16. **Done column overflow** — when Done has > 50 cards, the column body shows the first 50, then a footer "Showing recent 50, [Show all]" (microcopy §25). Click "Show all" → fetches without limit (or sets `showAll: true` in local state; data already loaded since we fetch with `include_completed`; just stop slicing). Per binding resolution #1.3 — implementer's call on UX; this is the chosen approach.
17. **+ Add task per column** — clicking column header's `+` opens Task modal with `initialTitle: ''` (empty; user types) + `initialProjectId: project.id` (destination context — project IS pre-filled per the kanban exception) + `initialStatus: <column.status>` (per microcopy §25 column add button). Date is NOT pre-filled (the user picks).
18. **Empty board** — when ALL columns are empty: full-view empty state "No tasks here yet." + subline "Drag from another project or add one." (microcopy §25).
19. **Multi-select within Kanban** — same patterns from task-12: shift-click + ⌘-click + ⌘A. Bulk toolbar appears. Note: cards are multi-selectable within a single column only (per `interaction-patterns.md` §3.3 — cross-column multi-select is disabled).
20. **Tests** — `apps/web/src/views/project-view/__tests__/`:
    - `kanban-view.test.tsx`: seed a hierarchical project with 1 Epic, 2 Features, 6 Tasks (3 To Do, 2 In Progress, 1 Done), 2 Subtasks. Switch to Kanban via view toggle. Assert only the 6 Tasks render as cards (Epics, Features, Subtasks excluded). Counts per column correct.
    - `kanban-drag-status.test.tsx`: drag a card from To Do to In Progress → PATCH /api/items/:id with status=in_progress; card moves visually.
    - `kanban-drag-to-done.test.tsx`: drag a card to Done → PATCH with status=done; if recurring, snackbar with "Next: <date>." and undo reverses both.
    - `kanban-keyboard-arrows.test.tsx`: focus a card, press → → status mutates to next column; press Space → toggles complete.
    - `kanban-done-overflow.test.tsx`: seed 60 Done items; Done column shows first 50 + "Showing recent 50, [Show all]"; click "Show all" → all 60 visible.
    - `kanban-add-task.test.tsx`: click + on In Progress column → modal opens with project + status pre-filled (date empty).
    - `kanban-empty-board.test.tsx`: no Tasks in project → full empty state.
    - `kanban-empty-column.test.tsx`: To Do empty but others have cards → per-column "No items" inline empty.
    - `kanban-mobile-touch.test.tsx`: smoke test that long-press on a card enters multi-select mode (mobile gesture from task-06).

## Acceptance criteria

- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — every test in step 8 (week) + 20 (kanban) passes.
- [ ] Manual: navigate to `/calendar/week`. The week range header shows "Mon DD – Sun DD, YYYY". Items render in all-day strip + time grid at correct hours. Multi-day items span across day columns. Filter chips work including "Show completed".
- [ ] Manual: clicking a timed block opens the Task modal (no drag CUT for v1).
- [ ] Manual: navigate to a hierarchical project's Kanban view via the view toggle. Cards render in 3 columns; only Tasks (no Epics/Features/Subtasks). Counts correct.
- [ ] Manual: drag a card from To Do to In Progress → it moves; status PATCH fires; snackbar "Status: In Progress."; multi-tab (after task-17) reflects.
- [ ] Manual: drag a Task with a recurrence to Done → completion sequence runs; snackbar "Task completed. Next: <date>."; undo reverses both.
- [ ] Manual: per-column `+` opens Task modal with project + status pre-filled, date empty.
- [ ] Manual: Done column with 60 items shows "Showing recent 50, [Show all]"; clicking expands.
- [ ] Manual: keyboard arrows on a focused card reorder/move-column as specified.
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/web/src/views/calendar-view/week.tsx` (+ test)
  - `apps/web/src/components/calendar-week-block/` (+ test)
  - `apps/web/src/views/project-view/kanban-view.tsx` (+ tests as listed)
  - `apps/web/src/components/kanban-column/` (+ test)
  - `apps/web/src/components/kanban-card/` (+ test)
- Modified:
  - `apps/web/src/routes/calendar.week.tsx` — render `<CalendarWeekView />`.
  - `apps/web/src/routes/project.$id.kanban.tsx` — render `<KanbanView />`.
  - `apps/web/src/components/view-toggle/` — for hierarchical project, Tree↔Kanban; for flat, List↔Kanban (already wired in task-09 — verify Kanban is the second tab).
