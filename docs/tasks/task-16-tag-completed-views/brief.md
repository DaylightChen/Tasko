# Task 16 — Per-tag view + Completed view

## Goal

Build the last two remaining views: **Per-tag** (cross-project flat list of items with a given tag) and **Completed** (chronologically grouped: Today / Yesterday / Earlier this week / Last week / Earlier this month / Earlier). Un-check from Completed re-opens an item (and for recurring instances, leaves the auto-generated next instance alone per §9.4 #5 — the snackbar reads "Task reopened. Next instance kept." per microcopy §7). The sidebar's TAGS section already lists tags via task-04 + task-06; clicking a tag navigates to `/tag/$name`.

## Context files

- `docs/ux/screens.md` — Per-tag view + Completed view.
- `docs/ux/flows.md` — §10 completion + Trash (the un-check-from-Completed path: row returns to its original view, with original due date — may now be overdue).
- `docs/ux/microcopy.md` — §17 per-tag view copy ("<N> items tagged "<tag>" across all projects."), §23 Completed view copy (Today / Yesterday / Earlier this week / Last week / Earlier this month / Earlier time-group headers + empty state), §7 snackbar "Task reopened." and "Task reopened. Next instance kept." (recurring), §9 sort dropdown (Completed defaults to "Recently completed"; Trash defaults to "Recently trashed").
- `docs/ux/component-inventory.md#23-task-list-row` — the Completed variant: strike-through + opacity 0.6 + check filled.
- `docs/brainstorm/product-spec.md#6-10-completion-and-trash` — completed semantics including un-check-from-completed.
- `docs/brainstorm/product-spec.md#9-4-ambiguities--resolved` — #5 un-checking a completed recurring instance only reopens that instance.
- `docs/engineering/2026-05-18-feature-mapping.md#5-1-completed-view`, §7 per-tag view.
- `docs/engineering/2026-05-18-api.md#2-1--get--api-items----list-items` — `view=completed` AND `view=tag&tag_id=<id>` query params (already wired in task-03).

## Downstream dependencies

- **Task 17** (SSE) — completed view + per-tag view auto-update across tabs.
- **Task 18** consolidates the keyboard registry — these views inherit the same per-row keyboard map.

## Steps

1. **Per-tag view** — `apps/web/src/views/tag-view/index.tsx`:
   - Route `routes/tag.$name.tsx` resolves the tag from `useTags()` cache (find by `name_lower` match against `$name` URL param). The URL uses the tag's `name_lower` (URL-safe; tags are user-typed but `name_lower` is always lowercase ASCII-friendly within the 1-32 char limit).
   - If no matching tag → 404 view "Tag not found." with a back link.
   - `useItems({ view: 'tag', tag_id: tag.id })`.
   - Subline: `<N> items tagged "<tag>" across all projects.` per microcopy §17.
   - TaskListRow with `showProjectBreadcrumb: true` (per `screens.md` per-tag view).
   - Quick-add: per microcopy §2 placeholder `Add task with #<tag>`. **The tag is NOT pre-filled** in the resulting modal (per the locked decision §9.4 #8 — the placeholder is informational only; the modal opens with tags empty + project empty).
   - Empty state: `icon: Hash, headline: 'No items tagged "<tag>".', subline: 'Tag tasks in the Task modal to surface them here.'` per microcopy §5.
   - Sort dropdown options + multi-select + drag-reorder behave the same as Inbox/All (since cross-project flat list).
   - Empty state when filtered to nothing: variant "No matches. Try removing a filter." (per UX §35.5).
2. **Completed view** — `apps/web/src/views/completed-view/index.tsx`:
   - Route `routes/completed.tsx` already exists; render `<CompletedView />`.
   - `useItems({ view: 'completed', sort: 'completed_desc' })` (sort default per microcopy §9).
   - Group items by their `completed_at` date relative to today:
     - **Today**: completed today.
     - **Yesterday**: completed yesterday.
     - **Earlier this week**: completed in the current week (per `week_start` config) but before yesterday.
     - **Last week**: completed in the prior week.
     - **Earlier this month**: completed earlier in the current month but not in this/last week.
     - **Earlier**: everything else.
     Render group headers `<h2>` per microcopy §23. Skip empty groups.
   - Each row: TaskListRow in the "Completed" variant — strike-through title + opacity 0.6 + filled checkbox. Show the time stamp (e.g., `09:42` for today, `Tue 8:14` for earlier this week, `May 12` for "Earlier") on the right.
   - Project breadcrumb visible on each row (per `screens.md`).
   - **Un-check**: click the (filled) checkbox → PATCH status:todo + clear completed_at. Per §9.4 #5 / `flows.md` §10:
     - Non-recurring item: snackbar "Task reopened." per microcopy §7. The row leaves Completed view and reappears in its original location (Today if due_date is today; overdue if past).
     - Recurring item: snackbar "Task reopened. Next instance kept." per microcopy §7. The row leaves Completed view. The auto-generated next instance is NOT deleted — it stays in active items per spec §7.5 + task-11.
   - **Soft-delete from Completed**: ⋯ menu → Delete → confirmation → soft-delete via `useTrashItem` (same path as anywhere else).
   - **Sort dropdown** options: "Recently completed" (default) / "Title (A–Z)" (per microcopy §9 — "Completed sort default: Recently completed"; we expose Title as the alternative).
   - Empty state: `icon: CheckCircle2, headline: 'Nothing completed yet.', subline: 'Done tasks land here.'` per microcopy §5.
3. **`completed_at` grouping helper** — `apps/web/src/views/completed-view/grouping.ts`:
   ```ts
   import { Item, LocalDate } from '@tasko/types';

   export type CompletedGroup = 'today' | 'yesterday' | 'earlier_this_week' | 'last_week' | 'earlier_this_month' | 'earlier';
   export interface GroupedItems { group: CompletedGroup; label: string; items: Item[]; }

   export function groupCompleted(items: Item[], today: LocalDate, weekStart: 'sun' | 'mon'): GroupedItems[];
   ```
   Implementation uses `daysBetween` + week-boundary math. Test in `__tests__/grouping.test.ts`:
   - Item completed today → 'today' bucket.
   - Yesterday → 'yesterday'.
   - 3 days ago (same week) → 'earlier_this_week'.
   - 10 days ago (week_start=mon, today=Wed) → 'last_week'.
   - 20 days ago → 'earlier_this_month'.
   - 60 days ago → 'earlier'.
   - Edge: week boundary (today=Mon week_start=mon, item completed last Sun) → 'last_week'.
4. **Un-check recurring snackbar variant** — the existing `useToggleComplete` from task-11 already handles the recurring response shape on completion. For un-check (status: 'todo'), the server response is just an `Item` (not `{ completed, next }`). The frontend handler detects: if `prior.status === 'done' && prior.recurrence !== null && newStatus === 'todo'` → snackbar "Task reopened. Next instance kept." Else if non-recurring un-check → "Task reopened.". Verify the hook's `onSuccess` branch handles this.
5. **Sidebar TAGS section auto-updates** — `useTags({ include_orphans: false })` already returns only tags referenced by at least one active item (per task-03 server route). When the last item with a given tag is deleted, the tag drops from the sidebar (orphan persists on disk per spec §4.5 + open-questions §6.8). No additional code; verify with manual test.
6. **Tag chip on rows** — clicking a tag chip on any TaskListRow navigates to `/tag/${tag.name_lower}` (the URL-safe form). Task-06's TaskListRow component already exposes `onTagClick(tagId)` callback — wire each view's tag-click handler to a router `navigate({ to: '/tag/$name', params: { name: tag.name_lower } })`.
7. **Tests** — `apps/web/src/views/__tests__/`:
   - `tag-view.test.tsx`: seed items with tag "urgent" + items without; render `/tag/urgent`; assert all and only the "urgent"-tagged items appear; subline "<N> items tagged "urgent" across all projects."; project breadcrumb on each row.
   - `tag-view-empty.test.tsx`: tag with 0 active items → empty state.
   - `tag-view-clicking-tag-chip.test.tsx`: from Today view, click a tag chip on a row → navigates to `/tag/${name_lower}`.
   - `completed-view.test.tsx`: seed items completed at various times (today, yesterday, 3 days ago, 10 days ago, 30 days ago); render Completed; assert time-group headers and items in correct buckets.
   - `completed-uncheck-nonrecurring.test.tsx`: click the filled checkbox on a non-recurring completed item → snackbar "Task reopened."; item leaves Completed; PATCH status: 'todo'.
   - `completed-uncheck-recurring.test.tsx`: completed recurring item → click checkbox → snackbar "Task reopened. Next instance kept."; item leaves Completed; auto-generated next instance is STILL in active items (verify via cache inspection or by then navigating to its project and seeing it).
   - `completed-empty.test.tsx`: no completed items → empty state.
   - `completed-grouping.test.ts`: pure unit test for `groupCompleted` (the helper).
8. **Manual end-to-end**:
   - Complete several items across days (use a date-mock or just clock-stub).
   - Navigate to Completed → see groups.
   - Un-check a non-recurring → returns to its origin view.
   - Un-check a recurring → snackbar mentions next instance kept; verify the next instance is still in active.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — every test in step 7 passes.
- [ ] Manual: per-tag view renders correctly; subline shows count; rows have project breadcrumb.
- [ ] Manual: clicking a tag chip from any row navigates to `/tag/${name_lower}`.
- [ ] Manual: Completed view groups items into the 6 time buckets correctly.
- [ ] Manual: un-check a non-recurring completed item → "Task reopened." snackbar; item leaves Completed.
- [ ] Manual: un-check a recurring completed item → "Task reopened. Next instance kept."; the source returns + next-instance is untouched.
- [ ] Manual: orphan tag (last item deleted) disappears from sidebar TAGS section.
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/web/src/views/tag-view/index.tsx` (+ tests)
  - `apps/web/src/views/completed-view/index.tsx`, `grouping.ts`, `__tests__/*.test.{ts,tsx}`
- Modified:
  - `apps/web/src/routes/tag.$name.tsx` — render `<TagView />`.
  - `apps/web/src/routes/completed.tsx` — render `<CompletedView />`.
  - `apps/web/src/api/items.ts` — `useToggleComplete`'s snackbar logic adds the "Task reopened. Next instance kept." branch for recurring un-check.
  - `apps/web/src/components/task-list-row/index.tsx` (and `tree-row/`) — wire `onTagClick` to navigate.
