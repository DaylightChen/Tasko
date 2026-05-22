# Task 08 — Smart list views (Today / Tomorrow / Next 7 Days / Inbox / All)

## Goal

Bring the five smart-list views to life: Today (with overdue strip + multi-day chips + "Move all overdue to today" → triggers a stub bulk endpoint that lands in task-12, so for now the action just calls a placeholder snackbar), Tomorrow, Next 7 Days (with day-group headers + cross-day reschedule via row drag is task-10, here just static groups), Inbox (with "N items waiting to be filed" subline), All (with project breadcrumbs). The optimistic-mutation pattern + Zustand `undoStore` + snackbar Undo ship here. Each view composes TaskListRow (task-06), QuickAddInput (task-06), SortDropdown (task-06), EmptyState (task-05). The `useOptimisticMutation` hook is built here as the central pattern for tasks 09+. Sidebar count badges from task-04's stubs become real numbers (the same TanStack Query data feeds both views and counts).

## Context files

- `docs/ux/screens.md` — Today (populated / empty / first-run), Tomorrow, Next 7 Days, Inbox, All — every screen rendered in this task. Empty state strings + warm flourishes.
- `docs/ux/flows.md` — §2 daily flow (the complete-task animation sequence + snackbar undo), §3 weekly review (Inbox triage), §4 multi-day work, §7 overdue clearing (per-item AND bulk).
- `docs/ux/microcopy.md` — §5 empty states for each view, §7 snackbar variants ("Task completed. Undo." 5s, "Task moved to Trash. Undo.", "N items moved to today. Undo." for bulk overdue), §14 Inbox subline, §15 All subline, §20 Today copy ("Overdue (N)" + "Move all overdue to today"), §21 Next 7 Days day-group headers, §22 Tomorrow.
- `docs/ux/interaction-patterns.md` — §6 optimistic update + rollback, §7 animation token reuse (the 200ms strike → 300ms fade-collapse sequence), §9 empty-state hierarchy (first-run vs returning-user detection), §11 confirmation policy (Move all overdue confirmation), §12 undo policy.
- `docs/ux/accessibility.md` — §3.11 sidebar nav with overdue sub-badge ARIA, §5 SR announcements ("<Title> completed. Undo available." `polite`).
- `docs/engineering/2026-05-18-feature-mapping.md#3-today-view`, §4 Tomorrow/Next 7 Days/Inbox/All — module + endpoint map.
- `docs/engineering/2026-05-18-frontend-architecture.md#4-4-mutation-pattern--optimistic--undo-` — full `useToggleComplete` example to mirror.
- `docs/engineering/2026-05-18-api.md` — §2.1 GET /api/items view filters; §7.1 POST /api/bulk/move-overdue-to-today (built in task-12; for task-08 stub call is fine).
- `docs/engineering/2026-05-18-data-model.md#3-5-active-vs-completed-vs-trashed-state-matrix` — Today view shows only active + non-completed.
- `docs/brainstorm/product-spec.md#6-2-daily-flow` — full narrative.
- `docs/brainstorm/product-spec.md#9-4-ambiguities----resolved-before-ux-phase` — #4 Today is strictly date-driven.

## Downstream dependencies

- **Task 09** adds Tree / Flat list per-project views — they use the same `useOptimisticMutation` and `useFocusedRow` patterns shipped here.
- **Task 10** adds drag-and-drop: row reorder inside Today / Inbox / All (sort_order PATCH) and cross-day reschedule in Next 7 Days (date PATCH). Today + Next 7 Days are the most user-visible drag surfaces.
- **Task 11** wires the recurring atomic-op response into the existing `usePatchItem` mutation (the response shape changes to `{completed, next}` for recurring items; the hook handles both).
- **Task 12** delivers the real bulk endpoints + Trash view. The "Move all overdue to today" stub here becomes a real `useBulkMoveOverdue` mutation.
- **Task 16** adds Completed + per-tag views using the same patterns established here.
- **Task 18** ties single-key shortcuts (T/I/J/K/Space/1-4/Backspace) to the focused row across all these views.

## Steps

1. **`useOptimisticMutation` helper** — `apps/web/src/hooks/useOptimisticMutation.ts` per `code-architecture.md` §4.4. Wraps `useMutation` with:
   - `onMutate` snapshots prior cache for the affected keys, applies the optimistic patch, invalidates lists, pushes an undo entry into `undoStore`.
   - `onError` rolls back to prior cache; calls `snackbar.show({ variant: 'error', text: 'Couldn\'t save. Try again.' })` per microcopy §28.2.
   - `onSuccess` replaces cache with server response.
   - Signature per `code-architecture.md` §4.4 — `buildOptimistic`, `buildUndo`, `buildSnackbar`, `invalidate`.
2. **`undoStore`** — `apps/web/src/store/undo.ts` per `code-architecture.md` §4.3 and §11. Single-step v1; `current: UndoEntry | null`. On push, replace prior + start a 5s timeout that clears. On pop, call `current.apply()` then set null. **Public surface:** `push`, `pop`, `clear`, `current`. The Snackbar's Undo button calls `undoStore.pop()`. Task-18 will wire `⌘Z` → `undoStore.pop()`.
3. **`useFocusedRow`** — `apps/web/src/hooks/useFocusedRow.ts` per `code-architecture.md` §4.4. Maintains a focused row id within a list view; `moveFocus(delta)` clamps to the list bounds; `setFocus(id)`. The view composes this with key handlers `J/K/Up/Down`. Persistence: scoped to the view's lifetime; resetting on view change is fine.
4. **`usePartitionOverdue`** + **`useTodayRoll`** helpers — `apps/web/src/views/today-view/partition.ts`:
   ```ts
   import { Item, LocalDate } from '@tasko/types';
   export interface TodayPartition { overdue: Item[]; todays: Item[]; }
   export function partitionOverdue(items: Item[], today: LocalDate): TodayPartition {
     // Per spec §6.2 + §9.4 #4 (strictly date-driven):
     //   overdue: items where due_date < today AND trashed_at == null AND status != 'done'
     //   todays:  items where (due_date == today) OR (start_date <= today <= due_date), AND trashed_at == null AND status != 'done', AND due_date >= today
     //   (overdue and todays are mutually exclusive; an item due today is in todays)
   }
   ```
5. **Today view** — `apps/web/src/views/today-view/index.tsx`:
   - `useItems({ view: 'today' })` (TanStack Query, key from task-04's keys factory).
   - Default sort `due_asc`; sort taken from URL search param via TanStack Router. Sort options: due date / priority / title / created (per microcopy §9). The SortDropdown lives in the view chrome row.
   - Partition into overdue + today (per step 4).
   - **Overdue strip**: header `<h2>Overdue (<N>)</h2>` per microcopy §20 + a Ghost button `<Button variant="ghost">Move all overdue to today</Button>` per microcopy §4. Click → opens ConfirmationPrompt (per microcopy §6.6: title `Move <N> overdue items to today?`, body `Their due dates will be set to today.`, primary `Move all`, not destructive — primary focused). Confirm → calls a `useBulkMoveOverdue()` mutation hook (stub for task-08: just snackbar "Bulk endpoint coming in task-12"; the real implementation lands in task-12). The animation "fly to today" is a `motion-slow` `ease-standard` transition — implement via FLIP technique (snapshot positions before mutation, animate from old to new on next paint). For task-08, the FLIP is best-effort; if it's tricky, accept an instant re-render and document in known-issues.
   - **Today section**: header `<h2>Today, <Day, Mon DD></h2>` per microcopy §20 (e.g., "Today, Wed May 18"). Then a `<ul role="list">` of TaskListRow.
   - **Empty state**: when both overdue AND todays are empty:
     - **First-run** (no user-created items ever — detect via "is there any item in the entire system, including completed/trashed"; use `useItems({ view: 'all' })` cached result or a fresh query without status filter, OR add a server `?include_completed_and_trashed=true` flag — for v1 simplicity, query `view=all` with `include_completed=true` and check both that AND the trash count via `useTrashList()` stub. If both 0 → first-run): use EmptyState with `icon: Sunrise, headline: 'Welcome to Tasko.', subline: 'Add your first task above — type it and press Enter.', tone: 'flourish'` + render a small "↑ start here" anchor next to the quick-add input. The quick-add input auto-focuses on first paint (per flows §1 step 4).
     - **Returning user**: `icon: Sun, headline: 'Nothing due today.', subline: 'You\'re caught up. Enjoy the day.', tone: 'flourish'` per microcopy §5 warm flourish #1.
   - **Quick-add**: at the top, QuickAddInput with placeholder `Add task` (microcopy §2 default). On Enter → `taskModalStore.openNew({ initialTitle: typedText })`. The opened modal has Project empty (per §9.4 #8) — the Today view does NOT pass `initialProjectId`.
   - **Mutations** wired via `useOptimisticMutation`:
     - `useToggleComplete(id, nextStatus)`: PATCH `status`; optimistic: set `status` + `completed_at` in cache; undo: PATCH back; snackbar: "Task completed." with Undo action button (5s). Per microcopy §7.
     - `useReschedule(id, newDate)`: PATCH `due_date`. Optimistic. Snackbar: "Task rescheduled to <date>." (no undo button — the field change itself is reversible by editing).
     - `useChangePriority(id, newPriority)`: PATCH `priority`. Optimistic. No snackbar.
     - `useEditTitleInline(id, newTitle)`: PATCH `title`. Optimistic.
     - `useDeleteItem(id)`: triggers ConfirmationPrompt "Move to Trash?" (microcopy §6.2). Confirm → soft-delete PATCH (task-12 wires the real endpoint; for task-08, stub the call but show "Coming in task-12" snackbar to keep the flow demoable). Future task-12 will refactor to use the real `DELETE /api/items/:id` route.
   - **Parent completion blocking**: when toggling a Task with incomplete subtasks → open ConfirmationPrompt (microcopy §6.1 — "Complete all children and continue?"). Confirm → mutation sets parent status + all subtasks to 'done' atomically (this can be done client-side by issuing one PATCH item with `{ status: 'done', subtasks: [updated array] }` since whole-array subtask replacement is supported per `api.md` §2.4). Snackbar: "Task and N subtasks completed. Undo." per microcopy §7.
   - **Single-row keyboard**: focused row + `Space` toggles checkbox; `Enter`/`O` opens modal; `1-4` sets priority; `T` schedules to today (PATCH `due_date: today`); `Backspace`/`Delete` opens the soft-delete confirmation. Wire via the `useFocusedRow` hook + key handlers on the view root. (Task-18 will consolidate via the hotkey registry; here we wire ad-hoc on the view.)
6. **Tomorrow view** — `apps/web/src/views/tomorrow-view/index.tsx`:
   - `useItems({ view: 'tomorrow' })`. SortDropdown + QuickAddInput. Single section with header `<h2>Tomorrow, <Day, Mon DD></h2>`. No overdue strip.
   - Empty state: `icon: Sunrise, headline: 'Nothing scheduled for tomorrow.', subline: 'Plan ahead — add a task.'`.
   - Multi-day chip on rows whose span includes tomorrow shows mid-span chip (Day N of M, where N is calculated from start_date relative to tomorrow).
7. **Next 7 Days view** — `apps/web/src/views/next-7-view/index.tsx`:
   - `useItems({ view: 'next7' })`. Group items client-side by `due_date`, including 7 day buckets (today through today+6). For multi-day items, render them in every day bucket their span covers (with appropriate Day N of M chip).
   - Day group headers per microcopy §21: `Today, <Day Mon DD>`, `Tomorrow, <Day Mon DD>`, `<Day, Mon DD>`. With count: `<header> (N)`. Empty: `<Day, Mon DD> ─ empty` in `text-subtle`.
   - Drag-reschedule across day groups is task-10. For task-08, just render groups statically.
   - Empty state (entire view empty): `icon: CalendarDays, headline: 'Nothing in the next seven days.', subline: 'A quiet week. Or just unscheduled.'`.
8. **Inbox view** — `apps/web/src/views/inbox-view/index.tsx`:
   - `useItems({ view: 'inbox' })`. Sort default `created_desc` (per microcopy §9 — the Inbox view's sort dropdown defaults to "Created (newest)").
   - Subline above the row list when items present: `<N> items waiting to be filed.` per microcopy §14.
   - Empty state: `icon: Inbox, headline: 'Inbox is clear.', subline: 'Quick-add lands here when no project is picked.'`.
9. **All view** — `apps/web/src/views/all-view/index.tsx`:
   - `useItems({ view: 'all' })`. TaskListRow with `showProjectBreadcrumb: true` (passes a `project` prop with name + folder name). The breadcrumb renders between title and date chip per `screens.md` All view.
   - Subline above list: `Showing <N> active items across all projects.` per microcopy §15.
   - Empty state: `icon: List, headline: 'No active items.', subline: 'Add a task or start a project.'`.
10. **Sidebar count badges become real** — in `apps/web/src/components/sidebar/` (already showing Today / Tomorrow / Inbox counts via task-04's `useItems` queries), update the Today nav item to display the overdue sub-badge: split the `view=today` results into overdue + todays via the partition helper, render `(N) ·O` per UX §18.4. Today's accessible name updates: "Today, N items, O overdue" (microcopy §29 + accessibility §3.11).
11. **Wire view chrome universal layout** — each view shares a chrome layout:
    - `<header>` zone: `<h1>{title}</h1>` + SortDropdown + (FilterChips placeholder — task-14 wires for calendar; for these views, filter is post-v1 per UX §5.1 line "Filter chips per view" — but the chip area can render the chip-strip if any filter is active). For task-08, FilterChips strip just renders nothing if there are no active filters.
    - QuickAddInput row.
    - The list (or empty state).
    
    Extract into `apps/web/src/views/_shared/ViewChrome.tsx` (composable wrapper accepting `title`, `sortValue`, `onSortChange`, `quickAddPlaceholder`, `children`).
12. **Item modal trigger** — clicking anywhere on a row (other than the inline edits) opens the modal in edit mode: `taskModalStore.openEdit(item.id)`. The modal (task-07) loads the item via `useItem(id)`.
13. **Tests** — `apps/web/src/views/__tests__/`:
    - `today-view.test.tsx`: seed mock items (3 overdue, 5 today, 1 in-progress future), render Today view, assert overdue strip header "Overdue (3)" + "Move all overdue to today" button + 3 overdue rows + 5 today rows. The future in-progress item does NOT appear (per §9.4 #4 binding decision — Today is strictly date-driven).
    - `today-empty-first-run.test.tsx`: seed empty / no items + no projects beyond Inbox → assert first-run empty state with "Welcome to Tasko." + "Add your first task above — type it and press Enter." (warm flourish #2).
    - `today-empty-returning.test.tsx`: seed one trashed item (returning user, just empty today) → assert "Nothing due today." + "You're caught up. Enjoy the day." (warm flourish #1).
    - `today-complete-undo.test.tsx`: render with 1 today item; click its checkbox; assert PATCH /api/items/:id with status=done; assert snackbar "Task completed." + Undo action; click Undo within 5s; assert PATCH back to status=todo; assert the row reappears.
    - `today-rollback-on-error.test.tsx`: mock the PATCH to fail; assert row reverts to its pre-mutation state; assert error snackbar "Couldn't save. Try again." with role=alert.
    - `today-parent-completion-blocking.test.tsx`: item with 2 incomplete subtasks; click checkbox → ConfirmationPrompt "Complete all children and continue?" body "This task has 2 incomplete subtasks. Completing it will mark them all done." → Confirm → PATCH includes updated subtasks. Snackbar "Task and 2 subtasks completed. Undo.".
    - `today-keyboard.test.tsx`: focus a row via Tab; press Space → checkbox toggles; press 1/2/3/4 → priority cycles; press Enter → modal opens; press T → reschedules to today (no-op if already today).
    - `tomorrow-view.test.tsx`, `next-7-days.test.tsx`, `inbox-view.test.tsx`, `all-view.test.tsx`: smoke tests for each (render mock items, assert grouping + sublines + empty states).
14. **Manual end-to-end check** — start the server, refresh the app:
    - Create a few items via the Task modal (some today, some overdue, some tomorrow, some next-7).
    - Today shows the right rows.
    - Sidebar counts update.
    - Complete an item → animation → snackbar → Undo works within 5s.
    - Quick-add a task → modal opens with title pre-filled, Due focused, Project empty.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — every test in step 13 passes.
- [ ] Today view at runtime: overdue strip renders only when overdue > 0; "Move all overdue" opens a ConfirmationPrompt; clicking Confirm shows a snackbar (real bulk in task-12).
- [ ] Today's empty-state branches correctly: first-run (no items ever) → warm flourish #2; returning user with no items today → warm flourish #1.
- [ ] Inbox subline shows `<N> items waiting to be filed.` when N > 0.
- [ ] All view shows the project breadcrumb (`Folder · Project`) on each row.
- [ ] Tomorrow / Next 7 Days / All / Inbox: each view has a working empty state with the exact microcopy strings from §5.
- [ ] Optimistic complete: clicking a checkbox → row strike-through animation → fade-collapse → snackbar "Task completed. Undo." for 5s. After 5s, the snackbar disappears and the undo entry expires.
- [ ] `⌘Z` is registered to call `undoStore.pop()` in this task as well (task-18 will consolidate hotkey registry — for task-08, do a lightweight `useEffect` on the view root). Within 5s of completing a task, `⌘Z` undoes.
- [ ] Sidebar Today badge shows overdue count when > 0; aria-label is "Today, N items, O overdue".
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/web/src/hooks/useOptimisticMutation.ts`, `apps/web/src/hooks/useFocusedRow.ts`
  - `apps/web/src/store/undo.ts`
  - `apps/web/src/views/_shared/ViewChrome.tsx`
  - `apps/web/src/views/today-view/index.tsx`, `partition.ts`, `__tests__/*.test.tsx`
  - `apps/web/src/views/tomorrow-view/index.tsx`, `__tests__/tomorrow-view.test.tsx`
  - `apps/web/src/views/next-7-view/index.tsx`, `__tests__/next-7-days.test.tsx`
  - `apps/web/src/views/inbox-view/index.tsx`, `__tests__/inbox-view.test.tsx`
  - `apps/web/src/views/all-view/index.tsx`, `__tests__/all-view.test.tsx`
- Modified:
  - `apps/web/src/api/items.ts` — add `useToggleComplete`, `useReschedule`, `useChangePriority`, `useEditTitleInline`, `useDeleteItem` (stub call body for trash; real wiring in task-12), `useBulkMoveOverdue` (stub).
  - `apps/web/src/routes/today.tsx`, `tomorrow.tsx`, `next-7-days.tsx`, `inbox.tsx`, `all.tsx` — render the corresponding view component.
  - `apps/web/src/components/sidebar/` — overdue sub-badge logic + correct aria-label.
