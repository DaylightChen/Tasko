---
status: complete
commit: f675ca0
completedAt: 2026-05-19T17:00:00Z
iterations: 3
---

# Task Completion — Task 11: Recurrence engine + atomic complete-recurring op

**Verification:** Recurrence engine shipped — the highest-test-surface domain module in v1. `domain/time.ts` provides pure local-date arithmetic (`addDays`, `addMonths`, `daysBetween`, `lastDayOfMonth`, `weekdayOf`, `nextScheduledWeekday`, `nextMonthlyDate`, `nextYearlyDate`). `domain/recurrence.ts` provides `nextDueDate` + `completeWithMaybeRecurrence` covering all 5 frequencies × 2 anchor modes with multi-day span preservation. The PATCH `/api/items/:id` handler runs the atomic complete-recurring op (mark source done, generate next instance with fresh subtasks and inherited sort_order, write both within the writer mutex, publish `item.changed` + `item.created`, return `{ completed, next }`). Frontend `usePatchItem`/`useToggleComplete` discriminate the union response, update both cache entries for recurring completions, push a custom undo (PATCH source → todo + guarded DELETE next), and show the recurring snackbar `"Task completed. Next: <date>."` per microcopy §7. Un-check from done → todo shows `"Task reopened. Next instance kept."`. The Recurrence picker renders a human-readable preview via `describeRecurrence`.

Tests: 312 server tests (+159 in this task, including the 65-case `recurrence.spec.ts` covering the brief's full matrix, 70-case `time.spec.ts`, 12 + 8 integration cases, and the test-corrections to align with the corrected monthly `after_completion` semantics). 649 web tests (+28 from `recurrence-description.test.ts`). Typecheck + biome lint clean (299 files).

Dev loop took 3 iterations. Iter-1 implemented all 8 steps but used `nextMonthlyDate(completedAt, day_of_month)` for monthly `after_completion`, which preserves the rule's `day_of_month` instead of adding 1 month to the completion date — directly contradicting the brief's enumerated test case (`prev=May 15, completed=May 10 → next=Jun 10`). Iter-2 introduced `addMonths(date, n)` with day-clamp and corrected the monthly `after_completion` branch (`addMonths(completedAt, 1)`), then wired the previously-missing un-check snackbar variant. Iter-2's review caught five further issues: `addMonths` lacked direct unit tests, a private `addDaysLocal` in `routes/items.ts` duplicated the shared `addDays`, `usePatchItem` still parsed responses with the plain `ItemSchema` (would fail Zod for any recurring completion routed through it), the un-check snackbar used 4000ms instead of the spec's 5000ms, and the undo `apply` hard-DELETEd the next instance against an endpoint that returns 501 (silent partial undo). Iter-3 resolved all five plus the yearly `after_completion` asymmetry documentation (yearly intentionally keeps the rule's calendar date rather than completedAt + 1 year — a yearly rule specifies a date, not an interval).

See `log.md` for the full per-iteration execution log.
