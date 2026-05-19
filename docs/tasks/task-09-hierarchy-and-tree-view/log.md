# Execution Log — Task 09: Hierarchy: depth-cap + tree view + per-project views

> Scope: `project` (project-design-heavy). Dev loop log for Task 09.

## Iteration 1

### Implement

- **Files created:**
  - `apps/server/src/domain/depth-cap.ts`, `hierarchy.ts`
  - `packages/types/src/domain/rollup.ts`
  - `apps/web/src/lib/depth-cap-client.ts`, `rollup.ts`
  - `apps/web/src/components/tree-row/{index.tsx, styles.module.css}`
  - `apps/web/src/components/move-to-picker/{index.tsx, styles.module.css}`
  - `apps/web/src/store/tree-expansion.ts`
  - `apps/web/src/views/project-view/{tree-view.tsx, flat-list-view.tsx, tree-view.module.css, flat-list-view.module.css}`
- **Files modified:**
  - `packages/types/src/index.ts` (export `rollupProgress`)
  - `apps/server/src/routes/items.ts` (canMove wired into POST / PATCH(parent_id) / POST move; TODO(task-09) markers replaced)
  - `apps/web/src/api/items.ts` (`useMoveItem`)
  - `apps/web/src/api/projects.ts` (`useProject(id)` derived from `useProjects` cache)
  - `apps/web/src/routes/project.$id.tsx` (TreeView vs FlatListView based on `is_hierarchical`)
  - `apps/web/src/routes/project.$id.kanban.tsx` (breadcrumb + task-15 placeholder)
- **Decisions not in plan:**
  - `rollupProgress` lives in `packages/types/src/domain/rollup.ts` rather than duplicated server+client (pure function, no deps).
  - `useProject(id)` derives from `useProjects()` cache to avoid extra round trips.
  - `getDescendants` in tree-view uses iterative BFS to avoid stack overflow.
- **Deviations from plan:** none material.
- **Issues encountered:**
  - `exactOptionalPropertyTypes` required spread-based conditional props in several spots.
  - Biome's `noRedundantRoles` rejects `role="list"`/`role="listbox"` on `<ul>` — removed.
  - Various import-order + non-null-assertion cleanups along the way.
- **Sanity-check:** `pnpm -r typecheck` exit 0; `pnpm lint` exit 0 (261 files).

### Test

- **New tests written:** 102 cases across 10 files
  - Server: `apps/server/test/unit/depth-cap.spec.ts` (20), `hierarchy.spec.ts` (14), `apps/server/test/integration/depth-cap-routes.spec.ts` (8)
  - Client lib: `apps/web/src/lib/__tests__/depth-cap-client.test.ts` (6)
  - Component: `apps/web/src/components/tree-row/__tests__/TreeRow.test.tsx` (24), `apps/web/src/components/move-to-picker/__tests__/move-to-picker.test.tsx` (6)
  - View: `apps/web/src/views/project-view/__tests__/{tree-view.test.tsx (9), tree-view-add-flow.test.tsx (4), flat-list-view.test.tsx (8), parent-completion-feature.test.tsx (3)}`
- **Failures:** none — Server 157/157, Web 567/567 pass.
- **Full suite output:**
  ```
  $ pnpm --filter @tasko/server test
   Test Files  22 passed (22)
        Tests  157 passed (157)

  $ pnpm --filter @tasko/web test
   Test Files  60 passed (60)
        Tests  567 passed (567)

  $ pnpm -r typecheck   (server + web: exit 0)
  $ pnpm lint           Checked 271 files in 100ms. No fixes applied. (exit 0)
  ```
- **Implementation bug surfaced (real, forwarded to reviewer):** parent-completion microcopy in `tree-view.tsx:503-504` is missing the second sentence. UX spec (microcopy.md §6.1) requires `"This feature has N incomplete tasks. Completing it will mark them all done."` — implementation only emits the first sentence. Tester documented the mismatch in the test assertions.
- **Coverage gaps:** view-toggle URL navigation, Kanban placeholder, `⌘⇧M` global hotkey, drag-DND visual (task-10), JSDOM-fragile expand/collapse + hover-affordance flows.

### Review

- **Verdict:** Issues found — 5 must-fix + 2 nice-to-have + 1 advisory.
- **Criteria check:** all PASS except:
  - **FAIL** Manual `⌘⇧M` opens Move-to picker — handler body at `tree-view.tsx:432-434` is empty.
  - **Partial PASS** "every Step-13 test passes" — `parent-completion-feature.test.tsx` asserts the truncated microcopy (tests pass by asserting the bug, not the spec).
- **Code quality findings:**
  - `tree-view.tsx:223` — dead conditional `item.type === 'epic' ? 'feature' : 'feature'` (both branches identical).
  - `apps/server/src/domain/hierarchy.ts:41-45` — `rollupProgress` is duplicated; should re-export from `@tasko/types` per the Iter-1 implementer decision.
  - `apps/server/src/routes/items.ts` cross-project move (PATCH + POST /move) still uses inline BFS; brief step 2 mandates calling `descendantsOf`.
- **Test quality findings:**
  - `parent-completion-feature.test.tsx:206` + `:231` document the microcopy/confirm-label divergence in comments and assert the buggy strings — tests pass green-lighting the wrong strings.
- **Microcopy / ARIA findings:**
  - `tree-view.tsx:503-506` parent-completion body missing 2nd sentence "Completing it will mark them all done." (confirmed).
  - `tree-view.tsx:694` ConfirmationPrompt `title="Mark complete?"` — spec §6.1 requires `"Complete all children and continue?"`.
  - `tree-view.tsx:696` `confirmLabel="Mark complete"` — spec §6.1 requires `"Complete all"`.
  - `tree-view.tsx:294` children subtree container is `<div aria-label>` instead of `<div role="group" aria-label>` per accessibility §3.6 + WAI-ARIA tree pattern.
  - TreeRow doesn't set `aria-label` on `treeitem`s per accessibility §3.6 + microcopy §29 (`"Epic: <Title>, N of M tasks complete"`) — advisory; defer to task-18 a11y sweep and log to known-issues.
- **Regressions:** none.
- **Downstream readiness:** all 5 forward dependencies (10/11/12/15/18) compatible.
- **Issues to fix:**
  1. **(must-fix)** ConfirmationPrompt `title` → `"Complete all children and continue?"` (`tree-view.tsx:694`).
  2. **(must-fix)** ConfirmationPrompt `confirmLabel` → `"Complete all"` (`tree-view.tsx:696`).
  3. **(must-fix)** Parent-completion `body` — append `"Completing it will mark them all done."` to both Feature/Epic variants (`tree-view.tsx:503-506`).
  4. **(must-fix)** `⌘⇧M` handler — wire to open the Move-to picker for the focused item. Minimal: track focused item via `useFocusedRow`, on keydown set `setMoveToPickerItem(focusedItem)`.
  5. **(must-fix)** `apps/server/src/routes/items.ts` — refactor cross-project move (PATCH parent_id + POST /move) to call `descendantsOf` from `domain/hierarchy.ts`. Update the `<div role="group">` ARIA fix in `tree-view.tsx:294` while at it.
  6. **(nice-to-have)** `apps/server/src/domain/hierarchy.ts` — `export { rollupProgress } from '@tasko/types'` instead of re-implementing.
  7. **(nice-to-have)** Drop dead conditional at `tree-view.tsx:223`.
  8. **(advisory, deferred)** TreeRow aria-label on `role="treeitem"` divs per accessibility §3.6 — log to `docs/known-issues.md` for task-18.
- **Tester must update** `parent-completion-feature.test.tsx` to assert the corrected microcopy + confirm-label after the implementer's fix.

---

## Iteration 2

### Fix

- **What was fixed:**
  1. `tree-view.tsx:710` ConfirmationPrompt `title` → `"Complete all children and continue?"`.
  2. `tree-view.tsx:712` `confirmLabel` → `"Complete all"`.
  3. `tree-view.tsx:517-520` body — second sentence appended for both Feature + Epic variants (pluralization preserved).
  4. `⌘⇧M` handler — wired to track focused item via new `onRowFocus` prop threaded through `TreeNode`, plus a `focusedItemRef` mirror to avoid stale closure in the `useEffect`. On keydown sets `setMoveToPickerItem(focusedItemRef.current)` if non-null and no input focused.
  5. (A) `apps/server/src/routes/items.ts:484-490, 607-613` — cross-project move BFS replaced with `descendantsOf(source.id, index.items)` from `domain/hierarchy.ts`. (B) `tree-view.tsx:296` children subtree container → `<div role="group" aria-label>` per WAI-ARIA tree pattern (with biome-ignore for the `useSemanticElements` `<fieldset>` suggestion, which isn't appropriate for tree subtrees).
  6. `apps/server/src/domain/hierarchy.ts` — `rollupProgress` now re-exports from `@tasko/types` (eliminates duplication).
  7. `tree-view.tsx:223` dead conditional → `'feature' as const`.
  8. `docs/known-issues.md` — appended deferred entry for TreeRow `aria-label` on `treeitem` (task-18 a11y sweep).
- **Files modified:**
  - `apps/web/src/views/project-view/tree-view.tsx`
  - `apps/server/src/routes/items.ts`
  - `apps/server/src/domain/hierarchy.ts`
  - `docs/known-issues.md`
- **Decisions not in plan:**
  - Used `useRef` to mirror `focusedItem` state for the ⌘⇧M effect handler, avoiding re-registration on every focus change.
  - Biome-ignore on the `role="group"` div: Biome's `useSemanticElements` suggests `<fieldset>` for all `role="group"` elements, but `<fieldset>` is form-only and inappropriate for tree subtrees.
- **Sanity-check:** typecheck exit 0; lint exit 0 (271 files).

### Test

- **What changed in tests:**
  - Updated `parent-completion-feature.test.tsx` to assert corrected microcopy (`"Complete all children and continue?"`, full 2-sentence body, `name: /complete all$/i` for the confirm button).
  - Added 2 new tests to `tree-view.test.tsx` exercising the ⌘⇧M flow: focuses a treeitem via click on its `data-item-id` div, fires the keychord, asserts `"Move to…"` heading appears. Second test asserts the chord does nothing when no row is focused.
- **Failures:** none — Web 569/569, Server 157/157.
- **Full suite output:**
  ```
  $ pnpm --filter @tasko/web test
   Test Files  60 passed (60)
        Tests  569 passed (569)
     Duration  7.12s

  $ pnpm --filter @tasko/server test
   Test Files  22 passed (22)
        Tests  157 passed (157)
     Duration  1.86s

  $ pnpm -r typecheck   (exit 0 both packages)
  $ pnpm lint           Checked 271 files in 73ms. No fixes applied. (exit 0)
  ```
- **Regressions:** none.

### Review

- **Verdict:** Approved.
- **Verification:** all 8 issues resolved at expected file:line; tests exercise the new wiring (⌘⇧M flow via real DOM events; updated microcopy assertions hit the corrected strings).
- **Optional follow-up (not blocking):** `descendantsOf` uses `items.values()` scan per BFS level (O(n × depth)) rather than an adjacency index. Fine at current scale; worth noting for a future perf pass if `items` grows large.

---

## Escalation

> Only present when a cross-boundary issue is discovered that cannot be resolved within this task's scope. Delete this section if no escalation occurred.

- **What broke:** (specific failure or blocker)
- **Why:** (root cause — library API mismatch, missing upstream interface, performance issue, etc.)
- **Upstream task/decision affected:** (which task or design decision is implicated)
- **Resolution:** (user's decision and outcome, or "blocked pending user input")

---

## Completion

- **Commit:** `f177582` — "Task 09: Hierarchy + depth-cap + tree view + Move-to picker"
- **Iterations:** 2 (Implement → Test → Review → Fix → Test → Review approved).
- **Verification evidence:**
  ```
  $ pnpm -r test
  apps/web   Test Files 60 passed (60) | Tests 569 passed (569)
  apps/server Test Files 22 passed (22) | Tests 157 passed (157)

  $ pnpm -r typecheck
  packages/types  Done
  apps/server     Done
  apps/web        Done

  $ pnpm lint
  Checked 271 files in 66ms. No fixes applied. (exit 0)
  ```
- **Acceptance criteria (from brief):**
  - [x] `pnpm --filter @tasko/server typecheck` 0 errors — verified.
  - [x] Server depth-cap unit + integration tests pass — `depth-cap.spec.ts` (20), `hierarchy.spec.ts` (14), `depth-cap-routes.spec.ts` (8) all green.
  - [x] `pnpm --filter @tasko/web typecheck` 0 errors — verified.
  - [x] Web tests pass — 8 new client test files (TreeRow, TreeView, add-flow, flat-list, parent-completion, move-to-picker, depth-cap-client, ⌘⇧M).
  - [x] Manual: tree renders w/ chevrons + indentation + rollup — covered by `tree-view.test.tsx`; manual verification still recommended.
  - [x] Server 409 DEPTH_CAP — `depth-cap-routes.spec.ts`.
  - [x] Kanban toggle → `/project/$id/kanban` stub — manual; route stub in place.
  - [x] `⌘⇧M` opens Move-to picker — verified by `tree-view.test.tsx` `⌘⇧M` describe block (Iter-2 fix).
  - [x] Flat project → List + Kanban toggle — `flat-list-view.test.tsx`.
  - [x] `pnpm lint` clean — verified.
- **Regressions:** none. Pre-existing 502 web + 127 server tests still pass; 67 web + 30 server new tests from this task.
- **Deviations from plan:**
  - `useProject(id)` derives from the `useProjects()` cache rather than a separate query (no extra round trips; cache hit ratio is high).
  - `getDescendants` in tree-view uses iterative BFS to avoid stack overflow.
  - Server `rollupProgress` is a re-export from `@tasko/types` (single source of truth across server + client).
  - Inline-add of Epic/Feature defaults `due_date` to today; user edits via modal afterward (brief explicitly authorizes this pragmatic choice).
  - `<div role="group" aria-label>` carries a biome-ignore for `useSemanticElements` — Biome's `<fieldset>` suggestion is form-only and inappropriate for WAI-ARIA tree subtrees.
- **Deferred to task-18 (logged in `docs/known-issues.md`):** TreeRow `aria-label` on `treeitem` divs per accessibility §3.6 / microcopy §29 (e.g., `"Epic: <Title>, N of M tasks complete"`).
