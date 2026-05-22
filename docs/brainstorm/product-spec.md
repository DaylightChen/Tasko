---
title: Tasko — Product Design Spec (v1)
date: 2026-05-18
phase: brainstorm
scope: project
status: draft
---

# Tasko — Product Design Spec (v1)

**Elevator pitch:** Tasko is a single-user, web-based personal task tracker that combines lightweight TickTick-style daily task management with an optional Epic → Feature → Task hierarchy for the user's larger projects — local-first, with cloud sync, no accounts, no notifications, no clutter.

---

## 1. Overview

Tasko is a personal productivity tool for one person. It is opinionated, intentionally narrow in v1, and built around the idea that **the Today view is the home of the product**. The user opens Tasko, sees what is due, what is overdue, and what is in progress on multi-day work, and gets through the day.

For larger pieces of work, Tasko also offers a flexible three-level project hierarchy (Epic → Feature → Task, with one further level of Subtask below Task) — so the same app handles "buy groceries" and "ship the Q3 milestone" without forcing the user into either extreme.

What Tasko **is not** in v1: a collaborative tool, a notes app, a calendar replacement, a habit tracker, a reminder service, a Pomodoro timer, a GTD framework, or an inbox-zero email client. There is exactly one user, no shared lists, no notifications, no proactive nudging. The user is responsible for opening the app; Tasko is responsible for making that visit useful.

---

## 2. Target user & core job-to-be-done

### Persona

A single individual who:

- Manages both **personal** tasks (errands, life admin, appointments) and **structured work or side-project** tasks (multi-step initiatives that have an Epic-shaped feel — software features, writing projects, course development, home renovations, etc.).
- Has tried tools across the spectrum: simple to-do lists feel cramped when work gets larger; full project management tools (Jira, Asana, Linear) are overkill for personal use and don't fit the "buy milk" use case.
- Works primarily from a laptop browser but occasionally checks tasks from a phone browser (no native app expectation).
- Cares about a clean, fast, predictable interface more than about a feature buffet.
- Trusts cloud sync as a backup story (no manual export ritual).

### Core job-to-be-done

1. **Plan the day** — first thing in the morning (or last thing the night before), open Tasko, see Today, see overdue, decide what to do.
2. **Capture quickly** — when a task pops into mind, add it in seconds without ceremony.
3. **Track multi-step work** — when something larger than a single task arrives, give it an Epic, break it into Features and Tasks, and chip away at it across days or weeks.
4. **Recover gracefully** — when life gets in the way and tasks roll overdue, clean up without shame: bulk-reschedule, complete, or defer.
5. **Review** — see what's coming this week, triage Inbox, schedule things into the right project.

Tasko's job is to make 1-5 feel light. Anything that doesn't directly serve those five behaviors is a candidate for deferral.

---

## 3. Platforms & runtime context

- **Form factor:** Single web application, responsive layout. One codebase serves both desktop browser (primary) and mobile browser (secondary). No native iOS/Android apps in v1.
- **User model:** Single user. No accounts, no login, no sharing. Data belongs to one person.
- **Storage posture:** Local-first — the app reads and writes to a local store on the device and works offline. A background sync mechanism reconciles changes with a cloud backend so the user's data is available across devices and is implicitly backed up.
- **Tech stack:** Deferred to the engineering phase. Sync protocol, local storage technology (IndexedDB / SQLite-in-browser / etc.), backend architecture, and conflict resolution semantics are all engineering decisions. This spec only commits to the *posture*: local-first, eventually consistent across devices, no per-write server round-trips.
- **Notification surface:** None in v1. The product does not request notification permissions, does not register service workers for push, and does not send email. The user pulls; the app does not push.

---

## 4. Entity model

This section defines every persistent entity in v1, its fields, and its relationships. It is deliberately schema-shaped but does not pick a database. The engineering phase will translate this into concrete tables / documents / CRDT types.

### 4.1 Project

A container that groups related work. Every Task lives in exactly one Project. There is one special built-in Project called **Inbox** that holds unfiled tasks.

| Field | Required | Notes |
|---|---|---|
| id | yes | Stable identifier |
| name | yes | User-visible label |
| folder_id | no | Optional parent folder (see 4.2) |
| is_hierarchical | yes (bool) | Opt-in flag — when true, the project supports Epics and Features; when false, only Tasks live under it directly. Default: false. |
| color / icon | no | Optional visual tag — exact treatment is a UX phase decision |
| sort_order | yes | User-defined ordering of projects in the sidebar |
| is_inbox | yes (bool) | True only for the built-in Inbox; false otherwise |
| created_at, updated_at | yes | Timestamps |

**Cardinality:** A user has one Inbox and zero-or-many user-created Projects. Inbox cannot be deleted, renamed, or moved into a folder.

### 4.2 Folder (optional)

A pure visual grouping layer in the sidebar. One level deep, no nesting. Folders **cannot contain tasks directly** — only Projects.

| Field | Required | Notes |
|---|---|---|
| id | yes | |
| name | yes | |
| sort_order | yes | |
| created_at, updated_at | yes | |

Folders are optional. A user can run Tasko forever without creating one. Projects can live folder-less.

### 4.3 Item (Task / Feature / Epic) — the flexible hierarchy

To support both flat projects ("Errands" with just Tasks under it) and hierarchical projects ("Q3 Launch" with Epics → Features → Tasks under it), all three concepts share one entity called **Item** with a `type` label.

| Field | Required | Notes |
|---|---|---|
| id | yes | |
| project_id | yes | Always belongs to exactly one Project (Inbox counts) |
| parent_id | no | Optional parent Item — used to express Epic ⇒ Feature ⇒ Task |
| type | yes | One of: `epic`, `feature`, `task`. Drives icon + progress rollup. **Not** strictly schema-enforced — see open question below. |
| title | yes | The required, load-bearing field |
| notes | no | Markdown body. Supports formatting, links, and markdown checklists (which are display-only — they are not subtasks). |
| start_date | no | Defaults to `due_date` for single-day items; explicitly set for multi-day items |
| due_date | yes | Required (date; time is a separate optional field) |
| due_time | no | Optional time-of-day in local timezone. No time = all-day item. |
| priority | yes | One of: `none` (default), `low`, `medium`, `high`. Sort signal only — not a separate view. |
| status | yes | One of: `todo` (default), `in_progress`, `done`. `done` is identical to "completed". |
| tags | no | Zero or many Tag IDs (see 4.5) |
| recurrence | no | Embedded Recurrence Rule (see 4.6) or null |
| completed_at | no | Set when `status` transitions to `done`. Null otherwise. |
| trashed_at | no | Set when soft-deleted. Null otherwise. |
| sort_order | yes | User-defined ordering within parent / project / view |
| created_at, updated_at | yes | |

**Constraints / business rules:**

- An Item with `type = task` may have **Subtasks** (see 4.4) — one level only.
- An Item with `type = feature` is typically a child of an Epic and a parent of Tasks, but the strict typing rules (e.g., can a Feature be top-level? can a Task have a child Task?) are deferred to the engineering phase. The spec commits to: 3 nesting levels max within a project + 1 subtask level = 4 levels total.
- An Item with `type = epic` is typically top-level within a hierarchical project.
- All Items in a non-hierarchical project are of type `task` and live directly under the project (no `parent_id`).
- Multi-day model: if `start_date < due_date`, the Item surfaces in Today every day from `start_date` to `due_date` inclusive, until it is completed.
- The `due_date` is *required* — the spec treats this as a core design call: every task has a when. Tasks created from the quick-add flow open a modal with the due-date field focused for that reason.

**Progress roll-up (display-only computed signal):**

For an Epic or Feature with child Items, Tasko computes a completion percentage from its direct children: `(completed children) / (total children)`. This is a display attribute, not a stored field. Subtasks count toward their parent Task's roll-up; the Task's own status is the user-controlled checkbox.

### 4.4 Subtask

A child checklist item beneath a Task. Subtasks are real entities (they have their own ID and lifecycle) but are intentionally lightweight.

| Field | Required | Notes |
|---|---|---|
| id | yes | |
| task_id | yes | Parent Task — Subtasks attach only to type=`task` items |
| title | yes | |
| status | yes | `todo` or `done` (no `in_progress` for subtasks — they're too small) |
| completed_at | no | |
| sort_order | yes | |
| created_at, updated_at | yes | |

**Constraints:**
- Subtasks cannot have subtasks. One level only.
- Subtasks have no due date, no priority, no notes, no tags, no recurrence. If a user needs those, they should promote it to a real Task.
- Subtasks do not appear in smart lists, calendar, or kanban — they only appear inside their parent Task's detail.
- The parent Task's status is independent of its subtasks' statuses — but see "parent completion blocking" below.

### 4.5 Tag

A free-form label that can be attached to zero or many Items. Created on-the-fly the first time a user types `#name`.

| Field | Required | Notes |
|---|---|---|
| id | yes | |
| name | yes | Unique. Case-insensitive match for autocomplete (display preserves user casing). |
| color | no | Optional, may default. Exact treatment a UX decision. |
| created_at, updated_at | yes | |

**Constraints:**
- Global namespace — tags are not project-scoped. A tag named `urgent` is the same `urgent` everywhere.
- Tag management (rename / delete / merge) is **post-v1**. In v1 a tag is created the first time it's used and cannot be renamed or deleted through a UI. Orphan tags (tag with zero attached items) may exist but are not surfaced in a tag list.
- A Tag with no attached active Items does not appear in the sidebar's tag list.

### 4.6 Recurrence Rule

Attached to a single Item. When the Item is completed, Tasko auto-generates the next occurrence per this rule.

| Field | Required | Notes |
|---|---|---|
| frequency | yes | One of: `daily`, `every_n_days`, `weekly`, `monthly`, `yearly` |
| interval | yes (if applicable) | Integer N for `every_n_days`; ignored otherwise |
| weekdays | yes (if weekly) | Set of weekdays (e.g., {Mon, Wed, Fri}) |
| day_of_month | yes (if monthly) | Integer 1-31. If month is shorter, clamp to last day of month. |
| month_and_day | yes (if yearly) | (Month, Day) tuple |
| anchor_mode | yes | One of: `on_schedule` (next occurrence is computed from the original due date) or `after_completion` (next occurrence is computed from the completion timestamp) |

**Explicitly out of scope for v1:** full iCalendar RRULE, "last weekday of the month," "nth Tuesday of the month," monthly-by-weekday, complex BYSETPOS rules.

**Behavior:**
- When a recurring Item is completed, Tasko (a) stamps the completed instance with `completed_at` and archives it to Completed view, then (b) creates a fresh Item with a new ID, new dates per the rule, and the same recurrence rule attached. Each occurrence is its own historical record.
- The recurrence rule lives on the *currently active* instance. Completed instances retain a snapshot of the rule for audit but are not used to generate further occurrences.

### 4.7 Status field

Status is part of the Item entity (see 4.3), not a separate entity. It has three values:

- `todo` — default
- `in_progress` — user has started working on it
- `done` — completed (equivalent to a checkbox tick)

The Kanban view's columns are bound to these three status values. A drag from one column to another mutates `status`. Checking off a task anywhere else in the app sets `status = done` and stamps `completed_at`.

### 4.8 Completion & Trash states

These are not separate entities — they are field states on the Item / Subtask:

- **Completed** = `status = done` AND `completed_at` is set. The Item disappears from all active views (Today, Tomorrow, Next 7 Days, Per-project, Per-tag, Calendar, Kanban-To-Do-and-In-Progress) and surfaces in **Completed view** and in the Kanban "Done" column.
- **Soft-deleted (Trash)** = `trashed_at` is set. The Item disappears from all views including Completed, and surfaces only in **Trash view**.
- **Active** = `trashed_at` is null. The Item appears in views according to its status and dates.

Restore from Trash sets `trashed_at = null`, returning the Item to whatever state it was in before deletion (active or completed).

Empty Trash is a **manual user action**. No auto-purge. The Trash grows until the user clears it.

### 4.9 Deferred entities (not in v1)

Mentioned here for completeness so the engineering phase doesn't need to discover them late:

- **Reminder** — would represent a scheduled push to the user. Post-v1.
- **Search index** — there's no global search in v1, so no inverted index. Post-v1.
- **Export bundle** — there's no export in v1, so no serialized bundle format. Post-v1.

---

## 5. Feature set (v1 / deferred / non-goal buckets)

### 5.1 Shipping in v1

**Core task management**
- Create / edit / delete tasks with required title + due date
- Optional fields: notes (markdown), priority (None / Low / Medium / High), tags, status, start date, due time, recurrence
- Subtasks (one level)
- Soft delete with Trash view; manual purge
- Parent-completion blocking prompt (offer "complete all children & continue" or cancel)
- Re-open completed tasks (un-check)

**Project hierarchy**
- Projects + optional Folders (one level)
- Built-in Inbox (cannot be deleted)
- Per-project opt-in to hierarchy: Epic → Feature → Task (3 nesting levels) + Subtask (4th level on Tasks)
- Item type label drives icons + roll-up
- Parent_id is flexible — user picks parent at creation/move time (subject to depth cap)

**Tags**
- Free-form, created via `#name` syntax in tag input (not in title — see Quick capture)
- Global namespace, autocomplete from existing tags
- Per-tag view in sidebar
- Tag chips on items
- No tag management UI in v1 (no rename, delete, merge)

**Views (v1)**
- Today (default landing) — surfaces overdue + due-today + multi-day in-progress
- Tomorrow
- Next 7 Days
- Inbox
- All
- Completed
- Trash
- Per-project view — tree of Epics / Features / Tasks for hierarchical projects, flat task list otherwise
- Per-tag view — flat list of items with the tag
- Calendar view — month + week, multi-day items render as spanning bars, drag-to-reschedule
- Kanban view — per-project optional, fixed columns To Do / In Progress / Done, drag-between-columns mutates status

**Time & scheduling**
- All-day items (no time) and timed items (with due_time)
- Local timezone only — no timezone math
- Multi-day items via start_date + due_date — visible every day across the span in Today
- Overdue items: stay on their original due date, surface at top of Today with "overdue" treatment
- One-tap "move all overdue to today" action
- Recurring rules (see 4.6): daily, every N days, weekly on weekdays, monthly on day-of-month, yearly + repeat-on-schedule vs. repeat-after-completion toggle
- Completing a recurring task auto-generates the next instance

**Quick capture**
- Persistent "+ Add task" input at the top of every view
- Global keyboard shortcut to focus quick capture (specific binding TBD by UX)
- Behavior: type title, press Enter, modal opens with title pre-filled and focus on due-date field — user completes modal to save
- **No NLP parsing** — the quick capture input is a fast path to the modal, not a smart parser

**Per-view filter & sort**
- Sort dropdown per view: due date asc (default), priority, title, created date
- Filter chips per view: click a tag / priority chip at top to narrow
- Filters are session-only — not persisted across reloads

**Settings**
- Theme: light / dark / system
- Week start: Sun / Mon
- (No default-project setting — quick-add always prompts; see §6.2, §6.5)

**Data & sync**
- Local-first storage on the device
- Cloud sync in the background — concrete mechanism deferred to engineering
- Implicit backup via sync (data lives on device + cloud)

### 5.2 Deferred (planned post-v1 but explicitly out of v1)

- Global search (⌘F / Ctrl+F across all titles, notes, tags) — **flagged as likely-needed-soon**
- Reminders / notifications (push, email, in-app, daily summary)
- Service Worker for push notifications
- Tag management UI (rename / delete / merge)
- Export (JSON / CSV / Markdown) — **flagged as a real lock-in risk**
- Import (from TickTick, Todoist, Markdown, CSV)
- User-defined smart lists / saved filters / persistent filters across sessions
- Date/time format settings
- Keyboard shortcut remapping
- Density setting
- Default-view setting
- More advanced recurrence (RRULE, "last weekday of month," "nth Tuesday")
- Task duration / time-blocking with explicit duration spans
- File attachments
- Activity log / per-item history beyond `completed_at` snapshots
- Multi-device per-device settings

### 5.3 Non-goals (explicitly will not be built — defining the product's shape)

- Multi-user / accounts / sharing / collaboration / comments
- Real-time collaborative editing
- Notifications via SMS, email, calendar invites
- Calendar feed / iCal subscribe-out
- Two-way calendar sync with Google / Microsoft / Apple calendars
- Habit tracking / streaks / metrics dashboards
- Pomodoro / focus timer
- Time tracking / billable hours
- Project templates / task templates beyond a vague "duplicate"
- AI assistance, smart suggestions, ML scheduling
- Plugin / extension ecosystem
- Public API

---

## 6. End-to-end user flows

These are written as narrative descriptions of what the user does, sees, and experiences. They deliberately do **not** specify pixel-level layout, microcopy, or component styling — those are the UX phase's job. Where a UX decision is load-bearing for the engineering phase to understand, it's noted as a hook.

### 6.1 First-time use

The user opens Tasko for the first time. The app shows an empty Today view because there are no tasks yet. The empty state explains that this is where today's tasks will appear and points to the quick-add input. The sidebar shows Inbox, Today, Tomorrow, Next 7 Days, All, Completed, Trash — and an empty Projects section with an option to add a project.

The user types a task title in the quick-add input ("Buy laptop charger") and presses Enter. A modal opens with the title pre-filled and the due-date field focused. The user picks today's date and presses Save. The modal closes. The new task appears in Today.

The user then creates their first Project ("Q3 Launch") via the sidebar's "Add project" affordance. The new-project flow asks for a name and offers a toggle for "Use Epic / Feature / Task hierarchy" (off by default). The user toggles it on. The new project appears in the sidebar; clicking it opens the project view, which is empty and shows an empty state explaining the hierarchy.

The user adds an Epic ("Backend rewrite"), then adds two Features under it ("Design new schema," "Migrate data"), then adds a few Tasks under each Feature. Each item creation goes through the same modal-with-required-due-date flow. The project view shows the tree.

The user navigates back to Today. Today now shows the individual Tasks they just created that are due today (the Epics and Features themselves only show if they have due dates today — they are containers, not work units, and don't necessarily surface in Today).

### 6.2 Daily flow

The user opens Tasko in the morning. Today view is the default landing. It shows:

- **Overdue section at the top** — every active task whose due date is before today, in date order (oldest first) with overdue treatment. A "move all overdue to today" affordance is visible if there is at least one overdue item.
- **Today section** — every active task whose due date is today, plus every active multi-day task whose start_date ≤ today ≤ due_date. The multi-day items have a per-day status hint ("in progress," "due tomorrow," "due today").
- A sort dropdown defaults to date ascending (timed items by their time, all-day items below). Priority sort is one click away.

The user checks off three tasks. Each checkbox tick:
- Sets status = done, stamps completed_at, and the item animates out of the active list.
- If the item has incomplete subtasks, a prompt asks "This task has 2 incomplete subtasks. Complete all and continue, or cancel?" The user picks one.
- If the item is recurring, the next instance is silently generated and the completed instance moves to Completed.

The user quick-adds two new tasks via the persistent input at the top. Each goes through the modal — title is pre-filled, due-date field is focused, **the Project field is empty (not pre-filled from the current view)**; the user must explicitly pick a project (or Inbox) before saving.

The user clicks "move all overdue to today" once for the overdue items they want to deal with today (this is one bulk action, not per-item — see open question on partial selection).

### 6.3 Weekly review

The user opens Inbox. They see N unfiled tasks that they've quick-added through the week without bothering to file. They go through them one by one: for each, they either (a) edit it to set a project and date, (b) bulk-select several and move them to a project (bulk operations — see open question), (c) delete it (soft-delete to Trash), or (d) leave it for later.

They then open Next 7 Days to see what's coming. They drag items in the calendar view to reschedule them across days, or open items in the modal to change dates more precisely. They check on the per-project view of each hierarchical project to see roll-up progress.

### 6.4 Multi-day work

The user creates a task "Write conference talk" with start_date = Mon May 18 and due_date = Fri May 22. The task is saved. From May 18 through May 22, every time the user opens Today, this task appears in the Today list with a per-day hint:

- May 18: "starts today"
- May 19-21: "in progress, due Fri"
- May 22: "due today"

If the user checks it off any day, it's done. If they don't check it off by May 22 and the next day comes, it becomes overdue and rolls into the Overdue section of Today.

In the calendar view, the same task renders as a spanning bar across the five day cells. Drag-to-reschedule on the calendar moves the whole span (preserving the start-due delta).

### 6.5 Hierarchical project — creating an Epic, Features, Tasks

The user opens project "Q3 Launch" (hierarchical). They click "Add Epic" (or a generic add affordance that lets them pick type). They create an Epic called "Marketing site relaunch." It appears at the top level of the project tree.

They expand the Epic and click "Add Feature." They create "Hero section copy," "Pricing page," "FAQ update." Each Feature appears as a child of the Epic.

They expand "Pricing page" and click "Add Task." They create "Draft pricing tiers," "Get sign-off from finance," "Hand off to designer." Each Task appears as a child of the Feature.

The user is on the Task "Draft pricing tiers." They add 3 subtasks: "Read competitor pricing," "Sketch table," "Send to PM for review." These appear as a checklist within the Task's detail.

The Epic's display shows roll-up progress: e.g., "2 / 9 tasks complete" or a progress bar — exact treatment is a UX decision. Same for each Feature.

A Task in the project can also be moved up the tree (re-parented to a different Feature, or to the Epic, or to the project root) — see open question on whether the UI for re-parenting is drag-and-drop, a modal field, or both.

### 6.6 Recurring task

The user creates a task "Pay rent" with due date June 1 and recurrence = monthly on day 1, anchor = on_schedule.

On June 1 the task appears in Today. The user checks it off. Tasko:
1. Sets completed_at = now, archives the June 1 instance to Completed.
2. Generates a fresh task with the same title, recurrence rule, due_date = July 1.
3. The July 1 task does not appear in Today (it's not today).

The user creates a second task "Water plants" with recurrence = every 3 days, anchor = after_completion.

On Day 1 they complete it. The next instance is created with due_date = Day 4 (three days after completion). On Day 4 they're busy and don't complete it. On Day 5 (overdue), they complete it. The next instance is created with due_date = Day 8 (three days after completion, regardless of original schedule).

For weekly recurrences ("every Mon, Wed, Fri"), completing the Monday instance generates a Wednesday instance (the next weekday in the rule's set, not Monday + 7).

### 6.7 Overdue

The user comes back to Tasko after a 3-day trip and has 12 overdue tasks. They open Today. The Overdue section at the top shows all 12, in date order (oldest first), each visually marked overdue. The Today section below shows today's tasks normally.

The user has three options for each overdue item:
- **Reschedule** — open the modal, pick a new date.
- **Complete** — if it was actually done.
- **Delete** — if it's no longer relevant.

For bulk handling, the user clicks "Move all overdue to today" and all 12 jump to today's date. (This is intentionally a blunt instrument — if the user wants finer control, they handle items individually.)

### 6.8 Kanban view

The user opens a project and switches to Kanban view (per-project, opt-in). Three fixed columns: **To Do**, **In Progress**, **Done**. Each Task in the project shows as a card in the column matching its status. **Only `type=task` items appear as cards.** Epics and Features (containers) and Subtasks do not appear in Kanban; they remain visible only in the project's tree view.

The user drags a card from To Do to In Progress. The card's status updates to `in_progress`. The change syncs.

The user drags a card from In Progress to Done. The card's status updates to `done`, completed_at is stamped, the card moves to the Done column, and (if recurring) the next instance is generated. The Done column accumulates completed items and may need pagination or a collapse affordance — UX decision.

If the user wants to revert, they drag from Done back to To Do or In Progress; the item un-completes (completed_at cleared).

Filter chips and sort dropdown work the same as elsewhere.

### 6.9 Calendar view

The user opens Calendar view — a **top-level global view across all projects**. Month view is default; the user can switch to Week view. At the top of the calendar, **optional filter chips** let the user narrow by project or tag (session-only, matching per-view filter convention). Each day cell shows the items due that day. Multi-day items render as a horizontal spanning bar across the day cells from start to due.

The user drags an item from Tuesday to Thursday. The item's due_date updates. If it was a multi-day item, the whole span shifts (start_date and due_date both move by the drag delta).

Clicking an item on the calendar opens it in the same edit modal used everywhere else.

Calendar respects timezone = local. No timezone math.

Items without due dates do not appear on the calendar (every active item has a due date, so this is non-issue — but completed items don't appear; see open question on whether Completed view should be calendar-renderable).

### 6.10 Completion and Trash

**Completion.** Checking a task's checkbox sets status=done. The task disappears from all active views. It appears in Completed view, sorted most-recently-completed first. From Completed view, the user can un-check the task; this clears completed_at and returns it to active (with its original due date — which may now be in the past, putting it overdue). The user can also delete a completed task (sending it to Trash).

**Un-checking a completed recurring instance** only reopens that specific instance. The auto-generated next instance (created at completion) stays put — un-check does NOT delete it. The user temporarily has two active instances; they can manually delete the next instance from its project view if it's no longer wanted.

**Trash.** Deleting a task (from anywhere — task detail, list, completed view) sets trashed_at. The task disappears from Active and Completed views and appears in Trash view, sorted most-recently-trashed first. From Trash, the user can:
- **Restore** — clears trashed_at; the task returns to its previous state (active or completed, with all its previous fields intact).
- **Delete permanently** — removes the record entirely. No recovery.
- **Empty Trash** — bulk permanent-delete everything in Trash.

Trash never auto-purges in v1. It will accumulate until the user clears it.

**Restoring a parent.** If a parent Item (Epic, Feature, or Task with subtasks) was trashed *along with* its children, restoring the parent restores its children too. See open question: what if the user trashed children individually before trashing the parent? (Engineering will need a clear semantic.)

---

## 7. Edge cases & failure modes

### 7.1 Local DB corruption

If the local database is corrupted on the device, the user has no manual export to restore from. The recovery path is: re-sync from the cloud backend, which should have the latest state. If sync has not yet completed for recent edits (e.g., the user made changes offline that hadn't synced yet), those changes are lost. **The spec acknowledges this risk; export is post-v1.** A user worried about data loss has no escape hatch in v1.

### 7.2 Sync conflict — two devices edit the same task offline

The user opens Tasko in two browser tabs (or on laptop + phone) while offline. They edit the same task differently in each. Both come back online. The two edits reach the backend.

The spec does not commit to a specific conflict resolution strategy here — that is an engineering decision (CRDT, last-write-wins per field, manual conflict UI, etc.). The spec only commits to: **data is never silently lost.** If a write is dropped, the user must be informed via a non-blocking indicator. If both writes are merged, both effects should be visible in the result if possible.

### 7.3 Timezone change / DST

The user travels across timezones. Tasko stores due_date and due_time in local time only — no timezone math. This means:

- A task due May 18 stays "May 18" regardless of where the user is. There is no time-shifting.
- A timed task due "May 18 at 14:00" stays "May 18 at 14:00" — the user's clock changes, but the task's wall-clock time stays put.
- DST transitions: the date wraps at the device's local midnight. A "every Monday" recurrence fires on whatever the device thinks Monday is.

This is intentionally simple. It will produce surprising behavior for users who genuinely cross timezones frequently. v1 accepts that.

### 7.4 Recurring task with start-date offset ("every Mon" with a 3-day start offset)

If a recurring task has `start_date` = May 11 and `due_date` = May 14 (a 3-day span) with recurrence = "weekly on Sun," then when the May 14 instance is completed, the next instance is generated. The spec commits: **the start-to-due delta is preserved.** The next due date is May 21 (next Sunday); the next start date is May 18. The 3-day span travels with the recurrence.

For `every_n_days` with `after_completion` anchor: the next due_date = completion_date + N days. The new start_date = new due_date - original_span (preserving the delta).

### 7.5 Completing an overdue recurring task

A recurring task is due May 10 (anchor = on_schedule, recurrence = weekly on Mon). The user doesn't complete it. It becomes overdue. On May 14 the user finally completes it. The next instance's due date is computed from the *original schedule*, not from today:

- Anchor `on_schedule` → next due = May 17 (next Monday after the original May 10).
- Anchor `after_completion` → next due = May 21 (May 14 + 7 days).

This difference is the whole point of the toggle. The spec is explicit about this so engineering doesn't have to guess.

### 7.6 Deleting a parent Item with children

If the user deletes an Epic with Features and Tasks under it, **all descendants are soft-deleted with the parent** in a single operation. They all go to Trash together. Restoring the Epic restores the descendants too (per 6.10).

If the user wants to keep the children, they must re-parent the children to a different parent (or to the project root) before deleting the Epic. The delete confirmation should mention how many descendants will be trashed (UX hook).

### 7.7 Soft-deleted task with subtasks — restoration semantics

A Task with 3 subtasks (1 done, 2 todo) is trashed. The Task and all 3 subtasks go to Trash. When the user restores the Task, the 3 subtasks come back in their previous states: 1 done, 2 todo.

If the user permanently deletes the Task from Trash, its subtasks are also permanently deleted (subtasks have no independent existence without their parent Task).

### 7.8 Calendar with 50+ tasks on one day

A day cell can become crowded. The spec commits: the calendar must handle a busy day gracefully — show a count indicator ("+12 more") with a tap-to-expand affordance, or let the cell scroll, or both. Exact treatment is a UX decision, but the engineering phase needs to know the calendar render will not assume bounded items per day.

### 7.9 Project with 500+ tasks

A hierarchical project with hundreds of items must render efficiently. The spec commits: virtualization or pagination of the tree view is acceptable; collapse-by-default for Epics with many descendants is acceptable. The user should be able to navigate without the app freezing. Engineering will need to budget for this.

### 7.10 Tag with 200+ tasks

Tag view is a flat list. Same scalability constraint as a busy project view. Virtualization or pagination is acceptable.

### 7.11 Quick-add fast path interactions

When the user types into the persistent quick-add and presses Enter, a modal opens. If the user has unsaved changes elsewhere (e.g., they were editing a different task's notes in another modal), what happens? The spec commits: only one modal open at a time; opening a new modal commits or cancels the prior one. UX decides the prompt behavior. Engineering should not assume multi-modal stacking.

### 7.12 Status field & overdue interplay

If a task's status is `in_progress` and it becomes overdue, it appears in the Overdue section of Today *and* in the In Progress column of its project's Kanban view. The two are not mutually exclusive — overdue is a date-derived signal, status is an explicit field.

### 7.13 Re-parenting across hierarchy depth

The depth cap is 4 levels (Epic → Feature → Task → Subtask). If the user tries to re-parent a Feature (with Tasks under it) under another Feature, that would create 5 levels — block the action with a clear error. The spec defers exact UI to UX, but the constraint is firm.

### 7.14 Inbox is special

Inbox cannot be deleted, renamed, moved into a folder, or have its `is_hierarchical` flag toggled (it is always flat — only Tasks live in Inbox). Tasks in Inbox have no project parent for hierarchy purposes but they still have `project_id = inbox_id`.

### 7.15 Empty-state surfaces

Every view must have a meaningful empty state — see UX hook list. The Today view empty state ("nothing due today") is particularly important since this is the default landing.

### 7.16 Multi-day item completed mid-span

The user creates "Write conference talk" with start_date = May 18, due_date = May 22. On May 19 they complete it. The item is marked done on May 19 and disappears from May 20, 21, 22's Today views. It does not somehow "stay open until May 22." If they need to track future work on it, they create a new task.

### 7.17 Recurring task that has been edited mid-cycle

The user has a recurring "Pay rent" task due June 1. On May 28 they edit the title to "Pay rent + utilities." The next instance (after they complete June 1) inherits the *latest* title and recurrence rule — there is no per-occurrence title override.

### 7.18 Items without due date — they cannot exist

By design, every Item has a required due_date. If the user tries to create one without one (e.g., via API in future, or via a buggy modal), the create is rejected. The Inbox can hold tasks but they still have due dates — Inbox is not "tasks without dates," it is "tasks without a project assignment."

---

## 8. Success criteria

After 2 to 4 weeks of real daily use, the user can honestly say:

1. **"I open Tasko first thing every morning and the Today view is enough to plan my day."** No reliance on a notification, no separate to-do list, no "let me check the other app." Today is the answer.

2. **"I can capture a task in under 5 seconds without breaking flow."** The quick-add modal is fast enough that the friction is in *deciding* what the task is, not in entering it.

3. **"I have at least one hierarchical project running and the Epic → Feature → Task structure feels useful, not bureaucratic."** Roll-up progress is visible. Re-parenting works. The hierarchy doesn't get in the way for small projects (because those projects don't opt in).

4. **"Multi-day work doesn't slip through the cracks."** The user has completed at least one multi-day task by the original due date because the Today view kept it visible across the span.

5. **"My overdue list is manageable, not a graveyard."** When the user comes back from a weekend or trip, the overdue surface + bulk-move-to-today gives them a way to clean up in under a minute. They are not afraid to open the app after a few days away.

6. **"Recurring tasks behave correctly."** Pay rent, water plants, weekly review — all roll forward on schedule. The user has not had to manually reschedule a recurrence.

7. **"Sync just works."** The user has used Tasko from at least two contexts (laptop + phone browser, or two browsers) and changes show up across them within a tolerable lag. No data has been silently lost or duplicated.

8. **"The Kanban and Calendar views earn their keep."** The user uses at least one of them regularly (not necessarily both). If they don't, that is a signal for v1.1 to reconsider their scope.

9. **"I haven't asked 'how do I undo that?' and gotten stuck."** Soft delete + Trash + un-check on completed tasks cover the recovery cases.

10. **"I trust the data."** The user has not lost a task. They have not been surprised by a sync conflict. They have not been confused about which device's edit won.

A failure on any single criterion is a v1.1 priority candidate. A failure on criterion 1 or 2 is an existential issue — the product isn't doing its core job.

---

## 9. Open questions & deferrals

### 9.1 Deferred to engineering phase

1. **Strict vs. loose typing of Epic / Feature / Task** — can a Feature be top-level? Can a Task have a child Task (creating a Task→Task chain rather than Subtask)? Can an Epic appear inside a Feature? The spec commits to a 4-level depth cap and the *intent* of Epic-as-top, Feature-as-middle, Task-as-leaf, but the *enforcement* level (UI hint vs. hard constraint) is an engineering decision.
2. **Tech stack** — local store technology (IndexedDB, SQLite-in-WASM, etc.), sync protocol (CRDT, OT, last-write-wins-per-field), backend architecture (single-region SaaS, self-hosted, serverless), framework choice, build tooling — all deferred.
3. **Sync conflict resolution semantics** — what happens when two offline edits land on the same field of the same task. Engineering picks the strategy (CRDT, manual conflict UI, last-write-wins) and the spec only commits that data is never silently lost.
4. **Roll-up progress computation** — eager vs. lazy compute, caching policy, propagation on subtask change. Engineering call.
5. **Virtualization / pagination thresholds** — at how many items per view does the engineering implementation switch to virtual scrolling? Not a product decision.
6. **Restoring partial Trash states** — when the user trashed some children of a parent individually *before* trashing the parent, and now restores the parent, do those independently-trashed children come back too? Engineering should pick a clear rule and document it.
7. **Bulk operations scope** — beyond "move all overdue to today," what bulk actions exist? (Bulk-select items in a view? Bulk-tag? Bulk-move to project?) Spec leaves this open; UX + engineering may converge on a minimal bulk set.

### 9.2 Deferred to UX phase

1. **Specific keyboard shortcut bindings** — including the global quick-add shortcut, navigation shortcuts, checkbox shortcuts.
2. **Visual treatment of overdue items** — color, icon, badge text, animation policy.
3. **Hierarchy indentation, expansion / collapse affordances** — tree view interaction details.
4. **Kanban card design** — what fields each card surfaces (title only? title + tag chips? title + priority?).
5. **Calendar event chip** — how multi-day spans look, how crowded days are handled visually.
6. **Modal layouts** — new-task modal, edit modal, confirmation prompts.
7. **Empty states** — exact treatment for every view's empty state.
8. **Microcopy** — every CTA, error message, empty state message, confirmation prompt.
9. **Color palette and dark mode tokens.**
10. **Density / spacing.**
11. **Focus states, hover affordances, drag handles.**
12. **Inline-vs-modal editing trade-off** — for fields like title and due date, is double-click-to-rename allowed inline, or does everything go through the modal?
13. **Re-parenting interaction** — drag-and-drop in the tree, modal-with-parent-picker, both.
14. **Folder interaction in sidebar** — drag-into-folder, modal-pick, both.
15. **Quick-add input scope** — does the persistent input on a per-project view default the new task's project to that project? (Strongly suggested yes — UX should confirm.)
16. **Per-project Kanban toggle UI** — how the user switches a project between list view and kanban view.
17. **Calendar per-project filter** — should the global calendar offer a project filter? (Open.)
18. **Notifications about overdue items on app open** — even without push, a soft "you have 5 overdue items" surface on the Today view's first paint. UX call.

### 9.3 Post-v1 (explicitly flagged as risks)

1. **Global search** — flagged as likely to feel limiting once the user has a few hundred tasks. Sidebar navigation alone may not scale. Strongly recommend revisiting for v1.1.
2. **Export / Import** — flagged as a real lock-in risk. The cloud-sync-as-backup story doesn't cover users who want to leave Tasko or who want a portable archive. Highly visible in any v1.1 prioritization.
3. **Reminders / Notifications** — without proactive nudging, Tasko relies entirely on the user opening it. If the user falls out of the habit, the product fails silently. Today view must be very strong to compensate. v1.1 candidate.
4. **Tag management** — orphan tags will accumulate; typos in tags will fragment the namespace. v1 ships without rename / merge / delete. The user pays for typos.
5. **Calendar + Kanban together in v1** — this is a significant scope expansion vs. a typical TickTick clone. **Flagged for engineering phase**: if implementation cost is high, one of these should be a stretch goal rather than a hard requirement. The product spec does not weaken the commitment, but the engineering plan should explicitly assess this.

### 9.4 Ambiguities — RESOLVED before UX phase

(All resolved in a user walkthrough after initial drafting. The resolutions below are now binding for downstream phases.)

1. **Kanban content scope — RESOLVED.** Per-project Kanban shows **only `type=task` items**. Epics and Features are containers and do not appear as cards on the kanban board. Subtasks also do not appear (they live nested under their parent Task in tree view only).

2. **Calendar scope — RESOLVED.** Calendar is a **global view across all projects**, with **optional filter chips** at the top of the calendar to narrow by project or tag. Filters are session-only (same convention as per-view filters).

3. **Tag input — RESOLVED.** Tags are added via a **dedicated "Tags" field in the task modal** — chip-style input with autocomplete from existing tags. `#tag` typed inside the title is **literal text**, not parsed. The leading `#` in the tag field is optional (the field accepts both `urgent` and `#urgent`).

4. **Today view content — RESOLVED.** Today is **strictly date-driven**. Status field (todo / in_progress / done) does not influence Today inclusion. An `in_progress` task scheduled for a future date does NOT surface in Today; it appears only in its project's Kanban / tree view and on the calendar.

5. **Re-opening a completed recurring task — RESOLVED.** Un-checking a completed recurring instance **only reopens that instance**. The auto-generated next instance is **not** deleted. User can manually delete the next instance from its project view if they no longer want it. Net effect: two active instances exist briefly.

6. **Subtask status values — RESOLVED.** Subtasks have **only {todo, done}** — no `in_progress`. Subtasks are not surfaced in Kanban (per #1), so the restricted status set is consistent with the rest of the system.

7. **Folders + non-folder projects — RESOLVED.** Projects can be moved **in and out of folders freely at any time**, including between folders. Tasks inside the project follow along automatically.

8. **Default-project setting + quick-add — RESOLVED.** The **"default project" setting is REMOVED entirely** from the v1 settings surface. Quick-add **always opens the modal with the Project field empty/focused**; the user must pick a project (or Inbox) before saving. This is true regardless of which view the user is on (Today, Project X, Calendar, etc.) — no view context auto-fills the field.

---

## 10. Hooks for the UX phase

The UX phase will need to design and decide:

### 10.1 Layout & navigation
- Sidebar structure: smart lists, projects, folders, tags, settings access, trash access.
- Sidebar density and color treatment of unread / overdue counts (e.g., "Today (5)").
- View-switcher UI within a project (List ↔ Kanban ↔ optional per-project Calendar).
- Top-of-view chrome: quick-add input, sort, filter chips, view-specific actions.
- Mobile responsive collapse pattern for the sidebar.

### 10.2 Item surfaces
- Task row in a list view: title, due indicator, priority indicator, tag chips, subtask count, status indicator. What is primary / secondary / tertiary in the row.
- Hierarchy indentation and expand / collapse affordances in the project tree.
- Kanban card design and the columns' visual weight.
- Calendar event chip — all-day, timed, multi-day span variants.
- Roll-up progress visual for Epics and Features.

### 10.3 States matrix per surface
- **Today view:** empty (nothing due today + no overdue), loading (initial app boot), error (sync failure), partial (some items still syncing), offline (using local data, sync paused).
- **Per-project view (hierarchical):** empty (no Epics yet), populated, deeply-nested.
- **Per-project view (flat):** empty, populated.
- **Calendar:** empty month, populated, busy day (50+ items), week view variations.
- **Kanban:** empty columns, busy "Done" column needing collapse.
- **Inbox:** empty, populated, large backlog.
- **Completed:** empty, populated, long history.
- **Trash:** empty, populated.
- **Tag view:** empty, populated.

### 10.4 Modals & prompts
- New-task modal — fields, layout, focus order, keyboard shortcuts.
- Edit-task modal — fields, markdown editor for notes (render vs. edit toggle).
- Confirmation prompts: parent completion blocking, delete confirmation, "move all overdue to today" confirmation.
- Tag autocomplete dropdown.

### 10.5 Microcopy
- Empty-state copy for every view (Today, project, calendar, etc.).
- CTAs: "Add task," "Add project," "Add Epic," "Add Feature," "Complete," "Reschedule," "Move to today," "Empty Trash," etc. — exact wording.
- Confirmation prompts: "This task has N incomplete subtasks. Complete all and continue?" exact wording.
- Sync indicator states: "Syncing," "Synced," "Offline — changes saved locally," etc.
- Error messages: "Couldn't save. Try again." or richer.
- "Move all overdue to today" affordance label.

### 10.6 Accessibility
- Keyboard navigation contract: can a keyboard-only user navigate the sidebar, open a view, quick-add a task, complete it, edit it, delete it? Specify the full key map.
- Screen reader expectations: every item row has a clear announcement format; views announce themselves on navigation.
- Color-only signals to avoid: overdue red, priority colors, status colors — all must have a non-color analogue (icon, badge text).
- Motion sensitivity: any animation on item check-off, modal open, etc. must respect `prefers-reduced-motion`.
- Touch targets for mobile browser.

### 10.7 Theming
- Light, dark, system tokens.
- Tag colors palette and assignment policy.
- Project / folder color palette.

### 10.8 Interaction details
- Drag-and-drop: calendar reschedule, kanban column change, item reorder, item re-parent.
- Inline edit vs. modal edit per field.
- Quick-add input's visual prominence on each view.
- Bulk selection (if any) — multi-select pattern.
- Mobile-specific affordances: swipe to complete, swipe to delete, long-press to multi-select.

### 10.9 First-run experience
- No-account onboarding sequence (since there are no accounts, this is purely about explaining the app, not collecting info).
- Sample data offer? (Suggestion: no — empty start, with strong empty-state copy. UX decides.)

### 10.10 Visual hierarchy of the Today view
This is the most important screen. UX must nail the layout so the user can, in a single glance, distinguish:
- Overdue items (urgent, may want bulk-action)
- Today's items (primary action surface)
- Multi-day in-progress (secondary, informational)
- Items they've already completed today (tertiary, may be hidden by default with toggle)

---

*End of spec.*
