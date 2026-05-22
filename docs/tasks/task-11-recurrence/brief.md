# Task 11 — Recurrence: math + atomic complete-recurring op

## Goal

Implement the recurrence engine — the single highest-test-surface module in v1 — as a pure function in `apps/server/src/domain/recurrence.ts` (plus `apps/server/src/domain/time.ts` for local-date arithmetic helpers). Ship the 80-case unit-test suite from `data-model.md` §6.4 covering all 5 frequencies × 2 anchor modes × edge cases (Feb 31 → Feb 28; leap year; weekly with multi-weekday set; mid-cycle edit propagation; overdue completion; multi-day span preservation). Replace task-03's "TODO(task-11)" stub in `PATCH /api/items/:id`: when an item with non-null `recurrence` transitions `status` to `'done'`, run the atomic complete-recurring server op (within the writer mutex): mark source done + stamp completed_at + generate a fresh next-instance Item + write both to disk + return `{ completed, next }`. Frontend updates handle the dual-response: TanStack Query cache gets both items, snackbar is "Task completed. Next: <date>." per microcopy §7, undo is a custom callback that reverses both (un-complete the source + delete the next instance).

## Context files

- `docs/engineering/2026-05-18-data-model.md#6-recurrencerule-and-next-instance-algorithm` — `nextDueDate` pseudocode + every helper + the 80-case test matrix in §6.4 + multi-day span preservation rule in §6.3.
- `docs/engineering/2026-05-18-data-model.md#6-5-recurring-completion-as-an-atomic-op` — the exact mutex-protected sequence.
- `docs/engineering/2026-05-18-data-model.md#6-6-un-checking-a-completed-recurring-instance` — un-check only reopens that instance; next is kept (§9.4 #5).
- `docs/engineering/2026-05-18-code-architecture.md#3-5-domain----depth-cap--recurrence--hierarchy` — `nextDueDate` signature + `domain/time.ts` helpers.
- `docs/brainstorm/product-spec.md#4-6-recurrence-rule` and `#6-6-recurring-task` and `#7-4` (start-date-offset preservation) and `#7-5` (overdue completion) and `#7-17` (recurring task edited mid-cycle).
- `docs/ux/microcopy.md#7-snackbar-variants` — "Task completed. Next: <date>." (recurring variant); "Task reopened. Next instance kept." (un-check from Completed view per §9.4 #5).
- `docs/engineering/2026-05-18-feature-mapping.md#10-3-recurrence-picker` — risk #2; the 80-test suite is a release gate.
- `docs/engineering/2026-05-18-frontend-architecture.md#16-recurring-next-instance-ux-flow` — full step-by-step including the undo behavior.

## Downstream dependencies

- **Task 12** (bulk complete) loops over selected ids; for each item with non-null recurrence, the bulk endpoint calls the same atomic op. Refactor so the recurrence completion is a callable function reused from `bulk.ts`.
- **Task 16** (Completed view) wires the un-check-from-completed path: when a user un-checks a completed recurring instance from the Completed view, only that instance reopens — the auto-generated next instance is NOT deleted. Snackbar: "Task reopened. Next instance kept." per microcopy §7.
- **Task 17** (SSE) — the atomic op publishes two events: `item.changed` for the source, `item.created` for the new instance. SSE wiring already in place from task-03 (broker.publish calls); task-17 wires the route.
- **Task 8 / 9 / 14 / 15** already wire `useToggleComplete` and `usePatchItem` mutations through `useOptimisticMutation`. The hooks need to handle the `{completed, next}` response shape — done here in step 4.

## Steps

1. **`domain/time.ts`** — pure local-date arithmetic:
   ```ts
   import { LocalDate, Weekday } from '@tasko/types';

   /** Parse YYYY-MM-DD into (year, month, day) — month is 1-12. */
   function parseLocalDate(d: LocalDate): { y: number; m: number; d: number };

   /** Format (y, m, d) back to YYYY-MM-DD with zero-padding. */
   function formatLocalDate(y: number, m: number, d: number): LocalDate;

   /** Returns today's YYYY-MM-DD per the server's local clock. */
   export function todayLocal(): LocalDate;

   /** Adds n days (n may be negative). Pure date arithmetic; no TZ math. */
   export function addDays(date: LocalDate, n: number): LocalDate;

   /** Returns the number of integer days from `a` to `b` (positive if b > a). */
   export function daysBetween(a: LocalDate, b: LocalDate): number;

   /** Last day of the given month (handles leap years for Feb). */
   export function lastDayOfMonth(year: number, month: number): number;

   /** Returns the weekday string for the date. */
   export function weekdayOf(date: LocalDate): Weekday;

   /** Returns the next LocalDate strictly AFTER `after` that matches one of `weekdays`. */
   export function nextScheduledWeekday(after: LocalDate, weekdays: Weekday[]): LocalDate;

   /** Returns the next monthly date AFTER `anchor` on `dayOfMonth`, clamping to last-day-of-month when month is shorter. */
   export function nextMonthlyDate(anchor: LocalDate, dayOfMonth: number): LocalDate;

   /** Returns the next yearly date AFTER `anchor` for (month, day), clamping for Feb 29. */
   export function nextYearlyDate(anchor: LocalDate, month: number, day: number): LocalDate;
   ```
   **Implementation note** for `addDays`: parse to (y,m,d), construct `new Date(y, m-1, d)` (which is in local TZ at midnight), `setDate(d + n)`, format back. This avoids UTC pitfalls per `data-model.md` §6.3 implementation note. Test with various edge cases (cross month, cross year, leap years).
   
   Tests in `apps/server/test/unit/time.spec.ts`: cross-month boundaries (Jan 31 + 1 → Feb 1), leap year (Feb 28 2028 + 1 → Feb 29), non-leap (Feb 28 2026 + 1 → Mar 1), monthly clamp (Jan 31 + 1 month → Feb 28 or Feb 29 depending on year), yearly Feb 29 → Feb 28 in next non-leap year, `nextScheduledWeekday` cases (anchor Sun + {Mon,Wed,Fri} → next Mon; anchor Fri + {Mon} → next Mon; anchor Mon + {Mon} → next Mon = anchor + 7).
2. **`domain/recurrence.ts`** — `nextDueDate` pure function. Verbatim shape from `data-model.md` §6.3:
   ```ts
   import { LocalDate, RecurrenceRule, Weekday } from '@tasko/types';
   import { addDays, daysBetween, nextScheduledWeekday, nextMonthlyDate, nextYearlyDate } from './time';

   export function nextDueDate(opts: {
     rule: RecurrenceRule;
     previousDueDate: LocalDate;
     completedAt: LocalDate;        // local date of completion
     previousStartDate: LocalDate | null;
   }): { due_date: LocalDate; start_date: LocalDate | null } { /* switch on rule.frequency */ }
   ```
   **Semantics**:
   - `anchor: LocalDate = rule.anchor_mode === 'on_schedule' ? previousDueDate : completedAt`.
   - Daily: `nextDue = addDays(anchor, 1)`.
   - Every N days: `nextDue = addDays(anchor, rule.interval)`.
   - Weekly: `nextDue = nextScheduledWeekday(anchor, rule.weekdays)`. **For `after_completion` with weekly**: the anchor is `completedAt`; we look for the next weekday in the set strictly after that date — which matches the `data-model.md` §6.4 last test case ("after_completion + weekly Mon, completedAt Thu May 14 → next Mon May 18").
   - Monthly: `nextDue = nextMonthlyDate(anchor, rule.day_of_month)`.
   - Yearly: `nextDue = nextYearlyDate(anchor, rule.month, rule.day)`.
   - Multi-day span preservation: if `previousStartDate !== null`, `delta = daysBetween(previousStartDate, previousDueDate)` (positive), `nextStart = addDays(nextDue, -delta)`. Else `nextStart = null`.
3. **The 80-case test suite** — `apps/server/test/unit/recurrence.spec.ts`. Use Vitest `describe` per frequency. Per `data-model.md` §6.4, implement at minimum these cases (and add cases for completeness — target ~80 assertions total):
   - **Daily on_schedule**: prev=2026-05-18, completed=2026-05-18 → next=2026-05-19. Late: prev=2026-05-18, completed=2026-05-25 → next=2026-05-19. Early: completed=2026-05-17 → next=2026-05-19.
   - **Daily after_completion**: prev=2026-05-18, completed=2026-05-19 → next=2026-05-20. Late by week: completed=2026-05-25 → next=2026-05-26.
   - **Every 3 days on_schedule**: prev=2026-05-18, completed=2026-05-20 → next=2026-05-21.
   - **Every 3 days after_completion**: prev=2026-05-18, completed=2026-05-20 → next=2026-05-23.
   - **Weekly {Mon,Wed,Fri} on_schedule**: prev=2026-05-18 (Mon), completed=2026-05-18 → next=2026-05-20 (Wed). Late: prev=2026-05-18 (Mon), completed=2026-05-22 (Fri) → next=2026-05-20 (Wed) — next sched after prev.
   - **Weekly {Mon} on_schedule**: prev=2026-05-11 (Mon-prev), completed=2026-05-14 (Thu) → next=2026-05-18 (Mon, next after May 11).
   - **Weekly {Mon} after_completion**: prev=2026-05-11, completed=2026-05-14 (Thu) → next Mon after May 14 = 2026-05-18.
   - **Weekly {Sat,Sun} on_schedule**: prev=2026-05-23 (Sat), completed=2026-05-23 → next=2026-05-24 (Sun).
   - **Monthly day=31 on_schedule, Jan→Feb**: prev=2026-01-31, completed=2026-01-31 → next=2026-02-28.
   - **Monthly day=31 leap year**: prev=2028-01-31, completed=2028-01-31 → next=2028-02-29.
   - **Monthly day=31 Mar→Apr**: prev=2026-03-31, completed=2026-03-31 → next=2026-04-30.
   - **Monthly day=15 on_schedule**: prev=2026-05-15, completed=2026-05-15 → next=2026-06-15.
   - **Monthly day=15 after_completion (early)**: prev=2026-05-15, completed=2026-05-10 → next=2026-06-10.
   - **Yearly Feb 29 (leap)**: prev=2028-02-29 → next=2029-02-28.
   - **Yearly Jan 1 on_schedule**: prev=2026-01-01 → next=2027-01-01.
   - **Multi-day weekly with delta**: prev_start=2026-05-11 (Mon), prev_due=2026-05-14 (Thu), rule=weekly {Sun} on_schedule, completed=2026-05-14 → next_due=2026-05-17 (Sun), delta=3 days, next_start=2026-05-14 (Thu).
   - **Multi-day daily**: prev_start=2026-05-18, prev_due=2026-05-20 (3-day span), rule=daily on_schedule, completed=2026-05-20 → next_due=2026-05-21, next_start=2026-05-19.
   - **Multi-day every_n_days after_completion**: prev_start=2026-05-15, prev_due=2026-05-18 (delta 3), rule=every_n_days n=7 after_completion, completed=2026-05-20 → next_due=2026-05-27, next_start=2026-05-24.
   - **Overdue completion on_schedule**: prev=2026-05-11 (Mon), rule=weekly {Mon} on_schedule, completed=2026-05-14 (Thu, overdue) → next=2026-05-18 (Mon — based on previous May 11, not on completion date).
   - **Overdue completion after_completion**: same prev, rule=weekly {Mon} after_completion, completed=2026-05-14 → next=2026-05-18 (next Mon after May 14).
   - **Boundary**: Monthly day=29 on Feb 2026 (non-leap): prev=2026-01-29, next=2026-02-28 (clamped).
   - **Boundary**: Monthly day=29 on Feb 2028 (leap): prev=2028-01-29, next=2028-02-29.
   - **Boundary**: Yearly month=4, day=31: rule has day=31 — server zod validates; if user picks April + day 31, the rule schema accepts but `nextYearlyDate` clamps to April 30. Test that.
   - **Anchor mode determinism**: same rule, same prev, same start, different completed → on_schedule unchanged, after_completion shifts.
4. **Wire the atomic complete-recurring op into `PATCH /api/items/:id`** — `apps/server/src/routes/items.ts`:
   - Replace the `// TODO(task-11)` comment in PATCH with:
     ```ts
     if (patch.status === 'done' && source.recurrence !== null && source.completed_at === null) {
       // Atomic complete-recurring op per data-model.md §6.5
       const completedAt = new Date();
       const completedLocal = todayLocal(); // server's local date for the anchor calc
       const next = nextDueDate({
         rule: source.recurrence,
         previousDueDate: source.due_date,
         completedAt: completedLocal,
         previousStartDate: source.start_date,
       });
       const updatedSource: Item = {
         ...source,
         status: 'done',
         completed_at: completedAt.toISOString(),
         updated_at: completedAt.toISOString(),
       };
       const newInstance: Item = {
         id: ulid(),
         schema_version: 1,
         type: source.type,
         project_id: source.project_id,
         parent_id: source.parent_id,
         title: source.title,
         notes: source.notes,
         due_date: next.due_date,
         start_date: next.start_date,
         due_time: source.due_time,
         priority: source.priority,
         status: 'todo',
         tags: source.tags,
         subtasks: [],       // fresh subtasks; per spec §7.17 the recurring rule lives on current instance; subtasks don't propagate (they're per-instance) — document this choice in the brief
         recurrence: source.recurrence,
         completed_at: null,
         trashed_at: null,
         trashed_with: null,
         sort_order: source.sort_order, // a fresh sort_order may be more correct; using source's keeps it in place — pick the safer choice and document
         created_at: completedAt.toISOString(),
         updated_at: completedAt.toISOString(),
       };
       await ops.writeItem(updatedSource);
       await ops.writeItem(newInstance);
       app.broker.publish({ type: 'item.changed', payload: { id: updatedSource.id, item: updatedSource }, tabId });
       app.broker.publish({ type: 'item.created', payload: { id: newInstance.id, item: newInstance }, tabId });
       return reply.send({ completed: updatedSource, next: newInstance });
     }
     ```
   - Subtask copy decision: **fresh subtasks on the next instance (empty array)** — recurrence implies the work is repeating; subtasks accumulated on the previous instance represented that occurrence's progress. Document this in `data-model.md` follow-up if not already covered. (The product spec is silent; the architect's choice is documented in §3.3 of data-model.md.)
   - Sort_order decision: **inherit from source** — keeps siblings sane in tree views; the source moves to Completed view (filtered out of tree by default).
5. **Frontend response handling** — `apps/web/src/api/items.ts`'s `usePatchItem` / `useToggleComplete`:
   - The PATCH response is sometimes `Item`, sometimes `{ completed: Item, next: Item }` (per `api.md` §2.4).
   - Define a discriminated response schema:
     ```ts
     import { ItemSchema } from '@tasko/types';
     import { z } from 'zod';
     const ItemPatchResponseSchema = z.union([
       ItemSchema,
       z.object({ completed: ItemSchema, next: ItemSchema }),
     ]);
     ```
   - In `onSuccess`: if the response has a `completed` field, treat it as a recurring-completion result: update cache for both items, push to `undoStore` with a custom `apply` that does **two API calls in sequence**:
     ```ts
     apply: async () => {
       await api.items.patch(completed.id, { status: 'todo' }); // reopens
       await api.items.softDelete(next.id);                    // deletes the auto-generated next instance
     }
     ```
     (Task-12 implements `softDelete`; for task-11, the soft-delete call will land then. Until then, write the apply function to call a stub that does a hard DELETE if soft-delete isn't ready — or wait for task-12 to refactor. Decision: write the apply function to call `useTrashItem` (stub) and document that the actual reverse fires after task-12 ships.)
   - Snackbar text: `Task completed. Next: <formatDate(next.due_date)>.` per microcopy §7.
   - For non-recurring: usual snackbar "Task completed.".
6. **Bulk complete already works (task-12)** — when task-12 ships `POST /api/bulk/complete`, the server's loop calls a refactored helper `completeItemAndMaybeRecur(item, ops)` that returns `{ completed, next? }`. Refactor the route handler to extract this helper here in task-11 so task-12 just composes it. Helper signature in `apps/server/src/routes/items.ts` (or move to `domain/recurrence-op.ts`):
   ```ts
   export async function completeWithMaybeRecurrence(source: Item, ops: WriteOps, broker: Broker, tabId: string | null, now: Date): Promise<{ completed: Item; next?: Item }>;
   ```
7. **Un-check from Completed view** — when the user un-checks a completed recurring instance, the request is `PATCH /api/items/:id { status: 'todo' }`. The current handler clears `completed_at`. **Critical**: this path must NOT delete the auto-generated next instance (per spec §9.4 #5). The handler logic is "if status transitions from 'done' to 'todo', clear completed_at; do nothing about next instances". Verify: the current PATCH path (after step 4) only enters the recurring-completion branch when transitioning TO 'done'. Transitioning FROM 'done' is the simple PATCH path. **No additional code needed; verify with a test.**
   - Test: `apps/server/test/integration/recurrence-uncomplete.spec.ts` — Create a recurring task, complete it (server generates next instance), un-complete it (PATCH status: 'todo'). Assert the source is back to status: 'todo', `completed_at: null`. Assert the next instance is STILL in the index.
   - Frontend snackbar variant: "Task reopened. Next instance kept." (microcopy §7). This is the snackbar shown when the un-check happens from Completed view AND the item is recurring. Task-16 (Completed view) implements the per-row uncheck; for task-11, just ensure the API hook handles the response correctly (the API returns just the updated item, not a `{completed, next}` shape).
8. **`todayLocal()` helper consolidation** — task-03 inlined a `todayLocal` function. Now we have a shared one in `domain/time.ts`. Refactor `apps/server/src/routes/items.ts` to import from there.
9. **Frontend mirror?** — the frontend doesn't compute next-instances (that's pure server-side). But the Recurrence picker (task-07) writes the rule; we may want a small helper to *describe* the next occurrence in human-readable form for the UI ("Repeats every Monday and Friday"). Add `apps/web/src/lib/recurrence-description.ts` exporting `describeRecurrence(rule: RecurrenceRule | null): string` — used by the Task modal's Recurrence section to show a preview ("Every Mon, Wed, Fri • on schedule"). Tests in `__tests__/recurrence-description.test.ts`.
10. **Test coverage** — final integration test: `apps/server/test/integration/recurrence-complete.spec.ts`:
    - Create a recurring task (monthly day=31, on_schedule, due=2026-01-31).
    - PATCH status=done.
    - Assert response is `{ completed: { ..., status: 'done', completed_at: not null }, next: { ..., due_date: '2026-02-28', ..., status: 'todo' } }`.
    - Assert disk: both files exist in `items/`.
    - Assert disk file count grew by 1.
    - PATCH the source's status to 'todo' → response is the updated source (not `{completed,next}`); the next instance is unchanged on disk.
    - Cleanup.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/server typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/server test` — `recurrence.spec.ts` runs ≥ 80 assertions covering every frequency × anchor × edge case enumerated in step 3 (or a comparable matrix); `time.spec.ts` covers `addDays`, `daysBetween`, `lastDayOfMonth`, `nextScheduledWeekday`, `nextMonthlyDate`, `nextYearlyDate`; `recurrence-complete.spec.ts` covers the integration; `recurrence-uncomplete.spec.ts` verifies un-check leaves the next instance alone.
- [ ] Manual: create a recurring task in the app (monthly day=1, on_schedule, due=Jun 1). Complete it. The Today view shows a snackbar "Task completed. Next: Jul 1." Click Undo within 5s → both the completion AND the Jul 1 instance reverse (the source goes back to status: todo + Jul 1 entry disappears from /api/items?view=all).
- [ ] Manual: in Completed view (task-16 will polish; for task-11 verification, query `/api/items?view=completed` and find the source instance, then PATCH `status: 'todo'`), un-check from the Completed view → next instance is still there.
- [ ] Manual: cross-tab — open two browser windows; complete a recurring task in window A; window B (after task-17 SSE) sees both the source change + the new instance.
- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — `recurrence-description.test.ts` passes.
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/server/src/domain/time.ts`, `apps/server/src/domain/recurrence.ts`
  - `apps/server/test/unit/time.spec.ts`, `apps/server/test/unit/recurrence.spec.ts` (the 80-case suite)
  - `apps/server/test/integration/recurrence-complete.spec.ts`, `apps/server/test/integration/recurrence-uncomplete.spec.ts`
  - `apps/web/src/lib/recurrence-description.ts` + test
- Modified:
  - `apps/server/src/routes/items.ts` — wire the atomic complete-recurring op into PATCH; extract `completeWithMaybeRecurrence` helper; replace inlined `todayLocal` with the shared one. Replace TODO(task-11) comment.
  - `apps/web/src/api/items.ts` — handle the union response shape; recurring snackbar variant; custom undo apply.
  - `apps/web/src/views/task-modal/recurrence-picker.tsx` — show the recurrence-description preview.
