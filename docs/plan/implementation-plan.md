# Implementation Plan — Tasko v1

> Written in the plan phase by the `planner` agent on 2026-05-18. Lives at `docs/plan/implementation-plan.md` per the project scope's `paths.plan`.

## Goal

Ship Tasko v1 — a single-user, local-first task tracker that runs as a Node.js + Fastify service on `http://127.0.0.1:7373`, serving a React 19 + Vite SPA the user opens in their regular browser. Data lives as one JSON file per entity under `~/Documents/.tasko-data/`, designed for the user to manage as a git repo manually. At the end of this task list, every product-spec §5.1 v1 feature is shipped, every UX deliverable (43 components across 7 UX docs) is implemented to WCAG 2.1 AA, the 8-phase engineering roadmap is consumed, and the full Vitest + Playwright suite is green. The release binary is `pnpm install && pnpm build && pnpm start` — no installer, no auth, no cloud sync.

## Task list

1. **task-01-foundation-vertical-slice** — Monorepo scaffold (pnpm + 3 workspaces), Fastify server with `/api/health`, Vite + React 19 shell that fetches health, Biome + strict TS + tsconfig.base, design tokens CSS shipped as the styling surface for downstream tasks. Proves the full stack end-to-end with one trivial feature.
2. **task-02-types-and-fs-store** — Complete `@tasko/types` zod schemas for Item / Subtask / Project / Folder / Tag / RecurrenceRule / Config / SSE events / ApiError. Server-side fs-store with atomic write, paths, mutex, and bootstrap indexer reading every JSON file on boot. `--init` creates data dir + Inbox sentinel.
3. **task-03-server-crud-routes** — Items CRUD (POST / PATCH / DELETE / GET / list), Projects CRUD, Folders CRUD, Tags CRUD (find-or-create), Subtask sub-routes, Config GET/PATCH, Health, error envelope, CORS. No depth-cap, no recurrence, no trash, no bulk, no SSE wiring yet (broker stub publishes but no `/api/events` route).
4. **task-04-frontend-shell-router-sidebar** — Provider tree, TanStack Router file-system routes with stubs, root layout + sidebar (smart lists, Projects, Tags, Settings + footer "Tasko v1.0 · Local files in `<dir>`"), Settings view (theme + week-start radios — applies immediately). API client + query keys factory. Skip link + landmarks.
5. **task-05-components-chrome-and-dialogs** — Button, IconButton, TextInput, Modal, Sheet (mobile shell), Snackbar (singleton host + Zustand store), Tooltip, Dropdown, EmptyState, Skeleton, ConfirmationPrompt. Vitest tests per component.
6. **task-06-components-rows-and-pickers** — Checkbox, SubtaskCheckbox, Card, Filter chip, Sort dropdown, View toggle, Multi-day chip, Sidebar nav item, Folder header, Project row, Sync footer, Quick-add input, TaskListRow (full layout including priority dot click→menu stub, date chip click→popover stub, tag chip nav).
7. **task-07-task-modal** — Date picker popover (`react-day-picker` wrapped), Time picker, Date+time combined, Priority menu, Tag input with autocomplete, Project picker (dropdown with typeahead), Recurrence picker, Subtask row. The full Task modal composes them; quick-add → modal flow ends here.
8. **task-08-smart-list-views** — Today (overdue strip + multi-day chips + bulk "Move all overdue"), Tomorrow, Next 7 Days (day groups), Inbox, All (with project breadcrumb). Optimistic mutations + Zustand `undoStore` (single-step, 5s). Sidebar count badges wire to TanStack Query.
9. **task-09-hierarchy-and-tree-view** — `domain/depth-cap.ts` server + `lib/depth-cap-client.ts` mirror. Tree view, rollup progress, `+ Add Epic/Feature/Task` inline editing → Task modal (destination context exception pre-fills project + parent), move-to picker (`⌘⇧M`), flat list view, view toggle (Tree↔Kanban / List↔Kanban) — Kanban itself is a stub route until task 15.
10. **task-10-drag-and-drop** — `@dnd-kit/core` + `@dnd-kit/sortable` setup. Sidebar drag (project↔folder), list reorder, tree re-parent (with depth-cap visualization), Next-7-Days cross-day-group drag (reschedule), subtask reorder inside modal. Live announcements via `lib/a11y.ts`. NOT calendar drag (CUT for v1), NOT kanban drag yet.
11. **task-11-recurrence** — `domain/recurrence.ts` pure function + `domain/time.ts` helpers + 80-case unit test suite. Atomic complete-recurring server op (within mutex). Frontend handles `{completed, next}` PATCH response, snackbar `Task completed. Next: <date>.`, undo reverses both. Un-check from Completed view leaves next instance alone.
12. **task-12-bulk-trash-undo** — Soft-delete cascade (`trashed_with`), `POST /api/items/:id/restore`, `DELETE /api/items/:id?permanent=true`, `POST /api/trash/empty`. Bulk endpoints (move-overdue, move-to-project, delete, complete). Trash view. `⌘Z` global undo wired through `undoStore`. Multi-select model (Zustand).
13. **task-13-markdown-notes** — `lib/markdown.ts` (marked + DOMPurify), edit/preview toggle in the modal's Notes field, textarea keybindings (⌘B/I/K, list continuation, Tab → 2 spaces). Markdown checklists render as display-only.
14. **task-14-calendar-month** — Month view (7-col grid + day cells + event chips + multi-day spans + "+N more"), day-detail popover, filter chips (project / tag / "Show completed"), keyboard nav per a11y contract, week-start setting honored. **Reschedule via click→modal only** — drag CUT.
15. **task-15-calendar-week-and-kanban** — Week view (all-day strip + time grid + 30-min timed blocks). Per-project Kanban (Tasks only; Epics/Features/Subtasks excluded), drag between columns, keyboard arrows, `+` per column (status pre-fill + project destination context).
16. **task-16-tag-completed-views** — Per-tag view (cross-project flat). Completed view (time-grouped: Today / Yesterday / Earlier this week / Last week / Earlier this month / Earlier). Un-check from Completed (per §9.4 #5: only that instance reopens, next recurring instance untouched).
17. **task-17-sse-multitab** — Wire `sse-broker` to every mutation path on the server. `/api/events` SSE route + heartbeat. Frontend `SSEConnector` + cache invalidation on self vs other-tab events. Reconnect refetches stale queries. Multi-tab E2E.
18. **task-18-hotkeys-palette-a11y-shell** — Hotkey registry (mode stack + global key listener), wire all single-key + modifier shortcuts per UX `interaction-patterns.md` §4. Command palette (cmdk) with full command catalog including dynamic "Go to <project>" / "Go to #<tag>". `⌘F` toast. `?` help overlay. Confirm landmarks + skip link + heading hierarchy.
19. **task-19-a11y-perf-audit** — axe-core scan on every view; manual SR walkthrough; verify the 13-item audit checklist in `docs/ux/accessibility.md` §13. Add `@tanstack/react-virtual` at thresholds (list >200, tree >200 visible, kanban >50/col, calendar day-detail >50, completed >200). Reduced-motion media-query override verified.
20. **task-20-e2e-and-release-readiness** — Full Playwright suite (today/overdue, recurring, depth-cap, kanban-drag, calendar reschedule, multi-tab SSE, quick-add validation, undo 5s, calendar multi-day, tree re-parent, settings theme switch). Biome lint sweep. Bundle size audit. README documenting `pnpm install && pnpm build && pnpm start`, port 7373, data dir default `~/Documents/.tasko-data`, all binding resolutions from `open-questions.md` §0. Known-issues.md with the explicit v1 deferrals.

## Dependency rationale

The order is sequential — each task starts from the committed state of the prior task, no parallel branches.

- **Vertical slice first (task 1):** scaffolds the monorepo, the Fastify server, the Vite SPA, and proves the toolchain (TypeScript strict, Biome, Vitest, pnpm workspaces, design tokens CSS). The health endpoint is the entire feature surface — minimal, but the SPA actually fetches it, exercising CORS, the Vite proxy, the typed `apiCall` wrapper at its first form. If the chosen stack breaks down here, we learn early. Every later task imports from `@tasko/types` and uses tokens from this task's CSS.
- **Foundation before features (tasks 2–3):** task 2 establishes the data layer (zod schemas, atomic-write fs-store, indexer with mutex). Task 3 puts a REST API on it. Both must be done before any view can fetch real data. No depth-cap, no recurrence, no trash, no SSE yet — those layer on top once the basic CRUD is solid.
- **Frontend shell before component library (task 4):** the router and theming layer must be in place before components can be rendered in their natural environment. Settings view ships early because theme switching is a cross-cutting concern that every later component must respect.
- **Components before views (tasks 5–6):** building the UX `component-inventory.md` primitives first means task 8's view orchestration is a composition exercise, not "implement components and view together." The split between Part A (chrome / dialogs) and Part B (rows / item primitives) groups related components by render-pattern and test pattern.
- **Modal before list views (task 7):** the Task modal is the single largest UI surface. Building it as an isolated unit (with date / time / tags / priority / recurrence / subtask pickers) means task 8's list views can use it from day one.
- **Risk-ordered:**
  - **Tree + depth-cap (task 9)** lands before drag (task 10) and recurrence (task 11). The `canMove` predicate is the central contract; getting its shape right early means drag wires into it cleanly, and the move-to picker provides keyboard re-parenting without depth-cap leakage.
  - **Recurrence math (task 11)** is risk #2 in the architect's grid. Pure functions with 80 tests, isolated module. We do this after CRUD is real so the atomic complete-recurring op can be tested end-to-end. Doing it before bulk (task 12) means bulk-complete can correctly handle recurring items in the loop.
  - **Bulk + trash + undo (task 12)** depends on recurrence (bulk-complete fans out to per-item next-instance generation) and depth-cap (cascade soft-delete enumerates descendants).
  - **Calendar (tasks 14–15)** is risk #1 in the architect's grid (PS §9.3 #5; multi-day spans across rows, "+N more" overflow, filter chips, week view, "Show completed" chip). Drag-to-reschedule is CUT per `open-questions.md` §0. Splitting calendar across two tasks (month then week+kanban) keeps each session sized correctly.
  - **SSE (task 17)** comes after the views render correctly without it. Per architect's §2.7, `refetchOnWindowFocus: true` is the fallback; SSE is a quality-of-life upgrade. Wiring SSE last means we don't have to reconfigure earlier mutations.
  - **A11y audit (task 19)** is its own task — accessibility is load-bearing (locked decision: WCAG 2.1 AA) and consolidating the axe + manual SR pass into a single review (rather than every prior task) catches gaps that single-component review misses.
- **Integration accumulates:** task 8 (list views) integrates tasks 1–7. Task 11 integrates 1–10. Each task's E2E test (small per-task in tasks 8+, full sweep in task 20) exercises everything below it.
- **Non-obvious orderings:**
  - **Drag (task 10)** before recurrence (11): drag operations sometimes mutate items (date drag changes due_date, parent drag changes parent_id). Building drag first means recurrence's atomic op is built into a code surface that already handles mutations cleanly.
  - **Markdown notes (task 13)** after the modal exists (task 7) but before calendar (14): the modal renders a plain `<textarea>` until task 13 layers `marked` + `DOMPurify` on the Notes field. This avoids blocking task 7 on a library decision.
  - **Hotkeys/palette/a11y shell (task 18)** after all views exist: many hotkeys reference views and commands that don't exist until later (calendar `T`-jump-to-today, kanban arrow-move-column). Wiring them in one consolidated task means the registry is correct in one place rather than retrofitted across 15 tasks.
  - **Virtualization (task 19)** at the perf audit point — `@tanstack/react-virtual` is conditional (kicks in at thresholds), so we don't need it for the v1 happy path of 100-item lists. Adding it as part of the perf audit means we add it where measurement shows we need it.

## Coverage check

Every product-spec §5.1 feature, every UX deliverable (component / screen / flow / microcopy entry / a11y-contract item / interaction pattern), and every engineering-spec endpoint / module / algorithm maps to a task below. The reader should be able to scan this section and see exactly which task implements each upstream requirement.

### Coverage by upstream section

#### Product spec §5.1 — v1 features

| Feature | Task(s) |
|---|---|
| Create / edit / delete tasks with required title + due date | task-03 (server) + task-07 (modal) + task-08 (views wire it) |
| Optional fields: notes, priority, tags, status, start date, due time, recurrence | task-07 (modal fields) + task-11 (recurrence wiring) + task-13 (markdown notes render) |
| Subtasks (one level) | task-07 (subtask row + modal section) + task-03 (subtask sub-routes) |
| Soft delete with Trash view; manual purge | task-12 |
| Parent-completion blocking prompt | task-12 (logic) + task-05 (ConfirmationPrompt) |
| Re-open completed tasks (un-check) | task-08 (in-view) + task-16 (from Completed view; recurring edge case) |
| Projects + optional Folders | task-03 (server) + task-04 (sidebar) |
| Built-in Inbox (cannot be deleted) | task-02 (sentinel) + task-03 (immutability) + task-04 (sidebar) |
| Per-project opt-in to hierarchy | task-04 (project modal toggle) + task-09 (tree behavior) |
| Item type label drives icons + roll-up | task-09 (rollup progress) |
| Parent_id flexible — depth cap | task-09 (depth-cap algorithm + UI) |
| Tags free-form `#name` syntax in tag input | task-07 (tag input component) + task-03 (find-or-create endpoint) |
| Per-tag view in sidebar + tag chips on items + per-tag view | task-04 (sidebar) + task-06 (tag chip render) + task-16 (per-tag view) |
| No tag management UI | (deferral — see Explicit deferrals) |
| Today (default landing) | task-08 |
| Tomorrow | task-08 |
| Next 7 Days | task-08 |
| Inbox | task-08 |
| All | task-08 |
| Completed | task-16 |
| Trash | task-12 |
| Per-project view (Tree / Flat) | task-09 |
| Per-tag view | task-16 |
| Calendar (month + week) — multi-day spans — filter chips | task-14 (month) + task-15 (week) |
| Calendar drag-to-reschedule | CUT (binding resolution `open-questions.md` §0) — see Explicit deferrals |
| Kanban view per-project, Tasks only | task-15 |
| All-day + timed items, local TZ only | task-07 (time picker) + task-11 (time helpers) |
| Multi-day items via start_date + due_date | task-02 (schema) + task-08 (Today rendering) + task-14 (calendar spans) |
| Overdue: surface at top of Today | task-08 |
| One-tap "move all overdue to today" | task-08 (UI) + task-12 (bulk endpoint) |
| Recurring rules + repeat-on-schedule / after-completion | task-07 (picker UI) + task-11 (math + atomic op) |
| Quick capture: + Add input + global shortcut + modal | task-06 (input component) + task-07 (modal) + task-08 (per-view wiring) + task-18 (`N` shortcut) |
| Per-view filter chips | task-06 (filter chip component) + task-08 (apply in views) + task-14 (calendar filters incl. "Show completed") |
| Per-view sort dropdown | task-06 (sort dropdown component) + task-08 (apply in views) |
| Settings: theme, week-start | task-04 (settings view) |
| No default-project setting | task-04 (settings view does not include it) — see binding resolution |
| Local-first storage | task-02 (fs-store) |
| Cloud sync background | DROPPED for v1 (binding resolution `open-questions.md` §0 / decisions.md) — Git is the sync mechanism. Sidebar sync indicator (§42) replaced with footer in task-04. |

#### Product spec §7 — edge cases

| Edge case | Task(s) |
|---|---|
| §7.1 Local DB corruption (skip-bad-file on indexer parse) | task-02 |
| §7.2 Sync conflict | N/A — no sync; last-write-wins per field via SSE invalidation is the implicit model (task-17). Multi-tab safety via SSE. |
| §7.3 Timezone / DST — local-only model | task-11 (time helpers — no TZ math) |
| §7.4 Recurring with start-date offset (delta preservation) | task-11 (test cases include multi-day weekly) |
| §7.5 Completing an overdue recurring task | task-11 (on_schedule vs after_completion test cases) |
| §7.6 Deleting a parent with children (cascade) | task-12 |
| §7.7 Restore-with-children semantics | task-12 (cascade restore using `trashed_with`) |
| §7.8 Calendar 50+ tasks/day | task-14 (+N more overflow) + task-19 (virtualization at >50 in day-detail) |
| §7.9 Project with 500+ tasks | task-19 (virtualization) |
| §7.10 Tag with 200+ tasks | task-19 (virtualization in per-tag view) |
| §7.11 One modal at a time | task-05 (modal component policy) + task-18 (hotkey mode stack) |
| §7.12 Status × overdue interplay | task-08 (Today is date-driven; in-progress future-dated items not surfaced) |
| §7.13 Re-parenting across depth | task-09 (depth-cap rejection) |
| §7.14 Inbox is special (immutable) | task-02 + task-03 + task-04 |
| §7.15 Empty-state surfaces | task-05 (EmptyState component) + every view task wires its variant |
| §7.16 Multi-day item completed mid-span | task-08 (Today removal) + task-14 (calendar bar truncation) |
| §7.17 Recurring task edited mid-cycle (latest title propagates) | task-11 (next-instance copies current title/recurrence) |
| §7.18 Items without due_date cannot exist | task-02 (schema required) + task-07 (form validation) |

#### UX `design-language.md` — tokens

| Section | Task(s) |
|---|---|
| §1 Typography, §2 Colors, §3 Spacing, §4 Radius, §5 Elevation, §6 Motion, §7 Iconography | task-01 (tokens CSS as CSS custom properties) — every later task references via `var(--…)`. Reduced-motion override verified in task-19. |

#### UX `component-inventory.md` — all 43 components

| § | Component | Task(s) |
|---|---|---|
| §1 | Button | task-05 |
| §2 | Icon button | task-05 |
| §3 | Text input | task-05 |
| §4 | Textarea (markdown) | task-13 (full markdown wiring; basic textarea ships in task-05 / task-07) |
| §5 | Date picker popover | task-07 |
| §6 | Time picker | task-07 |
| §7 | Date + time combined | task-07 |
| §8 | Dropdown / select menu | task-05 |
| §9 | Multi-select tag input | task-07 |
| §10 | Priority menu | task-07 |
| §11 | Checkbox | task-06 |
| §12 | Subtask checkbox | task-06 |
| §13 | Card | task-06 |
| §14 | Modal | task-05 |
| §15 | Sheet (mobile) | task-05 (ships, not QA-targeted per §22 in `frontend-architecture.md`) |
| §16 | Snackbar | task-05 |
| §17 | Tooltip | task-05 |
| §18 | Sidebar nav item | task-06 |
| §19 | Folder header | task-06 |
| §20 | Project row | task-06 |
| §21 | Tree row | task-09 |
| §22 | Subtask row | task-07 |
| §23 | Task list row | task-06 |
| §24 | Kanban column header | task-15 |
| §25 | Kanban card | task-15 |
| §26 | Calendar day cell | task-14 |
| §27 | Calendar event chip (month) | task-14 |
| §28 | Calendar week-view event block | task-15 |
| §29 | Filter chip | task-06 |
| §30 | Sort dropdown | task-06 |
| §31 | Tab / icon-toggle group (view switcher) | task-06 (component) + task-09 (project view wiring) |
| §32 | Multi-day chip | task-06 |
| §33 | Command palette modal | task-18 |
| §34 | Day-detail popover | task-14 |
| §35 | Empty state | task-05 |
| §36 | Skeleton loaders | task-05 |
| §37 | Confirmation prompt | task-05 |
| §38 | Drag ghost + drop target highlight | task-10 |
| §39 | Mobile bottom nav | task-04 (ships, not QA-targeted) |
| §40 | Mobile swipe action drawer | task-06 (ships, not QA-targeted) |
| §41 | Sidebar (collapsed state) | task-04 (collapsed variant + `⌘\` in task-18) |
| §42 | Sync state indicator | **DROPPED** — replaced by static footer in task-04 (binding resolution `open-questions.md` §3.1 + decisions.md 2026-05-18 Sync state indicator DROPPED). |

#### UX `screens.md` — every screen

| Screen | Task(s) |
|---|---|
| Global layout (desktop) | task-04 |
| Global layout (mobile) | task-04 (sidebar + topbar + bottom nav ship; mobile not QA-targeted) |
| Today (populated, empty, first-run) | task-08 |
| Today (mobile) | task-04 + task-06 (swipe drawer ships) |
| Tomorrow | task-08 |
| Next 7 Days | task-08 |
| Inbox | task-08 |
| All | task-08 |
| Completed | task-16 |
| Trash | task-12 |
| Per-project (flat) | task-09 |
| Per-project (hierarchical Tree) | task-09 |
| Per-project (Kanban) | task-15 |
| Per-tag | task-16 |
| Calendar (month) | task-14 |
| Calendar (week) | task-15 |
| Day-detail popover | task-14 |
| Settings (theme + week-start + about) | task-04 |
| Task modal (desktop) | task-07 |
| Task modal (mobile sheet) | task-07 (sheet variant ships) |
| New project modal | task-04 |
| Folder creation flow | task-04 |
| Command palette | task-18 |
| Confirmation dialogs (parent completion, permanent delete, empty trash, move all overdue, unsaved changes, delete folder, delete project) | task-05 (component) + task-08/12/14 (each triggers) |
| Empty states (every view) | task-05 (component) + every view task wires its variant |
| Sidebar collapsed state | task-04 + task-18 (`⌘\` shortcut) |
| Keyboard shortcut help overlay | task-18 |

#### UX `flows.md` — every flow

| Flow | Task(s) |
|---|---|
| §1 First-time use | task-08 (first-run empty state) + task-09 (hierarchy project creation) + task-04 (sidebar / new project modal) |
| §2 Daily flow — overdue triage + complete + quick-add | task-08 + task-12 (bulk) |
| §3 Weekly review — Inbox + Next 7 Days planning + bulk move | task-08 + task-12 (bulk multi-select) |
| §4 Multi-day work creation + lifecycle | task-07 (modal start/due dates) + task-08 (Today rendering) + task-14 (calendar bar) |
| §5 Hierarchical project — create + re-parent | task-09 (tree + add affordances + move-to picker) + task-10 (drag re-parent) |
| §6 Recurring task lifecycle | task-11 |
| §7 Overdue clearing — bulk + per-item | task-08 + task-12 |
| §8 Kanban — switch view + drag across columns | task-15 |
| §9 Calendar — switch views + click-to-modal reschedule + multi-day move | task-14 + task-15 — note: drag CUT, reschedule via modal |
| §10 Completion + Trash — complete → undo → soft-delete → restore → empty | task-08 + task-12 + task-16 |
| §11 Parent completion blocking | task-08 (per-item) + task-12 (bulk) + task-05 (ConfirmationPrompt) |
| §12 Folder management — create + drag + right-click | task-04 (modals + right-click) + task-10 (drag) |
| §13 Tag use — create via modal + apply + per-tag view | task-07 (input) + task-16 (view) |
| §14 Settings change — theme + week-start | task-04 |
| §15 Mobile day — swipe + sheet | task-04 (ships, not QA-targeted) |

#### UX `accessibility.md` — every contract item

| § | Item | Task(s) |
|---|---|---|
| §1.1 AA color contrast on every token pair | task-01 (tokens) + task-19 (axe verification on every view) |
| §1.2 44×44 touch targets (mobile) | task-05 (lg variants) + task-06 (row heights) — ships, not QA-targeted in v1 |
| §1.3 Text resize 200% + 320px reflow | task-04 (responsive layout) + task-19 (verify) |
| §1.4 Color independence — every signal has glyph/label/size alt | task-01 (tokens + icons) + task-06 (priority dot sizing) + task-19 (verify) |
| §2 Keyboard navigation contract (global, modifier, context-specific maps) | task-18 (hotkey registry) — wires per-mode |
| §2.4 Tab order | task-04 (DOM order) + task-18 (verify across views) |
| §2.5 Focus indicator (2px accent ring) | task-05 (component-level) — every component honors |
| §2.6 Focus restoration | task-05 (modal) + task-18 (route change focuses `<h1>`) |
| §3 ARIA roles + labels per component | every component task — examples in §3.1-3.12 implemented |
| §3.12 Landmarks (header / nav / main + skip link) | task-04 + task-18 (verify) |
| §3.13 Heading hierarchy (one `<h1>`, `<h2>` sections) | task-04 (root layout) + every view task |
| §3.14 Live regions (`role="status"` / `role="alert"`) | task-05 (Snackbar) + task-08 (announcement helper `lib/a11y.ts`) + task-18 |
| §4 Focus management (modal trap, popover focus, snackbar non-stealing) | task-05 + task-07 |
| §5 Screen-reader announcements for state changes | task-05 (snackbar variants) + every mutation site emits |
| §6 Color contrast full pair table | task-01 (tokens defined to pass) + task-19 (verify) |
| §7 Reduced-motion overrides | task-19 (`@media (prefers-reduced-motion: reduce)` block in `tokens.css`) |
| §8 Form validation (`aria-required`, `aria-invalid`, `aria-describedby`) | task-05 (TextInput) + task-07 (Task modal validation) |
| §9 Skip links | task-04 |
| §10 `<html lang>` | task-04 |
| §11 Date/time accessibility (long-form aria-label) | task-06 (date chip) + task-07 (date picker labels) |
| §12 ARIA edge cases (multi-day chip, subtask progress, rollup, sync, filter chips, tag chips, "+N more") | task-06 + task-09 (rollup) + task-14 (+N more) |
| §13 Audit checklist before launch | task-19 |

#### UX `microcopy.md` — every entry

Microcopy is the contract for every visible string. Each section is implemented at the surface that displays it; engineering must use the exact strings.

| § | Microcopy group | Task(s) |
|---|---|---|
| Voice rules + 3 warm flourishes | task-08 (Today empty regular + first-run) — flourishes appear in the Today empty state |
| §1 Sidebar labels | task-04 |
| §2 Quick-add placeholders (per view) | task-06 (component) + task-08/14/15/16 (per-view wiring) |
| §3 Modal labels (task, project, recurrence) | task-07 + task-04 (project modal) |
| §4 Button labels (every CTA in spec) | task-05 (Button component receives) + per-feature task wires |
| §5 Empty state copy (every view + filtered-down-to-nothing) | task-05 (component) + every view task |
| §6 Confirmation prompts (parent completion / soft-delete / permanent delete / empty trash / move overdue / unsaved changes / delete folder / delete project) | task-05 (component) + task-08/12 |
| §7 Snackbar variants (15+ entries) | task-05 (component) + task-08/11/12/14/16 (each trigger) |
| §8 Tooltip text (every icon control) | task-05 (Tooltip component) + per-component aria-label |
| §9 Sort dropdown | task-06 |
| §10 Filter chips | task-06 + task-14 |
| §11 Settings page | task-04 |
| §12 Command palette commands | task-18 |
| §13 Keyboard shortcut help overlay text | task-18 |
| §14 Inbox-specific copy | task-08 |
| §15 All view copy | task-08 |
| §16 Trash view copy | task-12 |
| §17 Per-tag view copy | task-16 |
| §18 Per-project (flat) copy | task-09 |
| §19 Per-project (hierarchical) copy | task-09 |
| §20 Today view copy | task-08 |
| §21 Next 7 Days copy | task-08 |
| §22 Tomorrow copy | task-08 |
| §23 Completed view copy | task-16 |
| §24 Calendar view copy | task-14 |
| §25 Kanban view copy | task-15 |
| §26 Drag SR announcements | task-10 + task-18 (a11y.ts announce helper) |
| §27 Sync indicator labels | **DROPPED** — see deferrals. Sync-state snackbars also dropped. |
| §28 Errors (form validation + operational) | task-07 (form) + task-05 (snackbar variants) + task-12 (operational rollback) |
| §29 ARIA labels (long-form date/time, task row label patterns) | task-06 + task-07 |
| §30 Localization notes | N/A — English-only in v1; flag for v1.1 |
| §31 Tone audit checklist | task-19 (verify all copy passes the audit) |

#### UX `interaction-patterns.md` — every cross-cutting rule

| § | Pattern | Task(s) |
|---|---|---|
| §1 Drag-and-drop rules (what's draggable, ghost, drop targets, depth-cap viz, Esc cancel, live announce, auto-scroll) | task-10 + task-15 (kanban drag) |
| §2 Hover affordances (which surfaces, timing, touch substitution) | task-06 (row hover affordances) + task-04 (sidebar hover) |
| §3 Selection model (single, multi-select, what's multi-selectable) | task-12 (multi-select store + toolbar) |
| §4 Keyboard shortcuts master table (global, no-input, modifier, modes) | task-18 |
| §5 Modal stacking policy (one at a time, unsaved-changes guard) | task-05 (Modal) + task-07 (Task modal) |
| §6 Loading / error / optimistic conventions (optimistic default, sync state indicator — DROPPED, errors, offline) | task-08 (optimistic + rollback) + task-12 (undo) — sync states dropped |
| §7 Animation token reuse | task-01 (motion tokens) + every component uses |
| §8 Mobile gestures (swipe complete, swipe drawer, long-press, no pull-to-refresh, pinch) | task-06 (ships, not QA-targeted) |
| §9 Empty-state hierarchy (genuine empty vs filtered vs loading + first-run vs returning) | task-05 + task-08 (first-run detection) |
| §10 "No global search" `⌘F` affordance (toast) | task-18 |
| §11 Confirmation policy (when to prompt) | task-05 + task-08 + task-12 |
| §12 Undo policy (snackbar + `⌘Z`, single-step v1) | task-08 (undo store) + task-12 + task-18 (`⌘Z` registered) |
| §13 Optimistic edge cases (recurring, cascade soft-delete, bulk) | task-11 + task-12 |
| §14 Right-click context menus | task-04 (sidebar) + task-06 (rows) + task-09 (tree) + task-12 (trash) + task-14 (calendar) |
| §15 Bottom-edge mobile policy | task-04 (ships, not QA-targeted) |
| §16 Inline-vs-modal editing summary | task-06 (row inline edits) + task-07 (modal) + task-09 (tree inline) |
| §17 Touch + pointer hybrid (PointerEvent) | task-10 (PointerSensor) |
| §18 Sync state visibility | **DROPPED** — replaced with static footer |
| §19 Open questions for engineering | resolved in engineering specs |

#### Engineering specs — endpoints

Every endpoint in `api.md` §12 maps to a task:

| Endpoint | Task(s) |
|---|---|
| GET /api/health | task-01 |
| GET /api/items | task-03 (basic) + task-08 (view filters wired) |
| GET /api/items/:id | task-03 |
| POST /api/items | task-03 (basic) + task-09 (depth-cap) |
| PATCH /api/items/:id | task-03 (basic) + task-09 (parent_id depth-cap) + task-11 (recurring branch) |
| DELETE /api/items/:id (soft) | task-12 |
| POST /api/items/:id/restore | task-12 |
| DELETE /api/items/:id?permanent=true | task-12 |
| POST /api/items/:id/move | task-09 |
| POST /api/items/:id/subtasks | task-03 |
| PATCH /api/items/:id/subtasks/:sid | task-03 |
| DELETE /api/items/:id/subtasks/:sid | task-03 |
| GET /api/trash, /:id | task-12 |
| POST /api/trash/empty | task-12 |
| GET / POST / PATCH / DELETE /api/projects | task-03 + task-12 (delete cascade) |
| GET / POST / PATCH / DELETE /api/folders | task-03 |
| GET / POST /api/tags + autocomplete | task-03 |
| POST /api/bulk/move-overdue-to-today | task-12 |
| POST /api/bulk/move-to-project | task-12 |
| POST /api/bulk/delete | task-12 |
| POST /api/bulk/complete | task-12 (with recurrence fan-out per item via task-11) |
| GET / PATCH /api/config | task-03 |
| GET /api/events (SSE) | task-17 |

#### Engineering specs — modules

| Module | Task(s) |
|---|---|
| `apps/server/src/server.ts`, `bin/tasko-server.ts` | task-01 (skeleton) + task-03 (route mount) + task-17 (SSE mount) |
| `apps/server/src/config/load.ts` | task-02 |
| `apps/server/src/store/fs-store.ts`, `paths.ts`, `mutex.ts`, `indexer.ts` | task-02 |
| `apps/server/src/routes/*` | task-03 (items / projects / folders / tags / config / health) + task-12 (trash / bulk) + task-17 (events) |
| `apps/server/src/domain/depth-cap.ts`, `hierarchy.ts`, `ids.ts` | task-09 (depth-cap + hierarchy) + task-02 (ids) |
| `apps/server/src/domain/recurrence.ts`, `time.ts` | task-11 |
| `apps/server/src/middleware/cors.ts`, `error-envelope.ts`, `sse-broker.ts` | task-01 (CORS) + task-03 (error envelope) + task-17 (broker) |
| `apps/web/src/main.tsx`, `app.tsx` | task-01 (skeleton) + task-04 (provider tree) |
| `apps/web/src/routes/*` | task-04 (file-system routes + stubs) + each view task |
| `apps/web/src/views/*` | every view task |
| `apps/web/src/components/*` | task-05 + task-06 + task-07 (modal sub-components) + task-09 (tree-row) + task-14 (calendar) + task-15 (kanban + week-block) |
| `apps/web/src/store/*` (theme, command-palette, filters, multi-select, undo, hotkey-registry, sse, snackbar) | task-04 (theme, snackbar, command-palette skeleton) + task-08 (undo) + task-12 (multi-select) + task-17 (sse) + task-18 (hotkey-registry, command-palette full) |
| `apps/web/src/api/*` (client, items, projects, folders, tags, trash, bulk, config, events) | task-04 (client + keys) + task-08 (items hooks) + task-09 (move) + task-11 (recurring branch) + task-12 (trash, bulk) + task-17 (events) |
| `apps/web/src/hooks/*` (useHotkey, useFocusedRow, useOptimisticMutation, usePrefersReducedMotion, useMatchMedia) | task-04 (matchMedia for theme) + task-08 (useOptimisticMutation, useFocusedRow) + task-18 (useHotkey) + task-19 (usePrefersReducedMotion) |
| `apps/web/src/lib/*` (date-fmt, markdown, depth-cap-client, keyboard, a11y) | task-06 (date-fmt) + task-09 (depth-cap-client) + task-10 (a11y announcer) + task-13 (markdown) + task-18 (keyboard) |
| `apps/web/src/styles/*` (tokens.css, base.css, theme.css) | task-01 |
| `packages/types/src/*` (every zod schema + branded ids + SSE events + ApiError) | task-02 |

#### Engineering specs — algorithms

| Algorithm | Task |
|---|---|
| Atomic write (tmp + rename) | task-02 |
| Indexer bootstrap (Promise.all + p-limit chunked reads) | task-02 |
| Index adjacency cache maintenance on mutate | task-02 + task-03 |
| `canMove` depth-cap predicate (`levelOf`, `maxDescendantDepth`, cycle check, subtask-attachment rule) | task-09 |
| Soft-delete cascade + `trashed_with` semantics | task-12 |
| Recurrence `nextDueDate` (5 frequencies × 2 anchors × edge cases) | task-11 |
| Multi-day span preservation across recurrence | task-11 |
| Atomic complete-recurring op | task-11 |
| Tag find-or-create with `name_lower` case-insensitive dedup | task-03 |
| Sort + filter resolution for views | task-08 |
| Time-group computation for Completed view | task-16 |
| Calendar cell layout + multi-day span across grid rows | task-14 |
| Week-view time-grid layout + 30-min block positioning | task-15 |
| Rollup progress computation (display-only from children) | task-09 |
| Optimistic update + rollback + undo journal | task-08 + task-11 (recurring undo) + task-12 (cascade undo) |
| SSE event broadcast on every mutation; self vs other-tab | task-17 |
| Hotkey mode stack push/pop on focus events | task-18 |

### Explicit deferrals

Each row below is a deliberate v1 cut, with the binding rationale and the location of the user-visible / engineering record.

| Item | Reason / source | Follow-up |
|---|---|---|
| Calendar drag-to-reschedule | `open-questions.md` §0 / §1.1 binding resolution — CUT from v1; click→modal is the v1 path | v1.1 feature task; `known-issues.md` entry written in task-20 |
| Sync state indicator (UX §42) + sync snackbars (microcopy §27) + "Changes from another device" snackbar | Decisions log 2026-05-18 "Sync state indicator (UX §42) DROPPED in v1"; engineering `frontend-architecture.md` §22 — no sync engine; git is the sync mechanism | v1.1 if real sync is added |
| Multi-machine sync engine | `open-questions.md` §0 / §2.1 binding resolution — "No sync engine ever. Git remains the only sync mechanism" | Git push/pull manual forever; v1.1 may add convenience "Sync now" CLI but no merge logic in app |
| Mobile QA target | `architecture.md` §13.10 — desktop browsers only; mobile CSS ships but is not QA-targeted | v1.1 |
| Tag management UI (rename / delete / merge) | Product spec §4.5 + §5.2 — endpoints reserved but not surfaced; orphan tags persist on disk | v1.1 |
| Global search | Product spec §5.2 — `⌘F` shows toast "Use ⌘K to navigate" instead | v1.1 |
| Export / Import | Product spec §5.2 — no export bundle format | v1.1 |
| Reminders / Notifications | Product spec §5.2 — no service worker, no push, no email | v1.1 |
| Multi-step undo (>1) | `open-questions.md` §0 / §4.4 binding resolution — single-step v1 | v1.1 |
| Project Restore from Trash | `open-questions.md` §0 / §4.7 binding resolution — v1: project deletion is irreversible; items recoverable individually but reparent to Inbox | v1.1 |
| Duplicate task / project | Spec §5.2 + API §2.8 (501) — context-menu entry exists disabled | v1.1 |
| Drag-on-touch | `interaction-patterns.md` §8.6 — move-to picker is canonical re-parent on mobile | v1.1 |
| Auto-start / launchd / systemd | `open-questions.md` §0 / §2.3 binding resolution — user runs `pnpm start` manually | v1.1 |
| File-watching for external (git pull) changes | `architecture.md` §2.7 / decisions.md — user refreshes browser after `git pull` | Never built |
| Calendar week-view drag-to-reschedule + drag-to-retime | Same as calendar drag CUT | v1.1 |
| Mobile pull-to-refresh suppression QA | Mobile not QA-targeted; CSS rule shipped but not verified | v1.1 |
| Default-project setting | UX §9.4 #8 + decisions.md 2026-05-18 — REMOVED entirely; quick-add always opens modal with empty Project | Never built |
| Localization (i18n) | English-only v1; strings live in `microcopy.md` as source | v1.1+ |
| Density toggle (cozy vs comfortable) | UX-phase locked decision — single density per form factor, no user toggle | v1.1 |
| Date / time format settings (12h vs 24h, etc.) | Product spec §5.2 — locale-driven; not user-configurable in v1 | v1.1 |
| Keyboard shortcut remapping | Product spec §5.2 | v1.1 |
| Activity log / per-item history beyond `completed_at` snapshots | Product spec §5.2 | v1.1 |
| File attachments on tasks | Product spec §5.2 | v1.1+ |
| Task duration / time-blocking with explicit duration spans | Product spec §5.2 — week view ships 30-min display blocks for timed items, not user-set duration | v1.1 |
| Sample-data first-run onboarding | UX 10.9 — locked: no sample data; empty start with strong empty-state copy | v1.1 may reconsider |

Each deferral will get a one-line entry in `docs/known-issues.md` created in task-20.

## Open questions

I found one inconsistency between the decisions log and the binding resolution in `open-questions.md` §0 that the planner is honoring per the binding-resolutions rule, but flagging for user awareness:

- **Data directory default path.** The decisions log entry "v1 distribution: source + `pnpm start`" (2026-05-18, engineering phase) records the default as `~/.tasko`. The `open-questions.md` §0 binding resolution (also 2026-05-18) overrides this to `~/Documents/.tasko-data`. The architecture spec `2026-05-18-architecture.md` §3.1 / §7.4 also references `~/Documents/.tasko-data`. **I am honoring the binding resolution** (`~/Documents/.tasko-data`) in every task brief. If the user wants `~/.tasko` instead, please flag before task 2 — it changes the `loadConfig` default and the README. No other inconsistencies surfaced in the upstream specs that I couldn't resolve.

Nothing else blocks execution. The plan is ready for the `implement` phase to start with task-01.
