---
title: Tasko — Feature → Module Mapping
date: 2026-05-18
phase: engineering
scope: project
status: draft
---

# Tasko — Feature → Module Mapping

The connective tissue between the product/UX surfaces and the engineering modules. The planner uses this to chunk implementation tasks; the implementer uses this as a "where does this live?" reference.

Each row maps **a product feature or UX component** to:
- The engineering module(s) it lives in (server / frontend / shared).
- The primary API endpoints touched.
- Key tests to cover.
- v1 risks / open questions specific to that feature.

References use:
- "PS §X" → product spec section.
- "UX §X" → UX doc section (component-inventory.md unless noted otherwise).
- "DM §X" → data-model.md.
- "API §X" → api.md.

---

## 1. Foundational primitives (build first)

### 1.1 Token CSS layer

| | |
|---|---|
| Where | `apps/web/src/styles/tokens.css`, `base.css`, `theme.css` |
| Spec source | `design-language.md` §1-7 |
| Tests | Visual regression in Playwright (light + dark snapshots of a few canonical views). Unit test: programmatic check that every named token from `design-language.md` exists as a CSS custom property. |
| Notes | Auto-generated from a source file at lint time. Hand-edits are allowed and committed; the next regenerate compares. |

### 1.2 Lucide icon set

| | |
|---|---|
| Where | Import `lucide-react` directly per component. |
| Spec source | `design-language.md` §7 |
| Tests | None component-specific; lint rule enforces "import { X } from 'lucide-react'" (tree-shake-friendly). |
| Notes | The ~35 icons used must be enumerated in `lib/icons.ts` (a typed re-export) so they're discoverable. |

### 1.3 Hotkey registry

| | |
|---|---|
| Where | `apps/web/src/store/hotkey-registry.ts`, `apps/web/src/hooks/useHotkey.ts`, `apps/web/src/lib/keyboard.ts` |
| Spec source | UX `interaction-patterns.md` §4 |
| Tests | Unit: mode push/pop, suppression while input focused, Mod→Meta/Ctrl resolution. E2E: each global single-key fires in the correct mode. |
| Risks | Conflict between `⌘K` (palette) and `⌘K` (markdown link helper) — resolved by mode. |

### 1.4 SSE client + EventSource

| | |
|---|---|
| Where | `apps/web/src/api/events.ts`, `apps/web/src/store/sse.ts`, `apps/server/src/middleware/sse-broker.ts`, `apps/server/src/routes/events.ts` |
| Spec source | `architecture.md` §2.7, `api.md` §9 |
| Tests | Integration: write in tab A, observe invalidation in tab B. Reconnect after disconnect. |
| Risks | Browsers cap EventSource connections per origin to 6. Two tabs is fine; many tabs not. (Not a v1 concern.) |

### 1.5 Theme switcher

| | |
|---|---|
| Where | `apps/web/src/store/theme.ts`, `apps/web/src/views/settings-view/` |
| Spec source | `design-language.md` §2, UX `flows.md` §14 |
| Endpoints | GET/PATCH `/api/config` |
| Tests | E2E: change theme in settings → DOM `data-theme` flips → page repaints. System theme: change OS preference → app follows (this is harder to E2E; mock matchMedia in unit tests). |

### 1.6 Skip link, landmarks, h1 hierarchy

| | |
|---|---|
| Where | `apps/web/src/app.tsx`, per view's root component |
| Spec source | UX `accessibility.md` §3.12, §3.13 |
| Tests | E2E axe-core scan on every view; manual SR walkthrough recorded as part of release. |

---

## 2. Sidebar + global nav

### 2.1 Sidebar layout

| | |
|---|---|
| UI components | UX §18 Sidebar nav, §19 Folder header, §20 Project row, §41 Collapsed sidebar |
| Frontend | `apps/web/src/views/__root.tsx` (sidebar lives in the root layout), `apps/web/src/components/sidebar-nav-item/`, `apps/web/src/components/folder-header/`, `apps/web/src/components/project-row/` |
| State | Sidebar collapsed state in `themeStore` (or its own Zustand slice) |
| Endpoints | GET `/api/projects`, GET `/api/folders`, GET `/api/tags`, GET `/api/items?view=today` (for count badges) |
| Tests | Unit: each component's variants. E2E: collapse/expand, drag a project into a folder, right-click context menu. |
| Risks | Counting overdue + today + tomorrow for badges requires server-side queries running per route; we may need to add a `/api/counts` endpoint for efficiency if multiple round-trips hurt boot perf. Initial assumption: each badge is its own query, TanStack Query dedupes. |

### 2.2 Sidebar count badges

| | |
|---|---|
| Spec source | UX §18.4 |
| Logic | Today count = items where due today (active); Today overdue = items where due_date < today (active). Inbox count = items in Inbox (active). Tag count = items tagged AND active. |
| Implementation | Each badge computed client-side from the TanStack Query cache; we don't expose a server "count" endpoint in v1. |
| Tests | Unit: count math (active vs trashed vs completed handled). |

### 2.3 Sidebar drag interactions

| | |
|---|---|
| UI | Drag a project onto a folder header; drag a project out; drag-and-drop reorder |
| Frontend | `views/__root.tsx` wraps the sidebar in a `DndContext`. `components/folder-header/` and `components/project-row/` use `useDroppable` / `useSortable`. |
| Endpoints | PATCH `/api/projects/:id` with `folder_id` and/or `sort_order`. PATCH `/api/folders/:id` with `sort_order`. |
| Tests | E2E: drag flows. Right-click "Move to folder…" alternative. |
| Risks | Auto-expand after 300ms hover on collapsed folder (UX §1.3 of interaction-patterns). Implement via a timer reset on dragOver. |

### 2.4 New project / new folder

| | |
|---|---|
| UI | UX `screens.md` "New project modal", "Folder creation flow" |
| Frontend | `views/__root.tsx` opens a Modal (project creation) or an inline edit row (folder creation) |
| Endpoints | POST `/api/projects`, POST `/api/folders` |
| Tests | E2E: create a hierarchical project, verify it lands in Tree view; create a folder, drag projects in. |

---

## 3. Today view

### 3.1 Today list

| | |
|---|---|
| Spec source | PS §5.1 Views, §6.2; UX `screens.md` Today view; locked decision §9.4 #4 (strictly date-driven) |
| UI | TaskListRow §23, OverdueStrip (composed) |
| Frontend | `apps/web/src/views/today-view/index.tsx`, `today-view/overdue-strip.tsx` |
| Endpoints | GET `/api/items?view=today` |
| Tests | E2E: items with various dates render in correct sections (overdue, today, multi-day). Status-driven items with future dates DON'T appear (locked rule). |
| Risks | The "multi-day item in Today" rendering must include start-day / mid-span / end-day chip variants per UX §32. |

### 3.2 Overdue strip + Move all overdue

| | |
|---|---|
| UI | UX `screens.md`, UX `flows.md` §7 |
| Frontend | `views/today-view/overdue-strip.tsx` |
| Endpoints | POST `/api/bulk/move-overdue-to-today` |
| Tests | E2E: 12 overdue items → "Move all" → confirmation → all move to today, animate up. Undo within 5s reverses. |
| Risks | Animation: "fly to today" uses `motion-slow` per UX §6.3. Implementation: when items move from overdue to today, layout via FLIP technique (snapshot positions before, animate to new). |

### 3.3 Inline edit on a row

| | |
|---|---|
| Spec source | UX `interaction-patterns.md` §16 |
| UI | TaskListRow §23 with inline-edit affordances (title click, date chip click, priority dot click) |
| Frontend | `components/task-list-row/inline-title-edit.tsx`, popovers from `components/date-picker/`, `components/priority-menu/`. |
| Endpoints | PATCH `/api/items/:id` |
| Tests | E2E: click title → edit → Enter saves; Esc cancels. Click date chip → popover → pick new date → row updates. |
| Risks | When the user is typing in inline title edit, single-key shortcuts must be suppressed (`hotkeyStore.mode = 'input'`). |

### 3.4 Checkbox completion + animation + undo

| | |
|---|---|
| Spec source | UX locked decision (200ms strike → 300ms fade → 5s undo); `interaction-patterns.md` §12 |
| UI | Checkbox §11, Snackbar §16 |
| Frontend | `components/checkbox/`, `views/today-view/` mutation orchestration |
| Endpoints | PATCH `/api/items/:id` (status: 'done') |
| Tests | E2E: check → row strike-through → fade-collapse → snackbar 5s → click Undo → row returns. |
| Risks | Recurring case: snackbar text is "Task completed. Next: <date>." (different from non-recurring). |

---

## 4. Tomorrow, Next 7 Days, Inbox, All

### 4.1 Tomorrow view

| | |
|---|---|
| Frontend | `views/tomorrow-view/` |
| Endpoints | GET `/api/items?view=tomorrow` |
| Tests | E2E: items with due_date = tomorrow appear; today/overdue don't appear here; multi-day items whose span includes tomorrow appear. |

### 4.2 Next 7 Days view

| | |
|---|---|
| Frontend | `views/next-7-view/`, with day-group headers |
| Endpoints | GET `/api/items?view=next7` |
| Tests | E2E: items grouped by day; empty days show "─ empty" subline. Multi-day spans appear in each day they cover. |
| Risks | Drag-reschedule across day groups: UX `flows.md` §3 step 20 mentions dragging between day groups in Next 7 Days. Implementation: each day group is a `useDroppable`; dropping changes due_date. |

### 4.3 Inbox view

| | |
|---|---|
| Frontend | `views/inbox-view/` |
| Endpoints | GET `/api/items?view=inbox` |
| Tests | E2E: items with project_id=INBOX and parent_id=null appear; items in Inbox subprojects don't. |
| Notes | Inbox is the smart-list view; the sidebar item links here. (The Inbox project itself can also be navigated to via `/project/<inbox-id>` but the canonical route is `/inbox`.) |

### 4.4 All view

| | |
|---|---|
| Frontend | `views/all-view/`, TaskListRow with project breadcrumb |
| Endpoints | GET `/api/items?view=all` |
| Tests | E2E: every active item appears; project breadcrumb shows folder + project. |
| Risks | Perf: virtualize when item count > 200. |

---

## 5. Completed and Trash

### 5.1 Completed view

| | |
|---|---|
| Frontend | `views/completed-view/` with time-grouping headers |
| Endpoints | GET `/api/items?view=completed&sort=completed_desc` |
| Tests | E2E: completed items grouped by Today / Yesterday / Earlier this week / Earlier; un-check returns item to active state with same fields. |
| Risks | Time-group calculation is client-side (group by date relative to today). |

### 5.2 Trash view

| | |
|---|---|
| Frontend | `views/trash-view/` |
| Endpoints | GET `/api/trash`, POST `/api/items/:id/restore`, DELETE `/api/items/:id?permanent=true`, POST `/api/trash/empty` |
| Tests | E2E: trash flows from `flows.md` §10. Restore-with-children (cascade restore) works. Permanent delete confirmation works. |
| Risks | Cascade restore semantics (DM §3.4) are subtle — tests must verify `trashed_with` behavior. |

---

## 6. Per-project views

### 6.1 Tree view (hierarchical projects)

| | |
|---|---|
| Spec source | PS §6.5; UX `screens.md` per-project hierarchical |
| UI | TreeRow §21 |
| Frontend | `views/project-view/tree-view.tsx`, `components/tree-row/` |
| Endpoints | GET `/api/items?view=project&project_id=<id>`, POST `/api/items` (add Epic/Feature/Task), POST `/api/items/:id/move` |
| Tests | E2E: build full Epic → Feature → Task → Subtask. Roll-up progress displays. Depth-cap rejects further nesting. Re-parent via drag and via picker. |
| Risks | Roll-up progress is a derived value — compute from current children's state. Cache invalidation must propagate to the ancestor when a child changes. |

### 6.2 Flat list view (non-hierarchical projects)

| | |
|---|---|
| UI | TaskListRow §23 |
| Frontend | `views/project-view/flat-list-view.tsx` |
| Endpoints | Same as Tree but with `include_completed` for the "Show N completed" toggle |
| Tests | E2E: add task, show/hide completed toggle, drag reorder. |

### 6.3 Kanban view

| | |
|---|---|
| Spec source | PS §6.8; locked §9.4 #1 (only Tasks); UX `screens.md` Kanban |
| UI | KanbanColumn §24, KanbanCard §25 |
| Frontend | `views/project-view/kanban-view.tsx`, `components/kanban-column/`, `components/kanban-card/` |
| Endpoints | GET `/api/items?view=project&project_id=<id>` (then filter to `type=task` client-side; could also push to server as `?type=task`), PATCH `/api/items/:id` (status change), POST `/api/items` (add card with status pre-set) |
| Tests | E2E: drag card across columns → status mutates; drag to Done → completion sequence (snackbar, recurrence). Keyboard arrows move card. |
| Risks | Done column with > 50 items shows "Showing recent 50" affordance per UX. Implementation: server slices when `?status=done&limit=50`; the "Show all" link fetches without limit. |

### 6.4 View toggle (List ↔ Kanban / Tree ↔ Kanban)

| | |
|---|---|
| UI | UX §31 |
| Frontend | `components/view-toggle/` — segmented control |
| State | URL: `/project/$id` (default for hierarchical = Tree, flat = List) vs `/project/$id/kanban`. Last-chosen view per project remembered in Zustand (or in URL — we pick URL for simplicity, so refresh restores). |
| Tests | E2E: switch view, refresh, view persists. |

### 6.5 "+ Add Epic / Feature / Task" (in tree)

| | |
|---|---|
| Spec source | UX `flows.md` §1, §5 |
| UI | Inline editable rows + the Task modal for Tasks |
| Frontend | `views/project-view/tree-view.tsx` |
| Endpoints | POST `/api/items` with appropriate type + parent |
| Tests | E2E: "+ Add Task" inside a Feature → modal opens with project + parent pre-filled (the destination context exception per §9.4 #8). |
| Risks | Depth-cap check happens on POST. If user tries to add a Feature where it would exceed cap, the affordance is hidden (UX § 21.5). |

---

## 7. Per-tag view

| | |
|---|---|
| Frontend | `views/tag-view/` |
| Endpoints | GET `/api/items?view=tag&tag_id=<id>` |
| Tests | E2E: items with the tag appear; quick-add on per-tag view does NOT pre-fill the tag (UX `screens.md` per-tag). |

---

## 8. Calendar

### 8.1 Month view

| | |
|---|---|
| Spec source | PS §6.9, locked §9.4 #2 |
| UI | UX §26 day cell, §27 event chip |
| Frontend | `views/calendar-view/month.tsx` |
| Endpoints | GET `/api/items?view=all&sort=due_asc` (we filter client-side to dates in view; server returns active items) |
| Tests | E2E: events render on correct days; multi-day spans render as bars; "+N more" overflow opens day-detail popover; click event opens modal (drag reschedule is CUT from v1); filter chips work including the new "Show completed" chip. |
| Risks | **High.** Complex feature in v1: 7-col grid, multi-day spans across rows, overflow popovers, filter chips (incl. "Show completed"), keyboard nav, week-start setting. Reschedule via click→modal only — drag is CUT per `open-questions.md` §0. Time budget: ~1 week for one engineer. |

### 8.2 Week view

| | |
|---|---|
| UI | UX §28 week-view event block |
| Frontend | `views/calendar-view/week.tsx` |
| Endpoints | Same as month |
| Tests | E2E: timed events render at correct hours; all-day + multi-day in all-day strip; vertical drag changes time. |
| Risks | Less critical than month view; user can still get value from just month if week is delayed. Mitigation: ship month view first, week view second. If we run hot, week is a candidate to cut to v1.1. |

### 8.3 Day-detail popover

| | |
|---|---|
| UI | UX §34 |
| Frontend | `views/calendar-view/day-detail.tsx` (popover anchored to cell) |
| Endpoints | Reuses cached items |
| Tests | E2E: "+N more" opens, full task list rows interactive inside. |

### 8.4 Calendar filter chips (incl. "Show completed")

| | |
|---|---|
| UI | UX §29 filter chip |
| Frontend | `components/filter-chip/`, state in URL search params |
| Endpoints | Filter applied client-side over cached items; "Show completed" toggle requires fetching completed items (separate query) and merging into the view |
| Tests | E2E: pick project filter → only that project's events render; clear chip → all return; toggle "Show completed" → completed items appear with done styling. |

### 8.5 Calendar reschedule — click → modal (v1)

| | |
|---|---|
| Frontend | `views/calendar-view/` — clicking any event opens the task modal where due_date / start_date can be edited |
| Endpoints | PATCH `/api/items/:id` (due_date and/or start_date and due_time) |
| Tests | E2E: click event → modal opens with current dates; change due date → event moves to new cell in calendar after save. |
| Note | **Drag-to-reschedule is CUT from v1** per `open-questions.md` §0 (decided 2026-05-18). It's a planned v1.1 feature. v1 reschedule is exclusively via click→modal. |

---

## 9. Settings

| | |
|---|---|
| Spec source | PS §5.1 Settings; locked §9.4 #8 (no default project) |
| UI | UX `screens.md` Settings; minimalist form |
| Frontend | `views/settings-view/` |
| Endpoints | GET / PATCH `/api/config` |
| Tests | E2E: change theme (light/dark/system), change week-start. Both apply immediately. |
| Notes | About section shows static "Tasko v1.0 · Local files in `<data-dir>`" — the "Synced to cloud" UX copy is REPLACED here (locked, no sync). |

---

## 10. Task modal

### 10.1 Modal shell

| | |
|---|---|
| Spec source | UX §14 Modal; `screens.md` Task modal |
| UI | Modal §14 |
| Frontend | `components/modal/`, `views/task-modal/` (wraps modal with our specific fields) |
| Tests | Unit: focus trap, Esc closes, unsaved-changes guard. E2E: open from quick-add → save; open from row → edit → save. |

### 10.2 Modal fields

Each field is its own subcomponent in `views/task-modal/`:

- Title (UX §3 Text input)
- Due date (UX §5 Date picker + UX §7 Date+time combined when adding time)
- Start date (optional, UX §5)
- Project picker (Dropdown §8 with typeahead)
- Tag input (UX §9 multi-select chip)
- Priority radios (UX §10 Priority menu, inline in modal)
- Notes (UX §4 Textarea markdown)
- Recurrence (UX §11.7 recurrence picker)
- Subtasks (UX §22 Subtask row)

| Field | Endpoint touched | Tests |
|---|---|---|
| Title | PATCH /items | length 1-500, required on submit |
| Due date | PATCH /items | required, date validity |
| Start date | PATCH /items | must be ≤ due_date |
| Project | PATCH /items | required, opens cascade if project changes |
| Tags | POST /tags (create-or-get) + PATCH /items | autocomplete by prefix |
| Priority | PATCH /items | 4-way enum |
| Notes | PATCH /items | markdown render in preview mode |
| Recurrence | PATCH /items | rule type → fields shown |
| Subtasks | POST/PATCH/DELETE /items/:id/subtasks/:sid or whole-array PATCH | inline add, reorder, delete |

### 10.3 Recurrence picker

| | |
|---|---|
| Spec source | PS §4.6, UX `microcopy.md` §3.3 |
| Frontend | `views/task-modal/recurrence-picker.tsx` |
| Tests | Unit: render correctness per frequency; switching frequency clears irrelevant fields. E2E: create recurring → complete → next instance has correct date. |

---

## 11. Quick-add input

| | |
|---|---|
| Spec source | PS §6.1; locked §9.4 #8 |
| UI | Per-view input at top |
| Frontend | `components/quick-add-input/`, integrated into each view's chrome |
| Endpoints | None directly — opens modal which then POSTs |
| Tests | E2E: per spec, on each view, project pre-fill follows the rules in `frontend-architecture.md` §14. |

---

## 12. Command palette (⌘K)

| | |
|---|---|
| Spec source | PS via UX `interaction-patterns.md` §10; `microcopy.md` §12 |
| UI | UX §33 |
| Frontend | `components/command-palette/`, `store/commandPaletteStore.ts` |
| Tests | E2E: open with `⌘K`, fuzzy search, select navigates / runs command. Dynamic commands (Go to project X) work. `⌘F` shows the toast. |
| Risks | The command registry must include every navigation, every "Add X", every settings change. Maintaining it as features grow is a small ongoing tax. |

---

## 13. Confirmation prompts

| | |
|---|---|
| Spec source | UX §37, microcopy §6 |
| UI | Confirmation §37 |
| Frontend | `components/confirmation-prompt/`, singleton like Snackbar |
| Tests | E2E: parent-completion blocking, permanent delete, empty trash, move all overdue, discard unsaved, delete folder, delete project. |
| Notes | Destructive variants have Cancel focused by default. |

---

## 14. Drag-and-drop infrastructure

| | |
|---|---|
| Spec source | UX `interaction-patterns.md` §1, §38 |
| Frontend | `components/drag-visuals/`, integration in views |
| Tests | E2E per draggable surface (see §6 above for tree, §8 for calendar). |

---

## 15. Snackbar

| | |
|---|---|
| Spec source | UX §16; microcopy §7 |
| UI | Snackbar §16 |
| Frontend | `components/snackbar/`, `store/snackbarStore.ts` |
| Tests | Unit: variants, ARIA, auto-dismiss timer. E2E: undo flow, queue depth, hover pauses dismiss. |

---

## 16. Tag autocomplete

| | |
|---|---|
| Frontend | `components/tag-input/` + autocomplete dropdown |
| Endpoints | GET `/api/tags/autocomplete?q=<prefix>`, POST `/api/tags` (create on commit if no match) |
| Tests | E2E: type "urg" → see "urgent" suggestion; type new name → "Create '...'" row; case-insensitive matching. |

---

## 17. Sync / event invalidation

Per locked decision, the "sync" surface for v1 is the SSE channel for multi-tab consistency. No backend cloud sync exists. The §42 component is NOT built (see §22 of `frontend-architecture.md`).

| | |
|---|---|
| Where | SSE wiring per §1.4 above |
| Tests | E2E: two-tab consistency test (write in tab A, observe tab B). |

---

## 18. About / footer

| | |
|---|---|
| UI | Bottom of sidebar: "Tasko v1.0 · Local files in `<data-dir>`" |
| Frontend | `views/__root.tsx` |
| Endpoints | GET `/api/health` (for the data-dir display) |
| Tests | Unit: shows the resolved data-dir. |

---

## 19. Error states

### 19.1 Server not running

If the frontend fails to reach `/api/health` at boot, render a full-page error:

> Tasko service is not running.
> Run `pnpm start` and refresh.

| | |
|---|---|
| Frontend | `app.tsx` checks `useQuery(['health'])`; if it errors, render the error component. |
| Tests | E2E: kill server during a test, observe error state on next nav. |

### 19.2 Local storage unavailable

This case doesn't apply to v1 (we don't use IndexedDB or localStorage as load-bearing storage; localStorage for theme preference is best-effort).

### 19.3 Sync failure

Not applicable — no sync.

### 19.4 Write failure (disk full, EACCES)

Server returns 500 with code FS_WRITE. Frontend shows "Couldn't save. Try again." snackbar; optimistic rollback applies.

---

## 20. Migration / data corruption recovery

| | |
|---|---|
| Server boot indexer | Reads every JSON file; skips files that fail to parse, logs them. The server still starts even if 10 files are bad. |
| User-facing visibility | The bad files don't appear in the UI. The server logs to stdout. |
| Recovery path (v1) | User edits the broken file manually OR git-checkouts an older version. No auto-recovery. |
| Tests | Unit: indexer tolerates corrupted file (skips, logs). |

---

## 21. v1 risk grid (priority-ordered)

| # | Risk | Module | Mitigation |
|---|---|---|---|
| 1 | Calendar month + week views, multi-day spans, "Show completed" filter | `views/calendar-view/` | Drag-to-reschedule is CUT from v1. Reschedule via click→modal only. Ship month view first (incl. multi-day spans + "Show completed" chip), then week view. |
| 2 | Recurrence next-instance algorithm correctness | `apps/server/src/domain/recurrence.ts` | 80-test unit suite covers all frequencies × anchor × edge cases. Documented in DM §6.4. |
| 3 | Depth-cap consistency across all paths | `domain/depth-cap.ts` + client mirror | Single source of truth; every mutation calls it; E2E test attempts each invalid path. |
| 4 | Soft-delete cascade + restore semantics | `apps/server/src/store/`, DM §3.4 | `trashed_with` field encodes the cascade group; tests verify all restore variants. |
| 5 | Atomic writes (tmp + rename) across OS quirks | `apps/server/src/store/fs-store.ts` | Document local-disk requirement; document the recommendation against network mounts. |
| 6 | Multi-tab consistency via SSE | `apps/server/src/middleware/sse-broker.ts`, `apps/web/src/api/events.ts` | Acceptable to fall back to `refetchOnWindowFocus` if SSE proves flaky. |
| 7 | Kanban + Calendar + Tree all in v1 | Three large views | Sequence: Tree first (it shares the most code with flat list), then Kanban (its own beast), then Calendar (largest). |
| 8 | Index rebuild perf at 10k items | `apps/server/src/store/indexer.ts` | `Promise.all` + chunked reads (`p-limit` 10). Boot < 1.5s budget. |
| 9 | Inline editing without disrupting other shortcuts | `apps/web/src/store/hotkey-registry.ts` | Mode stack push/pop on input focus/blur. |
| 10 | Markdown render XSS | `lib/markdown.ts` | DOMPurify sanitizes; custom renderer for checklists doesn't accept HTML. |

---

## 22. Task chunking guidance for the planner

The planner should consider these implementation phases (each ~1 week with one engineer; adjust as needed):

1. **Foundation** — repo + workspaces + types package + tokens CSS + base layout + theme switching + health check. **No features yet.**
2. **CRUD bones** — POST/PATCH/DELETE for Items, Projects, Folders, Tags. In-memory index + atomic writes. Basic Today + Inbox + All views. No drag, no kanban, no calendar.
3. **Hierarchy + tree view** — depth-cap algorithm, Tree view, "+ Add Epic/Feature/Task", move-to picker, drag-and-drop re-parent. Subtasks in task modal.
4. **Recurrence + bulk + trash + undo** — recurrence math + tests, bulk endpoints, trash/restore/empty, snackbar with 5s undo.
5. **Calendar (month) + click-to-modal reschedule + filter chips (incl. "Show completed")** — month view + day cells + event chips + multi-day spans + filter chips. No drag in v1.
6. **Calendar week + kanban view** — week view (still no drag-reschedule) + per-project kanban.
7. **Polish + a11y audit + perf budget enforcement + SSE** — wire SSE, verify a11y end-to-end with axe + manual SR, add virtualization where thresholds hit.
8. **E2E hardening + Biome lint sweep + bundle audit** — release-readiness pass.

Each phase ends with a working demo of the included features. The planner chunks these into 5-8 task briefs each.

---

## 23. Out-of-scope summary (v1)

- Multi-machine sync (manual git push/pull only)
- Mobile QA target (CSS ships, not tested)
- Real-time conflict resolution UX (no auto sync)
- Service Worker / PWA
- Tag management UI (rename, delete, merge)
- Export / Import
- Global search
- Reminders / notifications
- Pomodoro / time tracking
- Sync state sidebar indicator (§42 — DROPPED)
- File watching for external file changes (user refreshes browser after git pull)
- Auto-start (launchd / systemd)
- Multi-step undo

All of these are noted in `open-questions.md` as candidates for v1.1+.
