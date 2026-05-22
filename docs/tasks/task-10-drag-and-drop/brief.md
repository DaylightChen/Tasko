# Task 10 — Drag-and-drop infrastructure

## Goal

Wire `@dnd-kit/core` + `@dnd-kit/sortable` across every drag surface listed in `interaction-patterns.md` §1.1 that ships in v1:
- **Sidebar**: project↔folder drag (move project into folder, out of folder, between folders); project reorder within section.
- **List views**: row reorder within Today / Inbox / per-project flat / per-tag (sort_order PATCH).
- **Tree view**: re-parent items (uses `canMoveClient` from task-09 for depth-cap visualization).
- **Next 7 Days**: drag a row across day groups → reschedules due_date.
- **Subtask list in Task modal**: reorder.
- **NOT this task**: kanban (task-15), calendar (drag-reschedule is CUT for v1).

Drag visuals match UX §38: `elevation-drag` ghost, 1.02 scale (suppressed under reduced motion), source dims to 0.4 with a faint placeholder pulse, drop-target highlight (`accent-subtle` bg + dashed accent outline 2px), depth-cap rejection (overdue solid 2px outline + no-drop cursor), auto-scroll near viewport edges, Esc cancel, live announcements via `lib/a11y.ts` per microcopy §26.

## Context files

- `docs/ux/interaction-patterns.md` — §1 drag-and-drop rules (what's draggable, ghost behavior, drop targets, depth-cap viz, auto-scroll, Esc cancel, live announcements), §7 animation token reuse (drag pickup / release / drop-target highlight motion tokens), §8.6 drag-on-touch (deferred unless cheap — for task-10, focus desktop drag; mobile drag is opportunistic).
- `docs/ux/component-inventory.md#38-drag-ghost--drop-target-highlight` — visual details.
- `docs/ux/microcopy.md#26-drag-interactions-copy` — SR announcement strings.
- `docs/ux/accessibility.md` — §4.7 keyboard drag (v1: rely on the Move-to picker `⌘⇧M` for keyboard re-parenting; `dnd-kit`'s `KeyboardSensor` enables Space-to-pick-up + arrow-to-move + Enter-to-drop but UX commits to the picker as the canonical keyboard path — we ship the KeyboardSensor as well for completeness so keyboard users have both).
- `docs/engineering/2026-05-18-frontend-architecture.md#10-drag-and-drop-architecture` — dnd-kit setup + sensors + the depth-cap mirror integration.
- `docs/engineering/2026-05-18-code-architecture.md#4-7-dnd-kit-wiring-example` — TreeView drag example.

## Downstream dependencies

- **Task 14 / 15**: NOT this task. Calendar drag is CUT (binding resolution); kanban drag is task-15.
- **Task 17** (SSE) — drag commits trigger mutations that publish SSE events; multi-tab consistency works after task-17.
- **Task 18** — keyboard shortcuts in the hotkey registry don't conflict with dnd-kit's keyboard sensor (which only listens when an element is focused as a draggable).

## Steps

1. **`DndContext` provider** — wrap each draggable surface in its own `DndContext` per `frontend-architecture.md` §10.1. Sensors: `PointerSensor` with `activationConstraint: { delay: 100, tolerance: 5 }` + `KeyboardSensor` with a coordinate-getter per surface shape.
2. **Sidebar drag** — `apps/web/src/components/sidebar/dnd.tsx` wraps the projects+folders section in a `DndContext`.
   - **Project rows** become `useSortable` items keyed by project id.
   - **Folder headers** become `useDroppable` containers (with `acceptType: 'project'`).
   - Drop scenarios:
     - Project onto Folder header → PATCH project `folder_id: <folder.id>` + appropriate sort_order. Auto-expand folder after 300ms drag-hover.
     - Project onto a position in the top-level project list (between folders, or below) → PATCH `folder_id: null` + sort_order.
     - Folder reorder among folders → PATCH folder `sort_order`.
   - Snackbar: "Project moved to <Folder>. Undo." / "Project moved out of <Folder>. Undo." / "Folder reordered." (per microcopy §7).
   - Live announcements per microcopy §26.
3. **Task list row reorder** — Today / Inbox / per-project flat / per-tag use `useSortable` per row. On drop, PATCH `sort_order` to a new value (use the sparse-integer scheme: between two adjacent siblings whose sort_orders are A and B, the new value is `(A + B) / 2` rounded). If A and B differ by less than 2, re-number the whole list with 1024-step spacing.
4. **Next 7 Days cross-day-group drag** — each day group is a `useDroppable` (with the day's date as the drop id). Dragging a row from one group to another triggers PATCH `due_date: <newDate>`. Snackbar "Task rescheduled to <Day, Mon DD>." (per microcopy §7).
5. **Tree re-parent** — TreeView (task-09) wraps in `DndContext`. Each TreeRow is `useDraggable` and (for Epics/Features) `useDroppable`. The project root is a `useDroppable` too for placing items at top level. On `onDragOver` with a candidate target:
   - Call `canMoveClient({ source, newParent: targetItemOrNull, items: cache })`.
   - If `ok: true`: show the standard drop-target highlight (`accent-subtle` bg + dashed `accent` outline).
   - If `ok: false`: show the rejection visual (overdue solid 2px outline + `no-drop` cursor). Live announce: "Cannot drop on <target name>: would exceed nesting depth." (`polite`).
   - Auto-expand a collapsed Epic / Feature on 300ms dragover.
   - On drop with `ok: true`: call `useMoveItem({ id: source.id, new_parent_id: target.id })`. Snackbar "Task moved to <new parent name>. Undo.".
   - On drop with `ok: false`: do nothing; render the snackbar "Can't move there: would exceed nesting depth." (assertive). The animation reverts (no scale animation needed — the drop simply doesn't commit).
6. **Subtask reorder** (inside Task modal) — subtask-row list is a `useSortable` set. On drop, PATCH the parent item with the new `subtasks` array order. Modal-local; no snackbar.
7. **Drag visuals** — `apps/web/src/components/drag-visuals/`:
   - A single `<DragOverlay>` portal per `DndContext`. Renders the source's content (with `data-state="dragging"` so its styles apply: scale 1.02 + `elevation-drag` shadow + opacity 0.95).
   - The source row itself dims to opacity 0.4 + a faint pulsing placeholder rectangle (`accent-subtle` bg, `motion-medium` cycle) via the source's `data-state="drag-source-placeholder"`.
   - Drop-target highlight: rendered via the target's `data-state="drop-target"` CSS class (already in TaskListRow / TreeRow styles per task-06 and task-09).
   - **Reduced motion**: under `prefers-reduced-motion: reduce`, the 1.02 scale is suppressed (CSS rule `@media (prefers-reduced-motion: reduce) { [data-state="dragging"] { transform: none } }`), the placeholder pulse is disabled (`animation: none`), drop-target highlight is instant.
8. **Auto-scroll** — `apps/web/src/lib/drag-auto-scroll.ts`:
   - Detects when the pointer is within 40px of a scroll container's edge during drag; scrolls the container in that direction at velocity proportional to proximity (40-30px → slow, 30-15px → medium, 15-0px → fast). Implementation: a `useEffect` on the `DndContext` root that subscribes to dnd-kit's drag-move event and dispatches `scrollBy` on the relevant container.
   - Applied to: sidebar (vertical), main view (vertical). (Kanban horizontal scroll is task-15.)
9. **Esc cancel** — dnd-kit fires `onDragCancel` when Esc is pressed during drag. Wire the live announcement "Drag cancelled." (`polite`).
10. **Live announcements** — `apps/web/src/lib/a11y.ts`'s `announce` helper, called from each `DndContext`'s callbacks:
    - `onDragStart`: "Dragging '<Title>'. Drop on a project, folder, or feature." (`polite`).
    - `onDragOver` valid target (throttled to one announce per target): "Drop on <target name>.".
    - `onDragOver` invalid target (depth-cap): "Cannot drop on <target name>: would exceed nesting depth.".
    - `onDragEnd` success: "Dropped onto <target name>.".
    - `onDragEnd` reject (drop on invalid target): handled by snackbar (assertive); no separate announce.
    - `onDragCancel`: "Drag cancelled.".
11. **Tests** — `apps/web/src/__tests__/`:
    - `dnd/tree-reparent.test.tsx`: render TreeView, simulate drag of a Task from Feature A onto Feature B (dnd-kit's test utilities); assert PATCH /api/items/:id/move with `new_parent_id: <B.id>`.
    - `dnd/tree-depth-cap-reject.test.tsx`: attempt to drop a Feature (with a Task child) onto another Feature; assert the source's `data-state="depth-cap-reject"` is set during drag-over, and the drop does not commit a mutation; assert the assertive snackbar.
    - `dnd/sidebar-project-into-folder.test.tsx`: drag Project A onto Folder F; assert PATCH project { folder_id: F.id }.
    - `dnd/sidebar-project-out-of-folder.test.tsx`: drag Project A out of Folder F to the top-level area; assert PATCH project { folder_id: null }.
    - `dnd/next-7-cross-day.test.tsx`: drag a row from Wed group to Fri group; assert PATCH due_date.
    - `dnd/list-reorder.test.tsx`: drag a row up two positions; assert PATCH sort_order.
    - `dnd/subtask-reorder.test.tsx`: in the Task modal, drag a subtask down; assert PATCH parent item with reordered subtasks array.
    - `dnd/auto-scroll.test.ts`: unit test the `drag-auto-scroll` lib — given a pointer position 20px from the viewport top during drag, assert `scrollBy` is called with a negative velocity.
    - `dnd/keyboard-sensor.test.tsx`: focus a tree row, press Space → enters drag mode; arrow keys move highlight to a sibling/parent; Enter commits or Esc cancels.
12. **a11y SR walkthrough** — manually verify with macOS VoiceOver: drag a row → SR announces "Dragging '<Title>'."; hovering valid target → "Drop on <name>."; hovering invalid → "Cannot drop on <name>: would exceed nesting depth."; release → "Dropped onto <name>." OR the assertive snackbar "Can't move there: would exceed nesting depth.".

## Acceptance criteria

- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — every dnd test passes.
- [ ] Manual: drag a project into a folder in the sidebar; the folder header highlights; release → project animates into the folder; PATCH fires; snackbar.
- [ ] Manual: drag a task from one Feature to another in the tree; depth-cap valid → drop succeeds; depth-cap invalid → red outline + no-drop cursor + assertive snackbar on attempt.
- [ ] Manual: in Next 7 Days, drag a task from Wednesday's group to Friday's group → due_date changes; the row appears in Friday's group on next render.
- [ ] Manual: subtask list in the Task modal — drag-handle visible on hover; drag to reorder; release commits.
- [ ] Manual under reduced motion: no 1.02 scale; no placeholder pulse; drop-target highlight is instant.
- [ ] Esc during drag cancels and announces "Drag cancelled.".
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/web/src/components/drag-visuals/` (+ test) — the DragOverlay component + shared CSS classes for `data-state="dragging"` / `"drag-source-placeholder"`.
  - `apps/web/src/lib/drag-auto-scroll.ts` (+ test).
  - DnD test files as listed in step 11.
- Modified:
  - `apps/web/src/components/sidebar/` — add `DndContext` + per-row `useSortable`.
  - `apps/web/src/views/today-view/`, `tomorrow-view/`, `next-7-view/`, `inbox-view/`, `all-view/` — wrap list in `DndContext`; per-row `useSortable`.
  - `apps/web/src/views/project-view/tree-view.tsx`, `flat-list-view.tsx` — `DndContext` + dnd wiring.
  - `apps/web/src/views/task-modal/` — subtask list `DndContext`.
  - `apps/web/src/components/task-list-row/`, `tree-row/` — add `data-state="dragging"` / `"drop-target"` CSS rules + suppress 1.02 scale under `prefers-reduced-motion: reduce`.
