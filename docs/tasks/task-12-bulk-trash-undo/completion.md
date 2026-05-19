---
status: complete
commit: 26f5613
completedAt: 2026-05-19T19:33:00Z
iterations: 2
---

# Task Completion — Task 12: Bulk + Trash + Undo + multi-select

**Verification:** The trash + bulk + undo backbone shipped end-to-end. Server: cascade soft-delete with `trashed_with` semantics replacing task-03's 501 stubs, cascade restore (with orphan-parent → project-root reparent), cascade permanent delete, `POST /api/trash/empty`, project-delete cascade (Inbox immutable → 409), and four bulk endpoints (move-overdue with multi-day delta preservation, transactional move-to-project with depth-cap validation, bulk-delete, bulk-complete reusing task-11's `completeWithMaybeRecurrence`). Frontend: full Trash view, real `useTrashItem`/`useRestoreItem`/`usePermanentDeleteItem`/`useEmptyTrash` + four bulk hooks all going through `useOptimisticMutation`, a Zustand multi-select store with event-delegation hook (shift-click range, ⌘/Ctrl toggle, ⌘A select-all, Esc/route-change clear), the `BulkActionsToolbar` (slides in at 2+ selections), real project deletion with the §4.7 "This cannot be undone in v1." appendix, and a `<GlobalUndo />` component for ⌘Z (replacing `ViewChrome`'s previous local listener).

Tests: 368 server (+34 from this task) + 683 web (+34 from this task), all 18 brief-mandated test files (12 server + 6 client) in place. Typecheck + biome lint clean (329 files).

Dev loop took 2 iterations. The Iter-1 implementer landed all 14 implementation steps cleanly; the tester subagent stalled at 600s while finalizing TS casts on `delete-project-cascade.test.tsx`, and the orchestrator finished the cleanup (removed three stale pre-existing tests that asserted task-03's 501 stubs, added `useNavigate` to the sidebar mock, retargeted the ⌘Z test from `ViewChrome.test.tsx` to a new `app/__tests__/global-undo.test.tsx`, tightened a button query, ran `biome check --write`). Iter-2 fixed 4 must-fix + 2 nice-to-have issues from the review: cleaned up a stale `TODO(task-12)` in `useToggleComplete` (the recurring-completion undo's DELETE call now correctly hits the real soft-delete endpoint), wired `useBulkMoveToProject`'s undo `apply` to actually restore prior `{ project_id, parent_id }` per item (it had been a silent no-op), flipped `destructive={true}` on the bulk-delete ConfirmationPrompt, removed an invalid `every: 1` field from a daily-recurrence test payload (Zod was silently stripping it), and added route-change auto-clear to `useMultiSelect` per `interaction-patterns.md` §3.5.

See `log.md` for the full per-iteration execution log.
