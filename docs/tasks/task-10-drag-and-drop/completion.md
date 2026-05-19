---
status: complete
commit: 13f4d69
completedAt: 2026-05-19T16:22:00Z
iterations: 3
---

# Task Completion — Task 10: Drag-and-drop infrastructure

**Verification:** `@dnd-kit/core` + `@dnd-kit/sortable` wired across every v1 drag surface: sidebar (project↔folder, project reorder, folder reorder), smart list views (Today / Tomorrow / Inbox / All / per-project-flat row reorder), tree view (re-parent with `canMoveClient` depth-cap visualization), Next 7 Days cross-day rescheduling, and Task modal subtask reorder. Drag visuals shipped per UX §38 with reduced-motion suppression. Auto-scroll within 40px of viewport edges. Live SR announcements per microcopy §26 (throttled to one-per-target). Esc cancels. Undo wired on the three spec'd drag mutations (`useUndoStore.push` + snackbar `Undo` action). Keyboard sensor enabled via `useDndSensors` for completeness alongside the canonical `⌘⇧M` Move-to picker. Sort-order math uses the sparse-integer midpoint scheme with full-list renumber fallback when gap < 2.

Tests: 621/621 web pass (+57 new across 12 files); server 157/157 unchanged. Typecheck + biome lint clean (291 files).

Dev loop took 3 iterations. Iter-1 review surfaced 9 regressions: the new `ListDndContext`/`Next7DndContext` referenced `usePatchItem` which the existing view tests' mocks didn't expose. Iter-2's mock additions surfaced a real implementation bug — `dnd-kit.useSortable().listeners.onKeyDown` was overriding `TaskListRow.handleKeyDown` via JSX spread order, silently breaking Space/Enter/T/Delete shortcuts on every list row. The fix merged the two handlers; 3 regression-guard tests lock the behavior. Iter-2's review caught 4 must-fix UX gaps: the 3 drag snackbars lacked the spec-required `Undo` action and `useUndoStore.push` (which would have left task-12's bulk-undo consolidation with a silent contract gap), the project-out-of-folder snackbar dropped the folder name, the `ProjectRootDropZone` had a hardcoded `isDropTarget={false}` so its highlight never rendered, and the sidebar folder auto-expand was a no-op stub despite the brief explicitly requiring 300ms hover-to-expand. Iter-3 fixed all 4 plus a quartet of nice-to-haves (replaced the `dnd-transform.ts` shim with `@dnd-kit/utilities` as a direct dep, removed a dead `isDragSource` prop, added `onDragOver` SR announces to `ListDndContext`/`SubtaskList`, removed the unspec'd "Folder reordered." snackbar). 7 new regression-guard tests cover the Iter-3 changes.

See `log.md` for the full per-iteration execution log.
