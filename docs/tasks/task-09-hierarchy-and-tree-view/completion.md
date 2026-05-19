---
status: complete
commit: f177582
completedAt: 2026-05-19T14:45:00Z
iterations: 2
---

# Task Completion — Task 09: Hierarchy + depth-cap + tree view + per-project views

**Verification:** 4-level depth-cap rule shipped end-to-end. Server: `domain/depth-cap.ts` (`levelOf`, `maxDescendantDepth`, `canMove`, `canPlaceAtRoot`) wired into POST `/api/items`, PATCH `/api/items/:id` (when `parent_id` is in patch), and POST `/api/items/:id/move` with 409 DEPTH_CAP envelopes. `domain/hierarchy.ts` ships `descendantsOf`, `topLevelOfProject` plus a re-export of the shared `rollupProgress`. Cross-project move handlers refactored to call `descendantsOf`. Frontend: `lib/depth-cap-client.ts` mirrors the server, `TreeRow` + TreeView render the WAI-ARIA tree pattern (with `role="group"` on subtree containers), the per-project route resolves Tree vs Flat at runtime, the View toggle navigates between `/project/$id` and `/project/$id/kanban` (stubbed until task-15), `+ Add Epic` / `+ Add Feature` use inline create with today as default due_date and `+ Add Task` opens the modal with destination-context pre-fills. Move-to picker + `⌘⇧M` hotkey wired (focused-row tracked via `onRowFocus` + `focusedItemRef`). Parent-completion blocking for Feature/Epic enumerates descendants from cache + fan-out PATCH (task-12 will refactor to a server-side bulk endpoint).

Tests: server 157/157 pass (+30 new), web 569/569 pass (+67 new across 10 files). Typecheck + biome lint clean (271 files).

Dev loop took 2 iterations: the reviewer caught 5 must-fix issues in Iteration 1 — three around parent-completion microcopy (the prompt title, confirm-label, and a missing second sentence in the body that the brief explicitly required from `microcopy.md` §6.1), the `⌘⇧M` handler was a no-op stub leaving the manual acceptance criterion unmet, and the brief's required `descendantsOf` refactor in `items.ts` hadn't landed. Iteration 2 resolved all five (verbatim microcopy via tests, `⌘⇧M` wired through a new `onRowFocus` prop threaded into TreeNode + a `focusedItemRef` to dodge stale closure, server cross-project move refactored to call `descendantsOf`), plus two nice-to-haves: server `rollupProgress` collapsed to a single source of truth (re-export from `@tasko/types`) and a dead-conditional removed. One advisory was deferred to task-18's a11y sweep and logged in `docs/known-issues.md`: TreeRow `aria-label` on `treeitem` divs per accessibility §3.6.

See `log.md` for the full per-iteration execution log.
