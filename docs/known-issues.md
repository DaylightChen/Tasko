# Known Issues and v1.1+ Candidates

> Track deferred bugs, workarounds, and architectural debt. Each entry should include a reproduction or symptom, the workaround in place (if any), and the conditions for revisiting.

## Format

```
## [Issue title]

**Discovered:** YYYY-MM-DD ([phase name], Task NN if applicable)
**Status:** open / mitigated / resolved
**Symptom:** [What goes wrong, including reproduction steps]
**Workaround:** [What's in place today, if anything]
**Revisit when:** [Trigger condition for picking this up]
```

---

## v0.1 post-release polish pass (2026-05-23)

The following defects were found and fixed in a single pass after v0.1.0
shipped. They are documented here so future readers understand why specific
patterns exist in the code.

### Click on a task row accidentally triggered drag

**Status:** resolved 2026-05-23
**Symptom:** `apps/web/src/lib/dnd-sensors.ts` configured a unified
`PointerSensor` with `{ delay: 100, tolerance: 5 }`. Any mouse-down held >100ms
with the slightest cursor jitter (≥5px) activated a drag, which both flashed
`data-state="drag-source-placeholder"` on the row and occasionally reordered
tasks the user never intended to move. This affected every task row, tree
row, kanban card, and sidebar entry.
**Fix:** Split into `MouseSensor` with `{ distance: 8 }` (drag only after
intentional movement, so clicks never trigger) and `TouchSensor` with
`{ delay: 250, tolerance: 5 }` (preserves page scrolling). Regression
coverage: `apps/web/src/lib/__tests__/dnd-sensors.test.ts` and
`apps/web/test/e2e/click-vs-drag.spec.ts`.

### CommandPaletteHost rendered outside RouterProvider — navigation no-op

**Status:** resolved 2026-05-23
**Symptom:** `apps/web/src/main.tsx` mounted `<CommandPaletteHost />` as a
**sibling** of `<RouterProvider>`. Its `useNavigate()` hook ran without a
router context, so `navigate({ to: '/today' })` silently no-op'd. The
command palette opened, accepted input, closed on Enter — but no route
change happened. Affected every "Go to …" command (Today, Tomorrow,
Inbox, project pages, settings, etc.).
**Fix:** Moved the host into the route tree's root layout
(`apps/web/src/routes/__root.tsx`) so it renders inside RouterProvider.
Regression coverage: `apps/web/test/e2e/command-palette.spec.ts` now
asserts the URL change.

### Bulk "Move all overdue to today" Undo was a no-op

**Status:** resolved 2026-05-23
**Symptom:** `useBulkMoveOverdue` captured `priorDates` as a `let`
variable inside the hook body. React-query's `onMutate` populated it,
but any re-render between `onMutate` and `onSuccess` re-initialized
`priorDates = []`. By the time `onSuccess` registered the undo, the
captured list was empty, so `Promise.all([])` ran and no PATCH calls
fired. The snackbar Undo button "succeeded" but no dates were restored.
**Fix:** Threaded `priorDates` through react-query's mutation `context`
(same pattern as `useBulkMoveToProject`), so it survives re-renders.
Regression coverage: `apps/web/test/e2e/today-overdue.spec.ts`.

### E2E suite was effectively broken since v1 ship

Several latent bugs prevented the Playwright suite from running:
- `seedItem` / `seedProject` helpers in `apps/web/test/e2e/_helpers/setup.ts`
  were missing required schema fields (`type`, `parent_id`, `start_date`,
  `due_time`, `recurrence`, `folder_id`, `icon`) — every spec using them
  failed on 400 from the API.
- 14 calls to `page.waitForLoadState('networkidle')` across 8 specs never
  settled because the app holds a persistent SSE connection — every spec
  using that wait timed out at 30s. Replaced with a `waitForPageReady`
  helper that uses `domcontentloaded` + a short settle timer.
- The keyboard-help spec used `keyboard.press('Shift+/')`, which in
  headless chromium dispatches `key === '/'` (not `'?'`) because no OS
  keyboard layout is applied. Replaced with a synthetic
  `KeyboardEvent({ key: '?', shiftKey: true })` matching what real
  hardware emits.
- The overlay locator `[role="dialog"]` was a CSS attribute selector,
  which doesn't match `<dialog>`'s implicit role; updated to match
  by aria-label.

### E2E suite could destroy real data — no test-data isolation

**Status:** resolved 2026-05-23 (with apologies — this regression actually
fired in the field during the polish pass before the safeguards landed)
**Symptom:** `apps/web/playwright.config.ts` documented `pnpm dev` as the
prerequisite, which starts the server pointing at the default
`~/Documents/.tasko-data` — the user's REAL data. The e2e helpers'
`cleanupAll` then deletes every item, empties trash, and removes every
non-Inbox project against whatever the server is serving. Running
`pnpm test:e2e` while `pnpm dev` was up wiped real items, projects,
and tags. There is no soft-delete fallback — `trash/empty` permanently
unlinks files.
**Fix:**
- New `pnpm dev:test` script (root `package.json`) sets
  `TASKO_DATA_DIR=$PWD/.tasko-data-test` and runs the server with
  `--init` so the isolated dir is created on first run. Added to
  `.gitignore`.
- New safety guard in `apps/web/test/e2e/_helpers/cleanup.ts`:
  `cleanupAll` first calls `/api/health`, reads `data_dir`, and
  ABORTS with a clear error if the path does not end in
  `/.tasko-data-test`. The Playwright config header now points
  developers at `pnpm dev:test`.
**Net result:** even if a developer forgets the new script and starts
plain `pnpm dev` against their real data, the cleanup helpers refuse
to run; the only way to wipe real data via e2e is now to manually
spawn a server with `TASKO_DATA_DIR` set to a path containing
`/.tasko-data-test`.

### Accessibility (axe) violations across multiple views

**Status:** resolved 2026-05-23 (mix of fixes + documented deferrals)

Fixed:
- Hover-actions chevron in task rows was wrapped in `aria-hidden`
  while still focusable (axe `aria-hidden-focus`). Now uses `inert` +
  `aria-hidden` together so the subtree is fully excluded.
- Sidebar / project-tree drop-zone `<div>`s had `aria-label` without
  a role (axe `aria-prohibited-attr`). Switched to `aria-hidden` —
  they're purely visual drop targets, with no AT semantics needed.
- Kanban card `<div>` carried `aria-selected` without a hosting role
  (axe `aria-allowed-attr`). Removed the attribute — multi-select state
  is conveyed visually via `data-selected`.
- Color contrast: kanban "Today" date chip used `--color-accent`
  (#d97706, ~2.84:1) — bumped to `--color-accent-pressed` (~5.5:1).
  Kanban empty-state used `--color-text-muted` (~3.3:1) — switched to
  `--color-text-subtle` (~6.2:1). Calendar out-of-month day numbers had
  the same problem and got the same fix. Calendar "today" circle was
  white-on-`--color-accent` (~3.16:1) — moved to `--color-accent-pressed`
  for ~8.9:1.
- Calendar week all-day cells had bare `aria-label` (no role); added
  `role="button"` so the attribute is permitted.
- Calendar week time-grid was scrollable but not keyboard-focusable
  (axe `scrollable-region-focusable`). Converted from `<div>` to
  `<section aria-label="Time grid" tabIndex={0}>`.

Deferred to v1.1 (documented via `disableRules` in `a11y-views.spec.ts`):
- **nested-interactive** — dnd-kit's `useSortable.attributes` adds
  `role="button"` directly to the row, nesting the row's child
  controls (checkbox, title button, chevron). Fix requires a wrapper
  refactor so the role lives on a dedicated drag handle.
- **list** — virtualized lists put absolute-positioned children inside
  `<ul>` for `@tanstack/react-virtual`; axe sees non-`<li>` children.
  Fix requires a `role="presentation"` wrapper or a non-list scaffold.

---

## INBOX_PROJECT_ID contains chars excluded from the ULID base32 alphabet

**Discovered:** 2026-05-18 (implement, Task 02)
**Status:** resolved 2026-05-20 (bug-triage pass)
**Symptom (original):** The engineering spec states `INBOX_PROJECT_ID = '00000000000000000000INBOX0'` and claims all chars are in the ULID base32 alphabet, but `I` and `O` are excluded from Crockford base32. The strict `ProjectIdSchema` regex `/^[0-9A-HJKMNP-TV-Z]{26}$/` therefore rejected the constant.
**Server mitigation (Task 02):** The indexer defines `ProjectDiskSchema` and `ItemDiskSchema` with relaxed id fields for disk reads. The strict schema was preserved for user-supplied input (API routes).
**Client surface (discovered 2026-05-20):** The client's `GET /api/projects` response uses the strict `ProjectSchema` (with strict `ProjectIdSchema.id`). The Inbox project is the first element of the list. `z.array(ProjectSchema).parse(...)` therefore threw on the Inbox row, `useProjects()` returned `data: undefined`, and **every project disappeared from the sidebar** — including newly created ones. The empty `useProjects` cache also broke the project picker in the Add task modal. Item lists for Inbox have the same shape (`project_id === INBOX_PROJECT_ID`) and would have failed the same way.
**Resolution:** `ProjectIdSchema` (in `packages/types/src/domain/ids.ts`) now accepts ULID OR the `INBOX_PROJECT_ID` sentinel via `.refine()`. The schema-level fix removes the need for the server's `ProjectDiskSchema` / `ItemDiskSchema` workarounds, though they're left in place as defense in depth. Regression coverage added in `packages/types/src/__tests__/schemas.test.ts` (`ProjectIdSchema accepts the INBOX_PROJECT_ID sentinel`, `ProjectSchema parses an Inbox project`, `ItemSchema parses an item whose project_id is INBOX_PROJECT_ID`).

---

## Calendar drag-to-reschedule is not available in v1

**Discovered:** 2026-05-19 (implement, Task 14)
**Status:** open (by design — v1 scope reduction)
**Symptom:** Users cannot drag a calendar event chip to a different date to reschedule. The only reschedule path is click → Task modal → edit the date field.
**Workaround:** Click the event chip to open the Task modal; use the date picker in the modal to change the due date. Alternatively, right-click the chip and choose "Edit date…" (same modal opens).
**Revisit when:** Post-v1 UX iteration. Wire `@dnd-kit` to `CalendarDayCell` to accept drops, and add `useDraggable` to `CalendarEventChip`. The `data-item-id` and `data-day-position` attributes are already in place for drag source identification. Per binding resolution §1.1 this was explicitly CUT from v1 scope.

---

## Axe E2E suite deferred to task-20 (Playwright infra not present until task-20)

**Discovered:** 2026-05-20 (implement, Task 19)
**Status:** resolved 2026-05-20 (task-20, commit `e9d10b3`)
**Symptom (original):** Task-19 brief listed `apps/web/test/e2e/a11y-views.spec.ts` as a required output (AxeBuilder scan across all 13 routes). However Playwright infrastructure (playwright.config.ts, test fixtures, webServer wiring) did not exist until task-20 set it up in its step 1.
**Resolution:** Task-20 added Playwright + `@axe-core/playwright` to web devDeps, scaffolded `apps/web/playwright.config.ts`, and shipped `a11y-views.spec.ts` covering 11 of the 13 routes (2 dynamic-URL routes excluded — see "Remaining deferred E2E specs" below).

---

## Row "More actions" (⋯) menu deferred to v1.1 — button removed in flat lists

**Discovered:** 2026-05-20 (bug-triage pass)
**Status:** mitigated — button removed; menu scoped for v1.1
**Symptom:** Clicking the ⋯ button on a task row in any flat-list view (Today, Tomorrow, Next 7 Days, Inbox, All, flat project list, Trash, Completed, Tag view) did nothing. The button was rendered with the proper `aria-label="More actions"` and called `onMenuOpen?.()`, but no consumer of `TaskListRow` ever wired that callback — so it was a guaranteed no-op for users. (Tree view's `TreeRow` *does* wire its `onMenuOpen` to `onContextMenu(item, 0, 0)`, so the menu works there.)
**Mitigation:** The ⋯ button has been removed from `TaskListRow` along with the `onMenuOpen` prop. The Open chevron remains as the sole hover affordance, and right-click context menu / keyboard shortcuts (Delete, T to schedule today, 1–4 priority, O to open) are unchanged.
**Revisit when:** v1.1 — build a real row-context menu that the user can open from the ⋯ hover button. UX spec items per `docs/ux/microcopy.md` (Row "More actions" menu): Open, Set priority, Reschedule, Move to project…, Delete. Wire it into `TaskListRow` (and reuse for `TreeRow`) so the same pattern works in every flat-list consumer.

---

## TreeRow `aria-label` on `role="treeitem"` (deferred to task-18)
- **Where:** `apps/web/src/components/tree-row/index.tsx`
- **What:** TreeRow's `role="treeitem"` div doesn't set `aria-label`. Accessibility spec §3.6 and microcopy §29 define full row labels: `"Epic: <Title>, N of M tasks complete"`, `"Feature: <Title>, N of M tasks complete"`, etc.
- **Status:** resolved 2026-05-20 (task-18 a11y audit pass, commit `367e4f8`).

---

---
## v1 Explicit Deferrals

The following features were explicitly cut from v1 scope. Each entry documents the reason, the user-visible impact, and the path to resolution in v1.1+.

---

### Cut from v1

#### Calendar drag-to-reschedule (duplicate entry for deferral grouping)

**Status:** Deferred to v1.1
**Why:** The drag-with-multi-day-span-preserving-delta is the single most complex UI interaction in the entire product. Per binding resolution §1.1, it was explicitly cut on day one — not a scope-creep cut.
**Reference:** `docs/engineering/2026-05-18-open-questions.md` §0 item 1.1
**Workaround in v1:** Click the event chip → Task modal → change due date in the date picker → Save. The event moves to the new date.

---

#### Multi-step undo

**Status:** Deferred to v1.1
**Why:** Per binding resolution §4.4, single-step undo is sufficient for v1. Building a multi-step undo stack (with reliable rollback of cascade operations) requires redesigning the undo store to store full diffs rather than one mutation.
**Reference:** `docs/engineering/2026-05-18-open-questions.md` §0 item 4.4; `docs/engineering/2026-05-18-feature-mapping.md` §23
**Workaround in v1:** After a mutation, the snackbar shows a single Undo button for 5 seconds. Only the most recent destructive mutation can be undone.

---

#### Project restore from Trash

**Status:** Deferred to v1.1
**Why:** Per binding resolution §4.7, deleting a project trashes its items with `trashed_with: <project-id>`. The project record is deleted, not restorable via the Trash view. Implementing project restore requires a separate soft-delete path for projects (not just items).
**Reference:** `docs/engineering/2026-05-18-open-questions.md` §0 item 4.7
**Workaround in v1:** Before deleting a project, move its items to another project via bulk move. After deletion, the items remain in Trash and can be restored individually (they will be re-parented to Inbox on restore).

---

#### Tag management UI (rename, delete, merge)

**Status:** Deferred to v1.1
**Why:** Tags are created lazily (find-or-create on item save). Explicit tag management (renaming, deleting unused tags, merging duplicates) requires a dedicated Tags settings screen.
**Reference:** `docs/engineering/2026-05-18-feature-mapping.md` §23
**Workaround in v1:** Remove a tag from an item via the task modal's tag input. Tags with no remaining items remain in the autocomplete list but have no visible impact.

---

#### Global search

**Status:** Deferred to v1.1 (out of scope forever for the current architecture)
**Why:** Full-text search across all items requires an index structure (SQLite FTS or a dedicated search index). The flat-file JSON store does not support efficient full-text search. The ⌘F shortcut shows a toast directing the user to use the browser's built-in find.
**Reference:** `docs/engineering/2026-05-18-feature-mapping.md` §23
**Workaround in v1:** Use ⌘F (browser find) on list views. Use the Command palette (⌘K) to navigate to a specific project or tag. The "All" view shows every item in one flat list.

---

#### Reminders / notifications

**Status:** Out of scope (not planned for v1.1)
**Why:** Tasko is a pull-based productivity tool. The product explicitly does not request notification permissions, does not register service workers for push, and does not send email. Per product-spec §3: "The user pulls; the app does not push."
**Reference:** `docs/brainstorm/product-spec.md` §3
**Workaround in v1:** Use the Today view as the morning ritual — open the app to see what is due and what is overdue.

---

#### Pomodoro / time tracking

**Status:** Out of scope forever
**Why:** Explicitly not part of the product vision. Tasko is a task tracker, not a time tracker.
**Reference:** `docs/brainstorm/product-spec.md` §1
**Workaround in v1:** Use a separate tool (e.g., Toggl, Clockify) alongside Tasko.

---

#### Export / Import

**Status:** Deferred to v1.1
**Why:** The data directory is a flat directory of plain JSON files — users can already read and copy the data directly. A dedicated export UI (CSV, JSON envelope) would be a convenience feature.
**Reference:** `docs/engineering/2026-05-18-feature-mapping.md` §23
**Workaround in v1:** The `<data-dir>` (default `~/Documents/.tasko-data/`) is a plain directory of JSON files. Copy them directly for backup or migration.

---

### Mobile (ships, not QA-targeted)

#### Mobile browser QA

**Status:** Ships in v1, not QA-targeted
**Why:** The CSS is responsive and the app renders on mobile browsers, but no dedicated mobile QA was performed. Touch gestures (swipe-to-complete, pull-to-refresh) are not implemented. The mobile experience is "usable" but not polished.
**Reference:** `docs/engineering/2026-05-18-open-questions.md` §0 item 2.2
**Workaround in v1:** Use the desktop browser experience. Mobile users can use the web app but may encounter layout issues on very small screens.

---

#### Mobile gestures (swipe-complete, swipe-drawer, long-press)

**Status:** Deferred to v1.1
**Why:** Per `docs/engineering/2026-05-18-feature-mapping.md` §8 (interaction-patterns §8), mobile gestures were planned as "ships, not QA-targeted." The PointerEvent sensor from `@dnd-kit` is wired, but swipe-to-complete and swipe-to-open-sidebar are not implemented.
**Workaround in v1:** Use tap instead of swipe. The sidebar opens via the sidebar toggle button.

---

#### PWA / Service Worker / Install prompt

**Status:** Deferred to v1.1
**Why:** No service worker, no web manifest, no offline cache. The app requires the local server to be running to function.
**Reference:** `docs/engineering/2026-05-18-feature-mapping.md` §23
**Workaround in v1:** Keep the server running in a terminal window while using the app.

---

### Sync / Multi-machine

#### Multi-machine sync

**Status:** Deferred to v1.1+ (manual git workflow only)
**Why:** Per binding resolution §2.1, Tasko has no built-in cloud sync. Git is the only sync mechanism — the user runs `git pull` / `git push` manually in their terminal.
**Reference:** `docs/engineering/2026-05-18-open-questions.md` §0 item 2.1
**Workaround in v1:** Initialize the data directory as a git repo, push to a private remote (GitHub, GitLab, self-hosted), and pull on other machines before starting the server.

---

#### Sync state sidebar indicator (§42)

**Status:** Dropped (out of scope, not deferred)
**Why:** Per locked decision in `docs/engineering/2026-05-18-feature-mapping.md` §17, the sidebar sync indicator component (UX §42) was DROPPED because there is no background sync. The footer shows "Tasko v1.0 · Local files in `<data-dir>`" instead.
**Workaround in v1:** The footer shows the data directory path. Users know data is local-only.

---

#### Auto-start (launchd / systemd)

**Status:** Deferred to v1.1
**Why:** Per binding resolution §2.3, auto-start configuration (registering Tasko as a system service) is a v1.1 convenience. In v1, the user starts the server manually with `pnpm start`.
**Reference:** `docs/engineering/2026-05-18-open-questions.md` §2.3
**Workaround in v1:** Add `pnpm start` to a shell profile (`.zprofile`, `.bashrc`) or use a process manager like PM2 manually.

---

#### File watching for external changes (post-git-pull)

**Status:** Deferred to v1.1
**Why:** The server uses chokidar to watch the data directory, but the app does not proactively prompt the user to refresh after a `git pull`. SSE invalidation only covers mutations made through the running server instance.
**Reference:** `docs/engineering/2026-05-18-feature-mapping.md` §23
**Workaround in v1:** After `git pull`, refresh the browser (⌘R) to reload all data.

---

### Convenience Features

#### Default project setting

**Status:** Deferred to v1.1
**Why:** Per binding resolution (no-default-project), the Settings view does not include a "default project for quick-add" picker. Quick-add always opens the Task modal where the user picks a project.
**Reference:** `docs/plan/implementation-plan.md` coverage table item "No default-project setting"
**Workaround in v1:** Quick-add from a project view pre-fills the project (destination-context exception). Quick-add from smart list views (Today, Inbox, etc.) opens the modal without a pre-filled project.

---

#### Recurring task drag-reschedule date conflict

**Status:** Known limitation in v1
**Why:** When a recurring task is dragged to a new date (via the list DnD reorder), the due_date changes but the recurrence rule's anchor is not updated. This is a known semantic gap — drag reorder changes sort order, not due_date.
**Workaround in v1:** Use the Task modal to change the due_date for recurring tasks. The recurrence rule recalculates correctly from the new anchor.

---

#### Inline editing on mobile

**Status:** Deferred to v1.1
**Why:** Inline title editing (double-click on a task row title) is not accessible via touch on mobile. Tapping a row opens the Task modal instead.
**Workaround in v1:** Use the Task modal to edit task titles on mobile.

---

#### Localization / internationalization

**Status:** Out of scope
**Why:** Tasko v1 is English-only. All UI copy is hardcoded English strings. Dates use the local system timezone with no formatting locale.
**Reference:** `docs/ux/microcopy.md` §30 "Localization notes"
**Workaround in v1:** None needed unless the user requires a non-English locale.

---

### E2E Test Coverage (Remaining Specs)

The following E2E specs are documented in the brief but deferred from the initial v1 Playwright suite. Manual QA is the fallback for these scenarios.

#### Remaining deferred E2E specs

**Status:** Deferred to v1.1 Playwright suite
**Why:** The initial E2E setup (task-20) implements 6 representative specs covering the highest-risk areas. The remaining 11 specs require either complex drag-and-drop interactions, multi-tab browser contexts, or long-running timer tests that add significant test infrastructure complexity.

**Deferred specs:**
1. `recurring-monthly.spec.ts` — create monthly recurring task, complete, verify next instance date
2. `hierarchy-depth-cap.spec.ts` — build Epic → Feature → Task → Subtask, attempt depth-cap violation
3. `kanban-drag.spec.ts` — drag card between Kanban columns (blocked on kanban drag infrastructure)
4. `calendar-reschedule-modal.spec.ts` — click event chip → modal → change date → verify calendar
5. `calendar-multi-day-modal.spec.ts` — seed multi-day item, verify span, change due date
6. `multi-tab-sse.spec.ts` — two browser contexts, write in A, observe in B within 1s
7. `undo-5s.spec.ts` — complete task, wait 6s, verify Undo button gone
8. `parent-completion-blocking.spec.ts` — parent with subtasks, confirm prompt body text
9. `tag-create-and-apply.spec.ts` — create tag inline, verify case-insensitive match
10. `trash-cascade-and-restore.spec.ts` — delete Epic with descendants, restore all
11. `quick-add-project-context-exception.spec.ts` — quick-add inside project tree pre-fills project_id

**Workaround:** Manual smoke test per the checklist in README.md §Manual smoke test.

---

### Out of Scope Forever

#### Multi-user / collaboration

**Why:** Tasko is a single-user tool by design. There is no auth, no sharing, no real-time multi-user editing.
**Reference:** `docs/brainstorm/product-spec.md` §2 "Target user"

#### Native iOS/Android app

**Why:** The product is a web application. A native app would require a separate engineering effort and is not in the product vision.
**Reference:** `docs/brainstorm/product-spec.md` §3

#### Email / notification integrations

**Why:** Tasko is pull-based. No notification surface exists and none is planned.
**Reference:** `docs/brainstorm/product-spec.md` §3

#### GTD / Kanban-as-primary-workflow modes

**Why:** Tasko is a simple personal task tracker with one optional hierarchy for structured work. GTD-specific features (contexts, areas, reviews) are out of scope.
