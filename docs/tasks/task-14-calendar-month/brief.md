# Task 14 — Calendar (month view) + filter chips incl. "Show completed"

## Goal

Build the calendar month view: a 7-column grid (Sunday or Monday first per `week_start` config), 6 rows of day cells, with event chips rendered per item. Multi-day items render as continuous horizontal bars spanning the day cells (with start/end emphasis + middle-day faint continuation). "+N more" overflow opens the Day-detail popover (per UX §34) showing the full task list for that day. Filter chips above the calendar let the user narrow by project / tag, plus the **"Show completed" chip** (the addition per binding resolution §4.6) which toggles inclusion of completed items in the calendar. Calendar is a global view: items from EVERY project show, with optional filtering. **Reschedule is via click → modal only** — drag-to-reschedule is CUT (binding resolution §1.1).

## Context files

- `docs/ux/component-inventory.md#26-calendar-day-cell--month-view-`, §27 calendar event chip (month), §32 multi-day chip, §34 day-detail popover, §29 filter chip.
- `docs/ux/screens.md` — Calendar view (month) + Day-detail popover.
- `docs/ux/flows.md` — §9 calendar use (clicking chips, filter chips, "+N more").
- `docs/ux/microcopy.md` — §24 Calendar view copy (page title, month/year header, "+N more", day-detail popover title + subline, "Add task on <Mon DD>", empty month).
- `docs/ux/accessibility.md` — §3.8 calendar grid ARIA (`role="grid"`, `columnheader`, `gridcell` with full-date `aria-label`), §3.12.7 "+N more" ARIA, §2.3 calendar keyboard map (arrows day; ↑↓ week; PgUp/PgDn month; T jump-to-today; Enter day-detail; N new task on day).
- `docs/ux/interaction-patterns.md` — §10 filter chips, §14 right-click context menu (Calendar day cell + event chip).
- `docs/engineering/2026-05-18-feature-mapping.md#8-1-month-view`, §8.3 day-detail, §8.4 filter chips, §8.5 click-to-modal reschedule (drag CUT).
- `docs/engineering/2026-05-18-open-questions.md#0-binding-resolutions-user-2026-05-18` items #1.1 (drag CUT) + #4.6 (Show completed IN v1).
- `docs/brainstorm/product-spec.md#6-9-calendar-view`.

## Downstream dependencies

- **Task 15** ships the week view + per-project Kanban. Week view shares the same data-fetching model (`useItems({ view: 'all' })` + client-side filter to the visible range) and the same filter chips. Keep `CalendarFiltersBar` reusable.
- **Task 17** (SSE) — multi-tab calendar sync works after task-17.
- **Task 19** (a11y audit) — calendar grid is the most complex grid in v1; axe + manual SR walkthrough confirm.

## Steps

1. **Calendar route** — `apps/web/src/routes/calendar.index.tsx` redirects to `/calendar/month`. `routes/calendar.month.tsx` renders `<CalendarMonthView />`.
2. **Data model** — `apps/web/src/views/calendar-view/use-calendar-items.ts`:
   - `useItems({ view: 'all' })` fetches every active item.
   - If the "Show completed" chip is active, ALSO `useItems({ view: 'completed' })` and merge.
   - Apply filter chips client-side (project / tag / status) — derived from URL search params via TanStack Router.
   - Group items by the dates they appear on: a single-day item appears only on `due_date`; a multi-day item appears on every date in `[start_date, due_date]`. Return a `Map<LocalDate, Item[]>`.
3. **Month layout** — `apps/web/src/views/calendar-view/month.tsx`:
   - Header row: `< {Month YYYY} >` with chevron-left / chevron-right IconButtons that navigate `currentMonth` state (Zustand or URL search param `?month=2026-05`). Click on "{Month YYYY}" → opens a month-year picker popover (simple: a small grid of months + a year arrow; deferred polish — for v1, just chevrons).
   - View toggle: Month · Week (`/calendar/week` is task-15). Active = Month.
   - Filter chips bar (per UX §29): renders active filter chips (each with X dismiss); "Clear all" link when 2+ chips active; "+ Filter" Dropdown trigger opens a menu with options: "Filter by project…" (opens project picker → applies chip), "Filter by tag…" (opens tag picker), "Show completed" (a toggle filter chip — when off, click adds; when on, the chip is visible and clicking X removes it). Per microcopy §10 chip label formats.
   - Grid: a 7-column CSS grid. First row = weekday headers (S M T W T F S — respecting `week_start`). Remaining rows = day cells (typically 5 weeks visible, but always 6 rows to keep height stable, with the prior-month tail and next-month head shown muted).
   - Each day cell: `apps/web/src/components/calendar-day-cell/` (task-06 didn't build this — ship here). Per UX §26: min 96px height desktop, equal column width. Top-left day number; today is an `accent`-filled circle with `text-on-accent` text. Out-of-month: text=`text-muted` bg=`canvas-subtle`. Body: stack of event chips (first 4 + "+N more"). Each cell has `role="gridcell"` with full-date `aria-label`.
4. **Event chip component** — `apps/web/src/components/calendar-event-chip/` (per UX §27):
   - Variants: timed, all-day, multi-day span. Each item renders ONE chip per day cell it appears on; multi-day spans share visual continuity (start day shows title + "Day 1 of M", middle days show a faint continuation bar, end day shows title + "Day M of M").
   - Priority left-border 2px per priority color (none=no border).
   - Click → opens Task modal (`taskModalStore.openEdit(item.id)`).
   - Right-click → context menu (Open / Edit date… / Move to project… / Delete) per UX `interaction-patterns.md` §14.
   - ARIA: `role="button"` with `aria-label="Event: <title>, <date or span>, priority <level>"` (per accessibility §3.8).
   - Overdue treatment: title text=`text-overdue`, priority border replaced with overdue 2px, subtle row tint.
   - Completed treatment (when "Show completed" chip is active): strike-through + opacity 0.6.
   - **Multi-day positioning**: the start-day cell renders the title + "Day 1 of M" chip; the middle-day cells render a thin continuation bar (height 18-20px, faint `tag-bg` color); the end-day cell renders title + "Day M of M". The continuation is implemented via CSS grid spanning OR via per-day-cell chips with shared `data-item-id` and `data-day-position={'start'|'middle'|'end'}` so the styles connect them visually. **Decision**: implement as per-day-cell chips with a small grid trick — when the row layout permits, the chip's CSS uses negative margin / overflow to visually connect adjacent chips of the same item. Document the approach.
5. **Day-detail popover** — `apps/web/src/views/calendar-view/day-detail.tsx`:
   - Per UX §34: a popover (or Sheet on mobile) anchored to the cell. Header: date (`text-h2`) + subline "<N> items" (microcopy §24). Body: scrolling list of TaskListRow (full-fidelity rows). Footer: "Add task on <Mon DD>" (per microcopy §24) → opens Task modal with `initialDueDate` pre-filled to that day.
   - ARIA: `role="dialog"` with `aria-modal="false"` (anchored, not full modal); Tab cycles through rows; Esc closes.
   - The "+N more" link is `<button aria-label="View N more events on <Day, Mon DD>" aria-haspopup="dialog" aria-expanded>`.
   - Open via click on the "+N more" link OR via `Enter` on a focused day cell.
6. **Click-to-modal reschedule (the v1 reschedule path)** — clicking an event chip opens the Task modal. Drag is CUT — do NOT wire `@dnd-kit` for calendar in v1. The day cell's right-click context menu has "Edit date…" which opens the modal focused on the date field. Document the v1 limit in `known-issues.md` (task-20).
7. **Keyboard navigation** per accessibility §2.3 calendar map:
   - Initial focus on calendar entry: today's cell (if in visible month), else first day of visible range.
   - `←→` move focus between cells (day).
   - `↑↓` move focus between weeks (cell exactly 7 ahead/behind).
   - `Page Up / Page Down` previous / next month.
   - `Shift+Page Up / Page Down` previous / next year.
   - `Home / End` start/end of week.
   - `T` jump to today (if today is in a different month, navigate to that month; focus today's cell).
   - `Enter` opens day-detail popover.
   - `N` opens Task modal with date pre-filled (per `microcopy.md` §2 "Add task on <focused day>" placeholder behavior).
   - Wire via a local `useEffect` keylistener (task-18 will consolidate via hotkey registry).
8. **Empty state** — when no items intersect the visible month AND no filter chips → "No events this month." + "Press N to create one on the focused day." (microcopy §24 / §5).
9. **Filter chips ("Show completed" specifically)** — `apps/web/src/views/calendar-view/filters.ts`:
   - Filter state in URL search params: `filter_project_id?: string`, `filter_tag_id?: string`, `show_completed?: 'true'`.
   - When `show_completed=true`, fetch `view=completed` items in addition to `view=all`. Merge.
   - Filter chip render: each chip is per UX §29 with the appropriate label format ("Project: <name>", "Tag: <name>", "Show completed"). Dismiss removes the chip from URL.
   - "Clear all" link when ≥2 chips active.
   - Filter dropdown trigger ("+ Filter" Ghost button): opens a menu with sub-pickers per filter type. The "Show completed" entry is a checkbox-style toggle in the menu.
   - SR announcement: "Filter applied: <facet> <value>. <N> items shown." (microcopy §26 + accessibility §3.14 — task-18 will consolidate via the announce helper from task-06).
10. **Performance** — `architecture.md` §10: calendar month never virtualizes (42 cells × ~4 chips bounded by "+N more"). Day-detail popover virtualizes when > 50 items (task-19 wires the threshold; for task-14, render without virtualization).
11. **Tests** — `apps/web/src/views/calendar-view/__tests__/`:
    - `month-view.test.tsx`: seed items across a month (some today, some next week, one multi-day spanning May 18-22, one overdue from prior month). Render calendar at May 2026. Assert today's cell has the accent-filled circle. Assert the multi-day item renders as 5 chips with appropriate Day 1/5 and Day 5/5 emphasis. Assert "+N more" link appears when a cell has > 4 items.
    - `month-keyboard-nav.test.tsx`: focus today's cell, press ← → assert focus moved to yesterday's cell; ↑ → previous week; Page Down → next month; T → jumps to today.
    - `month-filter-chips.test.tsx`: apply a project filter → only that project's items render. Toggle "Show completed" → completed items appear with strike-through + 0.6 opacity. Clear all → reset.
    - `day-detail-popover.test.tsx`: click "+N more" → popover opens with full row list. Click row → modal opens. Click "Add task on <Mon DD>" → modal opens with initialDueDate pre-filled.
    - `month-week-start.test.tsx`: with `week_start: 'sun'` → header row starts with S; with `week_start: 'mon'` → starts with M.
    - `month-empty.test.tsx`: no items in visible month → empty state with the microcopy strings.
    - `month-overdue-render.test.tsx`: an item due in a prior month (overdue, still showing in Today) does not render on the calendar's current month — but if the user navigates back to that prior month, it does render with overdue treatment.
    - `calendar-no-drag.test.tsx`: smoke test that the chip has NO drag listener; the only interaction is click → modal.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — every test in step 11 passes.
- [ ] Manual: navigate to Calendar. Today's cell has accent-filled circle. Items render on their dates. Multi-day item renders as a continuous bar across days with appropriate emphasis.
- [ ] Manual: "+N more" on a busy day opens the day-detail popover showing all events; clicking one opens the Task modal.
- [ ] Manual: filter chips work: pick a project from "+ Filter" → only that project's events render; toggle "Show completed" → completed items appear with strike-through.
- [ ] Manual: Keyboard — arrow keys navigate cells; `T` jumps to today (even from another month); `N` on a focused day opens the Task modal with that date pre-filled (Project remains empty per §9.4 #8).
- [ ] Manual: clicking an event chip opens the Task modal — confirmed there is NO drag interaction in v1 calendar.
- [ ] Manual: week-start setting flips the column order (Sun first vs Mon first).
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/web/src/views/calendar-view/` — `month.tsx`, `day-detail.tsx`, `use-calendar-items.ts`, `filters.ts`, `__tests__/*.test.tsx`
  - `apps/web/src/components/calendar-day-cell/` (+ test)
  - `apps/web/src/components/calendar-event-chip/` (+ test)
- Modified:
  - `apps/web/src/routes/calendar.index.tsx` — redirect to month.
  - `apps/web/src/routes/calendar.month.tsx` — render `<CalendarMonthView />`.
  - `apps/web/src/components/filter-chip/` — wire the "Show completed" variant.
