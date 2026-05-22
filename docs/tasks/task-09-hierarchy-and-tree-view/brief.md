# Task 09 — Hierarchy: depth-cap + tree view + per-project views

## Goal

Implement the 4-level depth-cap rule end-to-end and the project tree / flat list views that surface hierarchy. Ship the server-side `domain/depth-cap.ts` `canMove` predicate (with cycle check + subtask-attachment rule), wire it into every server mutation that changes `parent_id` or `project_id` (POST /api/items, PATCH /api/items/:id, POST /api/items/:id/move), ship the frontend mirror `lib/depth-cap-client.ts`, build the TreeRow component (per UX §21), build the per-project Tree view + per-project Flat list view (the view to render is decided by the project's `is_hierarchical` field), wire the View toggle (Tree↔Kanban for hierarchical; List↔Kanban for flat — Kanban itself is a stub route until task-15), and the Move-to picker (`⌘⇧M`).

The per-project URL `/project/$id` resolves to Tree (hierarchical) or List (flat) at runtime. `+ Add Epic` / `+ Add Feature` / `+ Add Task` inline editing flows live here, including the destination-context exception: when the user clicks "+ Add Task" inside a Feature in the tree, the Task modal opens with project AND parent_id pre-filled (per UX §9.4 #8 exception + frontend-architecture §14).

## Context files

- `docs/engineering/2026-05-18-data-model.md#3-7-hierarchy--depth-cap` — `canMove` algorithm verbatim, with the `levelOf` and `maxDescendantDepth` helpers.
- `docs/engineering/2026-05-18-code-architecture.md#3-5-domain----depth-cap--recurrence--hierarchy` — file shapes for `domain/depth-cap.ts`, `domain/hierarchy.ts`.
- `docs/engineering/2026-05-18-frontend-architecture.md#10-2-the-frontend-depth-cap-mirror` — `lib/depth-cap-client.ts`.
- `docs/engineering/2026-05-18-feature-mapping.md#6-per-project-views` — module + endpoint map for tree / flat / view toggle / "+ Add Epic" etc.
- `docs/ux/component-inventory.md#21-tree-row` — full TreeRow spec.
- `docs/ux/component-inventory.md#31-tab--icon-toggle-group--project-view-switcher` — view toggle behavior.
- `docs/ux/screens.md` — per-project (flat), per-project (hierarchical Tree), per-project (Kanban — stub here).
- `docs/ux/flows.md` — §1 first-time use (steps 22-39 hierarchy project creation + first Epic/Feature/Task), §5 hierarchical project create + re-parent (both Drag and Move-to picker paths), §11 parent completion blocking (Feature has no checkbox in v1 — use the ⋯ menu → "Mark complete" with the same prompt).
- `docs/ux/microcopy.md` — §4 buttons "+ Add Epic" / "+ Add Feature" / "+ Add Task" / "+ Add Task in project" / "Mark complete", §6.1 parent completion blocking variants for Feature / Epic, §18 per-project flat copy ("Active (N)", "Show N completed"), §19 per-project hierarchical copy ("Loose tasks in project (no Epic parent)").
- `docs/ux/accessibility.md` — §3.6 tree ARIA (`role="tree"` / `treeitem` / `aria-level` / `aria-expanded` / `aria-setsize` / `aria-posinset`), §2.3 tree row keyboard map (↑↓ siblings; ← collapse / parent; → expand / first child; Enter / O modal; Space toggle checkbox on Tasks).
- `docs/ux/interaction-patterns.md` — §16 inline-vs-modal editing (tree row title inline edit; date chip / priority dot open popovers; click anywhere else opens modal).
- `docs/brainstorm/product-spec.md#4-3-item--task-feature-epic----the-flexible-hierarchy` — depth-cap semantics + constraints.
- `docs/engineering/2026-05-18-open-questions.md#0-binding-resolutions-user-2026-05-18` (no specific resolution here, but item #4.7 — Project Restore deferred to v1.1 — is relevant for understanding the boundary).

## Downstream dependencies

- **Task 10** (drag-and-drop) wires `canMoveClient` into the tree row's drop-target handling. The depth-cap-rejection visual (overdue-tinted dashed outline + no-drop cursor) is the contract here.
- **Task 11** (recurrence) does not touch the tree directly but the recurring next-instance generation may land items in different positions; the tree's rendering must handle re-renders smoothly when the cache updates.
- **Task 12** (trash) cascade-deletes descendants — the tree view re-renders without the trashed branch.
- **Task 15** wires Kanban into the project view via the View toggle.
- **Task 17** (SSE) keeps the tree in sync across tabs — multi-tab tree edits should reflect after a brief delay.
- **Task 18** registers the global `⌘⇧M` shortcut (Move-to picker) — already used here; task-18 puts it in the hotkey registry instead of an ad-hoc useEffect.

## Steps

1. **Server: `domain/depth-cap.ts`** — implement per `data-model.md` §3.7. Functions:
   - `levelOf(item, items)` — counts from item back to project root by walking `parent_id`.
   - `maxDescendantDepth(item, items)` — recursive descent excluding trashed items; +1 for inline subtasks if `item.type === 'task' && item.subtasks?.length > 0`.
   - `canMove({ source, newParent, items })` — checks subtask-attachment rule (non-task source can't attach to a Task), the computed `newSourceLevel + maxDescendantDepth(source) > 4` rejection, AND a cycle check (walking newParent's ancestors looking for source.id).
   - Export `canPlaceAtRoot(source, items) = canMove({ source, newParent: null, items })`.
   - Heavy unit tests in `apps/server/test/unit/depth-cap.spec.ts` covering: a fresh Task at project root (ok), an Epic→Feature→Task→Subtask family (ok), trying to nest a Feature under another Feature with a Task under it (level 1+1+1+subtask=4 — borderline ok; with one more level it rejects), trying to attach a Task as a child of another Task (rejected — only subtasks attach to Tasks), cycle (place Epic under its descendant — rejected with "Cannot place under own descendant.").
2. **Server: hierarchy helpers** — `apps/server/src/domain/hierarchy.ts`:
   - `descendantsOf(itemId, items)` — depth-first walk, excludes trashed. Used by `data-model.md` §3.4 cascade soft-delete (task-12) and §3.6 cross-project move (already in task-03 — refactor that route to call this helper for clarity).
   - `topLevelOfProject(projectId, items)` — items where `project_id === projectId && parent_id === null && trashed_at === null`.
   - `rollupProgress(item, items)` — counts direct children with `status === 'done'` over total non-trashed direct children. Returns `{ completed, total }`.
3. **Wire `canMove` into every server mutation that changes `parent_id` or `project_id`**:
   - `POST /api/items`: validate `parent_id`. Build a hypothetical Item shape (without the id but with the proposed parent_id). Call `canMove({ source: hypothetical, newParent, items })`. If `{ ok: false }`, throw `HttpError(409, 'DEPTH_CAP', reason)`.
   - `PATCH /api/items/:id` when `parent_id` is in the patch: re-validate. Same rejection.
   - `POST /api/items/:id/move`: same.
   - For `project_id` cross-project moves: the subtree moves wholesale, so depth cap is unaffected (its internal levels stay the same). Document this in a comment.
   - Replace the `// TODO(task-09): depth-cap check` comments from task-03.
   - Tests: `apps/server/test/integration/depth-cap-routes.spec.ts` — POST that would create level 5 → 409 DEPTH_CAP; PATCH parent_id same scenario → 409; cycle attempt → 409 with "Cannot place under own descendant.".
4. **Frontend: `lib/depth-cap-client.ts`** — exact mirror of the server's `canMove`. Operates on a `Map<ItemId, Item>` extracted from the TanStack Query cache. Used by the tree view's drag-over handler (task-10) and the move-to picker (here). Unit tests mirror the server's test cases.
5. **TreeRow component** — `apps/web/src/components/tree-row/`:
   - Per UX §21 structure (left to right):
     1. **Indent** — 24px per level (depth 0 = Epic, 1 = Feature, 2 = Task). Render a vertical guide line at each indent stop (1px `border-subtle`).
     2. **Expand chevron** — 16px Lucide `ChevronRight` (collapsed) / `ChevronDown` (expanded). Hidden if `item` has no children. 24×24 clickable area.
     3. **Type icon** — 20px Lucide per item type (Layers / LayoutGrid / SquareCheckBig). Color `text-subtle`.
     4. **Checkbox** — only for Tasks. Epics and Features show their type icon + rollup progress, no checkbox (per UX §21.2 + flows.md §11 resolution: "Epic/Feature completion is not user-toggleable via a checkbox in v1; use ⋯ → Mark complete").
     5. **Title** — `text-body`. Inline-editable on click.
     6. **Inline meta (right side)** — date chip if date is meaningful (Tasks only typically), tag chips (up to 2 + "+N"), priority dot, multi-day chip, **rollup progress** chip+bar (Epics/Features only) per UX §21.5: small chip "<N>/<M>" + 32px-wide progress bar (background `text-subtle`, filled portion `accent`). Hidden if no children.
     7. **Hover affordances** — ⋯ icon button + chevron-right "Open" icon.
   - **States** per §21.3: default / hover / focus / selected / multi-selected / completed (strike-through, `text-subtle` — only visible in Completed view or under a "show completed" toggle in tree — task-12 for Completed, task-09 for the toggle) / trashed (not shown) / dragging (task-10) / drop-target (task-10) / depth-cap rejection (task-10) / loading (with inline spinner on expand).
   - **Keyboard** per §21.4: ↑↓ siblings; ← collapse, then to parent; → expand, then to first child; Enter / O → opens modal; Space toggles checkbox (Tasks only); `⌘⇧M` opens Move-to picker (task-18 wires globally; task-09 sets up the local handler).
   - **ARIA** per accessibility.md §3.6: tree row is `role="treeitem"` with `aria-level`, `aria-expanded` where applicable, `aria-setsize`, `aria-posinset`. The parent container is `role="tree"` with an `aria-label="<Project name> tasks"`.
   - Props:
     ```tsx
     export interface TreeRowProps {
       item: Item;
       level: 1 | 2 | 3;       // 1=Epic-like (top-level), 2=Feature-like (child), 3=Task-like (grandchild)
       expanded: boolean;
       posInSet: number;
       setSize: number;
       hasChildren: boolean;
       rollup?: { completed: number; total: number };  // Epic/Feature only
       isFocused?: boolean;
       isSelected?: boolean;
       // Callbacks for every interactive element (same shape as TaskListRow + onToggleExpand + onAddChild for the "+ Add Feature" / "+ Add Task" inline affordances on the right side that appear on hover for Epic/Feature)
       onToggleExpand: () => void;
       onToggleCheckbox?: () => void;             // Tasks only
       onAddChild?: () => void;                    // Epic → "+ Add Feature"; Feature → "+ Add Task"
       onClick?: () => void;
       onMenuOpen?: () => void;
       onTitleClickInlineEdit?: () => void;
       onTitleCommitInlineEdit?: (newTitle: string) => void;
       onDateClick?: () => void;
       onPriorityClick?: () => void;
     }
     ```
   - Tests in `__tests__/TreeRow.test.tsx`: default render for each type (Epic, Feature, Task); checkbox visible only for Task; rollup visible only for Epic/Feature with children; arrow keys per the contract; ARIA attributes correct.
6. **Tree view** — `apps/web/src/views/project-view/tree-view.tsx`:
   - Loads `useItems({ view: 'project', project_id: id })`. Builds a tree by grouping items by `parent_id`.
   - Renders a `<div role="tree" aria-label="<Project name> tasks">` with `<TreeRow />` per item. Recursively renders children of expanded rows.
   - **Expanded state**: per-row, kept in a Zustand store `treeExpansionStore` (per-project map of `ItemId → boolean`). Default: top-level Epics expanded; everything else collapsed.
   - **"+ Add Epic" button** (top of view): inline editable row — clicking opens an inline TextInput at the top of the tree (NOT the Task modal — since Epics don't require date/project picking interactively; just title is enough). Enter creates the Epic via `POST /api/items` with `type: 'epic'`, `project_id: <project>`, `parent_id: null`, `title: typedText`. For required `due_date`: use today's date as default (the user can edit later via modal). This is a pragmatic choice — Epics are containers; forcing date selection at create is friction. Document the choice in the brief: **the inline Epic/Feature creation uses today's date as the default due_date**; the user edits via modal afterwards. (Tasks open the modal because they need explicit date picking — per flow §1 step 37.)
   - **"+ Add Feature" affordance** (hover on Epic): inline-edit on a child row. Same as Epic: title + Enter, type='feature', parent=Epic, due_date=today default.
   - **"+ Add Task" affordance** (hover on Feature): inline TextInput row opens; Enter → opens the Task modal with `initialTitle`, `initialProjectId: project.id`, `initialParentId: feature.id` (per `frontend-architecture.md` §14 destination-context exception). User completes the modal.
   - **"+ Add Task in project"** (top-level button): creates a Task at project root (parent_id: null). Same Modal-with-pre-fills flow.
   - **Loose tasks divider**: when a hierarchical project has top-level items of mixed types (Epics AND top-level Tasks), render a `<h3>Loose tasks in project (no Epic parent)</h3>` divider per microcopy §19, with the top-level Tasks below it.
   - **"Show N completed" toggle** (Ghost button at bottom of tree, per UX `screens.md` per-project flat — adapt for tree): collapsed by default. Click expands a section showing completed items in the tree (with strike-through styling). When expanded, label becomes "Hide completed". Uses `useItems({ view: 'project', project_id: id, include_completed: true })` and merges.
   - **Rollup progress** for Epics + Features: computed client-side from the cache using the helper from `domain/hierarchy.ts` (the same function shipped on the server — we re-implement on the client in `lib/rollup.ts`, OR re-export the pure function from `@tasko/types` — adding it to the types package keeps it shared. Decision: ship `packages/types/src/domain/rollup.ts` as a pure helper exporting `rollupProgress(item, items)` — both sides import.).
   - **View toggle** (ViewToggle from task-06): for hierarchical projects, show Tree + Kanban (Kanban routes to `/project/$id/kanban`, a stub until task-15). Selected: Tree. Selection persists via the URL.
   - **Empty state** per microcopy §5: "No work in <Project> yet." + subline "Add an Epic to start organizing, or a Task to keep it loose." + CTA "+ Add Epic" + secondary "+ Add Task in project".
7. **Flat list view** — `apps/web/src/views/project-view/flat-list-view.tsx`:
   - Loads items for the project. Renders TaskListRow (task-06). Sort dropdown. QuickAddInput.
   - **"Show N completed" toggle**: ghost button below the active list, expands to show completed items (per UX §18 per-project flat).
   - View toggle: List ↔ Kanban (Kanban stub until task-15).
   - Empty state: "No tasks in <Project> yet." + subline "Add one above.".
8. **Project view router** — `apps/web/src/routes/project.$id.tsx`:
   - Loads the project via `useProject(id)` (from task-04's hooks; if it doesn't exist yet, add). Renders TreeView if `project.is_hierarchical`, else FlatListView.
   - View chrome: title "<Project name> (in <Folder name>)" or just "<Project name>" if no folder. Plus the View toggle, sort, filter.
9. **Move-to picker (`⌘⇧M`)** — `apps/web/src/components/move-to-picker/`:
   - A Modal (or Sheet on mobile) that opens with a typeahead input and a flat list of valid destinations.
   - Destinations include: every project (e.g., "Inbox", "Personal / Errands", "Work / Q3 Launch") AND, for re-parenting within a single project, every Epic / Feature in the project (e.g., "Work / Q3 Launch / Marketing site relaunch" Epic, ".../Hero section copy" Feature, etc.).
   - Each candidate is annotated with whether `canMoveClient({ source, newParent: candidate, items })` returns ok. Invalid candidates render disabled with "too deep" or "self/descendant" annotation.
   - Selecting a candidate calls `useMoveItem({ id: source.id, new_parent_id, new_project_id })` (a new hook in `api/items.ts`).
   - Trigger: `⌘⇧M` while a row is focused (any list/tree view), or right-click → "Move to project…" / "Move to parent…", or via the ⋯ menu's "Move to…".
   - Tests: open via `⌘⇧M`, type to filter, select a candidate, verify the move PATCH happens; attempt to select an invalid candidate (depth-cap) — it's disabled, can't be selected.
10. **Wire view toggle URL navigation** — for the Kanban toggle, navigate to `/project/$id/kanban` (a stub route added in task-04 — its route component renders a placeholder "Kanban view (task-15)" message). The Tree/List toggle uses `/project/$id` (no extra path segment).
11. **Right-click context menu on tree rows** — Open / Edit tags / Move to project… / Reschedule (date submenu) / Set priority (priority submenu) / Mark complete (Epic/Feature only — opens parent-completion-blocking with descendant count) / Delete. Delete calls `useTrashItem` (stub → real in task-12).
12. **Parent completion blocking for Feature / Epic** — per `flows.md` §11 resolution: Mark complete via the ⋯ menu opens the ConfirmationPrompt with body variant from microcopy §6.1: "This feature has N incomplete tasks." / "This epic has N incomplete items." Confirm → atomic PATCH that sets `status: 'done'` on the Feature/Epic AND all incomplete descendants. (Client-side: enumerate descendants from cache, send a sequence of PATCH calls; server-side this isn't atomic across multiple items in v1 — accept the small consistency window.) Future task: add a `POST /api/bulk/complete` flow that handles this in one server-side mutex (task-12 builds it; revisit at task-12 to refactor this hot path to use the bulk endpoint).
13. **Tests** — `apps/web/src/views/project-view/__tests__/`:
    - `tree-view.test.tsx`: render a hierarchical project with 1 Epic → 2 Features → 4 Tasks (2 per Feature) + a top-level Task (loose). Assert the tree renders, expand/collapse works, rollup shows for Epic ("2/9" — make some Tasks completed). "Loose tasks in project (no Epic parent)" divider renders.
    - `tree-view-add-flow.test.tsx`: click "+ Add Epic" → inline TextInput, type "Q3 Launch", Enter → POST /api/items with type:epic; click "+ Add Feature" on the Epic → inline → POST type:feature; click "+ Add Task" on a Feature → modal opens with project + parent pre-filled.
    - `flat-list-view.test.tsx`: non-hierarchical project; tasks render; show-completed toggle works.
    - `move-to-picker.test.tsx`: open via `⌘⇧M`, filter by typing, select a candidate, assert PATCH. Attempt to select a self/descendant → disabled in list.
    - `parent-completion-feature.test.tsx`: Feature with 3 incomplete Tasks → menu → "Mark complete" → prompt body says "This feature has 3 incomplete tasks." → confirm → all 4 (Feature + 3 Tasks) become done.
    - Server tests: `depth-cap-routes.spec.ts` exhaustive per step 3.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/server typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/server test` — `domain/depth-cap.spec.ts` and `depth-cap-routes.spec.ts` pass with the full case matrix.
- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — every test in step 13 passes.
- [ ] Manual: create a hierarchical project, add an Epic, a Feature under it, 3 Tasks under the Feature, 2 subtasks on one Task. Tree renders correctly with chevrons + indentation + rollup. Adding a Feature inside an existing Feature with Tasks → blocked (the affordance is hidden because depth would exceed). Attempt via the move-to picker → candidate disabled.
- [ ] Manual: server rejects an out-of-cap POST with 409 DEPTH_CAP and the reason text.
- [ ] Manual: switching to Kanban via the view toggle navigates to `/project/$id/kanban` which renders the task-15 placeholder.
- [ ] Manual: `⌘⇧M` opens the Move-to picker (registered via a local `useEffect` keylistener in this task; task-18 will consolidate).
- [ ] Manual: a flat project shows the List + Kanban toggle, not Tree + Kanban.
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/server/src/domain/depth-cap.ts`, `apps/server/src/domain/hierarchy.ts`
  - `apps/server/test/unit/depth-cap.spec.ts`, `apps/server/test/integration/depth-cap-routes.spec.ts`
  - `packages/types/src/domain/rollup.ts` (shared `rollupProgress`)
  - `apps/web/src/lib/depth-cap-client.ts`, `apps/web/src/lib/rollup.ts` (re-exports from types)
  - `apps/web/src/components/tree-row/` (+ test)
  - `apps/web/src/views/project-view/tree-view.tsx`, `flat-list-view.tsx`, `__tests__/*.test.tsx`
  - `apps/web/src/components/move-to-picker/` (+ test)
  - `apps/web/src/store/tree-expansion.ts`
- Modified:
  - `apps/server/src/routes/items.ts` — wire `canMove` into POST, PATCH (when parent_id), POST /move. Replace TODO(task-09) comments.
  - `apps/server/src/routes/items.ts` (cross-project move) — call `descendantsOf` from `domain/hierarchy.ts`.
  - `apps/web/src/api/items.ts` — add `useMoveItem`.
  - `apps/web/src/routes/project.$id.tsx` — render TreeView or FlatListView based on `project.is_hierarchical`.
  - `apps/web/src/routes/project.$id.kanban.tsx` — stub message until task-15.
  - `packages/types/src/index.ts` — re-export `rollupProgress`.
