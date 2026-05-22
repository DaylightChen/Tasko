# Task 12 — Bulk + Trash + Undo + multi-select

## Goal

Build the trash + bulk + undo backbone:
1. **Server**: implement soft-delete cascade with `trashed_with` semantics (move file from `items/` to `trash/`; cascade descendants; `trashed_with` points at the parent's id), `POST /api/items/:id/restore` (cascade restore), `DELETE /api/items/:id?permanent=true` (cascade hard-delete from trash), `POST /api/trash/empty`. Implement project-delete cascade (trash all items in the project, then delete the project file). Implement the four `/api/bulk/*` endpoints (move-overdue, move-to-project, delete, complete — the complete one reuses `completeWithMaybeRecurrence` from task-11). Replace task-03's 501 stubs.
2. **Frontend**: Trash view, real `useTrashItem` / `useRestoreItem` / `usePermanentDeleteItem` / `useEmptyTrash` / `useBulkMoveOverdue` / `useBulkMoveToProject` / `useBulkDelete` / `useBulkComplete` hooks. Multi-select store + the bulk actions toolbar that slides in when 2+ rows are selected. Wire confirmation prompts per `microcopy.md` §6. Wire `⌘Z` to `undoStore.pop()` globally (task-18 may also register, harmless). Project deletion path uses the confirmation "Delete project '<name>'?" → cascade trash.

## Context files

- `docs/engineering/2026-05-18-data-model.md#3-4-soft-delete-semantics--cascade--restore-` — exact cascade + restore + trashed_with rules.
- `docs/engineering/2026-05-18-api.md#2-5--delete--api-items--id----soft-delete--move-to-trash-`, §2.6 restore, §2.7 permanent delete, §3 trash, §4.5 project delete (cascade), §7 bulk endpoints. Full request/response shapes.
- `docs/ux/screens.md` — Trash view (with "Empty Trash" button top-right, restore/delete-forever per row, subline "<N> items in Trash...").
- `docs/ux/flows.md` — §3 weekly review (bulk move-to via multi-select), §7 overdue clearing (bulk + per-item), §10 completion + Trash (full flow: complete → undo → soft-delete → restore → empty). §11 parent completion blocking (Feature/Epic mark-complete uses bulk-complete with descendant list).
- `docs/ux/microcopy.md` — §6 confirmation prompts (Permanent delete, Empty Trash, Move all overdue, Soft-delete, Soft-delete parent with children, Delete project, Delete folder); §7 snackbar variants (every undo case); §16 Trash view copy.
- `docs/ux/interaction-patterns.md` — §3 selection model (multi-select toolbar: "N selected · Move to… · Delete · Mark complete · Cancel"), §11 confirmation policy (4+ items confirm prompt; 1-4 items the snackbar Undo is enough), §12 undo policy (per action), §13 optimistic edge cases (cascade).
- `docs/engineering/2026-05-18-architecture.md#11-engineering-risks-for-v1` (#4 soft-delete cascade semantics).
- `docs/engineering/2026-05-18-feature-mapping.md#5-completed-and-trash`, §6.5 (Feature/Epic mark-complete via bulk).
- `docs/engineering/2026-05-18-open-questions.md#0-binding-resolutions-user-2026-05-18` — #4.7: Project Restore from Trash deferred to v1.1. **v1 project deletion is irreversible** (items recoverable individually but reparent to Inbox).

## Downstream dependencies

- **Task 14 / 15** (calendar / kanban) trigger trash via the same `useTrashItem` hook.
- **Task 16** (Completed view) — un-check completed items from Completed view uses the same `usePatchItem`. Restore from trash via `useRestoreItem`.
- **Task 17** (SSE) — all the new mutations publish SSE events (broker.publish already wired in task-03 stubs; the real route arrives in task-17).
- **Task 18** registers `⌘Z` globally via the hotkey registry.

## Steps

1. **Server: cascade soft-delete** — `apps/server/src/routes/items.ts` (replace the 501 stub):
   - `DELETE /api/items/:id` (without `?permanent=true`):
     ```ts
     return await indexer.withWriteLock(async (index, ops) => {
       const source = index.items.get(id);
       if (!source) { ... 404 ITEM_NOT_FOUND ... }
       // Enumerate non-trashed descendants:
       const descendants = descendantsOf(id, index.items).filter(i => i.trashed_at === null);
       const trashedAt = new Date().toISOString();
       const cascade: Item[] = [source, ...descendants].map(i => ({
         ...i,
         trashed_at: trashedAt,
         trashed_with: i.id === source.id ? null : source.id,  // root has trashed_with=null; descendants point at root.id
         updated_at: trashedAt,
       }));
       // Move each file to trash/:
       for (const item of cascade) await ops.moveItemToTrash(item);
       app.broker.publish({ type: 'item.trashed', payload: { id: source.id, item: cascade[0] }, tabId });
       return reply.send({ trashed: cascade });
     });
     ```
   - `WriteOps.moveItemToTrash(item)` (already declared in task-02) — atomically rename `items/<id>.json` → `trash/<id>.json`, then update both `index.items` (remove) and `index.trash` (add). Update adjacency caches.
2. **Server: cascade restore** — `POST /api/items/:id/restore`:
   ```ts
   const source = index.trash.get(id);
   if (!source) { 404 ITEM_NOT_FOUND }
   // Find descendants whose trashed_with === source.id
   const descendants = [...index.trash.values()].filter(t => t.trashed_with === source.id);
   const restored: Item[] = [source, ...descendants].map(i => ({ ...i, trashed_at: null, trashed_with: null, updated_at: now() }));
   for (const item of restored) {
     // Special handling: if a restored item's parent_id no longer exists in active items (e.g., the user permanently deleted an intermediate parent), reparent to project root:
     if (item.parent_id !== null && !index.items.has(item.parent_id) && !restored.find(r => r.id === item.parent_id)) {
       item.parent_id = null;
       // Note: snackbar in this case per `data-model.md` §3.4: "Restored item reparented to project root because its parent no longer exists."
     }
     await ops.moveItemFromTrash(item);
   }
   app.broker.publish({ type: 'item.restored', payload: { id: source.id, item: restored[0] }, tabId });
   return reply.send({ restored });
   ```
   `WriteOps.moveItemFromTrash(item)` renames `trash/<id>.json` → `items/<id>.json`, updates index maps + adjacency.
3. **Server: cascade permanent delete** — `DELETE /api/items/:id?permanent=true`:
   - Must be in trash (else 400 VALIDATION "Item must be in Trash before permanent deletion.").
   - Enumerate `trash` items where `trashed_with === id` (cascade-trashed descendants) AND the item itself.
   - Unlink each file. Update index.
   - Publish `item.permanently_deleted` for each removed id.
   - Return 204.
4. **Server: `POST /api/trash/empty`** — enumerate every item in `trash`. Unlink each file. Empty `index.trash` + clear all `trashed_with` references (they're already only in trash). Publish `trash.emptied` with `deleted_count`. Return `{ deleted_count }`.
5. **Server: project-delete cascade** — `DELETE /api/projects/:id`:
   - Reject Inbox → 409 INBOX_IMMUTABLE.
   - Enumerate all active items in the project (active + completed) → soft-delete cascade each, with `trashed_with: <project.id>` (the project id is reused as the cascade key per `api.md` §4.5).
   - Delete the project file.
   - Publish `project.deleted` + `item.trashed` per cascaded item.
   - Return `{ deleted_project_id, trashed_items: count }`.
6. **Server: bulk endpoints** — `apps/server/src/routes/bulk.ts`:
   - `POST /api/bulk/move-overdue-to-today` — enumerate active items where `due_date < todayLocal()`, set `due_date = todayLocal()` (preserve start_date offset? `data-model.md` doesn't specify; reading `flows.md` §7 "Their due dates will be set to today" suggests just due_date moves — but multi-day spans should preserve their start-to-due delta. **Decision**: for multi-day items (start_date < due_date), shift both by the same delta so the span maintains length AND the due_date becomes today. For single-day, just set due_date = today. Document.) Write each. Publish `item.changed` for each. Return `{ moved_ids, moved_count, new_due_date }`.
   - `POST /api/bulk/move-to-project` — for each id: re-parent (validate depth-cap via `canMove`; reject the entire batch with 409 DEPTH_CAP + per-item details if any single one fails). If a `new_parent_id` is provided, validate it's in `new_project_id` and depth-cap-ok for each. Update `project_id` cascade for each item (descendants follow). Return `{ moved_count, items }`.
   - `POST /api/bulk/delete` — for each id: cascade soft-delete (as in step 1). Return `{ trashed_count, items }`.
   - `POST /api/bulk/complete` — for each id: call the `completeWithMaybeRecurrence` helper from task-11. Collect `{ completed: [], new_instances: [], items: [] }`. Return per `api.md` §7.4.
   - Register the routes via `registerBulkRoutes(app)` in `server.ts`.
7. **Server tests** — `apps/server/test/integration/`:
   - `trash-cascade-soft-delete.spec.ts`: build Epic→Feature→Tasks; DELETE the Epic; assert all 4 (or 5+) items are in trash; descendants have `trashed_with: Epic.id`; root has `trashed_with: null`.
   - `trash-cascade-restore.spec.ts`: restore the Epic; assert all are restored; new tab: only items with `trashed_with: Epic.id` were restored; items that had been independently trashed before (their `trashed_with: null`) STAY in trash.
   - `trash-orphan-parent-on-restore.spec.ts`: build Epic→Feature→Task. Trash the Feature first (cascading the Task with `trashed_with: Feature.id`). Then PERMANENTLY delete the Feature from trash. Restore the Task individually — its `parent_id` no longer points to a valid item; assert it reparents to project root (parent_id: null).
   - `trash-permanent-delete-cascade.spec.ts`: trash Epic with descendants; permanent-delete the Epic; assert all cascaded descendants are gone.
   - `trash-empty.spec.ts`: trash 5 items; POST /api/trash/empty; assert 0 items in trash, files removed.
   - `project-delete-cascade.spec.ts`: project with 5 items + 2 epics with sub-items; DELETE the project; assert project file removed AND every item moved to trash with `trashed_with: <project.id>`. Inbox delete → 409.
   - `bulk-move-overdue.spec.ts`: seed 3 overdue items + 2 today items; POST /api/bulk/move-overdue-to-today; assert the 3 overdue items now have due_date = today; the 2 today items are unchanged.
   - `bulk-move-overdue-multiday.spec.ts`: seed a multi-day overdue (start=May 1, due=May 5, today=May 18); POST bulk; assert the new due_date = May 18 AND start_date = May 14 (delta preserved).
   - `bulk-move-to-project.spec.ts`: select 3 items from Project A, move to Project B; assert all 3's `project_id == B` (plus cascading descendants).
   - `bulk-move-to-project-depth-cap-reject.spec.ts`: include an item whose descendant chain would exceed cap under the new parent; assert 409 DEPTH_CAP with details listing which item failed; assert NONE of the items moved (transactional).
   - `bulk-delete.spec.ts`: select 5 items; assert all 5 + their descendants in trash.
   - `bulk-complete.spec.ts`: select 5 items, 2 of which are recurring; assert all 5 done; assert 2 new instances created.
8. **Frontend: hooks** — `apps/web/src/api/trash.ts` + `bulk.ts` + updates to `items.ts`:
   - `useTrashList()` — `GET /api/trash`.
   - `useTrashItem(id)` mutation — DELETE /api/items/:id (soft). Optimistic: remove from cache (lists) + add to trash list. Undo entry: call `useRestoreItem`.
   - `useRestoreItem(id)` mutation — POST restore. Optimistic: remove from trash list + put back in active lists. No undo (per UX §12: the user is in Trash deliberately).
   - `usePermanentDeleteItem(id)` mutation — DELETE ?permanent=true. Optimistic: remove from trash list. No undo (irreversible).
   - `useEmptyTrash()` mutation — POST /api/trash/empty. Optimistic: clear trash list. No undo.
   - `useBulkMoveOverdue()` — POST /api/bulk/move-overdue-to-today. Snackbar "N items moved to today. Undo." (Undo reverses by PATCH each item back to its prior date — store priors in the optimistic onMutate).
   - `useBulkMoveToProject(item_ids, new_project_id, new_parent_id)` — POST. Snackbar "N tasks moved to <Project>. Undo." Undo: per-item PATCH back to prior project.
   - `useBulkDelete(item_ids)` — POST. Snackbar "N items moved to Trash. Undo." Undo: per-item restore.
   - `useBulkComplete(item_ids)` — POST. Snackbar "N tasks completed.". (Undo for bulk complete: complex because recurring items generated new instances. Per microcopy §7 the bulk-complete snackbar has no Undo button by default — but the global `⌘Z` should reverse the most recent action. **Decision**: bulk complete pushes one undo entry; on apply, sequentially PATCH each item back to its prior status + delete each generated new instance. For 5+ items this might be slow but is acceptable on localhost.)
   - All hooks use `useOptimisticMutation` from task-08.
9. **Frontend: multi-select store** — `apps/web/src/store/multi-select.ts` per `frontend-architecture.md` §4.1. State: `Set<ItemId>`, `scope: 'list' | 'tree' | 'kanban-column' | 'trash'` (so we know what's selected and where), `add`, `toggle`, `remove`, `clear`. Auto-clear on route change + on Esc.
10. **Frontend: bulk-actions toolbar** — `apps/web/src/views/_shared/BulkActionsToolbar.tsx`:
    - When `multiSelect.set.size >= 2`, slide in a sticky toolbar at the top of the view (above quick-add) with the layout from `interaction-patterns.md` §3.2: `"<N> selected"` count + "Move to…" + "Delete" + "Mark complete" + "Cancel".
    - "Move to…" → opens the Move-to picker (task-09).
    - "Delete" → if N < 5: directly call `useBulkDelete(ids)` + snackbar with Undo. If N ≥ 5: open ConfirmationPrompt "Move N items to Trash?" (microcopy §6.2 adapted for bulk) before deleting.
    - "Mark complete" → call `useBulkComplete(ids)` (after the parent-completion blocking check: if any selected item has incomplete subtasks, open the aggregate prompt "Complete all selected items and their descendants?").
    - "Cancel" → `multiSelect.clear()`.
11. **Frontend: multi-select selection model** — in each list/tree view (Today / Inbox / All / per-project flat / per-tag / Trash):
    - Click row → single select (clear set + add this id).
    - Shift+click → range-select from prior anchor to this row (contiguous).
    - ⌘/Ctrl+click → toggle this id.
    - `⌘A` → select all visible rows.
    - Esc → clear.
    - Mobile: long-press 300ms enters multi-select mode (the row gets a leading checkbox and so do the others; tap toggles).
12. **Frontend: Trash view** — `apps/web/src/views/trash-view/index.tsx`:
    - `useTrashList()` data. Sort dropdown options: "Recently trashed" (default) / "Title (A–Z)".
    - Subline: `<N> items in Trash. Restored items return to their previous state.` (microcopy §16). Replace count with `0` triggers the empty state.
    - "Empty Trash" Destructive button top-right (microcopy §16). Click → ConfirmationPrompt (microcopy §6.5).
    - Each row: a variant of TaskListRow (no checkbox — use the row's left affordance area for the item-type icon instead). Right-side: Restore (Lucide `ArrowDownLeftFromSquare`) + Delete-forever (Lucide `X`) — both 28×28 IconButtons.
    - Restore → `useRestoreItem.mutate(id)` + snackbar "Task restored." (no undo).
    - Delete-forever → ConfirmationPrompt "Permanently delete?" (microcopy §6.4) → `usePermanentDeleteItem.mutate(id)`.
    - Empty state: "Trash is empty." + "Deleted items land here. Restore or permanently delete from here." (microcopy §16).
13. **Frontend: replace task-08 stubs** — the `useDeleteItem`, `useBulkMoveOverdue` stubs in task-08 are now real. Today view's "Move all overdue to today" calls the real `useBulkMoveOverdue`. Confirmation prompt opens beforehand (microcopy §6.6). Snackbar with Undo.
14. **Frontend: project-delete flow** — the right-click "Delete project" menu (task-04) and the project's ⋯ menu now opens ConfirmationPrompt (microcopy §6.9: "Delete project '<name>'? <N> active items will be moved to Trash."). Confirm → `useDeleteProject.mutate(id)` → server cascades. **Per binding resolution §4.7, no restore — document the irreversibility in the confirmation body**: append "This cannot be undone in v1." to the body for projects (override the default body). After delete, navigate to `/today`.
15. **Frontend: `⌘Z` global undo wired** — in `app/main.tsx` (or a dedicated `app/global-undo.tsx`), register a `keydown` listener: if `e.metaKey && e.key === 'z' && !e.shiftKey` AND no input is focused → call `undoStore.pop()`. Task-18 will replace with the hotkey registry; for task-12, the ad-hoc listener is enough.
16. **Frontend tests** — `apps/web/src/views/__tests__/`:
    - `trash-view.test.tsx`: render with 3 trashed items + 2 cascade descendants; rows show; restore one item → snackbar; click delete-forever → confirmation → permanent delete; Empty Trash button visible; click → confirmation.
    - `trash-restore-cascade.test.tsx`: restore an Epic that has cascaded descendants → all return to their active state.
    - `bulk-toolbar.test.tsx`: select 3 rows in Today via shift-click; toolbar slides in with "3 selected"; click Delete → bulk-delete fires (no confirmation for N=3); click Move to… → picker opens; click Mark complete → fires.
    - `bulk-delete-confirm.test.tsx`: select 5 rows; click Delete → confirmation appears first.
    - `move-all-overdue.test.tsx`: 3 overdue → click Move all overdue → confirmation → confirm → 3 items move; undo within 5s → 3 items restore.
    - `delete-project-cascade.test.tsx`: right-click project with 5 items → Delete project → confirmation body "5 active items will be moved to Trash. This cannot be undone in v1." → confirm → cascade → all 5 items in trash; project gone from sidebar.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/server typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/server test` — every spec in step 7 passes.
- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — every test in step 16 passes.
- [ ] Manual: from Today, delete a task (⋯ menu Delete) → confirmation → soft-delete → snackbar "Task moved to Trash. Undo." → click Undo within 5s → row returns to Today.
- [ ] Manual: navigate to Trash → see deleted items + "<N> items in Trash" subline → click Restore on one → it goes back to Today. Click Delete-forever on another → confirmation → gone.
- [ ] Manual: in Today, shift-click 3 rows → bulk toolbar shows; click "Delete" → 3 rows trashed; snackbar "3 items moved to Trash. Undo." → click Undo → all 3 restore.
- [ ] Manual: trash an Epic with 5 descendants → restore the Epic → all 6 items reappear in their original places.
- [ ] Manual: project delete: right-click a user project with 4 items → Delete → confirmation says "4 active items will be moved to Trash. This cannot be undone in v1." → confirm → project gone from sidebar, items in Trash.
- [ ] Manual: `⌘Z` after completing a task → un-completes (within 5s).
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/server/src/routes/bulk.ts`, `apps/server/src/routes/trash.ts`
  - `apps/server/test/integration/trash-*.spec.ts`, `project-delete-cascade.spec.ts`, `bulk-*.spec.ts`
  - `apps/web/src/api/trash.ts`, `apps/web/src/api/bulk.ts`
  - `apps/web/src/store/multi-select.ts`
  - `apps/web/src/views/_shared/BulkActionsToolbar.tsx`
  - `apps/web/src/views/trash-view/index.tsx`, `trash-row.tsx`, `__tests__/*.test.tsx`
  - `apps/web/src/app/global-undo.tsx`
- Modified:
  - `apps/server/src/routes/items.ts` — implement real DELETE (soft), POST /restore, DELETE ?permanent=true (replace 501 stubs). Move `WriteOps.moveItemToTrash/moveItemFromTrash` to actively maintain index.
  - `apps/server/src/routes/projects.ts` — implement DELETE cascade (replace 501 stub).
  - `apps/server/src/store/indexer.ts` — add adjacency-cache maintenance for trash transitions.
  - `apps/server/src/server.ts` — `registerBulkRoutes(app)`, `registerTrashRoutes(app)`.
  - `apps/web/src/api/items.ts` — real `useTrashItem`, `useRestoreItem`, `usePermanentDeleteItem`, `useBulkMoveOverdue`, `useBulkMoveToProject`, `useBulkDelete`, `useBulkComplete`.
  - `apps/web/src/api/projects.ts` — real `useDeleteProject`.
  - `apps/web/src/views/today-view/`, `inbox-view/`, `all-view/`, `next-7-view/`, `tomorrow-view/`, `project-view/tree-view.tsx`, `flat-list-view.tsx` — wire multi-select via shift/⌘-click + bulk toolbar.
  - `apps/web/src/components/sidebar/` — project ⋯ Delete + right-click menu → real `useDeleteProject` + confirmation.
  - `apps/web/src/main.tsx` — import `<GlobalUndo />` (or wire the keylistener in `app.tsx`).
  - `apps/web/src/routes/trash.tsx` — render `TrashView`.
