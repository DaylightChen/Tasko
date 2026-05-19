---
title: Tasko — Engineering Open Questions
date: 2026-05-18
phase: engineering
scope: project
status: draft
---

# Tasko — Engineering Open Questions

Questions the engineering phase could not (or should not) resolve unilaterally. Each entry includes:
- The question.
- What it affects (downstream phases or v1.1+).
- The proposed default if the user doesn't weigh in.
- The cost of revisiting.

Some entries are reminders to the planner that a feature is *deliberately not in v1*; others are choices the user may want to make explicit.

---

## 0. BINDING RESOLUTIONS (user, 2026-05-18)

All open questions reviewed with the user. The binding answers below override any "proposed default" or "may be cut" language elsewhere in this document. Planner and implementer phases must honor these:

| Item | Resolution |
|---|---|
| **1.1 Calendar drag-reschedule** | **CUT from v1.** Day-one decision (not "stretch"). v1 calendar uses click-event → modal → pick new date. Drag reschedule comes in v1.1. |
| **1.2 Calendar week view** | **IN v1.** Keep as planned. |
| **1.3 Kanban Done column overflow** | Architect's proposed default stands (collapse / paginate at threshold — exact UX is implementer's call). |
| **2.1 Multi-machine sync model** | **No sync engine ever.** Git remains the only sync mechanism — user runs `git pull` / `git push` manually in terminal indefinitely. v1.1 may add a convenience "Sync now" button that shells out to `git`, but no merge logic / conflict UI in Tasko. |
| **2.2 Mobile strategy (v1.1+)** | **Decide later.** Note as open question; do not pre-design. |
| **2.3 Auto-start (v1.1+)** | **Decide later.** Note as open question. |
| **2.4 Data backup outside git** | **Not needed.** Git provides backup story. User can use Time Machine / File History / etc. on the data dir if they want extra safety. No Tasko backup feature. |
| **4.1 Data directory default** | **`~/Documents/.tasko-data`** (hidden subfolder inside Documents, predictable on Mac/Linux/Windows). |
| **4.2 Port default** | **7373.** Server errors out (does not fall back) if taken. |
| **4.3 SSE wired in v1** | **Yes.** Ship the ~110 LOC for multi-tab consistency. |
| **4.4 Single-step undo for v1** | **Yes.** Multi-step is v1.1+. |
| **4.5 Atomic writes on Windows** | Architect's proposed handling stands (document recommendation against network mounts; on Windows use `copyFile + unlink` fallback; log warning on non-local FS). |
| **4.6 "Show completed" on calendar** | **IN v1.** Add a "Show completed" filter chip to the calendar view (slight scope addition vs the architect's proposed default of "v1.1"). |
| **4.7 Project Restore from Trash** | **Defer to v1.1.** v1 behavior: deleting a project trashes its items with `trashed_with: <project-id>`; project record is deleted, not restorable. |
| **4.8 Skeleton threshold** | Architect's proposed default stands (keep wired at 300ms; almost never fires in localhost). |

Subsequent sections retain their original analysis; cross-reference this resolution table for the binding answer.

---

## 1. v1 cuts (under heat) and stretch goals

### 1.1 Calendar drag-reschedule (high-risk, may be cut)

**Question**: Is "drag an event in the month/week calendar to a new day to reschedule" a hard v1 requirement, or is the fallback "click event → modal → pick new date" acceptable?

**Affects**: implementation budget. The drag-with-multi-day-span-preserving-delta is the single most complex piece in v1.

**Proposed default**: Ship drag-reschedule. If the implementation runs over budget, drop drag-reschedule to v1.1 — the modal path still works. The user gets calendar-as-overview in v1 even without drag.

**Cost of revisiting**: Cutting drag-reschedule mid-implementation costs a calendar refactor (remove dnd-kit wiring) — small. Adding it post-launch is a feature task ~1.5 weeks.

### 1.2 Calendar week view (lower priority than month)

**Question**: If we run hot on the calendar, is the week view defer-able to v1.1?

**Proposed default**: Ship month view first. Week view second. If week view is at risk past acceptable, defer the week view. The product spec lists both (PS §5.1) but the calendar is acknowledged as scope-heavy (PS §9.3 #5).

### 1.3 Kanban Done column with > 50 items

**Question**: The locked UX is "show recent 50 with [Show all] link." If the user has 5000 Done items in a project, what does "Show all" do?

**Proposed default**: "Show all" fetches the rest via a paginated endpoint extension (`?status=done&offset=50&limit=200` repeated until done). Server returns up to 1000 per page; client virtualizes. v1.1 may add a "Done items older than 30 days are collapsed" affordance.

---

## 2. Multi-machine v1.1+ design

### 2.1 Conflict resolution when multi-machine sync arrives

**Question**: When v1.x adds true sync (not just git), what conflict resolution model do we adopt?

**Affects**: the data model (do we need CRDTs?), the API (manual conflict UI?), the UX (the "Changes from another device" snackbar from `interaction-patterns.md` §6.5).

**Options**:
- **Git as truth, no app-level sync**: Keep v1's model forever. User does `git pull && refresh`. Conflicts are git merge conflicts. **(Currently locked. Simplest.)**
- **Background fetch-and-merge**: App periodically `git fetch`-equivalent (we'd need git or a similar protocol). Conflicts surface in the app. (Requires Tasko to know git or to have its own backend.)
- **CRDT-based eventual consistency**: Each Item is a CRDT (e.g., a map of LWW registers). Two devices edit, both writes merge with last-write-wins per-field. Requires re-modeling on-disk format.
- **Last-write-wins per file**: Simpler. Two-device divergence becomes "the most recent file write wins" — implemented by including a `modified_at_logical` (Lamport clock) field. Easy to add later.

**Proposed default for v1.1+**: start with **last-write-wins per field** (Lamport clock added to each field). No conflict UI. The "Changes from another device overwrote your edit" snackbar surfaces when the user's optimistic write was clobbered by an incoming change.

**Cost of revisiting**: Low if we add a `logical_clock` field to schema_version 2 entities. The migration is mechanical.

### 2.2 Mobile app strategy

**Question**: When v1.1+ ships a mobile experience, is it (a) the existing responsive web in a mobile browser, (b) a PWA with offline cache, (c) a Capacitor/Tauri wrapper, or (d) native iOS/Android?

**Proposed default**: (a) the responsive web first, with QA. Then (b) PWA if the install-as-app affordance becomes valued. Native is unlikely given the single-user model.

**Implication for v1**: the mobile CSS already ships; v1.1 PWA work is additive (add a service worker, manifest, install prompt).

### 2.3 Auto-start / process management

**Question**: When v1.1+ ships, do we ship launchd plists / systemd units / Windows Service templates for the user to install?

**Proposed default**: Ship a `tasko` CLI binary (esbuild single-file) + a `tasko install-autostart` subcommand that drops the platform-appropriate template. The user opts in.

### 2.4 Data backup outside git

**Question**: For users who don't want to git-push (privacy, complexity), is there a backup story beyond "you back up the data dir yourself"?

**Proposed default**: v1.1 ships an `tasko export` CLI that writes a single-file JSON dump. Imports via `tasko import`. No GUI surface in v1.

---

## 3. UX-spec items NOT BUILT in v1 (engineering noting them)

These are explicit DROPs from the UX spec, recorded here so the planner doesn't accidentally include them in tasks.

### 3.1 Sync state indicator (UX §42) — DROPPED

**Reason**: No sync in v1.

**Replacement**: Tiny footer "Tasko v1.0 · Local files in `<data-dir>`" at the bottom of the sidebar.

### 3.2 Sync-state snackbars (microcopy §27) — DROPPED

**Reason**: No sync in v1.

**Affected microcopy**: "Synced.", "Offline. Changes are saved locally.", "Sync error. Retry.", "Back online. Syncing your changes." — none of these appear in v1.

### 3.3 "Changes from another device" snackbar (interaction-patterns §6.5) — DROPPED

**Reason**: No multi-device sync in v1. Same-machine multi-tab conflicts are last-write-wins via SSE invalidation; no snackbar surfaces.

### 3.4 Pull-to-refresh suppression — NOMINALLY IMPLEMENTED

**Reason**: Mobile is not a QA target. We add the CSS rule (`overscroll-behavior-y: contain;` on `<body>`) but don't test it.

### 3.5 Mobile swipe drawer / bottom nav / Sheet — SHIPS, NOT QA-TARGETED

**Reason**: Mobile is not v1 QA. Code is present in `components/sheet/`, `components/bottom-nav/`, `components/swipe-drawer/` because the responsive CSS references them.

---

## 4. Engineering choices the user might want to weigh in on

### 4.1 Data directory default location

**Question**: When the user runs `pnpm start` without `TASKO_DATA_DIR`, where does data go?

**Options**:
- `./tasko-data` (relative to cwd) — fragile if user starts from different directories.
- `~/.tasko` (hidden in home) — works on Mac/Linux, less obvious on Windows.
- `~/Documents/Tasko` (visible in home) — friendly default; Mac/Linux/Windows-friendly.

**Proposed default**: `~/.tasko`. Hidden but predictable. `tasko init` creates it if missing.

### 4.2 Port default

**Question**: 7373 ("TASK" on phone keys, available). Acceptable?

**Proposed default**: 7373. If it's taken, the server errors out and asks the user to pass `--port`. We do NOT auto-fallback to a random port — that breaks the user's bookmarked URL.

### 4.3 SSE vs polling

**Question**: Should we ship SSE for multi-tab consistency, or is `refetchOnWindowFocus: true` enough?

**Proposed default**: Ship SSE. ~110 lines of code total. If it adds maintenance burden, drop in v1.1.

### 4.4 Single-step undo vs multi-step

**Question**: v1 ships single-step undo (replace on push). Multi-step (stack of 5-10) is post-v1. Acceptable?

**Proposed default**: Single-step v1. Multi-step is a small extension (changing `current: UndoEntry | null` to `stack: UndoEntry[]` + UI for "undo more") but it's not on the v1 critical path.

### 4.5 Atomic writes on Windows

**Question**: Windows `fs.rename` is **not** atomic across drives. The user is unlikely to point Tasko at a network mount, but if they do on Windows, writes can corrupt.

**Proposed default**: Document the recommendation against network mounts; on Windows, fall back to `fs.copyFile + fs.unlink` (two-step, technically not atomic but more reliable). Server logs a warning on boot if the data dir appears to be on a non-local filesystem (heuristic: drive letter starts with `\\` or path is a network share).

### 4.6 The "Calendar shows completed items" toggle

**Question**: PS §6.9 mentions "completed items don't appear" in calendar but flags this as an open question. Should we add an optional "Show completed" filter chip in calendar?

**Proposed default**: v1 calendar does NOT show completed items. A "Show completed" toggle is a v1.1 candidate. Documented in UX spec as out of v1.

### 4.7 Project Restore from Trash

**Question**: Currently, deleting a project trashes its items but doesn't put the project itself in Trash — the project is gone, items are recoverable but reparent to Inbox. Should we support "restore project"?

**Proposed default**: Defer to v1.1. The current behavior is documented in API §4.5. v1.1 may add `trash/projects/` to mirror the items pattern.

### 4.8 Skeleton threshold

**Question**: UX commits 300ms; engineering expects localhost loads to be < 10ms. Should we drop skeletons entirely?

**Proposed default**: Keep skeletons wired (small code surface). They almost never fire in practice. Acceptable as is.

---

## 5. Performance budgets — what to do at the ceiling

### 5.1 5000+ items in a project

**Threshold**: virtualization kicks in at 200 visible rows. With 5000 items the indexer takes ~750ms to read on boot, virtualized render is fine.

**What if 10k+?**: server boot starts to bite (1.5s+). v1.1 considers a SQLite-backed index. v1 accepts the ceiling.

### 5.2 200+ tags

**Threshold**: tag autocomplete query is `?prefix=...` capped at 50 results. The sidebar tag list renders all referenced tags. At 200 tags, the sidebar gets crowded; UX may collapse.

**v1.1**: collapsible "Tags" sidebar section with "show all (N)" affordance.

### 5.3 Recurrence: how many active recurring instances?

**Threshold**: each instance lives in `items/`. If a user has 30 recurring tasks and lets them roll forward for years, they accumulate "next instances" in flight. But each completion only generates ONE next, so the count is bounded by the user's check-off rate.

**Not a v1 concern**.

---

## 6. Inconsistencies in upstream specs (and resolution)

These are places where the brainstorm and UX specs were ambiguous or in tension. Engineering's resolution is below; flagging here so the user can override.

### 6.1 "Sync state" surface vs "no sync in v1"

**Conflict**: UX `component-inventory.md` §42 specs a sync state indicator. The locked decision is "no sync in v1."

**Resolution**: §42 is NOT built. The sidebar's bottom row becomes a tiny "v1.0 · Local files in `<data-dir>`" footer. UX `flows.md` and `microcopy.md` references to sync are not implemented.

### 6.2 Quick-add project pre-fill on per-project view

**Conflict**: UX `flows.md` §1 step 37 says the "+ Add Task" inside a project tree DOES pre-fill the project. UX `screens.md` per-project view says quick-add does too. Locked decision §9.4 #8 says quick-add NEVER pre-fills project.

**Resolution**: The "destination context" exception applies (per UX itself, in `flows.md` step 37 explanation). The quick-add **bar at the top of a per-project view DOES pre-fill the project** because the user navigated to that destination. The quick-add bar on Today, Tomorrow, Calendar, etc. does NOT pre-fill (those are smart lists, not destinations). The locked decision §9.4 #8 is honored in spirit.

**Documented in**: `frontend-architecture.md` §14.

### 6.3 "Add task on this day" calendar quick-add — what about project?

**Conflict**: On the calendar, the user presses `N` on a focused day → modal opens with **date pre-filled**. Does the project also pre-fill?

**Resolution**: No project pre-fill. Calendar is a smart-list view (per locked decision §9.4 #8). The date is the only context the calendar provides. User picks project.

### 6.4 Kanban "+ Add task" with column context

**Conflict**: Per UX `screens.md`, Kanban column "+ Add task" pre-fills status from the column. Does it pre-fill project?

**Resolution**: Project DOES pre-fill (the Kanban view is **on a specific project** — the user is in that project's destination context). Status pre-fills from the column. Date does NOT pre-fill (no date context on Kanban). UX `screens.md` notes this as the exception explicitly.

### 6.5 Subtask uncheck animation

**Conflict**: UX §12.4 says subtask toggle does NOT trigger a snackbar. Brainstorm §4.4 doesn't explicitly say. Consistency with task animations?

**Resolution**: Subtask check/uncheck:
- Within the modal (the only place subtasks live): no animation beyond the checkbox tick. No snackbar (UX §12.4).
- No undo entry pushed (the modal is already a paused editing context; the user can manually toggle back).

### 6.6 Empty Trash announcement

**Conflict**: Snackbar variants exist for "Task moved to Trash" and "Task restored" but Empty Trash's snackbar is less specified.

**Resolution**: After confirming "Empty Trash", show snackbar `Trash emptied. <N> items deleted.` per microcopy §7. No undo (irreversible — also per UX §12).

### 6.7 Folder deletion preserves projects — what about Project deletion?

**Conflict**: UX `microcopy.md` §6.9 says "Delete project '<name>'? <N> active items will be moved to Trash." Confirms items go to Trash. Folders go too?

**Resolution** (engineering call): Deleting a project deletes the project file AND trashes every item in the project (active + completed). The folder containing the project is untouched. Documented in API §4.5.

### 6.8 What happens to a Tag with zero references after the last item is deleted?

**Conflict**: PS §4.5 says "Orphan tags vanish from the sidebar but are not deleted automatically." UX `microcopy.md` doesn't address.

**Resolution**: Orphan tags persist on disk. They simply don't appear in the sidebar list (`include_orphans=false` default). v1.1 may add a "Clean up unused tags" affordance.

### 6.9 Project view defaults — Tree vs List

**Conflict**: A flat (non-hierarchical) project ships with List + Kanban; a hierarchical project ships with Tree + Kanban (UX §31.2). What's the URL for a hierarchical project's default? `/project/$id` or `/project/$id/tree`?

**Resolution**: Default URL `/project/$id` resolves to Tree for hierarchical projects, List for flat projects. The view decision is driven by the project's `is_hierarchical` field, not the URL. Kanban has an explicit URL: `/project/$id/kanban`. No `/project/$id/tree` or `/project/$id/list` — the default URL is the default view.

### 6.10 Calendar's "Today" indicator while focused on another date

**Conflict**: UX says the cell representing today's date always has the accent-filled circle, regardless of selection (per §5.6 — "Today" highlight is always drawn). What if the user has navigated to a different month? The cell isn't visible; should we show some "back to today" affordance?

**Resolution**: The keyboard shortcut `T` (per UX `interaction-patterns.md` §4.7) jumps to today. No additional "back to today" button in v1. The behavior is documented in the help overlay.

---

## 7. Items to monitor in the implementation phase

A small list the planner should keep visible:

- **The roll-up progress recomputation**: when a Task is completed, the ancestor Epic / Feature's progress chip must update. Implementation: TanStack Query cache invalidation walks up the parent_id chain and invalidates each ancestor's detail query. Or we compute the chip purely from the children's data already in cache. Latter is simpler — pick that.

- **The "depth-cap rejection" snackbar from a drag**: dnd-kit's drop callback knows the source and target; we call `canMoveClient` and either commit the mutation or surface the snackbar. Don't accidentally fire the mutation first and only catch the depth-cap server-side — that's a worse UX.

- **The hotkey mode stack edge cases**: opening a popover (date picker) from inside a modal should push 'date-picker' on top of 'modal'. Closing the popover pops; closing the modal pops again. Verify with E2E.

- **Reduced-motion CSS coverage**: every motion token has a reduced-motion override. The default token values should NOT be a motion-less fallback — the override only fires under the media query. Verify via a Playwright test with `reducedMotion: 'reduce'`.

- **SSE reconnect after server restart**: if the user kills and restarts the server, the SSE connection breaks. The native `EventSource` retries automatically. On reconnect, `onopen` fires our refetch-all-stale logic. Verify the user doesn't see "Server not running" during this window (it's brief).

---

## 8. Summary table for the user's quick review

| # | Item | What's needed |
|---|---|---|
| 1.1 | Calendar drag-reschedule | OK to defer if we run over? |
| 1.2 | Calendar week view | OK to defer if we run over? |
| 2.1 | Multi-machine conflict model (v1.1+) | Approve "git as truth" forever or commit to a v1.x sync? |
| 2.2 | Mobile strategy (v1.1+) | PWA, native, or just responsive web with QA? |
| 2.3 | Auto-start CLI (v1.1+) | Yes/no |
| 2.4 | Data backup outside git (v1.1+) | Yes/no |
| 4.1 | Data dir default | `~/.tasko`? |
| 4.2 | Port default | 7373? |
| 4.3 | SSE wired | Yes? |
| 4.4 | Single-step undo for v1 | Yes? (multi-step v1.1+) |
| 4.6 | Show completed in calendar | v1: no. v1.1 candidate. |
| 4.7 | Project restore from Trash (v1.1+) | When this becomes work, what's the model? |

If the user wants any of these resolved differently before the plan phase, flag here.
