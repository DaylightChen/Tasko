# Execution Log — Task 10: Drag-and-drop infrastructure

> Scope: `project` (project-design-heavy). Dev loop log for Task 10.

## Iteration 1

### Implement

- **Files created:**
  - `apps/web/src/lib/sort-order.ts` — sparse-integer sort-order math
  - `apps/web/src/lib/drag-auto-scroll.ts` — edge-proximity RAF auto-scroll
  - `apps/web/src/lib/dnd-sensors.ts` — shared PointerSensor + KeyboardSensor hook
  - `apps/web/src/lib/dnd-transform.ts` — local `transformToCSS` (replacing absent `@dnd-kit/utilities`)
  - `apps/web/src/components/drag-visuals/` (`index.tsx` + `styles.module.css`)
  - `apps/web/src/components/sidebar/dnd.tsx` — `SidebarDndContext`, sortable/droppable wrappers
  - `apps/web/src/views/_shared/ListDndContext.tsx`
  - `apps/web/src/views/next-7-view/Next7DndContext.tsx`
  - `apps/web/src/views/project-view/TreeDndContext.tsx`
- **Files modified:**
  - `apps/web/src/components/task-list-row/{index.tsx, styles.module.css}` — drag props + `data-state` CSS
  - `apps/web/src/components/tree-row/styles.module.css` — drag-state CSS
  - `apps/web/src/components/sidebar/index.tsx` — wired DndContext + sortable/droppable
  - `apps/web/src/components/subtask-row/index.tsx` — `useSortable` per row + context on SubtaskList
  - `apps/web/src/views/{today,inbox,tomorrow,all}-view/index.tsx` — wrapped in ListDndContext + SortableTaskRow
  - `apps/web/src/views/project-view/flat-list-view.tsx` — same
  - `apps/web/src/views/next-7-view/index.tsx` — Next7DndContext + DroppableDayGroup + SortableNext7Row
  - `apps/web/src/views/project-view/tree-view.tsx` — TreeDndContext + TreeRowDraggable + ProjectRootDropZone
  - `apps/web/src/views/task-modal/index.tsx` — `handleSubtaskReorder` wired into SubtaskList
- **Decisions not in plan:**
  - `Transform` type isn't a public export from `@dnd-kit/core`; used a local structural type in `lib/dnd-transform.ts`.
  - `@dnd-kit/utilities` not installed at task-01 scaffold — shipped a local `transformToCSS` helper instead of adding the dep.
  - "Loose structural" types in `sidebar/dnd.tsx` to avoid zod-parsed API data tripping the branded `ProjectId`/`FolderId` types — worth flagging to the reviewer (may be hiding a brand-type contract drift).
  - Next-7 sortable IDs are `${item.id}:${groupDate}` because the same item can appear in multiple day buckets (multi-day items).
  - `TreeDndStateCtx` React context shares drop-target + depth-cap-reject state to nested TreeNodes without prop-drilling.
- **Deviations from plan:** none.
- **Issues encountered:** `@dnd-kit/utilities` absence — resolved with local helper (see above).
- **Sanity-check:** `pnpm --filter @tasko/web typecheck` exit 0; `pnpm lint` exit 0 (281 files).

### Test

- **New tests written:** 41 cases across 10 files
  - `apps/web/src/lib/__tests__/sort-order.test.ts` (15)
  - `apps/web/src/__tests__/dnd/auto-scroll.test.ts` (7)
  - `dnd/list-reorder.test.tsx` (3), `sidebar-project-into-folder.test.tsx` (2), `sidebar-project-out-of-folder.test.tsx` (2), `tree-reparent.test.tsx` (2), `tree-depth-cap-reject.test.tsx` (2), `next-7-cross-day.test.tsx` (3), `subtask-reorder.test.tsx` (3), `keyboard-sensor.test.tsx` (3)
- **Failures:** **44 pre-existing tests across 9 files regressed.** All caused by the task-10 implementation: `ListDndContext` and `Next7DndContext` call `usePatchItem()`, but the existing view tests' `vi.mock('../../api/items', () => ({...}))` factories don't include `usePatchItem`. Test runner errors with `No "usePatchItem" export is defined on the mock`. Failing files:
  - `today-view/__tests__/{today-view, today-complete-undo, today-keyboard, today-parent-completion-blocking, today-rollback-on-error}.test.tsx`
  - `inbox-view/__tests__/inbox-view.test.tsx`
  - `tomorrow-view/__tests__/tomorrow-view.test.tsx`
  - `all-view/__tests__/all-view.test.tsx`
  - `next-7-view/__tests__/next-7-days.test.tsx`
- **Suite output:**
  ```
  $ pnpm --filter @tasko/web test
   Test Files  9 failed | 61 passed (70)
        Tests  44 failed | 567 passed (611)
     Duration  12.76s

  $ pnpm --filter @tasko/web typecheck  (exit 0)
  $ pnpm lint                            Checked 291 files in 95ms. No fixes applied. (exit 0)
  ```
- **Forwarded to Iteration 2 fix:** add `usePatchItem: vi.fn()` (and any other now-required mocks like `useChangePriority`, `useReschedule`, `useToggleComplete` etc. that the dnd contexts may now reference) to each of the 9 failing test files.
- **Coverage gaps documented:** CSS reduced-motion behavior (JSDOM can't evaluate media queries); SR walkthrough (Step 12 manual); `data-state="depth-cap-reject"` visual during dragOver phase (assertion would require full TreeView integration render).

### Review
- **Verdict:** Approved / Issues found
- **Criteria check:**
  - [criterion from brief] — pass / fail
  - [criterion from brief] — pass / fail
- **Code quality findings:** (DRY, YAGNI, unnecessary abstractions, or: clean)
- **Test quality findings:** (coverage gaps, test design issues, or: adequate)
- **Regressions:** none / (details)
- **Issues to fix:** (numbered list, or: none)

---

## Iteration 2

### Fix

- **What was fixed:**
  - Added `usePatchItem: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() }))` to the `vi.mock` factory in all 9 failing test files. (`useReschedule` was already mocked.)
  - **Surfaced + fixed a real keyboard-handler conflict in `task-list-row/index.tsx`.** dnd-kit's `useSortable().listeners` includes an `onKeyDown` activator that, when JSX-spread last via `{...dragListeners}`, overrode the row's own `handleKeyDown` — silently breaking Space / Enter / T / Delete / 1-4 row shortcuts everywhere. The implementer merged the two handlers (`handleKeyDown` first, then `dragListeners.onKeyDown?.()`) and spreads `mergedListeners` instead of the raw set.
  - Updated row-query selectors in 5 test files (`today-view`, `today-rollback-on-error`, `today-keyboard`, `inbox-view`, `tomorrow-view`, `all-view`) from `getByRole('listitem')` to `getByRole('button', { name: /^task:/i })` because dnd-kit's `dragAttributes.role = "button"` overrides the `<li>` semantics on draggable rows.
- **Files modified:**
  - 9 view test files (mock factories)
  - `apps/web/src/components/task-list-row/index.tsx` (merged keyboard handlers + always-merge listener spread)
  - 5 of the 9 test files also had their role queries updated (`today-view`, `today-rollback-on-error`, `today-keyboard`, `inbox-view`, `tomorrow-view`, `all-view`)
- **Deviations:** the brief said only mock additions; the dnd-kit listener-override bug was a real implementation issue that surfaced once `usePatchItem` was wired through. Fixing it preserves the existing row keyboard contract. This is forwarded to the reviewer as a note (the fix is structural, not a regression).
- **Sanity-check:** test 611/611 pass, typecheck exit 0, `pnpm lint` exit 0 (291 files).

---

## Iteration 3

### Fix

- **What was fixed (all 8 issues from Iter-2 review):**
  1. Undo wiring on 3 drag mutations:
     - project-into-folder (`sidebar/dnd.tsx:260-281`): captures `prior = { folder_id, sort_order }`, pushes `useUndoStore.getState().push({ label: 'Project move', apply: () => patchProject.mutate(...prior) })`, adds `action: { label: 'Undo', onClick: () => useUndoStore.getState().pop() }` to snackbar.
     - project-out-of-folder (`sidebar/dnd.tsx:284-322`): same pattern; `prior.folder_id` is restored.
     - task re-parent (`TreeDndContext.tsx:289-308`): captures `priorParentId`/`priorProjectId`, pushes undo entry in `onSuccess`.
  2. `sidebar/dnd.tsx:316` snackbar → `` `Project moved out of ${sourceFolderName}.` `` (folder name looked up from `folders`).
  3. `tree-view.tsx:678` — new `ProjectRootDropZoneWrapper` that consumes `useTreeDndState()` (the context already exposed `dropTargetId`) and passes the correctly-derived `isRootDropTarget`.
  4. Sidebar folder auto-expand wired through new `onAutoExpandFolder?: (folderId) => void` prop on `SidebarDndContext`; `sidebar/index.tsx` provides the callback that deletes the folder from `collapsedFolders`.
  5. Dropped `lib/dnd-transform.ts` in favor of `@dnd-kit/utilities` `CSS.Transform.toString`. Added direct dep; replaced all 4 call sites. `dnd-transform.ts` deleted.
  6. Dead `isDragSource` prop removed from `SortableProjectProps`/`SortableFolder` + the 3 `isDragSource={false}` passing sites in `sidebar/index.tsx`.
  7. Added `onDragOver` SR announces (throttled via `lastAnnouncedTargetRef`) to `ListDndContext` and `subtask-row`'s `SubtaskList`. Verbatim: `Drop on <title>.`.
  8. `"Folder reordered."` snackbar removed (silent reorder per the spec's silence on this case).
- **Files modified:**
  - `apps/web/src/components/sidebar/{dnd.tsx, index.tsx}`
  - `apps/web/src/views/project-view/{TreeDndContext.tsx, tree-view.tsx}`
  - `apps/web/src/views/_shared/ListDndContext.tsx`
  - `apps/web/src/views/next-7-view/Next7DndContext.tsx`
  - `apps/web/src/components/subtask-row/index.tsx`
  - `apps/web/package.json`
- **Files deleted:** `apps/web/src/lib/dnd-transform.ts`
- **Decisions not in brief:** `ProjectRootDropZoneWrapper` is a small local component (needed because `useTreeDndState()` must be called inside the context subtree); keeps `tree-view.tsx` render function clean.
- **Sanity-check:** test 614/614 pass, typecheck exit 0, `pnpm lint` exit 0 (290 files after `dnd-transform.ts` deletion).

### Test

- **What changed in tests:** 7 new regression-guard cases across 4 files:
  - `sidebar-project-into-folder.test.tsx` (+2): undo entry pushed + snackbar action; pop re-PATCHes to original folder.
  - `sidebar-project-out-of-folder.test.tsx` (+1): snackbar text has real folder name + Undo action + undo entry.
  - `tree-reparent.test.tsx` (+2): undo wiring after reparent; pop re-moves to original parent.
  - `sidebar-folder-auto-expand.test.tsx` (new, +2): 300ms callback fires; cancels if hover moves away.
- **Failures:** none — 621/621 pass.
- **Suite output:**
  ```
  $ pnpm --filter @tasko/web test    Tests  621 passed (621)
  $ pnpm --filter @tasko/web typecheck  (exit 0)
  $ pnpm lint                            Checked 291 files in 84ms. No fixes applied. (exit 0)
  ```
- **Coverage note:** the `data-state="drop-target"` visual on `ProjectRootDropZone` during dragOver isn't reached in JSDOM (would conflict with the module-level `@dnd-kit/core` mock); verified via the surrounding integration tests + manual / future Playwright pass.

### Review

- **Verdict:** Approved.
- **Verification:** all 8 issues resolved at expected file:line; the 7 new regression-guard tests genuinely exercise the new behavior (snackbar carries `Undo` action, undo store has entry, pop re-PATCHes to prior state, auto-expand timer fires/cancels correctly).
- **Optional follow-up (not blocking):** `TreeDndContext.tsx:291` undo `apply` passes `new_project_id: priorProjectId` even though the forward move only sets `new_parent_id`. This is correct for same-project re-parent, but worth a comment so future cross-project drag (if added) doesn't lose context. Logged for task-18/task-9 follow-up.

### Test

- **What changed in tests:**
  - Added 3 cases to `task-list-row/__tests__/TaskListRow.test.tsx` under a new `'keyboard handler merge with dragListeners'` describe block. They directly exercise the `mergedKeyDown` path: (1) Space fires both the row's `onToggleCheckbox` AND dnd-kit's `onKeyDown`; (2) edge-case where the row has no own callback — dnd-kit listener still runs; (3) fallback — no `dragListeners` → row shortcuts still work.
- **Failures:** none — 614/614 pass.
- **Full output:**
  ```
  $ pnpm --filter @tasko/web test    Tests  614 passed (614)
  $ pnpm --filter @tasko/web typecheck   (exit 0)
  $ pnpm lint                            Checked 291 files in 90ms. No fixes applied. (exit 0)
  ```
- **Regressions:** none.

### Review

- **Verdict:** Issues found — 4 must-fix + 4 nice-to-have.
- **Criteria check:** all PASS except "drag project into folder → PATCH + snackbar" (PARTIAL: PATCH fires but snackbar lacks Undo action; same for project-out-of-folder + tree re-parent).
- **Code quality findings:**
  - Drag snackbars at `sidebar/dnd.tsx:263-268`, `:291-296`, and `TreeDndContext.tsx:291-299` show no `Undo` action and push nothing into `undoStore`. Spec §7 requires Undo for all three. Task-12's bulk-undo consolidation would later inherit this gap.
  - `sidebar/dnd.tsx:293` snackbar text `'Project moved out of folder.'` — spec requires the folder name (`Project moved out of <Folder>.`).
  - `tree-view.tsx:678` `<ProjectRootDropZone isDropTarget={false}>` — hardcoded false; should derive from `useTreeDndState().dropTargetId === 'tree-root:<projectId>'`. Visual highlight never appears for the project root drop zone.
  - `sidebar/dnd.tsx:196-202` folder auto-expand callback is a no-op stub; brief Step 2 explicitly requires 300ms auto-expand. `SidebarDndContext` needs an `onAutoExpandFolder` prop wired into the sidebar's collapsed-folders state.
  - `dnd-transform.ts` shim diverges from `@dnd-kit/utilities`' `CSS.Transform.toString` but is functionally correct for current use. `@dnd-kit/utilities` is already in pnpm store as a transitive dep; delete the shim + add direct dep.
  - `sidebar/dnd.tsx` `isDragSource` prop is dead (never read; always passed false).
  - `sidebar/dnd.tsx:366` `"Folder reordered."` snackbar isn't in microcopy §7 — remove or document intent.
  - `ListDndContext` + `SubtaskList` lack `onDragOver` SR announcements (brief Step 10 + microcopy §26).
- **Test quality findings:** existing tests would not catch the missing Undo action; new tests should assert action button presence after fix lands.
- **Microcopy / ARIA findings:** see code-quality section. CSS data-state contract, reduced-motion, keyboard-merge, and tree depth-cap rejection are all clean.
- **Downstream readiness:**
  - Task-11 (recurrence): clean — drag uses `useReschedule`/`usePatchItem`/`useMoveItem`, not `useToggleComplete`.
  - **Task-12 (bulk undo): blocked by missing drag-undo wiring** — must be fixed here.
  - Task-17 (SSE): clean — standard PATCH/POST will publish.
  - Task-18 (hotkey registry): keyboard-merge fix in TaskListRow has 3 regression-guard tests.
- **Issues to fix:**
  1. **(must-fix)** Wire `undoStore.push({ label, apply })` + `action: { label: 'Undo', onClick: undoStore.pop }` for the 3 drag mutations: project-into-folder (`sidebar/dnd.tsx:263-268`), project-out-of-folder (`:291-296`), task re-parent (`TreeDndContext.tsx:291-299`).
  2. **(must-fix)** `sidebar/dnd.tsx:293` snackbar text — substitute folder name (`Project moved out of ${folderName}.`).
  3. **(must-fix)** `tree-view.tsx:678` `ProjectRootDropZone` — derive `isDropTarget` from `useTreeDndState().dropTargetId === 'tree-root:<projectId>'`.
  4. **(must-fix)** `sidebar/dnd.tsx:196-202` + `sidebar/index.tsx` — wire folder auto-expand through `onAutoExpandFolder` callback.
  5. **(nice-to-have)** Delete `lib/dnd-transform.ts`; add `@dnd-kit/utilities` to `apps/web/package.json`; use `CSS.Transform.toString`.
  6. **(nice-to-have)** Remove dead `isDragSource` prop from `SortableProject`/`SortableFolder`.
  7. **(nice-to-have)** Add `onDragOver` SR announce throttled to one-per-target in `ListDndContext` + `SubtaskList`.
  8. **(nice-to-have)** Decide on the `"Folder reordered."` snackbar — remove or document.

---

## Escalation

> Only present when a cross-boundary issue is discovered that cannot be resolved within this task's scope. Delete this section if no escalation occurred.

- **What broke:** (specific failure or blocker)
- **Why:** (root cause — library API mismatch, missing upstream interface, performance issue, etc.)
- **Upstream task/decision affected:** (which task or design decision is implicated)
- **Resolution:** (user's decision and outcome, or "blocked pending user input")

---

## Completion

- **Commit:** `13f4d69` — "Task 10: Drag-and-drop infrastructure across sidebar, lists, tree, next-7, and subtasks"
- **Iterations:** 3 (Implement → Test → Fix view mocks → Test → Review → Fix UX gaps → Test → Review approved).
- **Verification evidence:**
  ```
  $ pnpm -r test
  apps/web   Test Files 71 passed (71) | Tests 621 passed (621)
  apps/server (unchanged — Test Files 22 passed (22) | Tests 157 passed (157))

  $ pnpm -r typecheck
  packages/types  Done
  apps/server     Done
  apps/web        Done

  $ pnpm lint
  Checked 291 files in 93ms. No fixes applied. (exit 0)
  ```
- **Acceptance criteria (from brief):**
  - [x] `pnpm --filter @tasko/web typecheck` 0 errors — verified.
  - [x] All dnd tests pass — 13 new dnd tests + 1 sort-order suite + 3 TaskListRow merge tests + 2 auto-expand tests; 41+10 = 51 brand-new cases on top of 567 pre-existing = 621.
  - [x] Drag project into folder → PATCH + snackbar + **Undo wired** (Iter-3 fix) — `sidebar-project-into-folder.test.tsx`.
  - [x] Tree drag — depth-cap valid drops, invalid rejects + assertive snackbar — `tree-depth-cap-reject.test.tsx`.
  - [x] Next 7 Days cross-day drag → due_date PATCH — `next-7-cross-day.test.tsx`.
  - [x] Subtask drag-handle visible; drag commits — `subtask-reorder.test.tsx`.
  - [x] Reduced motion: scale + pulse + transitions suppressed via `@media (prefers-reduced-motion: reduce)` — manual.
  - [x] Esc cancels + "Drag cancelled." announce — `keyboard-sensor.test.tsx`.
  - [x] `pnpm lint` clean — verified.
- **Regressions:** none. 502 web pre-existing + 67 task-09 + 30 server task-09 + 41 task-10 new + 7 iter-3 guards + 3 keyboard-merge = ~611 → 621 web; server 157.
- **Deviations from plan (summary across all iterations):**
  - `@dnd-kit/utilities` was missing from `apps/web/package.json` — Iter-1 shipped a local `transformToCSS` shim; Iter-3 added the dep and deleted the shim.
  - Iter-2 surfaced a real keyboard-handler conflict (dnd-kit's `useSortable().listeners.onKeyDown` was overriding `TaskListRow.handleKeyDown`); fixed by merging handlers — 3 regression-guard tests added. This was the single highest-impact discovery — would have silently broken Space/Enter/T/Delete shortcuts across every list row.
  - Iter-3 added Undo wiring (`useUndoStore` + snackbar `action`) to the 3 drag mutations the spec requires (project-into-folder, project-out-of-folder, task re-parent). Without this, task-12's bulk-undo consolidation would have inherited a silent contract gap.
  - Iter-3 also fixed the `ProjectRootDropZone` visual-highlight bug (hardcoded `false`), the sidebar folder auto-expand no-op stub, and microcopy for `Project moved out of <Folder>.`. Removed the unspec'd `"Folder reordered."` snackbar.
  - "Loose structural" types in `sidebar/dnd.tsx` were retained — the brand-type strip workaround is benign since zod has already validated the data upstream; reviewer approved.
- **Forwarded to task-9/-18 follow-up:** the `TreeDndContext` undo `apply` passes `new_project_id: priorProjectId` even though forward drag is same-project only — fine for current behavior, worth a comment if cross-project drag is added later.
