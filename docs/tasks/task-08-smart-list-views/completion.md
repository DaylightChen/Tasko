---
status: complete
commit: c8c96ba
completedAt: 2026-05-19T13:55:00Z
iterations: 2
---

# Task Completion — Task 08: Smart list views (Today / Tomorrow / Next 7 Days / Inbox / All)

**Verification:** Five smart-list views shipped end-to-end (Today, Tomorrow, Next 7 Days, Inbox, All), plus the foundational primitives every downstream task consumes: `useOptimisticMutation` (with cache-rollback `onError`), `undoStore` (single-step Zustand, 5s timeout), `useFocusedRow`, and the shared `ViewChrome` wrapper. Six mutation hooks added to `api/items.ts` (`useToggleComplete`, `useReschedule`, `useChangePriority`, `useEditTitleInline`, `useDeleteItem` and `useBulkMoveOverdue`; the last two are task-12-bound stubs). `<TaskModal />` now mounts globally in `__root.tsx`. 506 web tests pass across 53 files (+64 new from this task across the 11 view + hook test files). Typecheck clean. Biome clean (247 files).

Dev loop took 2 iterations: the reviewer caught three must-fix issues in Iteration 1 — priority keys 1–4 weren't actually wired to `useChangePriority` (tests passed vacuously), `useOptimisticMutation.onError` had a TODO-style stub instead of the rollback callback the engineering spec calls for, and the abstraction was dead code with no real call site. Iteration 2 resolved all three (priority keys wire through `today-view.handleKeyDown` with a `data-item-id` DOM-focus fallback; `onError(input, prior)` callback added and invoked after the error snackbar; `useChangePriority` refactored to use `useOptimisticMutation` so the abstraction is validated) plus three nice-to-haves: `UndoEntry.label` made required per spec, a `ViewChrome` ⌘Z test, and verification that the sidebar overdue-aria-label test was already present.

See `log.md` for the full per-iteration execution log.
